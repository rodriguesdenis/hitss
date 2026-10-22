# ADR-0017 — Conventional Commits and atomic PRs

- **Status:** Accepted
- **Date:** 2026-10-20
- **Deciders:** software-architect, git-pr-manager, devops-ci

## Context

Evaluators will read the git history as evidence of how the work was done. Constitution §VIII requires atomic pull requests (one task, reviewable in under 15 minutes), Conventional Commits and a bisectable history. Spec-Driven Development already decomposes each feature into tasks `T-<spec>-<nn>` sized S (< 150 lines) or M (< 400 lines).

## Decision drivers

- Reviewable units: each PR answers one question.
- History that explains _why_, links to specs/ADRs, and can be bisected.
- Automatable: commit format checked locally and in CI; changelog-ready.
- Allow parallel progress on dependent tasks without giant PRs.

## Considered options

### 1. Conventional Commits + commitlint + husky/lint-staged, one task = one PR, stacked PRs (chosen)

- **+** Machine-readable history (`feat(api): …`, `fix(mobile): …`), enables changelog/semver tooling later.
- **+** Local hooks catch format and lint problems before CI.
- **+** Stacked PRs (each based on the previous task's branch) keep each diff small while work continues.
- **−** Stacks need rebasing when a lower PR changes.

### 2. Free-form commits, squash-merge everything

- **+** No tooling.
- **−** Squashing hides the TDD steps; free-form subjects are inconsistent and not automatable.

### 3. Feature branches per epic (large PRs)

- **+** Fewer PRs.
- **−** Multi-thousand-line diffs are not reviewable in 15 minutes; mixed concerns; painful reverts.

### 4. Trunk-based with feature flags, direct commits to `main`

- **+** Fastest integration.
- **−** No review trail for evaluators; flags add complexity irrelevant here.

## Decision outcome

- **Format:** `type(scope): subject` — types `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `build`, `perf`; scopes `api`, `mobile`, `api-client`, `docs`, `adr`, `spec`, `ci`, `infra`, `deps`, `agents` (enforced by `commitlint.config.mjs`). Body explains _why_; footer references the task (`Refs: T-003-07`) and breaking changes (`BREAKING CHANGE:`).
- **Hooks:** husky `commit-msg` → commitlint; `pre-commit` → lint-staged (prettier, eslint on staged files).
- **Granularity:** one task (`T-NNN-nn`) = one branch (`<type>/<spec>-<slug>`, e.g. `feat/003-list-filters`) = one PR. Commits inside a PR are meaningful steps (e.g. `test:` failing scenarios → `feat:` implementation → `refactor:`), **each building and passing tests** so `git bisect` works; the "red" test commit is marked with `it.failing`/`test.todo` to stay green.
- **Stacking:** dependent tasks are opened as stacked PRs (base = previous task branch). Retarget the stacked PR to `main` **before** merging its base, so GitHub does not close it when the base branch is deleted (amended 2026-10-22).
- **Merge:** rebase-merge only, enforced by a `main` ruleset requiring linear history and the `ci-success` check (amended 2026-10-22); no squash of meaningful history.
- **PR template:** links spec, scenarios (`@AC-…`) and ADRs; checklist from the Definition of Done; CI must be green ([ADR-0014](0014-testing-strategy.md)).
- **Docs are code:** spec/ADR changes are their own commits/PRs with `docs`/`adr`/`spec` scopes.

**Task status (amended 2026-10-22).** The PR that completes a spec task sets `- **Status:** done` on that task in `tasks.md`. From then on the traceability gate requires automated tests for the task's MUST acceptance criteria ([ADR-0014](0014-testing-strategy.md)).

## Consequences

**Positive**

- History reads as a narrative of tasks; each PR is small enough to review carefully.
- Bisect and revert are safe at commit level.
- Changelog generation is possible without extra effort.

**Negative**

- More PRs to manage; stacked PRs require rebases after review changes.
- Hooks can be bypassed with `--no-verify`; CI re-runs commitlint on the PR range as the backstop.

**Neutral**

- Release automation (semantic-release/changesets) is not configured since there is no deployment ([vision — out of scope](../../product/vision.md#out-of-scope)).

## Links

- [Specs README — tasks template and sizes](../../specs/README.md#tasksmd)
- Conventional Commits: https://www.conventionalcommits.org/en/v1.0.0/ · commitlint: https://commitlint.js.org
