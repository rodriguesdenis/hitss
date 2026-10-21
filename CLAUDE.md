# CLAUDE.md

Teams & Tasks — hiring-test project (senior level). Monorepo: `apps/api` (NestJS 11 + Prisma + PostgreSQL + Better Auth), `apps/mobile` (Expo), `packages/api-client` (orval, generated from the API's OpenAPI), `packages/tsconfig`.

## Workflow (Spec-Driven Development)

1. No code without an approved task in `docs/specs/<id>-<feature>/tasks.md`.
2. Order per feature: `spec.md` (what/why, stories, acceptance criteria) → `*.feature` (BDD) → `plan.md` (how) → `tasks.md` → TDD implementation → review → atomic PR.
3. Principles in `docs/constitution.md` are non-negotiable; decisions live in `docs/architecture/adr/`.

## Specialist agents (`.claude/agents/`)

product-owner · software-architect · nestjs-specialist · database-specialist · react-native-expo-specialist · ux-ui-designer · qa-engineer · security-specialist · observability-sre · devops-ci · git-pr-manager · tech-writer

## Conventions

- Docs and code in English.
- Conventional Commits (commitlint scopes: api, mobile, api-client, docs, adr, spec, ci, infra, deps, agents). One task = one PR. Never push or open PRs without explicit user approval.
- API: Nest ecosystem and conventions, class-validator DTOs, CQRS, Clean Architecture layers `domain → application → infrastructure → presentation`, domain is framework-free.
- Mobile: Expo conventions, must run in Expo Go, NativeWind with `@apply` semantic classes, React Query (server state) + Zustand/immer (local state), react-hook-form + zod.
- Must run with only Docker: `docker compose up` migrates and seeds automatically. No Figma — design lives in `docs/design/design-spec.md`.

## Git worktrees

- Run `pnpm install` in every new worktree before the first commit. Husky's `prepare` script creates `.husky/_`; without it git silently skips the commitlint and lint-staged hooks.
- The git stash is shared by all worktrees: switch branches with a temporary WIP commit, never a bare `git stash`.

## Commands

- `pnpm install` · `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm test`
