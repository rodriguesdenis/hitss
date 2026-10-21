# Runbook

Local operation of Teams & Tasks. Commands assume the repository root. Every `make` target prints its raw `docker compose` equivalent — use that on systems without `make` (e.g. Windows without WSL). Design: [spec 007](../specs/007-ci-and-dx/spec.md) · [plan](../specs/007-ci-and-dx/plan.md) · [ADR-0018](../architecture/adr/0018-docker-compose-one-command-run.md).

## Run

| Goal                                               | Command                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Start DB + API (migrate, seed, wait until healthy) | `docker compose up --build` (foreground) · `make up` (background, waits for healthy) |
| Stop (keep data)                                   | `make down`                                                                          |
| Follow API logs                                    | `make logs` (`LOG_PRETTY=true make up` for human-readable logs)                      |
| Re-apply demo data                                 | `make seed`                                                                          |
| Wipe everything and start fresh                    | `make reset`                                                                         |
| With SigNoz (≈ 4 GB RAM)                           | `make observability` → http://localhost:8080                                         |
| Mobile dev server (Expo Go QR)                     | `make mobile` (see [mobile on a device](#expo-device-cant-reach-the-api))            |
| Smoke / load test                                  | `make smoke` · `make load`                                                           |
| Status                                             | `docker compose ps` (look for `healthy`)                                             |

URLs once healthy:

- API: http://localhost:3000/api/v1 · Swagger UI: http://localhost:3000/docs · OpenAPI: http://localhost:3000/docs/openapi.json
- Readiness: http://localhost:3000/api/v1/health/ready
- Demo account: `demo@teams-tasks.dev` / `Demo@1234`

Settings: none required. To override, create `.env` from `.env.example` (compose reads it automatically) or prefix the command: `API_PORT=3100 make up`.

## Common failures

### Port already in use

Symptom: `Bind for 0.0.0.0:3000 failed: port is already allocated` (or `:5432`, `:8081`, `:8080`).

1. Find the process: `lsof -i :3000` (macOS/Linux) · `netstat -ano | findstr :3000` (Windows).
2. Stop it, or choose another port: `API_PORT=3100 make up`, `POSTGRES_PORT=5433 make up`.
3. If the API port changes, update the app's `EXPO_PUBLIC_API_URL` and the Bruno environment `baseUrl`.

A local PostgreSQL installation commonly holds `5432` — `POSTGRES_PORT=5433` avoids it (the API talks to the container over the compose network and is unaffected).

### Database not healthy / API waiting

Symptom: `api` stays `waiting` or `dependency failed to start: container teams-tasks-postgres-1 is unhealthy`.

1. `docker compose logs postgres` — look for `FATAL`.
2. Stale volume created with different credentials (`password authentication failed`): the volume keeps the first credentials. Run `make reset` (deletes data) or restore the original `POSTGRES_*` values.
3. Disk full: `docker system df`; free with `docker system prune` (careful: removes unused images/volumes).
4. Slow machine: the healthcheck allows ~60 s; check `docker compose ps` again.

### API unhealthy or restarting

1. `docker compose logs api | tail -50`.
2. `Invalid configuration: <VAR> …` → fix the named variable in `.env` (or delete `.env` to fall back to defaults).
3. `prisma migrate deploy` error (`P3009` failed migration, `P1001` can't reach DB) → `make reset` for local data; for a genuinely broken migration fix it in a new migration (never edit an applied one).
4. Production-rule errors (`APP_ENV=production`): `BETTER_AUTH_SECRET` is the local default, `BETTER_AUTH_URL` not https, `CORS_ORIGINS` has `*`/`http://`/`localhost`, `AUTH_RATE_LIMIT_ENABLED=false`, `APP_SCHEME=exp`, `SEED_DEMO=true` → fix the named variable, or use `APP_ENV=local` locally (`NODE_ENV` is always `production` inside the image; only `APP_ENV` selects these rules). `DOCS_ENABLED` is forced off in production, so `/docs` is 404 there.
5. Readiness `503` with `database: down` → DB unreachable; see the previous section.

### Expo device can't reach the API

Symptom: the app on a phone shows network errors/timeouts; on an emulator it works.

- `localhost` on the phone is the phone itself. Use your computer's LAN IP:
  1. Find it: `ipconfig getifaddr en0` (macOS) · `hostname -I` (Linux) · `ipconfig` (Windows).
  2. `EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 make mobile` (restart Metro after changing `EXPO_PUBLIC_*`; they are inlined at bundle time — clear with `expo start -c` if stale).
  3. Phone and computer on the same Wi-Fi; corporate/guest Wi-Fi often isolates clients — use a hotspot.
  4. Firewall: allow inbound TCP 3000 (macOS: System Settings → Network → Firewall; Windows Defender: allow Docker/`com.docker.backend`).
- Emulators: Android emulator → `http://10.0.2.2:3000`; iOS simulator → `http://localhost:3000`.
- `--tunnel` only exposes **Metro** (the JS bundle), not the API. A phone on mobile data can load the app but still needs a reachable API URL.
- QR not visible in `make mobile`: the service runs with a TTY; run `docker compose --profile mobile up mobile` in the foreground, or open the `exp://…` URL printed in the logs manually in Expo Go.
- Tunnel fails (`ngrok tunnel took too long to connect`): retry, or use LAN mode: `docker compose --profile mobile run --rm --service-ports mobile pnpm --filter @hitss/mobile exec expo start --lan` (requires host networking reachability).

### Requests return 401

- Token missing/expired: sign in again (`POST /api/auth/sign-in/email`), read the `set-auth-token` header, send `Authorization: Bearer <token>`.
- After `make reset` all sessions are gone — sign in again in the app/Bruno.

### Requests return 429

Rate limit: `RATE_LIMIT_MAX` (default 100) req/min per user, `RATE_LIMIT_IP_MAX` (default 300) req/min per client IP checked before authentication, and 10 req/min per IP on credential routes. Wait for `Retry-After` seconds. For load tests use `make load` (raises `RATE_LIMIT_MAX` and `RATE_LIMIT_IP_MAX` for that run).

**Docker Desktop / WSL2 caveat.** On Docker Desktop (macOS, Windows, WSL2) published ports go through a NAT/userland proxy, so the API usually sees **one client IP (the gateway, e.g. `172.x.0.1` / `192.168.65.1`) for all traffic coming from the host** — Bruno, the app, `curl` and a phone on the LAN. The per-IP limits then act as one shared bucket for everything you run locally, and a burst from one tool can cause `429` in another. This is expected and local-only (native Linux Docker shows real addresses; behind a real proxy set `TRUSTED_PROXIES`). Workarounds: wait for `Retry-After`, sign in once and reuse the token, or raise the limits for a session: `RATE_LIMIT_IP_MAX=1000 make up`. Do not trust client-sent `X-Forwarded-For` / `x-tt-client-ip` to work around it — the API ignores them.

### SigNoz shows nothing

1. `docker compose --profile observability ps` — all `healthy`/`running`; the schema migrator must have exited `0`.
2. API not exporting: `OTEL_SDK_DISABLED` must be `false`; endpoint `http://signoz-otel-collector:4318`.
3. Wait 15–30 s (batch export interval); refresh with a time range of "last 15 minutes".
4. Out of memory: `docker stats` — ClickHouse needs ~2–3 GB; raise Docker Desktop memory to ≥ 6 GB.

### Build is slow or fails on install

- First build downloads base images and packages (~2–4 min). Subsequent builds use BuildKit caches.
- `ERR_PNPM_OUTDATED_LOCKFILE` → someone changed a `package.json` without the lockfile: `pnpm install` and commit `pnpm-lock.yaml`.
- `exec ./docker-entrypoint.sh: no such file or directory` on Windows → CRLF line endings; `git config core.autocrlf false` and re-clone (`.gitattributes` pins `*.sh` to LF).

## Reset the database

| Need                              | Command                                                                     | Data        |
| --------------------------------- | --------------------------------------------------------------------------- | ----------- |
| Restore demo records, keep my own | `make seed`                                                                 | kept        |
| Fresh DB with only demo data      | `make reset` (`docker compose down -v && make up`)                          | **deleted** |
| From the host toolchain           | `pnpm db:reset` (drops, migrates, seeds via `prisma migrate reset --force`) | **deleted** |
| Start without demo data           | `SEED_ON_START=false make reset`                                            | empty       |

## Logs

```bash
make logs                                   # follow API logs (JSON)
docker compose logs --since 10m api         # last 10 minutes
docker compose logs api | grep '"level":50' # errors only
docker compose logs api | grep <traceId>    # one request (traceId from an error envelope)
docker compose logs api | jq -c 'select(.res.statusCode >= 500)'   # with jq
LOG_LEVEL=debug make up                     # more detail (restart the api)
```

Logs never contain passwords, tokens or cookies; if you ever see one, treat it as a security bug ([threat model I-03](../security/threat-model.md#information-disclosure)).

## Inspect the database

```bash
docker compose exec postgres psql -U teams -d teams_tasks
# \dt                          list tables
# select status, count(*) from tasks where deleted_at is null group by 1;
```

Or connect a GUI to `localhost:${POSTGRES_PORT:-5432}` with `teams` / `teams`.

## Clean up everything

```bash
docker compose --profile observability --profile mobile --profile load down -v --rmi local
```
