#!/bin/sh
# Container entrypoint of the API image. Migrations are applied beforehand by the one-shot
# `migrate` compose service (Dockerfile target `migrator`); the API starts only after it
# completed successfully, so a failed migration never serves traffic (AC-07.1.7).
set -eu

# A provided DATABASE_URL wins. Otherwise build it from the POSTGRES_* parts (credentials are
# percent-encoded and never printed), so the compose file carries no password inside a URL.
if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$(node database-url.cjs)"
  export DATABASE_URL
fi

# Idempotent and deterministic (ADR-0004); it writes the demo data only when SEED_DEMO allows it.
# A failure stops the container, so a broken seed is never hidden behind a running API.
if [ "${SEED_ON_START:-true}" = "true" ]; then
  node dist/seed/run.js
fi

# OpenTelemetry must be loaded before the application code (ADR-0013).
exec node --import ./dist/instrumentation.js dist/main.js
