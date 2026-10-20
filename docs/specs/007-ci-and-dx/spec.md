# 007 — Quality, CI & Developer Experience

- **Epic:** [EP-07](../../product/epics/EP-07-quality-ci-and-dx.md) · **Status:** Draft · **Priority:** MUST (US-07.1, US-07.2, US-07.4) · SHOULD (US-07.3) · COULD (others)

## Problem

The evaluator has limited time and, possibly, only a container runtime on the machine. If the project needs a language toolchain, manual configuration or tribal knowledge to start, the evaluation starts with friction — and the brief explicitly requires that "the project starts without errors from the step-by-step". For maintainers, conventions that are only written down (layering, contract-first client, commit format) erode as soon as nobody checks them.

## Goals / Non-goals

**Goals**

- One command, no edits: database and API start migrated, seeded and ready.
- Deterministic demo data and a known demo account.
- Obvious `start`, `test`, `seed` commands and short aliases.
- Request examples runnable without writing a request.
- Every change verified by an automated pipeline whose gates are also runnable locally.
- Architecture, contract and supply-chain rules enforced by tooling.

**Non-goals**

- Deployment or release automation (continuous delivery).
- Running mobile end-to-end tests in the pipeline.
- Supporting a local toolchain other than the pinned language runtime and package manager.

## User stories

### US-07.1 — One-command local run (`MUST`)

As an evaluator, I want one command to start the database and the API, migrated and ready, without editing any file, so that I can evaluate quickly.

**Acceptance criteria**

- **AC-07.1.1** Given a fresh clone and only a container runtime installed, when the evaluator runs the single documented start command without creating or editing any file, then the database and the API start, the schema is migrated, demo data is seeded, the API reports ready, and the interactive API documentation is reachable.
- **AC-07.1.2** The API is started only after the database reports healthy, and the stack is reported as up only once the API's readiness check passes.
- **AC-07.1.3** Given the stack was started before, when it is stopped and started again, then existing data is preserved and seed data is not duplicated.
- **AC-07.1.4** Every setting has a working local default; an optional local settings file overrides defaults; a committed template documents every setting with its default.
- **AC-07.1.5** Given a default host port is already in use, when the evaluator sets the documented port setting, then the stack starts on the chosen port without editing any committed file.
- **AC-07.1.6** The API image runs as a non-privileged user and contains no development dependencies, test files, local settings files or version-control data.
- **AC-07.1.7** Given a migration fails, then the API exits with a non-zero code, logs the migration error, never reports ready and never serves requests.
- **AC-07.1.8** On a typical laptop with broadband, a cold start (images not cached) reaches "ready" in under 5 minutes.

### US-07.2 — Deterministic demo data (`MUST`)

As an evaluator, I want deterministic demo data and a demo account, so that I can explore every feature immediately.

**Acceptance criteria**

- **AC-07.2.1** After the first start, the evaluator can sign in as `demo@teams-tasks.dev` with password `Demo@1234`.
- **AC-07.2.2** The demo account owns exactly 3 teams and 10 tasks, covering all three statuses, at least one task in two or more teams, at least one task without team, at least one overdue task and at least one task due in the future.
- **AC-07.2.3** Seeding twice produces identical seeded records (same identifiers and values) and no duplicates.
- **AC-07.2.4** Re-seeding restores seeded records to their seeded values and leaves records the evaluator created untouched.
- **AC-07.2.5** The reset command deletes all data and recreates exactly the seeded data set.
- **AC-07.2.6** Automatic seeding at start can be disabled by a setting.

### US-07.3 — Standard scripts and aliases (`SHOULD`)

As an evaluator, I want `start`, `test` and `seed` scripts and short command aliases, so that common operations are obvious.

**Acceptance criteria**

