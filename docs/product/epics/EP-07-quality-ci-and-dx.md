# EP-07 — Quality, CI & Developer Experience

- **Spec:** [007-ci-and-dx](../../specs/007-ci-and-dx/spec.md)
- **Bounded context:** cross-cutting (delivery platform)
- **Priority:** mixed — the brief makes one-step local run, seed data, run instructions and request examples `MUST`; `start`/`test`/`seed` scripts are a brief differential (`SHOULD`); CI and automated gates are our extras (`COULD`).
- **Principles:** [Constitution III.3](../../constitution.md#iii-clean-architecture), [IV](../../constitution.md#iv-contracts), [V](../../constitution.md#v-quality), [VII.1](../../constitution.md#vii-operability), [VIII](../../constitution.md#viii-delivery)
- **ADRs:** [0001](../../architecture/adr/0001-monorepo-pnpm-turborepo.md), [0004](../../architecture/adr/0004-prisma-migrations-and-seeding.md), [0008](../../architecture/adr/archive/0008-class-validator-dtos-and-generated-client.md), [0014](../../architecture/adr/0014-testing-strategy.md), [0017](../../architecture/adr/archive/0017-conventional-commits-and-atomic-prs.md), [0018](../../architecture/adr/0018-docker-compose-one-command-run.md)

## Goal

An evaluator with **only Docker** clones the repository, runs **one command**, and gets a migrated, seeded, healthy API in under five minutes, plus ready-to-run request examples. Every change to the code base passes the same automated gates — commit conventions, lint, types, tests, build, architecture rules, contract drift and dependency audit — before it can be merged.

## Why

- The brief: "ensure the project starts without errors from the step-by-step", "seeds/fixtures for quick evaluation", "documentation with request examples".
- The evaluation weighs code quality and architectural clarity; rules enforced by tooling are stronger evidence than rules written in a document.

## Personas

| Persona                                   | Need                                                                             |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| **Evaluator** (Docker only, limited time) | One command, no manual edits, known demo credentials, examples to click through. |
| **Contributor** (future developer)        | Fast feedback, clear failures, conventions enforced automatically.               |
| **Maintainer**                            | Safe dependency updates, no silent architectural or contract decay.              |

## User stories

| ID       | Story                                                                                                                                                | Priority                         |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| US-07.1  | As an evaluator, I want one command to start the database and the API, migrated and ready, without editing any file, so that I can evaluate quickly. | `MUST`                           |
| US-07.2  | As an evaluator, I want deterministic demo data and a demo account, so that I can explore every feature immediately.                                 | `MUST`                           |
| US-07.3  | As an evaluator, I want `start`, `test` and `seed` scripts and short command aliases, so that common operations are obvious.                         | `SHOULD`                         |
| US-07.4  | As an evaluator, I want runnable request examples (collection and plain files), so that I can exercise the API without writing requests.             | `MUST` (brief: request examples) |
| US-07.5  | As an evaluator, I want to run the mobile app's dev server in a container and open it on my phone, so that I don't need a local Node toolchain.      | `COULD`                          |
| US-07.6  | As a maintainer, I want every pull request and every change to the main branch verified by an automated pipeline, so that main is always releasable. | `COULD`                          |
| US-07.7  | As a maintainer, I want layer dependency rules enforced automatically, so that the architecture cannot erode silently.                               | `COULD`                          |
| US-07.8  | As a maintainer, I want the build to fail when the generated client is out of date with the API contract, so that the app never drifts from the API. | `COULD`                          |
| US-07.9  | As a maintainer, I want dependencies audited and updated automatically, so that known vulnerabilities are caught early.                              | `COULD`                          |
| US-07.10 | As a maintainer, I want commit and pull-request conventions enforced, so that history stays readable and bisectable.                                 | `COULD`                          |

## Success metrics

| Metric                                      | Target                              |
| ------------------------------------------- | ----------------------------------- |
| Clone → healthy seeded API, Docker only     | < 5 min, 1 command, 0 manual edits  |
| CI wall-clock on a typical PR (warm cache)  | < 10 min                            |
| Main branch red builds caused by merged PRs | 0 (gate before merge)               |
| Architecture-rule violations on main        | 0                                   |
| Open high/critical advisories on main       | 0 (or a dated, justified exception) |

## Out of scope

- Continuous delivery / deployment (vision: out of scope). Production CD is described in [production readiness](../../operations/production-readiness.md).
- Mobile end-to-end tests in CI (require an emulator); they run locally (see [test strategy](../../quality/test-strategy.md)).

## Dependencies

- EP-06 provides the readiness probe the compose healthcheck uses.
- EP-01/02/03 provide the schema and auth used by the seed.
- EP-04 provides the mobile app served by the optional dev-server container.
