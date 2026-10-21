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

# TODO(T-007-07): run the idempotent seed here when SEED_ON_START=true.
# TODO(T-006-01): start with `node --import ./dist/instrumentation.js` once instrumentation lands.
exec node dist/main.js