- **AC-07.3.1** The repository exposes a `start` script (starts the stack as in US-07.1), a `test` script (runs every automated test suite of every package) and a `seed` script (re-applies demo data).
- **AC-07.3.2** Short aliases exist for: start (`up`), stop (`down`), follow logs (`logs`), seed (`seed`), reset (`reset`), run tests (`test`), start with the telemetry backend (`observability`).
- **AC-07.3.3** The README lists every script and alias with one line explaining it, and states which require only the container runtime.

### US-07.4 — Runnable request examples (`MUST`)

As an evaluator, I want runnable request examples, so that I can exercise the API without writing requests.

**Acceptance criteria**

- **AC-07.4.1** The README contains copy-paste command-line examples for: sign in as the demo user, list/create/update/delete teams, list tasks with every filter, sort and pagination, create a task in two teams, change status, delete a task.
- **AC-07.4.2** A request collection with a local environment is provided; after running its sign-in request once, every other request is authorized automatically.
- **AC-07.4.3** Plain-text request files usable from common code editors cover the same requests.
- **AC-07.4.4** The collection runs headlessly against the freshly seeded stack in the pipeline and all its assertions pass.

### US-07.5 — Mobile dev server in a container (`COULD`)

As an evaluator, I want to run the mobile app's development server in a container and open the app on my phone, so that I don't need a local toolchain.

**Acceptance criteria**

- **AC-07.5.1** Given the optional mobile option, when it is started, then the logs show a code the phone's development client can scan to open the app, and the development server is reachable from the phone even when the phone is not on the same network as the computer (the API address is configured as in AC-07.5.2).
- **AC-07.5.2** The documentation explains how to point the app to an API address reachable from the phone, with a working default for emulators/simulators on the same machine.
- **AC-07.5.3** The default start command does not start the mobile development server.

### US-07.6 — Automated pipeline (`COULD`)

As a maintainer, I want every pull request and every change to the main branch verified automatically, so that main is always releasable.

**Acceptance criteria**

- **AC-07.6.1** For every pull request and every change to main, the pipeline runs: commit-convention check (pull requests only), formatting, lint, type check, unit tests, integration tests against a real database, build, architecture rules, contract drift, dependency audit, and a fresh-stack smoke test.
- **AC-07.6.2** If any gate fails, a single aggregate status fails, and that status is the one required to merge.
- **AC-07.6.3** Given a new push to a pull request while its pipeline is running, then the running pipeline is cancelled and a new one starts.
- **AC-07.6.4** Unchanged packages reuse cached results; a typical pull request with a warm cache completes in under 10 minutes.
- **AC-07.6.5** Given domain-layer line coverage below 90 % or overall API line coverage below 80 %, then the pipeline fails and reports the shortfall.
- **AC-07.6.6** Mutation testing of the domain layer runs nightly, on manual request, and on pull requests carrying a dedicated label; a mutation score below 80 % fails that run.
- **AC-07.6.7** The pipeline has read-only repository permissions, requires no secrets to verify a pull request, and never deploys anything.
- **AC-07.6.8** The fresh-stack smoke test builds the images from the commit, starts the stack with the one documented command, waits for readiness, signs in as the demo user and verifies 3 teams and 10 tasks.

### US-07.7 — Architecture rules enforced (`COULD`)

As a maintainer, I want layer dependency rules enforced automatically, so that the architecture cannot erode silently.

**Acceptance criteria**

- **AC-07.7.1** Given code that breaks a layering rule — domain depending on a framework, the persistence library, the application layer or infrastructure; application depending on infrastructure or presentation; presentation depending on infrastructure; one bounded context depending on another context's domain or infrastructure internals; the mobile app depending on server code; any circular dependency — then the check fails, naming the rule and the offending file and import.
- **AC-07.7.2** Given code that follows every rule, then the check passes.
- **AC-07.7.3** The check runs locally with one command and in the pipeline with the same command.

### US-07.8 — Contract drift detection (`COULD`)

As a maintainer, I want the pipeline to fail when the generated client is out of date with the API contract, so that the app never drifts from the API.

**Acceptance criteria**

