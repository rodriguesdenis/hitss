#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

pnpm api-client:generate

if git diff --quiet -- packages/api-client && [ -z "$(git status --porcelain -- packages/api-client)" ]; then
  echo "api-client: the committed contract and generated client match the API"
  exit 0
fi

echo "::error::packages/api-client is stale: run 'pnpm api-client:generate' and commit the result"
git status --porcelain -- packages/api-client
git diff --stat -- packages/api-client
git diff -- packages/api-client | head -n 200
exit 1
