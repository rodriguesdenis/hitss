# ADR-0018 — Docker Compose one-command run

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** software-architect, devops-ci

## Context

Constitution §VII.1: with only Docker installed, `docker compose up` must yield a migrated, seeded, healthy API. The vision targets < 5 minutes from clone to running API. The brief asks for `start`, `test` and `seed` scripts and a README explaining how to run. Deployment/CD is explicitly out of scope; CI is in scope.

## Decision drivers

- One command, no local Node/pnpm required for the API path.
- Deterministic startup ordering (database ready before migrations).
- Small, secure production-like image.
- Optional heavy pieces (observability, Metro) must not slow the default path.
- Same images/commands in CI as locally.

## Considered options

### 1. Docker Compose with healthchecks, profiles and a migrating entrypoint (chosen)

- **+** Ubiquitous; one YAML readable in minutes; `depends_on: condition: service_healthy` orders startup.
- **+** Profiles keep optional stacks opt-in.
- **−** Not an orchestrator: no rolling updates or autoscaling (not needed).

### 2. Local tooling only (`pnpm dev` + a manually started Postgres)

- **+** Fast inner loop for developers.
- **−** Evaluator needs Node 24, pnpm and a Postgres — violates the one-command rule. Kept as the developer workflow, not the evaluation path.

### 3. Dev containers / Nix

- **+** Fully reproducible toolchain.
- **−** Requires specific editors or Nix knowledge; heavier ask for an evaluator.

### 4. Local Kubernetes (kind/minikube + Helm)

- **−** Far more moving parts than the problem; contradicts simplicity (constitution §IX).

## Decision outcome

**Services** (`docker-compose.yml`):

| Service                                                           | Profile         | Notes                                                                                                                                                    |
| ----------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `postgres`                                                        | default         | `postgres:17-alpine`, named volume, `healthcheck: pg_isready`.                                                                                           |
| `api`                                                             | default         | Built from `apps/api/Dockerfile`; `depends_on: postgres: condition: service_healthy`; healthcheck `GET /api/v1/health/ready`; port 3000.                 |
| `mobile`                                                          | `mobile`        | Node image running `expo start --tunnel` so a phone with Expo Go can load the bundle from anywhere; `EXPO_PUBLIC_API_URL` points at the host/tunnel URL. |
| SigNoz stack (collector, query service/UI, ClickHouse, ZooKeeper) | `observability` | ~4 GB RAM; API exports OTLP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set ([ADR-0013](0013-opentelemetry-and-signoz.md)).                                    |

**API image** (multi-stage):

1. `pruner`: `turbo prune @hitss/api --docker` → minimal `json/` + `full/` workspace.
2. `deps`: install with `pnpm install --frozen-lockfile` from `json/` (layer cached until lockfile changes).
3. `build`: copy `full/`, `prisma generate`, `turbo run build --filter=@hitss/api`, `pnpm deploy --prod` to an isolated folder.
4. `runtime`: `node:24-alpine`, `NODE_ENV=production`, **non-root** `node` user, only `dist/`, production `node_modules`, `prisma/` (schema, migrations, seed).

**Entrypoint:** `prisma migrate deploy` → seed (idempotent, skipped when `SEED_ON_START=false`) → `node --import ./dist/instrumentation.js dist/main.js`. Fails fast (non-zero exit) on migration error so Compose shows the failure.

**Configuration:** `.env.example` with safe local defaults (including a development-only `BETTER_AUTH_SECRET`); Compose reads `.env` if present. `@nestjs/config` validates env on boot (constitution §VII.3).

**Shortcuts:** `Makefile` — `make up`, `make down`, `make logs`, `make seed`, `make reset` (drop volume → up), `make obs-up`, `make mobile`, `make test`.

**CI (GitHub Actions) only, no CD:** lint, typecheck, unit, integration/E2E (Testcontainers), architecture rules, contract drift, `pnpm audit`, build of the API image (`docker build`, no push), and a smoke job that runs `docker compose up -d --wait` and calls `/api/v1/health/ready`.

## Consequences

**Positive**

- `git clone && docker compose up` gives a seeded API with the demo user; the README's cURL examples work immediately.
- Image is small, cache-friendly and runs as non-root.
- CI proves the one-command path on every PR.

**Negative**

- Running migrations in the entrypoint is fine for one replica but racy with many; production would run migrations as a separate release job.
- `--tunnel` depends on Expo's tunnel service (internet); LAN mode is documented as the alternative.

**Neutral**

- Developers can still run `pnpm dev` against the Compose Postgres for hot reload.

## Links

- [Spec 007 — CI and DX](../../specs/007-ci-and-dx/spec.md)
- [ADR-0001 — Monorepo](0001-monorepo-pnpm-turborepo.md) · [ADR-0004 — Prisma migrations and seed](0004-prisma-migrations-and-seeding.md)
- Turborepo Docker guide: https://turborepo.com/docs/guides/tools/docker
