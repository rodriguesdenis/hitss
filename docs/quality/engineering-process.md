# Engineering process

The working rules the team settled on while building the backend. They complement the [Definition of Done](definition-of-done.md) and [ADR-0017](../architecture/adr/0017-conventional-commits-and-atomic-prs.md); when a rule here and a checklist disagree, this page is the newer one.

## Where checks run

- **CI is the gate.** Every pull request runs the full gate on GitHub: static checks (format, lint, typecheck, architecture rules, traceability, doc checks), unit tests with coverage gates, integration and e2e tests on Testcontainers, build, secrets scan and the compose smoke ([ADR-0014](../architecture/adr/0014-testing-strategy.md)). `ci-success` aggregates them.
- **Local checks stay light.** Before pushing, run format, lint, typecheck, `pnpm test:tools`, `pnpm traceability:check`, `pnpm arch` and the test files of the code you changed.
- **One heavy job at a time.** Docker builds, `docker compose` runs, Testcontainers suites and the full Turbo gate are "heavy": only one may run on the shared machine at a time, and only to debug a CI failure or to run a test CI does not run. Long waits (CI, merges) run in the background.

## Git

- **Worktrees:** each task gets its own git worktree. Run `pnpm install` in a new worktree before the first commit; it recreates `.husky/_`, without which git silently skips the commit hooks.
- **Hooks are never bypassed:** no `--no-verify`. To park work, make a WIP commit (hooks run) and undo it later with `git reset --soft`.
- **No `git stash`:** the stash is shared by all worktrees, so a stash in one can be popped in another. Switch branches with a temporary WIP commit instead.
- **Never edit the main checkout:** it is the sync point for `main`. Reviews are read-only (`git fetch` + `git diff`, or `git archive` into a scratch folder).
- **Merging:** rebase-merge only (linear history), one task per PR. A stacked PR is retargeted to `main` **before** its base merges.
- **One merge at a time:** merges go through a single script that holds a lock (`flock`), so two merges never run in parallel. Under the lock, a PR that is behind `main` is rebased on GitHub (update branch) and merged only after CI passes on that new head, so `main` stays green. (Two PRs merged in parallel once broke `main`'s typecheck.) Queue several merges sequentially in one background command.
- **After a rebase on GitHub:** before amending a branch that was rebased remotely, run `git fetch && git reset --keep origin/<branch>`.

## Task status

The PR that completes a spec task sets `- **Status:** done` on it in `tasks.md`. From then on CI (`traceability --require-tests`) requires every MUST acceptance criterion the task covers to be named by at least one automated test.

## Secrets

- Real secrets live only in the gitignored `.env`; `.env.example` holds placeholders. gitleaks runs in CI and, when installed, in the pre-commit hook.
- **Test fixtures never look like secrets:** build tokens, passwords and keys at runtime from low-entropy parts, so scanners do not flag them and nobody mistakes them for real credentials.
- **No credentials inside URLs (DK-4):** Compose passes `POSTGRES_*` parts, and the entrypoints build `DATABASE_URL` from them with percent-encoding; logs and error messages never print it.
