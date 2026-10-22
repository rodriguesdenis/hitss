# Definition of Ready & Definition of Done

Applies to every task, pull request and feature ([Constitution V.4](../constitution.md#v-quality)). Checklists are copied into the PR description (the [PR template](../../.github/pull_request_template.md) holds the short version) and ticked by the author; the reviewer verifies them.

## Definition of Ready

### Spec / feature is Ready for planning when

- [ ] `spec.md` exists with problem, goals/non-goals, user stories (`US-0N.n`) and acceptance criteria (`AC-0N.n.m`) with priority `MUST`/`SHOULD`/`COULD`.
- [ ] Spec names no technology; business rules and edge cases are listed; open questions are either answered or explicitly deferred.
- [ ] Every AC is testable (observable outcome, no "should be fast/nice").
- [ ] Ubiquitous language matches the [domain model](../architecture/domain-model.md).
- [ ] The epic links to the spec, and the spec is in the [specs index](../specs/README.md).

### Task is Ready for implementation when

- [ ] Its spec is **Approved**, its `.feature` scenarios exist and are tagged (`@US-…`, `@AC-…`, priority, surface).
- [ ] `plan.md` covers the task's architecture, contract, data, security, observability and test approach, and references the ADRs it relies on (ADRs accepted).
- [ ] The task in `tasks.md` has: id `T-NNN-nn`, goal, changes, covered `@AC-…` scenarios, verifiable "done when", size **S/M** (larger → split), branch name, dependencies.
- [ ] All dependencies are merged (or the PR is explicitly stacked on them).
- [ ] Contract changes, if any, are reflected in [api-contracts.md](../architecture/api-contracts.md) first.

## Definition of Done

### Task (code change) is Done when

- [ ] **Tests first:** every scenario listed under "Covers" has ≥ 1 automated test whose name starts with the AC id; tests were seen failing before the implementation.
- [ ] Tests are at the right pyramid level ([test strategy](test-strategy.md)); no sleeps, isolated data, no order dependence.
- [ ] Light checks pass locally (format, lint, typecheck, `pnpm arch`, `pnpm traceability:check`, the changed tests); the full gate, integration and E2E pass in CI ([engineering process](engineering-process.md)).
- [ ] Coverage gates hold (domain ≥ 90 % lines, API ≥ 80 %); mutation score ≥ 80 % when domain code changed (run with label `mutation`).
- [ ] Strict TypeScript: no `any`, no `@ts-ignore` without a linked reason, no non-null assertions to silence `noUncheckedIndexedAccess`.
- [ ] Architecture: domain is framework-free; layers respect dependency rules; aggregates change state only via methods.
- [ ] Contract: DTO changes regenerated the OpenAPI document and `packages/api-client` in a separate commit; drift check green; breaking change → ADR + new version.
- [ ] Security checklist ([threat model](../security/threat-model.md), security-specialist): auth required unless explicitly public; owner scoping with 404 for foreign ids; input whitelist and length limits; no secrets, tokens, passwords or PII in logs/telemetry; new threats added to the threat model.
- [ ] Observability: new use cases produce a handler span; errors map to documented `code`s; new business events counted if relevant; no high-cardinality metric attributes.
- [ ] Docs updated in the same PR: spec (if behavior changed — spec first), plan, ADR (if a decision changed), README/runbook (if a command or setting changed), `.env.example` (if a setting was added).
- [ ] The task's "Done when" checks are demonstrated in the PR (command output, screenshot or test names).
- [ ] The PR that completes a task sets `- **Status:** done` on it in `tasks.md`; from then on the traceability gate requires an automated test for every MUST AC the task covers (or a waiver with a reason in `tools/ci/traceability-waivers.json`).

### Pull request is Done (mergeable) when

- [ ] One task, one concern; < 400 changed lines excluding lockfile/generated code; reviewable in < 15 minutes.
- [ ] Branch named `<type>/<spec>-<slug>`; commits follow Conventional Commits with an allowed scope; each commit builds and passes tests (bisectable); refactors separated from behavior changes; generated code in its own commit.
- [ ] Description follows the template: what, why (link `docs/specs/<id>/tasks.md#t-nnn-nn` and ADRs), how, how it was tested; base branch stated if stacked.
- [ ] CI `ci-success` is green (commitlint, static, unit, integration, build, contract, audit, compose smoke).
- [ ] At least one approving review; all conversations resolved; no open high/critical security finding.
- [ ] Mobile UI changes include screenshots (light/dark) and pass the accessibility checks of spec 004.
- [ ] No unrelated changes, no debug code, no commented-out code, no TODO without a linked task.

### Feature / spec is Done when

- [ ] All its tasks are merged.
- [ ] **100 % of `MUST` acceptance criteria** map to ≥ 1 scenario and ≥ 1 passing automated test (traceability check green; [traceability matrix](traceability-matrix.md) updated). `SHOULD`/`COULD` gaps are listed explicitly.
- [ ] Mobile features: the Maestro journey covering the feature passes locally on Android emulator and iOS simulator (or Expo Go on a device).
- [ ] From a fresh clone, `docker compose up` still yields a seeded, healthy API; README "How to run" and request examples are accurate.
- [ ] Spec status set to **Approved → Done**; open questions closed or moved to the backlog; threat-model rows for the feature set to _Implemented_.
- [ ] Performance budget respected where relevant (`make load`: task list p95 < 100 ms, errors < 1 %).
- [ ] Demo to the product owner (or a recorded walkthrough) accepted.
