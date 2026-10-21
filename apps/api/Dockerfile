# syntax=docker/dockerfile:1.7
# Teams & Tasks API image (ADR-0018): pruned workspace -> cached dependency layer -> build ->
# small non-root runtime. Build context is the repository root:
#   docker build -f apps/api/Dockerfile .

# Pinned minor + digest; Dependabot (docker ecosystem) proposes bumps.
ARG NODE_IMAGE=node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
# openssl: required by Prisma's schema engine on Alpine.
RUN apk add --no-cache openssl && corepack enable
WORKDIR /repo

# 1. Prune the monorepo to what @hitss/api needs (manifests + lockfile first, sources second).
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.10 prune @hitss/api --docker

# 2. Dependencies: cached until a manifest or the lockfile changes. Install scripts are skipped
#    (D-1); prisma generate runs explicitly in the build stage.
FROM base AS deps
COPY --from=pruner /repo/out/json/ ./
COPY --from=pruner /repo/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch --frozen-lockfile
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --offline --ignore-scripts

# 3. Build: generate the Prisma client and compile. The build stage keeps the whole workspace,
#    including the Prisma CLI, and is the base of the migrator.
FROM deps AS build
COPY --from=pruner /repo/out/full/ ./
RUN pnpm --filter @hitss/api exec prisma generate \
 && pnpm --filter @hitss/api run build

# 4. Migrator: applies the SQL migrations with the Prisma CLI, then exits. Never deployed: the CLI
#    and its ~380 MB of dependencies stay out of the API image, which keeps that image small and
#    free of tooling an attacker could use.
FROM build AS migrator
COPY apps/api/prisma.runtime.config.cjs apps/api/database-url.cjs /repo/apps/api/
COPY --chmod=755 apps/api/docker-migrate.sh /repo/apps/api/docker-migrate.sh
USER node
WORKDIR /repo/apps/api
ENTRYPOINT ["./docker-migrate.sh"]

# 5. Production dependencies without the Prisma CLI. @prisma/client lists `prisma` as an optional
#    peer (as is typescript), so even a plain `deploy --prod` links the whole CLI; prune-cli.cjs
#    removes both and everything only they need, and the build fails if the CLI, its engines,
#    typescript or a prisma binary is left over.
FROM build AS prod-deps
COPY apps/api/prune-cli.cjs /tmp/prune-cli.cjs
RUN pnpm --filter @hitss/api deploy --prod --legacy /out \
 && node /tmp/prune-cli.cjs /out/node_modules prisma,typescript \
 && ! ls /out/node_modules/.pnpm | grep -qE '^(prisma|@prisma\+engines|typescript)@' \
 && ! test -e /out/node_modules/.bin/prisma

# 6. Runtime: compiled code and production node_modules only. Files stay root-owned and read-only
#    for the unprivileged `node` user, so the process cannot rewrite its own code or dependencies.
FROM ${NODE_IMAGE} AS runtime
# The runtime needs neither npm nor corepack: removing them shrinks the image and its attack surface.
RUN apk add --no-cache openssl \
 && rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-*
ENV NODE_ENV=production
WORKDIR /app
COPY --from=prod-deps /out/node_modules ./node_modules
COPY --from=prod-deps /out/package.json ./package.json
COPY --from=build /repo/apps/api/dist ./dist
COPY apps/api/database-url.cjs ./database-url.cjs
COPY --chmod=755 apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
