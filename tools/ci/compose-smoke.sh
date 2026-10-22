#!/usr/bin/env bash
# Compose smoke test (T-007-09): proves the evaluator's one command on every pull request.
#   tools/ci/compose-smoke.sh
# Builds the images from the commit, starts the stack with `docker compose up -d --build --wait`,
# and checks it the way an evaluator would. Always tears the stack down; prints the logs on failure.
set -euo pipefail
cd "$(dirname "$0")/../.."

export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-teams-tasks-smoke}"
API_PORT="${API_PORT:-3000}"
TMP="$(mktemp -d)"
STEP=0

log() { STEP=$((STEP + 1)); printf '\n==> [%d] %s\n' "$STEP" "$*"; }
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
summary() { [ -z "${GITHUB_STEP_SUMMARY:-}" ] || printf '%s\n' "$@" >> "$GITHUB_STEP_SUMMARY"; }

cleanup() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    echo '--- docker compose ps -a'; docker compose ps -a || true
    echo '--- docker compose logs'; docker compose logs --no-color --tail=200 || true
  fi
  docker compose down -v --remove-orphans > /dev/null 2>&1 || true
  rm -rf "$TMP"
  exit "$status"
}
trap cleanup EXIT

container() { docker compose ps -aq "$1" | head -n 1; }
state_of() { docker inspect -f "$2" "$(container "$1")"; }

# An HTTP answer (any status) proves the server is up; the routes themselves arrive with spec 001.
http_status() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$1/api/v1/" || true; }

assert_http_up() {
  local code
  code="$(http_status "$1")"
  [[ "$code" =~ ^[1-5][0-9][0-9]$ ]] || fail "no HTTP answer from the API on port $1 (got '$code')"
  echo "API answers on port $1 (HTTP $code)"
}

log 'start from scratch: docker compose up -d --build --wait (AC-07.1.1, AC-07.6.8)'
docker compose down -v --remove-orphans > /dev/null 2>&1 || true
START=$SECONDS
docker compose up -d --build --wait
COLD=$((SECONDS - START))
echo "cold start: ${COLD}s"
summary "### Compose smoke" "" "| Check | Result |" "| --- | --- |" "| Cold start (\`up -d --build --wait\`) | ${COLD} s (AC-07.1.8: under 300 s) |"
[ "$COLD" -le 300 ] || echo "::warning::cold start took ${COLD}s (AC-07.1.8 expects under 5 minutes)"

log 'services: postgres and api healthy, migrate exited 0'
[ "$(state_of postgres '{{.State.Health.Status}}')" = healthy ] || fail 'postgres is not healthy'
[ "$(state_of api '{{.State.Health.Status}}')" = healthy ] || fail 'api is not healthy'
[ "$(state_of migrate '{{.State.Status}} {{.State.ExitCode}}')" = 'exited 0' ] || fail 'migrate did not exit 0'

log 'the API answers over HTTP on the default port (AC-07.6.8)'
assert_http_up "$API_PORT"
# TODO(T-001-08, T-006-03, T-007-07): assert GET /api/v1/health/ready is 200, /docs is 200, sign in
# as the demo user and check 3 teams and 10 tasks (AC-07.6.8) once those routes and the seed exist.

log 'the API image is unprivileged and minimal (AC-07.1.6)'
[ "$(docker compose exec -T api id -u)" != 0 ] || fail 'the API runs as root'
docker compose exec -T api sh -c '
  cd /app
  for path in src test .env .git .npmrc node_modules/.bin/prisma node_modules/prisma node_modules/typescript; do
    [ ! -e "$path" ] || { echo "unexpected /app/$path"; exit 1; }
  done
  ! command -v npm > /dev/null || { echo "npm is present"; exit 1; }
  ! touch /app/.write-test 2> /dev/null || { echo "/app is writable"; exit 1; }
  grep -q "CapEff:.0000000000000000" /proc/self/status || { echo "capabilities not dropped"; exit 1; }
'

log 'docker compose stop api exits 0 and the container exited cleanly'
docker compose stop api
[ "$(state_of api '{{.State.ExitCode}}')" = 0 ] || fail 'the API did not shut down cleanly (exit code != 0)'
docker compose down -v --remove-orphans

log "a busy default port is avoided through API_PORT=3100 (AC-07.1.5)"
API_PORT=3100 docker compose up -d --build --wait
assert_http_up 3100
docker compose down -v --remove-orphans

if [ "${OTEL_SDK_DISABLED:-false}" = true ]; then
  echo "skipped: OTEL_SDK_DISABLED=true"
else
  log 'the built image exports a trace to an OTLP sink: the --import telemetry hand-off works (AC-06.2.1, AC-06.2.6)'
  # The sink runs on the Node image the API Dockerfile pins (ARG NODE_IMAGE).
  SINK_IMAGE="$(sed -n 's/^ARG NODE_IMAGE=//p' apps/api/Dockerfile)"
  cat > "$TMP/otlp-sink.yml" << YAML
