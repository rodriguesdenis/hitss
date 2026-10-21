#!/bin/sh
# Entrypoint of the one-shot `migrate` service: apply the Prisma migrations and exit. A failed
# migration exits non-zero, so the API (which waits for this service to complete successfully)
# never starts on a half-migrated database (AC-07.1.7).
set -eu

# A provided DATABASE_URL wins. Otherwise build it from the POSTGRES_* parts (credentials are
# percent-encoded and never printed), so the compose file carries no password inside a URL.
if [ -z "${DATABASE_URL:-}" ]; then
  DATABASE_URL="$(node database-url.cjs)"
  export DATABASE_URL
fi

exec node_modules/.bin/prisma migrate deploy --config prisma.runtime.config.cjs
