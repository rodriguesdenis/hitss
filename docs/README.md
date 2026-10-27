# Documentation map

Everything about **Teams & Tasks** lives here. How to run it is in the [root README](../README.md).

## Read these (the system as it is)

| Document                                                   | What it covers                                                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [Brief](brief/README.md)                                   | The hiring-test requirements this project answers.                                                                    |
| [Architecture overview](architecture/overview.md)          | Containers, modules and `TeamDirectory`/`TeamLookup`, layers, domain model, request lifecycle, folders, import rules. |
| [Data model](architecture/data-model.md)                   | ERD, indexes and why, soft delete, versions, transactions and timeouts, migrations and seed.                          |
| [API contracts](architecture/api-contracts.md)             | Endpoints, envelopes, headers, pagination, sorting, error codes.                                                      |
| [ADR index](architecture/adr/README.md)                    | The essential decisions with the alternatives rejected; older ones in the archive.                                    |
| [Constitution](constitution.md)                            | The engineering principles every decision follows.                                                                    |
| [Threat model](security/threat-model.md)                   | STRIDE threats, mitigations and residual risks.                                                                       |
| [Test strategy](quality/test-strategy.md)                  | Test pyramid, tooling, test data, commands.                                                                           |
| [Observability](operations/observability.md)               | Logs, optional traces, health probes.                                                                                 |
| [Runbook](operations/runbook.md)                           | Run, reset and troubleshoot locally.                                                                                  |
| [Production readiness](operations/production-readiness.md) | What I'd do differently in production, and when.                                                                      |

## Process material (optional reading)

The project was built spec-first. These documents record how and why each feature was planned; they are kept as history and are not checked by the CI gate. Where they disagree with the documents above, the documents above and the code win; [ADR-0020](architecture/adr/0020-simplify-architecture-for-the-hiring-test.md) lists what was simplified later.

| Document                                                                                                    | What it covers                                                                                  |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Specs index](specs/README.md)                                                                              | Spec-Driven Development flow and specs 001–008 (`spec.md`, `*.feature`, `plan.md`, `tasks.md`). |
| [Product vision](product/vision.md) · [roadmap](product/roadmap.md)                                         | Persona, scope, priorities, epics.                                                              |
| [Traceability matrix](quality/traceability-matrix.md)                                                       | Acceptance criteria ↔ scenarios ↔ tasks ↔ tests (generated with `pnpm traceability`).           |
| [Definition of done](quality/definition-of-done.md) · [engineering process](quality/engineering-process.md) | Ready/done checklists, how the team worked.                                                     |
| [Design spec](design/design-spec.md)                                                                        | Mobile design tokens, screens, states, accessibility, copy (next phase).                        |