services:
  otlp-sink:
    image: $SINK_IMAGE
    command: ["node", "/sink.mjs"]
    volumes:
      - $PWD/tools/ci/otlp-sink.mjs:/sink.mjs:ro
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:4318/').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 2s
      timeout: 3s
      retries: 15
  api:
    depends_on:
      otlp-sink:
        condition: service_healthy
    environment:
      OTEL_EXPORTER_OTLP_ENDPOINT: http://otlp-sink:4318
      OTEL_BSP_SCHEDULE_DELAY: "500"
YAML
  export COMPOSE_FILE="docker-compose.yml:$TMP/otlp-sink.yml"
  docker compose up -d --wait
  assert_http_up "$API_PORT"
  # Traces are batched (500 ms here); metrics follow the SDK's 15 s export interval, hence 45 tries.
  SEEN=no
  for _ in $(seq 1 45); do
    curl -s -o /dev/null --max-time 5 "http://127.0.0.1:$API_PORT/api/v1/" || true
    SINK_LOG="$(docker compose logs --no-color otlp-sink 2> /dev/null)"
    if grep -q 'TRACE_RECEIVED service=teams-tasks-api' <<< "$SINK_LOG" \
      && grep -q 'METRICS_RECEIVED service=teams-tasks-api' <<< "$SINK_LOG"; then
      SEEN=yes
      break
    fi
    sleep 1
  done
  [ "$SEEN" = yes ] || fail 'the sink did not receive both a trace and a metrics export for teams-tasks-api: the image does not export telemetry (is the entrypoint still loading dist/instrumentation.js with --import?)'
  echo "the sink received a trace and a metrics export for teams-tasks-api"
  summary "| Telemetry hand-off: the sink received a trace and a metrics export for \`teams-tasks-api\` | passed |"
  docker compose down -v --remove-orphans
  unset COMPOSE_FILE
fi

log 'a failing migration stops the stack: migrate exits non-zero, the API never starts (AC-07.1.7)'
mkdir -p "$TMP/migrations/20260101000000_not_sql"
printf 'provider = "postgresql"\n' > "$TMP/migrations/migration_lock.toml"
printf 'THIS IS NOT SQL;\n' > "$TMP/migrations/20260101000000_not_sql/migration.sql"
cat > "$TMP/bad-migration.yml" << YAML
services:
  migrate:
    volumes:
      - $TMP/migrations:/repo/apps/api/prisma/migrations:ro
YAML
export COMPOSE_FILE="docker-compose.yml:$TMP/bad-migration.yml"
if docker compose up -d --wait; then fail 'the stack came up although a migration is invalid'; fi
CODE="$(state_of migrate '{{.State.ExitCode}}')"
[ "$CODE" != 0 ] || fail 'migrate exited 0 on an invalid migration'
API_STATE="$(docker compose ps -a --format '{{.State}}' api)"
case "$API_STATE" in ''|created) echo "migrate exit code $CODE; api state: ${API_STATE:-absent}";; *) fail "the API was started (state: $API_STATE)";; esac
docker compose down -v --remove-orphans
unset COMPOSE_FILE

# The URL is assembled from parts at runtime: no literal credentials in this source.
DB_USER=x; DB_PASSWORD=x
UNREACHABLE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:1/x"

# Runs a service against an unreachable database; it must fail by itself (exit code other than 0
# and than 124, timeout's own code, which would mean it hung) within 60 seconds.
expect_fast_failure() {
  local service="$1" started=$SECONDS code=0 elapsed
  timeout 60 docker compose run --rm --no-deps -e "DATABASE_URL=$UNREACHABLE_URL" "$service" || code=$?
  elapsed=$((SECONDS - started))
  [ "$code" -ne 0 ] || fail "$service started without a reachable database"
  [ "$code" -ne 124 ] || fail "$service hung for ${elapsed}s instead of failing fast"
  echo "$service failed fast: exit code $code after ${elapsed}s"
  summary "| Unreachable database: \`$service\` exits $code after ${elapsed} s | passed |"
}

log 'an unreachable database makes migrate exit non-zero quickly (AC-07.1.7)'
expect_fast_failure migrate

log 'an unreachable database makes the API fail fast on boot (AC-07.1.7)'
expect_fast_failure api

summary "| Services healthy, migrate exited 0, HTTP answer | passed |" \
  "| Non-root user, minimal read-only image, no capabilities | passed |" \
  "| \`docker compose stop api\` exits 0 | passed |" \
  "| \`API_PORT=3100\` | passed |" \
  "| Failing migration: migrate fails, API never starts | passed |"
echo; echo 'Compose smoke passed.'
