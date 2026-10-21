#!/bin/sh
# Container entrypoint: apply migrations, then start the API. A failed migration stops the
# container with a non-zero exit code (AC-07.1.7); the API never serves on a half-migrated database.
set -eu

# A provided DATABASE_URL wins. Otherwise build it from the POSTGRES_* parts (credentials are
# percent-encoded and never printed), so the compose file carries no password inside a URL.
if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$(node database-url.cjs)"
  export DATABASE_URL
fi

node_modules/.bin/prisma migrate deploy --config prisma.runtime.config.cjs

# TODO(T-007-07): run the idempotent seed here when SEED_ON_START=true.
# TODO(T-006-01): start with `node --import ./dist/instrumentation.js` once instrumentation lands.
exec node dist/main.js
