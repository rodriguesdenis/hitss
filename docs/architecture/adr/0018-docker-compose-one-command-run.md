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

### 1. Docker Compose with healthchecks, profiles and a one-shot migration service (chosen)

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

| Service                                                           | Profile         | Notes                                                                                                                                                                       |
| ----------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `postgres`                                                        | default         | `postgres:17-alpine`, named volume, `healthcheck: pg_isready`.                                                                                                              |
| `migrate`                                                         | default         | One-shot, built from the `migrator` target of `apps/api/Dockerfile` (Prisma CLI + migrations); runs `prisma migrate deploy` once and exits; `restart: no`.                  |
| `api`                                                             | default         | Built from `apps/api/Dockerfile`; `depends_on: postgres: service_healthy` and `migrate: service_completed_successfully`; healthcheck `GET /api/v1/health/ready`; port 3000. |
| `mobile`                                                          | `mobile`        | Node image running `expo start --tunnel` so a phone with Expo Go can load the bundle from anywhere; `EXPO_PUBLIC_API_URL` points at the host/tunnel URL.                    |
| SigNoz stack (collector, query service/UI, ClickHouse, ZooKeeper) | `observability` | ~4 GB RAM; API exports OTLP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set ([ADR-0013](archive/0013-opentelemetry-and-signoz.md)).                                               |

**API image** (multi-stage, `apps/api/Dockerfile`, context = repository root):

1. `pruner`: `turbo prune @hitss/api --docker` → minimal `json/` + `full/` workspace.
2. `deps`: `pnpm fetch` + `pnpm install --frozen-lockfile --offline --ignore-scripts` from `json/` (layer cached until the lockfile changes; install scripts are skipped, `prisma generate` runs explicitly).
3. `build`: copy `full/`, `prisma generate`, `nest build`.
4. `migrator`: the `build` stage plus the runtime Prisma config and `docker-migrate.sh`; non-root; applies the migrations and exits. Never deployed.
5. `prod-deps`: `pnpm deploy --prod`, then `prune-cli.cjs` removes the Prisma CLI and `typescript`, which `@prisma/client` links as optional peers (the build fails if either is left over).
6. `runtime`: `node:24-alpine` (pinned minor and digest), `NODE_ENV=production`, **non-root** `node` user, root-owned read-only files: only `dist/` and the production `node_modules` — no CLI, schema, migrations, tests or `.env`.

**Migrations run in a separate one-shot service, not in the API entrypoint** (amended 2026-10-21). The Prisma CLI and its dependencies are ~380 MB of `node_modules`; shipping them in the API image made it 748 MB and left migration tooling inside the process that serves traffic. With the `migrate` service the API image is about 470 MB after also pruning the optional `typescript` peer (target < 500 MB; the `node:24-alpine` base alone is 244 MB and `@prisma/client` 71 MB), and the guarantee of AC-07.1.7 is kept differently: `migrate` exits non-zero on a failed migration, so Compose never starts `api` (`depends_on: migrate: condition: service_completed_successfully`). It also separates the two concerns the “racy with many replicas” note below was about: migrations are one explicit step, not a side effect of every replica starting.

**Entrypoints:** `docker-migrate.sh` (migrator) runs `prisma migrate deploy` and exits. `docker-entrypoint.sh` (API) runs the idempotent seed (skipped when `SEED_ON_START=false`; arrives with T-007-07) and then `node --import ./dist/instrumentation.js dist/main.js`. Both build `DATABASE_URL` from the `POSTGRES_*` variables when it is not provided, so `docker-compose.yml` never places a password inside a URL; the helper percent-encodes the credentials and never prints them.

**The migrator image is a build artifact, not a deployable service.** It is the full build stage (~1.2 GB: workspace, dev dependencies, compiler, the Prisma CLI and its engines), so it carries tooling an attacker could use. It must only be run as a short-lived job against the database — locally by Compose, in production by a release step — and must never be pushed to a registry as a service image or kept running; only the `runtime` image is deployed.

**Container hardening:** `api` and `migrate` run with `no-new-privileges`, all capabilities dropped, a read-only root filesystem and a tmpfs `/tmp`.

**Configuration:** `.env.example` with safe local defaults (including a development-only `BETTER_AUTH_SECRET`); Compose reads `.env` if present. `@nestjs/config` validates env on boot (constitution §VII.3).

**Shortcuts:** `Makefile` — `make up`, `make down`, `make logs`, `make seed`, `make reset` (drop volume → up), `make observability`, `make observability-down`, `make mobile`, `make test`.

**CI (GitHub Actions) only, no CD:** lint, typecheck, unit, integration/E2E (Testcontainers), architecture rules, contract drift, `pnpm audit`, build of the API image (`docker build`, no push), and a smoke job that runs `docker compose up -d --wait` and calls `/api/v1/health/ready`.

## Consequences

**Positive**

- `git clone && docker compose up` gives a seeded API with the demo user; the README's cURL examples work immediately.
- The API image is cache-friendly, runs as non-root with an immutable filesystem and contains no migration tooling (about 470 MB: 244 MB base + 71 MB `@prisma/client`).
- CI proves the one-command path on every PR.

**Negative**

- The `migrate` service is a single-host answer: production would run the same migrator image as a release job (or init step) before rolling out the API, never from several replicas at once.
- Two images are built from one Dockerfile (`migrator` is ~1.2 GB because it is the full build stage), which adds build time and disk locally.
- `--tunnel` depends on Expo's tunnel service (internet); LAN mode is documented as the alternative.

**Neutral**

- Developers can still run `pnpm dev` against the Compose Postgres for hot reload.

## Links

- [Spec 007 — CI and DX](../../specs/007-ci-and-dx/spec.md)
- [ADR-0001 — Monorepo](0001-monorepo-pnpm-turborepo.md) · [ADR-0004 — Prisma migrations and seed](0004-prisma-migrations-and-seeding.md)
- Turborepo Docker guide: https://turborepo.com/docs/guides/tools/docker
