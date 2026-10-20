@ops
Feature: Quality gates, CI and developer experience
  An evaluator with only a container runtime clones the repository, runs one command
  and gets a migrated, seeded, healthy API with ready-to-run request examples.
  Every change is verified by the same automated gates — conventions, lint, types,
  tests, build, architecture rules, contract drift and dependency audit — before it
  can reach the main branch.

  Rule: One command, no edits, yields a migrated, seeded, ready API

    @US-07.1 @AC-07.1.1 @AC-07.1.8 @must
    Scenario: Fresh clone and one command gives a seeded, healthy API
      Given a fresh clone of the repository
      And only a container runtime is installed
      And no local settings file exists
      When the evaluator runs the documented start command
      Then within 5 minutes the API reports ready
      And the database schema is fully migrated
      And the demo user can sign in
      And the interactive API documentation is reachable

    @US-07.1 @AC-07.1.2 @must
    Scenario: The API waits for a healthy database
      Given the database takes 20 seconds to become healthy
      When the evaluator runs the documented start command
      Then the API is not started before the database reports healthy
      And the start command reports the stack as up only after the API is ready

    @US-07.1 @AC-07.1.3 @must
    Scenario: Restarting keeps data and does not duplicate the seed
      Given the stack was started and the demo user created a task titled "My own task"
      When the evaluator stops and starts the stack again
      Then the task "My own task" still exists
      And the demo user still has exactly 3 seeded teams

    @US-07.1 @AC-07.1.4 @must
    Scenario: Defaults work and can be overridden
      Given no local settings file exists
      When the stack starts
      Then every setting takes its documented default
      And every setting in the committed template has a default and a description
      When the evaluator creates a local settings file setting the log level to "debug"
      And restarts the stack
      Then the API runs with log level "debug"

    @US-07.1 @AC-07.1.5 @must
    Scenario: A busy port is avoided through a setting
      Given another program is using the default API port
      When the evaluator sets the API port setting to 3100 and runs the start command
      Then the API is reachable on port 3100
      And no committed file was modified

    @US-07.1 @AC-07.1.6 @must
    Scenario: The API image is minimal and unprivileged
      When the API image is built
      Then its process runs as a non-root user
      And the image contains no development dependencies, test files, local settings files or version-control data

    @US-07.1 @AC-07.1.7 @must
    Scenario: A failed migration never serves traffic
      Given a migration that fails to apply
      When the stack starts
      Then the API exits with a non-zero code
      And its logs contain the migration error
      And the API never reports ready

  Rule: Demo data is deterministic and resettable

    @US-07.2 @AC-07.2.1 @AC-07.2.2 @must
    Scenario: The demo account owns a representative data set
      Given the stack has started for the first time
      When I sign in as "demo@teams-tasks.dev" with password "Demo@1234"
      Then I own exactly 3 teams and 10 tasks
      And the tasks include every status: Pending, In progress and Done
      And at least one task belongs to two or more teams
      And at least one task belongs to no team
      And at least one task is overdue
      And at least one task is due in the future

    @US-07.2 @AC-07.2.3 @must
    Scenario: Seeding twice gives identical data
      Given the demo data has been seeded
      When the seed runs again
      Then the seeded records have the same identifiers and values as before
      And no record is duplicated

    @US-07.2 @AC-07.2.4 @must
    Scenario: Re-seeding restores seeded records and keeps the evaluator's records
      Given the demo user renamed the seeded team "Mobile" to "Phones"
      And the demo user created a task titled "My own task"
      When the seed runs again
      Then the seeded team is named "Mobile" again
      And the task "My own task" still exists

    @US-07.2 @AC-07.2.5 @must
    Scenario: Reset recreates exactly the seeded data
      Given the demo user created 5 additional tasks
      When the evaluator runs the reset command
      Then the demo user owns exactly 3 teams and 10 tasks

    @US-07.2 @AC-07.2.6 @must
    Scenario: Automatic seeding can be turned off
      Given automatic seeding is disabled by setting
      And the database is empty
      When the stack starts
      Then the schema is migrated
      And no demo data exists

  Rule: Standard scripts and aliases make common operations obvious

    @US-07.3 @AC-07.3.1 @should
    Scenario Outline: Standard scripts exist and do what they say
      When the evaluator runs the "<script>" script
      Then <outcome>

      Examples:
        | script | outcome                                                        |
        | start  | the stack starts as with the one-command run                   |
        | test   | every automated test suite of every package runs               |
        | seed   | the demo data is re-applied                                    |

    @US-07.3 @AC-07.3.2 @AC-07.3.3 @should
    Scenario: Every alias is available and documented
      When the evaluator lists the available aliases
      Then "up", "down", "logs", "seed", "reset", "test" and "observability" are available
      And each one is described in the README

  Rule: Request examples are runnable and kept truthful

    @US-07.4 @AC-07.4.1 @must @docs
    Scenario: README examples cover the whole API
      When the evaluator reads the README request examples
      Then there are copy-paste examples for sign-in, team create, list, update and delete
      And for task listing with team, status, search, sort and pagination
      And for creating a task in two teams, changing its status and deleting it

    @US-07.4 @AC-07.4.2 @must
    Scenario: The collection authorizes every request after one sign-in
      Given the request collection is opened with the local environment
      When the evaluator runs the sign-in request
      Then every other request in the collection is authorized without manual steps

    @US-07.4 @AC-07.4.3 @must
    Scenario: Plain-text request files mirror the collection
      Then every request in the collection has an equivalent in the plain-text request files

    @US-07.4 @AC-07.4.4 @could
    Scenario: The collection passes against a freshly seeded stack
      Given the pipeline started a freshly seeded stack
      When the request collection runs headlessly
      Then every request assertion passes

  Rule: The mobile development server is available on demand

    @US-07.5 @AC-07.5.1 @could @mobile
    Scenario: The phone opens the app from the containerized dev server
      When the evaluator starts the stack with the mobile option
      Then the mobile dev server logs show a scannable code
      And a phone on a different network can load the app from it

    @US-07.5 @AC-07.5.2 @could @mobile @docs
    Scenario: The API address for devices is documented
      When the evaluator reads the mobile run instructions
      Then they explain how to set an API address reachable from a physical phone
      And the default API address works for an emulator on the same machine

    @US-07.5 @AC-07.5.3 @could @mobile
    Scenario: The default start does not run the mobile dev server
      When the evaluator runs the documented start command
      Then the mobile dev server is not running

  Rule: Every change passes the same gates before reaching main

    @US-07.6 @AC-07.6.1 @AC-07.6.2 @could
    Scenario Outline: Any failing gate fails the aggregate status
      Given a pull request where <gate> fails
      When the pipeline runs
      Then the aggregate status fails
      And the pull request cannot be merged

      Examples:
        | gate                   |
        | the commit convention  |
        | formatting             |
        | lint                   |
        | type check             |
        | unit tests             |
        | integration tests      |
        | build                  |
        | architecture rules     |
        | contract drift         |
        | dependency audit       |
        | fresh-stack smoke test |

    @US-07.6 @AC-07.6.1 @could
    Scenario: A change to main runs every gate except the commit-range check
      When a change is merged to main
      Then the pipeline runs every gate except the pull request commit-convention check

    @US-07.6 @AC-07.6.3 @could
    Scenario: A new push cancels the running pipeline
      Given the pipeline is running for a pull request
      When a new commit is pushed to that pull request
      Then the running pipeline is cancelled
      And a new pipeline starts for the new commit

    @US-07.6 @AC-07.6.4 @could
    Scenario: Unchanged packages reuse cached results
      Given a pull request that changes only mobile app files
      When the pipeline runs with a warm cache
      Then the API's lint, type check, unit test and build results are restored from cache
      And the pipeline completes in under 10 minutes

    @US-07.6 @AC-07.6.5 @could
    Scenario Outline: Coverage below the gate fails the pipeline
      Given <scope> line coverage is <coverage>
      When the pipeline runs
      Then the coverage gate <result>

      Examples:
        | scope        | coverage | result                       |
        | domain layer | 90 %     | passes                       |
        | domain layer | 89.9 %   | fails and reports the gap    |
        | API overall  | 80 %     | passes                       |
        | API overall  | 79 %     | fails and reports the gap    |

    @US-07.6 @AC-07.6.6 @could
    Scenario Outline: Mutation testing runs on schedule, on demand and on label
      Given <trigger>
      When the mutation run finishes with a score of <score>
      Then it <result>

      Examples:
        | trigger                                        | score | result |
        | the nightly schedule                           | 85 %  | passes |
        | a manual request                               | 80 %  | passes |
        | a pull request labelled for mutation testing   | 79 %  | fails  |

    @US-07.6 @AC-07.6.6 @could
    Scenario: Unlabelled pull requests do not run mutation testing
      Given a pull request without the mutation label
      When the pipeline runs
      Then mutation testing does not run

    @US-07.6 @AC-07.6.7 @could
    Scenario: A pull request from a fork is verified without secrets and nothing is deployed
      Given a pull request from a fork
      When the pipeline runs
      Then every gate runs without access to repository secrets
      And the pipeline has read-only repository permissions
      And nothing is deployed or published

    @US-07.6 @AC-07.6.8 @could
    Scenario: The fresh-stack smoke test proves the one-command run
      When the pipeline builds the images from the commit and starts the stack with the documented command
      Then the API becomes ready
      And the demo user can sign in and owns 3 teams and 10 tasks

  Rule: Architecture rules are enforced by tooling

    @US-07.7 @AC-07.7.1 @could
    Scenario Outline: Breaking a layering rule fails the check
      Given <offending dependency>
      When the architecture check runs
      Then it fails naming the rule "<rule>", the offending file and the import

      Examples:
        | offending dependency                                            | rule                          |
        | a domain file imports the persistence library                   | domain-is-pure                |
        | a domain file imports the web framework                         | domain-is-pure                |
        | a domain file imports an infrastructure file                    | domain-is-pure                |
        | a domain file imports an application file                       | domain-is-pure                |
        | an application file imports an infrastructure file              | application-not-to-infra      |
        | an application file imports a presentation file                 | application-not-to-presentation |
        | a presentation file imports an infrastructure file directly     | presentation-not-to-infra     |
        | the task context imports the team context's infrastructure      | contexts-via-ports            |
        | the mobile app imports a file from the API                      | mobile-not-to-api             |
        | two modules import each other                                   | no-circular                   |

    @US-07.7 @AC-07.7.2 @AC-07.7.3 @could
    Scenario: Compliant code passes locally and in the pipeline with the same command
      Given code that follows every layering rule
      When the architecture check runs locally and in the pipeline
      Then both runs pass using the same command

  Rule: The generated client never drifts from the API contract

    @US-07.8 @AC-07.8.1 @could
    Scenario: A contract change without regeneration fails
      Given a pull request adds a field to the task resource
      And the generated client was not regenerated
      When the contract drift check runs
      Then it fails
      And it shows the difference in the contract document and the generated client

    @US-07.8 @AC-07.8.2 @could
    Scenario: A contract change with the regenerated client passes
      Given a pull request adds a field to the task resource
      And the contract document and the generated client were regenerated and committed
      When the contract drift check runs
      Then it passes

    @US-07.8 @AC-07.8.3 @could
    Scenario: The contract is exported without a database
      Given no database and no network are available
      When the contract document is exported
      Then the export succeeds

    @US-07.8 @AC-07.8.4 @could
    Scenario: Generated files are protected from hand edits
      Then every generated client file is marked as generated
      And generated files are excluded from lint and formatting

  Rule: Dependencies are audited and kept up to date

    @US-07.9 @AC-07.9.1 @could
    Scenario Outline: Known vulnerabilities fail the audit unless explicitly accepted
      Given a dependency with a known <severity> advisory
      And <allowlist>
      When the dependency audit runs
      Then it <result>

      Examples:
        | severity | allowlist                                              | result |
        | critical | no allowlist entry                                     | fails  |
        | high     | no allowlist entry                                     | fails  |
        | moderate | no allowlist entry                                     | passes |
        | high     | an allowlist entry with justification and future expiry | passes |
        | high     | an allowlist entry whose expiry date has passed        | fails  |

    @US-07.9 @AC-07.9.2 @could
    Scenario: An outdated lockfile fails installation
      Given a manifest changed without updating the lockfile
      When the pipeline installs dependencies
      Then installation fails

    @US-07.9 @AC-07.9.3 @could
    Scenario: Weekly grouped update proposals follow the conventions
      When a week has passed
      Then update proposals exist for packages, pipeline actions and container base images
      And related updates are grouped into one proposal
      And their commit messages follow the commit conventions

  Rule: Commit and pull-request conventions are enforced

    @US-07.10 @AC-07.10.1 @could
    Scenario Outline: A commit violating the conventions fails the pipeline
      Given a pull request containing a commit with message "<message>"
      When the commit-convention check runs
      Then it <result>

      Examples:
        | message                                  | result                     |
        | feat(api): add task status filter        | passes                     |
        | fix(mobile): keep chip text readable     | passes                     |
        | added stuff                              | fails naming that commit   |
        | feat(backend): add filter                | fails naming that commit   |
        | Feat(api): Add filter.                   | fails naming that commit   |

    @US-07.10 @AC-07.10.2 @could
    Scenario: The local hook rejects bad messages and formats staged files
      Given a staged file with formatting issues
      When the developer commits with message "wip"
      Then the commit is rejected
      When the developer commits with message "docs(spec): clarify readiness timeout"
      Then the commit is created with the staged file formatted

    @US-07.10 @AC-07.10.3 @AC-07.10.4 @could @docs
    Scenario: Pull requests start from the template and protection is documented
      When a contributor opens a pull request
      Then its description starts from the template linking the task and ADRs with the quality checklist
      And the recommended main-branch protection settings are documented
