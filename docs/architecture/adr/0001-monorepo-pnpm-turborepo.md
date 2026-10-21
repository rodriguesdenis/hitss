# ADR-0001 — Monorepo with pnpm workspaces + Turborepo

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** software-architect, devops-ci

## Context

The deliverable has three moving parts that change together: the NestJS API (`apps/api`), the Expo app (`apps/mobile`) and the client generated from the API's OpenAPI document (`packages/api-client`). A contract change in the API must regenerate the client and type-check the app **in the same pull request**, otherwise the app and API drift silently. The evaluator must also be able to clone one repository and run everything.

## Decision drivers

- Atomic cross-cutting changes (DTO change → client → screen) in one PR and one CI run.
- Fast CI: only rebuild/test what a change affects.
- Strict, reproducible dependency resolution (no phantom dependencies).
- Compatibility with Expo/Metro (symlinked workspaces) and NestJS CLI.
- Low ceremony: the tooling should be explainable in a paragraph.

## Considered options

### 1. pnpm workspaces + Turborepo (chosen)

- **+** pnpm's content-addressed store and strict `node_modules` layout prevent importing undeclared dependencies; `workspace:*` links local packages.
- **+** Turborepo adds a task graph (`build` depends on `^build`), local/remote caching and `turbo prune --docker`, which produces a minimal workspace subset for the API image ([ADR-0018](0018-docker-compose-one-command-run.md)).
- **+** Expo SDK supports pnpm monorepos out of the box (Metro resolves symlinks since SDK 50+; `expo` auto-configures `watchFolders` for monorepos).
- **−** pnpm's isolated layout occasionally trips React Native libraries that assume hoisting; mitigated with targeted `public-hoist-pattern` entries if needed.
- **−** Two tools to learn instead of one.

### 2. Nx

- **+** Rich generators, affected-graph, module-boundary lint rules out of the box.
- **−** Heavy configuration surface and plugin conventions that compete with NestJS CLI and Expo conventions (constitution §III.4: use frameworks idiomatically).
- **−** Harder for an evaluator to read in minutes.

### 3. npm/Yarn workspaces without a task runner

- **+** Fewest tools.
- **−** No task graph or cache: CI runs everything every time; ordering (`api-client` before `mobile`) is manual scripting.
- **−** npm hoisting allows phantom dependencies.

### 4. Polyrepo (one repo per app + published client package)

- **+** Independent release cycles.
- **−** A contract change becomes three PRs and a package publish; the evaluator clones multiple repos. Wrong trade-off for a single-team product with one consumer.

## Decision outcome

Use **pnpm 10 workspaces** with **Turborepo 2** as the task runner.

```text
apps/api            @hitss/api
apps/mobile         @hitss/mobile
packages/api-client @hitss/api-client   (generated; depends on nothing in apps/*)
packages/tsconfig   @hitss/tsconfig     (strict base configs)
```

- `packageManager` is pinned in the root `package.json`; Node ≥ 24 via `engines`.
- Root scripts delegate to Turbo (`pnpm build|lint|typecheck|test` → `turbo run …`).
- Turbo tasks declare `outputs` for caching (`dist/**`, `coverage/**`); `dev` and `test:e2e` are uncached.
- A dedicated `api:openapi` → `api-client:generate` pipeline lets CI detect contract drift ([ADR-0008](0008-class-validator-dtos-and-generated-client.md)).

## Consequences

**Positive**

- One PR can carry a backend change, the regenerated client and the screen that uses it, verified by one CI run.
- `turbo run test --filter=...[origin/main]` keeps CI fast as the repo grows.
- `turbo prune --docker` makes the API image small and cache-friendly.

**Negative**

- Contributors must use pnpm (enforced by `packageManager` + Corepack).
- Some RN libraries may need hoisting exceptions; each exception is documented in `.npmrc`.

**Neutral**

- Remote caching (Vercel or self-hosted) is not configured; it is a straightforward addition if CI time becomes a concern.

## Links

- [Architecture overview — folder structure](../overview.md#6-folder-structure)
- [ADR-0018 — Docker Compose one-command run](0018-docker-compose-one-command-run.md)
- pnpm workspaces: https://pnpm.io/workspaces · Turborepo: https://turborepo.com/docs