- **AC-07.8.1** Given a change to the API contract without regenerating the client, then the pipeline fails and shows the difference in the contract document and the generated client.
- **AC-07.8.2** Given the contract change and the regenerated client are committed together, then the check passes.
- **AC-07.8.3** Exporting the contract document does not need a running database or network access.
- **AC-07.8.4** Generated files are marked as generated and excluded from lint and formatting rules, so they can only change by regeneration.

### US-07.9 — Dependency audit and updates (`COULD`)

As a maintainer, I want dependencies audited and updated automatically, so that known vulnerabilities are caught early.

**Acceptance criteria**

- **AC-07.9.1** Given a dependency with a known high or critical advisory, then the pipeline fails; an exception is only possible through a committed allowlist entry with a justification and an expiry date.
- **AC-07.9.2** Given the lockfile is out of date with the manifests, then installation in the pipeline fails.
- **AC-07.9.3** Update proposals are opened automatically every week for packages, pipeline actions and container base images, grouped to limit noise and following the commit conventions.

### US-07.10 — Commit and pull-request conventions (`COULD`)

As a maintainer, I want commit and pull-request conventions enforced, so that history stays readable and bisectable.

**Acceptance criteria**

- **AC-07.10.1** Given a pull request containing a commit whose message violates the conventions (type, allowed scope, subject format), then the pipeline fails naming that commit.
- **AC-07.10.2** Locally, a commit with an invalid message is rejected, and staged files are formatted before the commit is created.
- **AC-07.10.3** Pull requests open with a description template that links the task and ADRs and contains the quality checklist.
- **AC-07.10.4** Recommended main-branch protection is documented: pull request required, one approval, the aggregate status required, branch up to date, no force pushes, linear history.

## Business rules

| ID      | Rule                                                                                                                                                                     |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BR-07.1 | Zero manual steps between clone and a ready API (no file to copy or edit, no account to create).                                                                         |
| BR-07.2 | Committed defaults are for local use only; no real secret is ever committed; the API refuses the local default secret outside local/test environments.                   |
| BR-07.3 | Every pipeline gate is runnable locally with the same command the pipeline uses.                                                                                         |
| BR-07.4 | Main is protected: nothing merges with a failing aggregate status.                                                                                                       |
| BR-07.5 | The pipeline never deploys and never publishes artifacts.                                                                                                                |
| BR-07.6 | Demo data is deterministic: fixed identifiers and values; relative dates are computed from the seeding day only where a value must stay meaningful (overdue / upcoming). |
| BR-07.7 | The API's contract document is generated from the API; the client is generated from the contract document; both are committed and never hand-edited.                     |

## Edge cases

- Host port 3000 or 5432 already in use → documented port settings; the stack does not silently pick another port.
- Container runtime with little memory → default stack must fit in 2 GB; the telemetry backend (≈ 4 GB) is opt-in.
- ARM laptops → all images available for both common CPU architectures.
- Repository cloned on an OS that converts line endings → start-up scripts still run (line endings pinned).
- A stale local settings file with an invalid value → API fails fast naming the setting (see AC-06.5.5).
- Re-running the start command while the stack is up → no-op, no duplicate data.
- Pipeline run from a fork → no secrets needed; all gates still run.
- Dependency update proposal that breaks the build → it fails the same gates and cannot merge.

## Out of scope

- Continuous delivery, environments, release tagging, store builds (see production readiness).
- Mobile end-to-end tests in the pipeline (run locally; see test strategy).
- Load-test thresholds in the pipeline (shared runners are too noisy; only the smoke test runs).

## Open questions

- **OQ-07.1** Running the test suites with _only_ a container runtime requires access to the container runtime from inside a container (integration tests start their own database). Proposed: the `test` alias runs on the host toolchain; a containerized variant is offered as best effort and documented.
- **OQ-07.2** When the mobile development server runs in a tunnel, the API itself is not tunnelled: a phone on another network cannot reach `localhost`. Proposed: document the LAN-address setting; tunnelling the API is out of scope.
