# Runbook

Local operation of Teams & Tasks. Commands assume the repository root. Every `make` target prints its raw `docker compose` equivalent — use that on systems without `make` (e.g. Windows without WSL). Design: [spec 007](../specs/007-ci-and-dx/spec.md) · [plan](../specs/007-ci-and-dx/plan.md) · [ADR-0018](../architecture/adr/0018-docker-compose-one-command-run.md).

## Run

| Goal                                                       | Command                                                                                                                                                          |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start DB + API (migrate, seed, wait until healthy)         | `docker compose up --build` (foreground) · `make up` (background, waits for healthy)                                                                             |
| Stop (keep data)                                           | `make down`                                                                                                                                                      |
| Follow API logs                                            | `make logs`; human-readable: `docker compose logs -f api \| npx pino-pretty`, or run the API on the host with `LOG_PRETTY=true` (the image has no `pino-pretty`) |
| Re-apply demo data                                         | `make seed`                                                                                                                                                      |
| Wipe everything and start fresh                            | `make reset`                                                                                                                                                     |
| Smoke test (stop the dev stack first: ports 3000 and 5432) | `make smoke`                                                                                                                                                     |
| Expo dev server for Expo Go (optional, profile `mobile`)   | `make mobile` · see [Mobile dev server](#mobile-dev-server-optional)                                                                                             |
| Status                                                     | `docker compose ps` (look for `healthy`)                                                                                                                         |

URLs once healthy:

- API: http://localhost:3000/api/v1 · Swagger UI: http://localhost:3000/docs · OpenAPI: http://localhost:3000/docs/openapi.json
- Readiness: http://localhost:3000/api/v1/health/ready
- Demo account: `demo@teams-tasks.dev` / `Demo@1234`

Settings: none required. To override, create `.env` from `.env.example` (compose reads it automatically) or prefix the command: `API_PORT=3100 make up`.

## Mobile dev server (optional)

Runs Metro (the Expo dev server) in a container so the app opens in **Expo Go** on a phone with only Docker installed. It is behind the compose profile `mobile`: a plain `docker compose up` / `make up` never starts it.

```sh
make up                                                        # the API the app talks to
EXPO_PUBLIC_API_URL=http://192.168.0.10:3000 make mobile       # = docker compose --profile mobile up --build mobile
```

The terminal shows a QR code: scan it with Expo Go (Android) or the Camera app (iOS). Stop with `Ctrl+C`. Settings come from the shell or `.env` (see `.env.example`); the image never contains a `.env` file.

**Point the app at the API (`EXPO_PUBLIC_API_URL`).** The app calls this origin from the phone, so `localhost` means the phone itself. It is read when Metro bundles the app; after changing it, stop and run `make mobile` again.

| Where the app runs                     | `EXPO_PUBLIC_API_URL`                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Phone on the same Wi-Fi                | `http://<this computer's LAN IP>:3000` (the API is published on `0.0.0.0`, `API_BIND`)   |
| Android emulator on this computer      | `http://10.0.2.2:3000`                                                                   |
| iOS simulator on this computer         | `http://localhost:3000` (the default)                                                    |
| Phone on another network (mobile data) | an API origin the phone can reach from the internet; the Metro tunnel does not carry API |

**How Expo Go reaches Metro (`EXPO_DEV_MODE`).**

| Mode               | Use when                                              | Trade-off                                                                                                                                                                                                                                                                                                                                                        |
| ------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tunnel` (default) | the phone is on another network, or the LAN blocks it | Works from anywhere without firewall changes, but goes through Expo's ngrok tunnel (a third-party service): slower reloads and an outage there stops it. It exposes Metro only, never the API, but anyone with the tunnel URL can download the dev bundle (the app source and its `EXPO_PUBLIC_*` values; no secrets today): stop it (`Ctrl+C`) when not in use. |
| `lan`              | phone and computer on the same Wi-Fi                  | Fast and local, but needs `REACT_NATIVE_PACKAGER_HOSTNAME=<this computer's LAN IP>` (inside the container Expo only sees the container IP, which the phone cannot reach), `METRO_BIND=0.0.0.0` (Metro is published on `127.0.0.1` by default) and port 8081 open on the host firewall.                                                                           |
| `localhost`        | an emulator or simulator on this computer             | Nothing leaves the machine; no phone can connect.                                                                                                                                                                                                                                                                                                                |

```sh
EXPO_DEV_MODE=lan METRO_BIND=0.0.0.0 REACT_NATIVE_PACKAGER_HOSTNAME=192.168.0.10 \
  EXPO_PUBLIC_API_URL=http://192.168.0.10:3000 make mobile
```

**Windows with WSL 2.** Use `networkingMode=mirrored` in `%UserProfile%\.wslconfig`: WSL then shares the Windows network interfaces, so the LAN IP to use is the Windows one (`ipconfig`, the Wi-Fi adapter) and published ports are reachable on it. Inbound connections to WSL also pass the Hyper-V firewall; allow only the two ports once, in an elevated PowerShell:

```powershell
New-NetFirewallHyperVRule -Name expo-dev -DisplayName "Expo Metro and Teams & Tasks API" -Direction Inbound -VMCreatorId '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -Protocol TCP -LocalPorts 8081,3000
```

The tunnel mode needs none of this.

**Expo Go cannot connect.** Check the QR's address: in `lan` mode it must be `exp://<LAN IP>:8081`; otherwise set `REACT_NATIVE_PACKAGER_HOSTNAME`. If the bundle loads but every request fails, `EXPO_PUBLIC_API_URL` is not reachable from the phone: open `<that URL>/api/v1/health/live` in the phone's browser. If the tunnel does not start, retry or switch to `lan`.

## Common failures

### Port already in use

Symptom: `Bind for 0.0.0.0:3000 failed: port is already allocated` (or `:5432`).

1. Find the process: `lsof -i :3000` (macOS/Linux) · `netstat -ano | findstr :3000` (Windows).
2. Stop it, or choose another port: `API_PORT=3100 make up`, `POSTGRES_PORT=5433 make up`.
3. If the API port changes, update the Bruno environment `baseUrl` and the `.http` files' host.

A local PostgreSQL installation commonly holds `5432` — `POSTGRES_PORT=5433` avoids it (the API talks to the container over the compose network and is unaffected).

### Database not healthy / API waiting

Symptom: `api` stays `waiting` or `dependency failed to start: container teams-tasks-postgres-1 is unhealthy`.

1. `docker compose logs postgres` — look for `FATAL`.
2. Stale volume created with different credentials (`password authentication failed`): the volume keeps the first credentials. Run `make reset` (deletes data) or restore the original `POSTGRES_*` values.
3. Disk full: `docker system df`; free with `docker system prune` (careful: removes unused images/volumes).
4. Slow machine: the healthcheck allows ~60 s; check `docker compose ps` again.

### API unhealthy or restarting

1. `docker compose logs migrate api | tail -50` (migrations run in the one-shot `migrate` service; if it failed, the `api` container never starts).
2. `Invalid configuration: <VAR> …` → fix the named variable in `.env` (or delete `.env` to fall back to defaults).
3. `prisma migrate deploy` error (`P3009` failed migration, `P1001` can't reach DB) → `make reset` for local data; for a genuinely broken migration fix it in a new migration (never edit an applied one).
4. Production-rule errors (`APP_ENV=production`): `BETTER_AUTH_SECRET` is the local default, `BETTER_AUTH_URL` not https, `CORS_ORIGINS` has `*`/`http://`/`localhost`, `AUTH_RATE_LIMIT_ENABLED=false`, `SEED_DEMO=true` → fix the named variable, or use `APP_ENV=local` locally (`NODE_ENV` is always `production` inside the image; only `APP_ENV` selects these rules). `DOCS_ENABLED` is forced off in production, so `/docs` is 404 there.
5. `APP_SCHEME` must be a lower-case custom scheme such as `teamstasks`; `exp`, `http(s)` and `file` are rejected in every environment, not only in production.
6. Readiness `503` with `database: down` → DB unreachable; see the previous section.

### Requests return 401

- Token missing/expired: sign in again (`POST /api/auth/sign-in/email`), read the `set-auth-token` header, send `Authorization: Bearer <token>`.
- Cookie only: `/api/v1` accepts **Bearer tokens only** ([ADR-0020](../architecture/adr/0020-simplify-architecture-for-the-hiring-test.md)); a request that carries just the session cookie answers `401 UNAUTHENTICATED`. Send the `Authorization` header (Bruno and the `.http` files do).
- After `make reset` all sessions are gone — sign in again in the app/Bruno.

### Requests return 429

Rate limit: `RATE_LIMIT_MAX` (default 100) req/min per user, `RATE_LIMIT_IP_MAX` (default 300) req/min per client IP checked before authentication, and, on `/api/auth/*`, 10 req/min per IP on each credential route (sign-up, sign-in, sign-out) and 100 req/min per IP on `get-session`. Wait for `Retry-After` seconds (`X-Retry-After` on `/api/auth/*`, set by Better Auth's limiter; `AUTH_RATE_LIMIT_ENABLED=false` turns that limiter off outside production). For a load test, raise `RATE_LIMIT_MAX` and `RATE_LIMIT_IP_MAX` for that run.

**Docker Desktop / WSL2 caveat.** On Docker Desktop (macOS, Windows, WSL2) published ports go through a NAT/userland proxy, so the API usually sees **one client IP (the gateway, e.g. `172.x.0.1` / `192.168.65.1`) for all traffic coming from the host** — Bruno, the app, `curl` and a phone on the LAN. The per-IP limits then act as one shared bucket for everything you run locally, and a burst from one tool can cause `429` in another. This is expected and local-only (native Linux Docker shows real addresses; behind a real proxy set `TRUSTED_PROXIES`). Workarounds: wait for `Retry-After`, sign in once and reuse the token, or raise the limits for a session: `RATE_LIMIT_IP_MAX=1000 make up`. Do not trust client-sent `X-Forwarded-For` / `x-tt-client-ip` to work around it — the API ignores them.

### No traces arrive at my collector

Telemetry is off unless `OTEL_EXPORTER_OTLP_ENDPOINT` is set; see [observability](observability.md).

1. The API container must see the variable: `docker compose exec api printenv OTEL_EXPORTER_OTLP_ENDPOINT` (set it in `.env` and `docker compose up -d`).
2. `OTEL_SDK_DISABLED` must not be `true`; a per-signal endpoint (`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`) alone does not start the exporter.
3. The endpoint must be reachable **from the API container** (`localhost` there is the container itself); a down collector never affects requests but drops the spans.
4. Spans are batched: wait about 5 s, then search by service `teams-tasks-api` or the `traceId` from a log line.

### Build is slow or fails on install

- First build downloads base images and packages (~2–4 min). Subsequent builds use BuildKit caches.
- `ERR_PNPM_OUTDATED_LOCKFILE` → someone changed a `package.json` without the lockfile: `pnpm install` and commit `pnpm-lock.yaml`.
- `exec ./docker-entrypoint.sh: no such file or directory` on Windows → CRLF line endings; `git config core.autocrlf false` and re-clone (`.gitattributes` pins `*.sh` to LF).

## Reset the database

| Need                              | Command                                            | Data        |
| --------------------------------- | -------------------------------------------------- | ----------- |
| Restore demo records, keep my own | `make seed`                                        | kept        |
| Fresh DB with only demo data      | `make reset` (`docker compose down -v && make up`) | **deleted** |
| Start without demo data           | `SEED_ON_START=false make reset`                   | empty       |

## Logs

```bash
make logs                                   # follow API logs (JSON)
docker compose logs --since 10m api         # last 10 minutes
docker compose logs api | grep '"level":50' # errors only
docker compose logs api | grep <traceId>    # one request (traceId from an error envelope)
docker compose logs api | jq -c 'select(.res.statusCode >= 500)'   # with jq
LOG_LEVEL=debug make up                     # more detail (restart the api)
```

The `route` field of the request completion line comes from `shared/observability/logging/route-template.ts`, which depends on Express 5 routing internals (`req.route` assignments). If an Express or Nest upgrade makes `route` show `{/*splat}` or the raw path, the `/api/v1/tasks/:id` test in `test/unit/shared/observability/logging/logger.config.spec.ts` fails; fix `route-template.ts` rather than loosening the test.

`LOG_PRETTY=true` needs the dev-only `pino-pretty`; without it (the production image) the API logs JSON and prints one warning. `APP_ENV=production` refuses `LOG_PRETTY=true`.

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
docker compose down -v --rmi local
```
