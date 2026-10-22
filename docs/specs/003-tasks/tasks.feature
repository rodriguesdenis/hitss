@api
Feature: Task management
  Marina captures tasks, assigns them to zero or more of her color-coded teams,
  finds them by team, status or text, sorts and pages through them, and moves
  them through a free status lifecycle. Completion time follows the Done status,
  overdue is derived, and nobody else can see or touch her tasks.

  Traceability: spec.md (US-03.n / AC-03.n.m). Error codes: api-contracts.md#error-codes.

  Background:
    Given I am signed in as "marina@example.com"
    And the current time is "2026-10-20T13:00:00Z"
    And I own the teams:
      | name    | color   |
      | Mobile  | #7C3AED |
      | Backend | #0EA5E9 |
      | Design  | #F59E0B |

  # ---------------------------------------------------------------------------
  Rule: A task is created from a valid title with sensible defaults

    @US-03.1 @AC-03.1.1 @must
    Scenario: Create a task with only a title
      When I create a task titled "Write release notes"
      Then the task is created
      And I receive its location and its version tag (ETag) for version 1
      And the task has:
        | status      | PENDING |
        | description | none    |
        | dueDate     | none    |
        | completedAt | none    |
        | teams       | none    |
        | version     | 1       |
        | createdAt   | 2026-10-20T13:00:00Z |
        | updatedAt   | 2026-10-20T13:00:00Z |

    @US-03.1 @AC-03.1.2 @must
    Scenario Outline: Title length boundaries (after trimming)
      When I create a task whose title is <length> characters long, padded with spaces
      Then the outcome is "<outcome>"

      Examples:
        | length | outcome                    |
        | 0      | VALIDATION_FAILED on title |
        | 2      | VALIDATION_FAILED on title |
        | 3      | created                    |
        | 120    | created                    |
        | 121    | VALIDATION_FAILED on title |

    @US-03.1 @AC-03.1.2 @must
    Scenario: Title is stored trimmed
      When I create a task titled "   Plan sprint   "
      Then the task's title is "Plan sprint"

    @US-03.1 @AC-03.1.8 @must @security
    Scenario Outline: Titles reject control characters
      When I create a task whose title contains <characters>
      Then the request is rejected with "VALIDATION_FAILED" on "title"
      And I still have 0 tasks

      Examples:
        | characters                   |
        | a newline between two words  |
        | a tab between two words      |
        | a NUL character              |
        | an escape character          |

    @US-03.1 @AC-03.1.2 @must
    Scenario: Title is required
      When I create a task without a title
      Then the request is rejected with "VALIDATION_FAILED" on "title"
      And I still have 0 tasks

    @US-03.1 @AC-03.1.3 @must
    Scenario Outline: Description boundaries
      When I create a task titled "Document API" with a description of <length> characters
      Then the outcome is "<outcome>"

      Examples:
        | length | outcome                          |
        | 2000   | created                          |
        | 2001   | VALIDATION_FAILED on description |

    @US-03.1 @AC-03.1.3 @must
    Scenario: A blank description is stored as none
      When I create a task titled "Document API" with the description "   "
      Then the task has no description

    @US-03.1 @AC-03.1.4 @must
    Scenario Outline: Initial status
      When I create a task titled "Fix crash" with status "<status>"
      Then the outcome is "<outcome>"

      Examples:
        | status      | outcome                     |
        | PENDING     | created                     |
        | IN_PROGRESS | created                     |
        | DONE        | created                     |
        | pending     | VALIDATION_FAILED on status |
        | BLOCKED     | VALIDATION_FAILED on status |
        |             | VALIDATION_FAILED on status |

    @US-03.1 @AC-03.1.4 @must
    Scenario: Creating a task directly as Done records its completion time
      When I create a task titled "Already shipped" with status "DONE"
      Then the task's completion time is "2026-10-20T13:00:00Z"

    @US-03.1 @AC-03.1.5 @must
    Scenario Outline: Due date must be a real calendar date
      When I create a task titled "Prepare demo" due "<dueDate>"
      Then the outcome is "<outcome>"

      Examples:
        | dueDate              | outcome                      |
        | 2026-10-31           | created                      |
        | 2020-01-15           | created                      |
        | 2028-02-29           | created                      |
        | 2026-02-29           | VALIDATION_FAILED on dueDate |
        | 2026-13-01           | VALIDATION_FAILED on dueDate |
        | 2026-04-31           | VALIDATION_FAILED on dueDate |
        | 31/10/2026           | VALIDATION_FAILED on dueDate |
        | 20261031             | VALIDATION_FAILED on dueDate |
        | 2026-10-31T10:00:00Z | VALIDATION_FAILED on dueDate |
        | tomorrow             | VALIDATION_FAILED on dueDate |

    @US-03.1 @AC-03.1.7 @must
    Scenario Outline: Fields outside the contract are rejected
      When I create a task titled "Sneaky" that also sets "<field>"
      Then the request is rejected with "VALIDATION_FAILED" on "<field>"
      And I still have 0 tasks

      Examples:
        | field       |
        | id          |
        | ownerId     |
        | owner_id    |
        | userId      |
        | owner       |
        | version     |
        | completedAt |
        | isOverdue   |
        | createdAt   |
        | updatedAt   |
        | deletedAt   |
        | priority    |
        | __proto__   |
        | constructor |

    @US-03.1 @AC-03.1.7 @must @security
    Scenario: An owner given as an object is rejected, not merged
      When I create a task titled "Sneaky" that also sets "owner" to an object holding Joao's id
      Then the request is rejected with "VALIDATION_FAILED" on "owner"
      And I still have 0 tasks

  # ---------------------------------------------------------------------------
  Rule: A task belongs to 0 to 10 distinct teams of its owner

    @US-03.1 @AC-03.1.6 @must
    Scenario: Create a task assigned to two teams
      When I create a task titled "Release 1.0" assigned to "Mobile, Backend"
      Then the task is created
      And the task shows the teams:
        | name    | color   |
        | Backend | #0EA5E9 |
        | Mobile  | #7C3AED |

    @US-03.1 @AC-03.1.6 @must
    Scenario Outline: Team count boundaries
      Given I own <owned> teams in total
      When I create a task assigned to <count> distinct teams of mine
      Then the outcome is "<outcome>"

      Examples:
        | owned | count | outcome        |
        | 11    | 0     | created        |
        | 11    | 1     | created        |
        | 11    | 10    | created        |
        | 11    | 11    | TOO_MANY_TEAMS |

    @US-03.1 @AC-03.1.6 @must
    Scenario: The same team twice is rejected
      When I create a task assigned to "Mobile, Mobile"
      Then the request is rejected with "VALIDATION_FAILED" on "teamIds"

    @US-03.1 @AC-03.1.6 @must
    Scenario: A malformed team id is rejected
      When I create a task assigned to the team id "not-a-uuid"
      Then the request is rejected with "VALIDATION_FAILED" on "teamIds"

    @US-03.1 @AC-03.1.6 @must
    Scenario: Unknown teams are reported precisely and nothing is created
      Given a well-formed team id "X" that does not exist
      And the team "Design" has been deleted
      When I create a task assigned to "Mobile", "X" and "Design"
      Then the request is rejected with "UNKNOWN_TEAMS"
      And the error lists exactly the ids of "X" and "Design"
      And I still have 0 tasks

    @US-03.1 @AC-03.1.6 @must @security
    Scenario: A foreign team and a never-existing team are indistinguishable
      Given "joao@example.com" owns the team "Ops"
      And a well-formed team id "X" that does not exist
      When I create a task assigned to the team "Ops" of "joao@example.com"
      And I create a task assigned to the team id "X"
      Then both requests are rejected with status 422 and code "UNKNOWN_TEAMS"
      And each error lists exactly the id that was sent
      And the two response bodies are identical apart from that id and the trace id

    @US-03.1 @AC-03.1.6 @must
    Scenario: Team count is checked before team existence
      When I create a task assigned to 11 team ids none of which exist
      Then the request is rejected with "TOO_MANY_TEAMS"

  # ---------------------------------------------------------------------------
  Rule: Listing returns my live tasks as full task views with metadata

    @US-03.2 @AC-03.2.1 @AC-03.2.2 @must
    Scenario: Default listing is newest first with metadata
      Given I have 25 tasks created one minute apart
      When I list my tasks
      Then I receive 20 tasks, newest created first
      And each task is a full task view with its teams embedded
      And the metadata is total 25, limit 20, offset 0, has next page "yes"

    @US-03.2 @AC-03.2.3 @must
    Scenario: Deleted tasks never appear
      Given I have the tasks "A", "B" and "C"
      And the task "B" has been deleted
      When I list my tasks
      Then I receive exactly the tasks "A" and "C"
      And the total is 2

    @US-03.2 @AC-03.2.4 @must
    Scenario: Empty list
      Given I have no tasks
      When I list my tasks
      Then I receive no tasks
      And the metadata is total 0, limit 20, offset 0, has next page "no"

    @US-03.2 @AC-03.2.5 @must
    Scenario: Embedded teams are ordered by name
      Given I have a task "Cross-team" assigned to "Mobile, Design, Backend"
      When I list my tasks
      Then the task "Cross-team" shows the teams "Backend, Design, Mobile" in this order

  # ---------------------------------------------------------------------------
  Rule: Filters narrow the list; filters combine with AND, statuses with OR

    Background:
      Given I have the tasks:
        | title              | description            | status      | teams           |
        | Login screen       | Email and password     | IN_PROGRESS | Mobile          |
        | Login API          | Session endpoint       | PENDING     | Backend         |
        | Release notes      | Summarize LOGIN fixes  | DONE        | Mobile, Backend |
        | Color tokens       | Palette for chips      | PENDING     | Design          |
        | Personal errand    |                        | PENDING     |                 |

    @US-03.3 @AC-03.3.1 @must
    Scenario: Filter by team includes multi-team tasks with all their teams
      When I list tasks of the team "Mobile"
      Then I receive exactly the tasks "Login screen" and "Release notes"
      And the task "Release notes" shows the teams "Backend, Mobile"

    @US-03.3 @AC-03.3.2 @must
    Scenario Outline: Filtering by a team without visible tasks returns an empty list
      Given <situation>
      When I list tasks of that team
      Then I receive no tasks
      And the total is 0

      Examples:
        | situation                                         |
        | a well-formed team id that does not exist         |
        | a team "Infra" of mine with no tasks              |
        | the team "Design" has been deleted                |

    @US-03.3 @AC-03.3.3 @must
    Scenario: Malformed team id in the filter
      When I list tasks of the team id "123"
      Then the request is rejected with "VALIDATION_FAILED" on "teamId"

    @US-03.4 @AC-03.4.1 @AC-03.4.2 @must
    Scenario Outline: Filter by one or several statuses
      When I list tasks with status "<status>"
      Then I receive exactly the tasks <tasks>

      Examples:
        | status                   | tasks                                                       |
        | PENDING                  | "Login API", "Color tokens" and "Personal errand"           |
        | DONE                     | "Release notes"                                             |
        | PENDING,IN_PROGRESS      | "Login screen", "Login API", "Color tokens" and "Personal errand" |
        | PENDING,IN_PROGRESS,DONE | all 5 tasks                                                 |
        | DONE,DONE                | "Release notes"                                             |

    @US-03.4 @AC-03.4.3 @must
    Scenario Outline: Invalid status filters are rejected
      When I list tasks with status "<status>"
      Then the request is rejected with "VALIDATION_FAILED" on "status"

      Examples:
        | status          |
        | done            |
        | ARCHIVED        |
        | PENDING,UNKNOWN |
        | PENDING,        |
        |                 |

    @US-03.5 @AC-03.5.1 @AC-03.5.4 @must
    Scenario Outline: Search matches title or description, ignoring case
      When I search tasks for "<term>"
      Then I receive exactly the tasks <tasks>

      Examples:
        | term     | tasks                                              |
        | login    | "Login screen", "Login API" and "Release notes"    |
        | PALETTE  | "Color tokens"                                     |
        | endpoint | "Login API"                                        |
        | zzz      | none                                               |

    @US-03.5 @AC-03.5.2 @must
    Scenario Outline: Search term boundaries
      When I search tasks for a term of <length> characters
      Then the outcome is "<outcome>"

      Examples:
        | length | outcome                     |
        | 0      | VALIDATION_FAILED on search |
        | 1      | listed                      |
        | 100    | listed                      |
        | 101    | VALIDATION_FAILED on search |

    @US-03.5 @AC-03.5.2 @must
    Scenario: A blank search term is rejected
      When I search tasks for "   "
      Then the request is rejected with "VALIDATION_FAILED" on "search"

    @US-03.5 @AC-03.5.3 @must
    Scenario Outline: Search treats special characters literally
      Given I have a task titled "Reach 100% coverage"
      And I have a task titled "Reach 1000 users"
      And I have a task titled "snake_case names"
      And I have a task titled "snakeXcase names"
      When I search tasks for "<term>"
      Then I receive exactly the tasks <tasks>

      Examples:
        | term       | tasks                   |
        | 100%       | "Reach 100% coverage"   |
        | snake_case | "snake_case names"      |
        | \          | none                    |

    @US-03.4 @US-03.3 @US-03.5 @AC-03.4.4 @must
    Scenario Outline: Filters combine
      When I list tasks with team "<team>", status "<status>" and search "<search>"
      Then I receive exactly the tasks <tasks>

      Examples:
        | team    | status              | search | tasks                              |
        | Mobile  | PENDING,IN_PROGRESS | login  | "Login screen"                     |
        | Backend | PENDING,IN_PROGRESS | login  | "Login API"                        |
        | Backend | DONE                | login  | "Release notes"                    |
        | Design  | DONE                | color  | none                               |
        |         | PENDING             | login  | "Login API"                        |

  # ---------------------------------------------------------------------------
  Rule: Sorting is whitelisted, deterministic and puts missing due dates last

    Background:
      Given I have the tasks:
        | title   | status      | dueDate    | createdAt            | updatedAt            |
        | bravo   | DONE        | 2026-10-25 | 2026-10-01T10:00:00Z | 2026-10-05T10:00:00Z |
        | Alpha   | PENDING     |            | 2026-10-02T10:00:00Z | 2026-10-02T10:00:00Z |
        | charlie | IN_PROGRESS | 2026-10-21 | 2026-10-03T10:00:00Z | 2026-10-04T10:00:00Z |
        | Delta   | PENDING     | 2026-10-21 | 2026-10-04T10:00:00Z | 2026-10-06T10:00:00Z |
        | echo    | PENDING     |            | 2026-10-05T10:00:00Z | 2026-10-05T11:00:00Z |

    @US-03.6 @AC-03.6.1 @AC-03.6.2 @AC-03.6.3 @must
    Scenario Outline: Sort by an allowed field
      When I list my tasks sorted by "<sort>"
      Then the tasks come in the order <order>

      Examples:
        | sort       | order                                      |
        |            | echo, Delta, charlie, Alpha, bravo         |
        | -createdAt | echo, Delta, charlie, Alpha, bravo         |
        | createdAt  | bravo, Alpha, charlie, Delta, echo         |
        | -updatedAt | Delta, echo, bravo, charlie, Alpha         |
        | title      | Alpha, bravo, charlie, Delta, echo         |
        | -title     | echo, Delta, charlie, bravo, Alpha         |
        | dueDate    | charlie or Delta (tie), the other, bravo, then Alpha and echo (no due date) |
        | -dueDate   | bravo, charlie and Delta (tie), then Alpha and echo (no due date)          |
        | status     | the three PENDING tasks, charlie, bravo    |
        | -status    | bravo, charlie, the three PENDING tasks    |

    @US-03.6 @AC-03.6.3 @must
    Scenario Outline: Tasks without due date come last in both directions
      When I list my tasks sorted by "<sort>"
      Then the last two tasks are "Alpha" and "echo"

      Examples:
        | sort     |
        | dueDate  |
        | -dueDate |

    @US-03.6 @AC-03.6.4 @must
    Scenario Outline: Ties are broken by id, in the sort direction
      When I list my tasks sorted by "<sort>"
      Then tasks sharing the same <field> are ordered by id <direction>
      And repeating the request returns exactly the same order

      Examples:
        | sort     | field   | direction  |
        | status   | status  | ascending  |
        | -status  | status  | descending |
        | dueDate  | dueDate | ascending  |

    @US-03.6 @AC-03.6.4 @AC-03.7.5 @must
    Scenario: Pages of a tied sort never overlap
      Given I have 30 more tasks with status "PENDING"
      When I walk all pages of tasks sorted by "status" with limit 7
      Then every task appears exactly once

    @US-03.6 @AC-03.6.5 @must
    Scenario Outline: Invalid sort values are rejected
      When I list my tasks sorted by "<sort>"
      Then the request is rejected with "VALIDATION_FAILED" on "sort"

      Examples:
        | sort              |
        | priority          |
        | --title           |
        | +title            |
        | title,-createdAt  |
        | ownerId           |
        | -                 |

  # ---------------------------------------------------------------------------
  Rule: Pagination is offset-based with accurate metadata

    Background:
      Given I have 45 tasks

    @US-03.7 @AC-03.7.1 @AC-03.7.2 @AC-03.7.3 @must
    Scenario Outline: Page metadata
      When I list my tasks with limit <limit> and offset <offset>
      Then I receive <count> tasks
      And the metadata is total 45, limit <limit>, offset <offset>, has next page "<next>"

      Examples:
        | limit | offset | count | next |
        | 20    | 0      | 20    | yes  |
        | 20    | 20     | 20    | yes  |
        | 20    | 40     | 5     | no   |
        | 20    | 25     | 20    | no   |
        | 1     | 44     | 1     | no   |
        | 100   | 0      | 45    | no   |
        | 20    | 45     | 0     | no   |
        | 20    | 1000   | 0     | no   |

    @US-03.7 @AC-03.7.2 @must
    Scenario: Total counts matches of the filters, not the page
      Given 12 of my tasks are "DONE"
      When I list tasks with status "DONE" and limit 5
      Then I receive 5 tasks
      And the total is 12

    @US-03.7 @AC-03.7.4 @must
    Scenario Outline: Invalid pagination parameters are rejected
      When I list my tasks with <param> "<value>"
      Then the request is rejected with "VALIDATION_FAILED" on "<param>"

      Examples:
        | param  | value |
        | limit  | 0     |
        | limit  | 101   |
        | limit  | -1    |
        | limit  | 2.5   |
        | limit  | ten   |
        | offset | -1    |
        | offset | 1.5   |
        | offset | x     |

    @US-03.7 @AC-03.7.5 @must
    Scenario: Walking all pages returns each task exactly once
      When I walk all pages of my tasks with limit 10
      Then I visit 5 pages
      And every one of the 45 tasks appears exactly once

  # ---------------------------------------------------------------------------
  Rule: A single task is viewed with everything needed to display it

    @US-03.8 @AC-03.8.1 @must
    Scenario: View a task
      Given I have a task "Release 1.0" with status "IN_PROGRESS", due "2026-10-31", assigned to "Mobile"
      When I view the task "Release 1.0"
      Then I receive its task view with:
        | title       | Release 1.0 |
        | status      | IN_PROGRESS |
        | dueDate     | 2026-10-31  |
        | completedAt | none        |
        | isOverdue   | false       |
        | version     | 1           |
      And it shows the team "Mobile" with color "#7C3AED"
      And I receive its version tag (ETag) for version 1

    @US-03.8 @AC-03.8.2 @must
    Scenario Outline: Viewing a missing task
      Given <situation>
      When I view that task
      Then the request is rejected with "TASK_NOT_FOUND"

      Examples:
        | situation                                     |
        | a well-formed task id that does not exist     |
        | a task of mine that has been deleted          |

    @US-03.8 @AC-03.8.3 @must
    Scenario: Viewing with a malformed id
      When I view the task with id "abc"
      Then the request is rejected with "VALIDATION_FAILED" on "id"

  # ---------------------------------------------------------------------------
  Rule: Editing replaces the editable fields of a task

    Background:
      Given I have a task "Draft" with description "v1", status "PENDING", due "2026-10-30", assigned to "Mobile, Backend", at version 1

    @US-03.9 @AC-03.9.1 @must
    Scenario: Replace all editable fields
      Given the current time is "2026-10-21T09:00:00Z"
      When I edit the task "Draft" to title "Final", description "v2", status "IN_PROGRESS", due "2026-11-02", teams "Design"
      Then the task has title "Final", description "v2", status "IN_PROGRESS", due "2026-11-02"
      And it shows only the team "Design"
      And its version is 2
      And its updated time is "2026-10-21T09:00:00Z"
      And its created time is unchanged

    @US-03.9 @AC-03.9.2 @must
    Scenario: Omitted optional fields are cleared and an empty team list unassigns all
      When I edit the task "Draft" to title "Draft", status "PENDING", teams none, and no description or due date
      Then the task has no description, no due date and no teams

    @US-03.9 @AC-03.9.2 @must
    Scenario: Reassigning teams replaces the whole set
      When I edit the task "Draft" keeping everything but teams "Backend, Design"
      Then it shows exactly the teams "Backend, Design"

    @US-03.9 @AC-03.9.3 @must
    Scenario Outline: Required fields on edit
      When I edit the task "Draft" without "<field>"
      Then the request is rejected with "VALIDATION_FAILED" on "<field>"
      And the task "Draft" is unchanged at version 1

      Examples:
        | field   |
        | title   |
        | status  |
        | teamIds |

    @US-03.9 @AC-03.9.3 @must
    Scenario Outline: Create rules apply to edits
      When I edit the task "Draft" with <change>
      Then the request is rejected with "<code>"
      And the task "Draft" is unchanged at version 1

      Examples:
        | change                                   | code              |
        | a title of 2 characters                  | VALIDATION_FAILED |
        | a title of 121 characters                | VALIDATION_FAILED |
        | a description of 2001 characters         | VALIDATION_FAILED |
        | the due date "2026-02-30"                | VALIDATION_FAILED |
        | the status "CANCELLED"                   | VALIDATION_FAILED |
        | 11 teams                                 | TOO_MANY_TEAMS    |
        | a team that does not exist               | UNKNOWN_TEAMS     |
        | the extra field "ownerId"                | VALIDATION_FAILED |
        | the extra field "owner_id"               | VALIDATION_FAILED |
        | the extra field "userId"                 | VALIDATION_FAILED |
        | the extra field "owner" holding an object | VALIDATION_FAILED |
        | the extra field "updatedAt"              | VALIDATION_FAILED |
        | the extra field "deletedAt"              | VALIDATION_FAILED |
        | the extra field "__proto__"              | VALIDATION_FAILED |
        | the extra field "constructor"            | VALIDATION_FAILED |
        | a title containing a control character   | VALIDATION_FAILED |

    @US-03.9 @AC-03.9.4 @must
    Scenario: Editing into Done records completion; editing out of Done clears it
      When I edit the task "Draft" keeping everything but status "DONE"
      Then the task's completion time is "2026-10-20T13:00:00Z"
      When I edit the task "Draft" keeping everything but status "PENDING"
      Then the task has no completion time

    @US-03.9 @AC-03.9.5 @must
    Scenario: An identical replacement is a no-op
      Given the current time is "2026-10-21T09:00:00Z"
      When I edit the task "Draft" with exactly its current values, teams listed as "Backend, Mobile"
      Then the edit succeeds
      And its version is 1
      And its updated time is "2026-10-20T13:00:00Z"

    @US-03.9 @AC-03.9.6 @must
    Scenario Outline: Editing a missing task
      Given <situation>
      When I edit that task with valid values
      Then the request is rejected with "TASK_NOT_FOUND"

      Examples:
        | situation                                     |
        | a well-formed task id that does not exist     |
        | a task of mine that has been deleted          |

  # ---------------------------------------------------------------------------
  Rule: Status transitions are free and completion time follows Done

    @US-03.10 @AC-03.10.1 @AC-03.10.2 @AC-03.10.3 @must
    Scenario Outline: Status transition matrix
      Given I have a task "Ship it" with status "<from>" at version 3
      And if it is "DONE" it was completed at "2026-10-19T08:00:00Z"
      And the current time is "2026-10-20T13:00:00Z"
      When I change the status of "Ship it" to "<to>"
      Then the change succeeds
      And its status is "<to>"
      And its version is <version>
      And its completion time is "<completedAt>"

      Examples:
        | from        | to          | version | completedAt          |
        | PENDING     | PENDING     | 3       | none                 |
        | PENDING     | IN_PROGRESS | 4       | none                 |
        | PENDING     | DONE        | 4       | 2026-10-20T13:00:00Z |
        | IN_PROGRESS | PENDING     | 4       | none                 |
        | IN_PROGRESS | IN_PROGRESS | 3       | none                 |
        | IN_PROGRESS | DONE        | 4       | 2026-10-20T13:00:00Z |
        | DONE        | PENDING     | 4       | none                 |
        | DONE        | IN_PROGRESS | 4       | none                 |
        | DONE        | DONE        | 3       | 2026-10-19T08:00:00Z |

    @US-03.10 @AC-03.10.1 @AC-03.10.3 @must
    Scenario Outline: Updated time moves only on a real change
      Given I have a task "Ship it" with status "<from>" last updated at "2026-10-19T08:00:00Z"
      When I change the status of "Ship it" to "<to>"
      Then its updated time is "<updatedAt>"

      Examples:
        | from    | to      | updatedAt            |
        | PENDING | DONE    | 2026-10-20T13:00:00Z |
        | PENDING | PENDING | 2026-10-19T08:00:00Z |

    @US-03.10 @AC-03.10.1 @must
    Scenario: A no-op status change keeps the version tag
      Given I have a task "Ship it" with status "DONE" at version 3
      When I change the status of "Ship it" to "DONE"
      Then the response is 200 with the task
      And the response carries the version tag (ETag) for version 3

    @US-03.10 @AC-03.10.5 @must
    Scenario: A status change touches nothing else
      Given I have a task "Ship it" with description "notes", due "2026-10-31", assigned to "Mobile"
      When I change the status of "Ship it" to "DONE"
      Then its title, description, due date and teams are unchanged

    @US-03.10 @AC-03.10.4 @must
    Scenario Outline: Invalid status change requests
      Given I have a task "Ship it" with status "PENDING" at version 1
      When I change the status of "Ship it" with <body>
      Then the request is rejected with "VALIDATION_FAILED"
      And the task "Ship it" is unchanged at version 1

      Examples:
        | body                                  |
        | no status                             |
        | the status "FINISHED"                 |
        | the status "done"                     |
        | the status "DONE" and title "Hacked"  |

    @US-03.10 @AC-03.10.6 @must
    Scenario Outline: Changing the status of a missing task
      Given <situation>
      When I change the status of that task to "DONE"
      Then the request is rejected with "TASK_NOT_FOUND"

      Examples:
        | situation                                     |
        | a well-formed task id that does not exist     |
        | a task of mine that has been deleted          |

  # ---------------------------------------------------------------------------
  Rule: Deleting archives a task; it vanishes from every read and write

    @US-03.11 @AC-03.11.1 @must
    Scenario: Delete a task
      Given I have a task "Obsolete" assigned to "Mobile"
      When I delete the task "Obsolete"
      Then the deletion succeeds with no content
      And viewing, editing or changing the status of "Obsolete" is rejected with "TASK_NOT_FOUND"
      And "Obsolete" appears in no list, whatever the filters

    @US-03.11 @AC-03.11.2 @must
    Scenario Outline: Deleting a missing task
      Given <situation>
      When I delete that task
      Then the request is rejected with "TASK_NOT_FOUND"

      Examples:
        | situation                                     |
        | a well-formed task id that does not exist     |
        | a task of mine that has been deleted          |

    @US-03.11 @AC-03.11.3 @must
    Scenario: A deleted task no longer counts for its teams
      Given the team "Mobile" has 2 tasks
      When I delete one of them
      Then the team "Mobile" has a task count of 1

  # ---------------------------------------------------------------------------
  Rule: Tasks are private to their owner

    Background:
      Given "joao@example.com" owns the team "Ops" and the task "Joao's secret" assigned to it

    @US-03.12 @AC-03.12.1 @must
    Scenario Outline: Another user's task behaves as non-existent
      When I <operation> the task "Joao's secret"
      Then the request is rejected with "TASK_NOT_FOUND"
      And "Joao's secret" is unchanged for "joao@example.com"

      Examples:
        | operation                       |
        | view                            |
        | edit with valid values          |
        | change the status to "DONE" of  |
        | delete                          |

    @US-03.12 @AC-03.12.6 @must @security
    Scenario: The owner of a new task is always the signed-in user
      When I create a task titled "Mine"
      Then the task belongs to "marina@example.com"
      And it does not appear in the list of "joao@example.com"

    @US-03.12 @AC-03.12.2 @must
    Scenario: Another user's tasks never appear in my lists
      Given I have the task "Mine"
      When I list my tasks searching for "secret"
      Then I receive no tasks
      When I list my tasks
      Then I receive exactly the task "Mine"

    @US-03.12 @AC-03.12.3 @must
    Scenario Outline: Another user's team cannot be assigned
      When I <operation> assigned to "Mobile" and the team "Ops" of "joao@example.com"
      Then the request is rejected with "UNKNOWN_TEAMS"
      And the error lists exactly the id of "Ops"

      Examples:
        | operation                 |
        | create a task "Mine"      |
        | edit my task "Mine"       |

    @US-03.12 @AC-03.12.4 @must
    Scenario: Filtering by another user's team returns nothing
      When I list tasks of the team "Ops" of "joao@example.com"
      Then I receive no tasks
      And the total is 0

    @US-03.12 @AC-03.12.5 @must
    Scenario Outline: Task operations require a session
      Given I am not signed in
      When I <operation>
      Then the request is rejected with "UNAUTHENTICATED"

      Examples:
        | operation                 |
        | list tasks                |
        | view a task               |
        | create a task             |
        | edit a task               |
        | change a task's status    |
        | delete a task             |

  # ---------------------------------------------------------------------------
  Rule: Deleting a team unassigns it; its tasks survive

    Background:
      Given I have the tasks:
        | title     | status | teams           | completedAt          | version |
        | Shared    | DONE   | Mobile, Backend | 2026-10-18T10:00:00Z | 2       |
        | Only mob  | PENDING | Mobile          |                      | 1       |
        | Untouched | PENDING | Design          |                      | 1       |

    @US-03.13 @AC-03.13.1 @AC-03.13.2 @AC-03.2.5 @must
    Scenario: Tasks survive the deletion of their team
      When I delete the team "Mobile"
      Then I still have 3 tasks
      And the task "Shared" shows only the team "Backend"
      And the task "Only mob" shows no teams
      And the task "Shared" still has status "DONE" and completion time "2026-10-18T10:00:00Z"
      And the task "Untouched" is unchanged

    @US-03.13 @AC-03.13.3 @must
    Scenario: Filtering by a deleted team returns nothing
      When I delete the team "Mobile"
      And I list tasks of the team "Mobile"
      Then I receive no tasks

    @US-03.13 @AC-03.13.4 @must
    Scenario: Unassignment produces a new version of each affected task
      When I delete the team "Mobile"
      Then the task "Shared" is at version 3
      And the task "Only mob" is at version 2
      And the task "Untouched" is at version 1

  # ---------------------------------------------------------------------------
  Rule: Overdue is derived from due date, status and today

    @US-03.14 @AC-03.14.1 @AC-03.14.2 @could
    Scenario Outline: Overdue flag
      Given today is "2026-10-20"
      And I have a task with status "<status>" and due date "<dueDate>"
      When I view that task
      Then it is overdue: "<overdue>"

      Examples:
        | status      | dueDate    | overdue |
        | PENDING     | 2026-10-19 | yes     |
        | IN_PROGRESS | 2026-01-01 | yes     |
        | PENDING     | 2026-10-20 | no      |
        | PENDING     | 2026-10-21 | no      |
        | PENDING     |            | no      |
        | DONE        | 2026-10-19 | no      |

    @US-03.14 @AC-03.14.3 @could
    Scenario: Reopening a late Done task makes it overdue
      Given I have a task "Late" with status "DONE" and due date "2026-10-01"
      When I change the status of "Late" to "IN_PROGRESS"
      Then the task "Late" is overdue

    @US-03.14 @AC-03.14.3 @could
    Scenario: A task becomes overdue as days pass, without changing
      Given I have a task "Tomorrow" with status "PENDING" and due date "2026-10-21" at version 1
      When the current time becomes "2026-10-22T00:00:01Z"
      Then the task "Tomorrow" is overdue
      And it is still at version 1

  # ---------------------------------------------------------------------------
  Rule: Stale writes are rejected when the client sends the version it last saw

    Background:
      Given I have a task "Contended" with status "PENDING" at version 3

    @US-03.15 @AC-03.15.1 @could
    Scenario Outline: Single-task responses carry the version tag
      When I <operation> the task "Contended"
      Then the response carries the version tag of version <version>

      Examples:
        | operation                         | version |
        | view                              | 3       |
        | create (response of the POST)     | 1       |
        | change the status to "DONE" of    | 4       |
        | edit with a new title             | 4       |

    @US-03.15 @AC-03.15.2 @AC-03.15.3 @could
    Scenario Outline: Conditional writes
      When I <operation> the task "Contended" expecting version <expected>
      Then the outcome is "<outcome>"
      And the task "Contended" is at version <after>

      Examples:
        | operation                       | expected | outcome             | after   |
        | edit with a new title           | 3        | success             | 4       |
        | edit with a new title           | 2        | PRECONDITION_FAILED | 3       |
        | change the status to "DONE" of  | 3        | success             | 4       |
        | change the status to "DONE" of  | 2        | PRECONDITION_FAILED | 3       |
        | change the status to "PENDING" of | 2      | PRECONDITION_FAILED | 3       |
        | delete                          | 3        | success             | deleted |
        | delete                          | 4        | PRECONDITION_FAILED | 3       |
        | edit with a new title           | garbage  | PRECONDITION_FAILED | 3       |

    @US-03.15 @AC-03.15.3 @could
    Scenario: The conflict reports the current version
      When I edit the task "Contended" with a new title expecting version 1
      Then the request is rejected with "PRECONDITION_FAILED"
      And the error reports the current version 3

    @US-03.15 @AC-03.15.3 @could
    Scenario Outline: Validation runs before the version check
      When I <operation> the task "Contended" with <change> expecting version 1
      Then the request is rejected with "VALIDATION_FAILED"
      And it is not rejected with "PRECONDITION_FAILED"
      And the task "Contended" is unchanged at version 3

      Examples:
        | operation                         | change                 |
        | edit                              | a title of 2 characters |
        | edit                              | the extra field "ownerId" |
        | change the status of              | the status "FINISHED"  |

    @US-03.15 @AC-03.15.3 @could
    Scenario: A malformed version tag together with an invalid body is a validation error
      When I edit the task "Contended" with a title of 2 characters expecting version "garbage"
      Then the request is rejected with "VALIDATION_FAILED"

    @US-03.15 @AC-03.15.3 @could
    Scenario: The version check comes before the no-op shortcut
      When I change the status of "Contended" to "PENDING" expecting version 1
      Then the request is rejected with "PRECONDITION_FAILED"
      And the error reports the current version 3

    @US-03.15 @AC-03.15.5 @could @security
    Scenario Outline: Not found takes precedence over the version check
      Given "joao@example.com" owns the task "Joao's secret"
      When I <operation> the task "Joao's secret" expecting version 1
      Then the request is rejected with "TASK_NOT_FOUND"
      And "Joao's secret" is unchanged for "joao@example.com"

      Examples:
        | operation                       |
        | edit with a new title           |
        | change the status to "DONE" of  |
        | delete                          |

    @US-03.15 @AC-03.15.4 @could
    Scenario: Without an expected version the last write wins
      When I edit the task "Contended" with a new title without an expected version
      Then the edit succeeds
      And the task "Contended" is at version 4

    @US-03.15 @AC-03.15.3 @could
    Scenario: Two devices racing on the same version
      Given two devices both last saw version 3 of "Contended"
      When both change its status at the same time expecting version 3
      Then exactly one change succeeds
      And the other is rejected with "PRECONDITION_FAILED"
      And the task "Contended" is at version 4

  # ---------------------------------------------------------------------------
  Rule: Retrying a create with the same idempotency key never duplicates

    @US-03.16 @AC-03.16.1 @could
    Scenario: A retried create replays the original response
      Given I created the task "Buy milk" with idempotency key "K1"
      When I create the task "Buy milk" again with idempotency key "K1" 10 minutes later
      Then I receive the original response, with the same status, body, location and version tag
      And the response carries the header "Idempotent-Replayed: true"
      And I have exactly 1 task titled "Buy milk"

    @US-03.16 @AC-03.16.1 @AC-03.16.6 @could @concurrency
    Scenario: Concurrent identical creations with the same key
      When I send the same creation of the task "Buy milk" twice at the same time with idempotency key "K1"
      Then exactly 1 task titled "Buy milk" is created
      And one request receives the 201 creation
      And the other receives either the 201 replay or status 409 with code "IDEMPOTENCY_REQUEST_IN_PROGRESS"

    @US-03.16 @AC-03.16.6 @could @concurrency
    Scenario: A request arriving while the first is still processing is not queued
      Given a creation of the task "Buy milk" with idempotency key "K1" is still being processed
      When I create the task "Buy milk" again with idempotency key "K1"
      Then the request is rejected immediately with "IDEMPOTENCY_REQUEST_IN_PROGRESS"
      And the response carries a "Retry-After" value of 1
      And I have no more than 1 task titled "Buy milk"

    @US-03.16 @AC-03.16.2 @could
    Scenario: Reusing a key with different content is rejected
      Given I created the task "Buy milk" with idempotency key "K1"
      When I create the task "Buy bread" with idempotency key "K1"
      Then the request is rejected with "IDEMPOTENCY_KEY_REUSED"
      And I have no task titled "Buy bread"

    @US-03.16 @AC-03.16.3 @could
    Scenario: Keys are scoped per user
      Given I created the task "Buy milk" with idempotency key "K1"
      When "joao@example.com" creates the task "Buy milk" with idempotency key "K1"
      Then "joao@example.com" receives a new task with a different id

    @US-03.16 @AC-03.16.7 @could @concurrency @security
    Scenario: Another user's identical key is never blocked by an in-flight request
      Given a creation by "joao@example.com" with idempotency key "K1" is still being processed
      When I create the task "Buy milk" with idempotency key "K1"
      Then the task is created
      And I do not receive "IDEMPOTENCY_REQUEST_IN_PROGRESS"

    @US-03.16 @AC-03.16.8 @could
    Scenario: A key used for a task cannot be reused for a team
      Given I created the task "Buy milk" with idempotency key "K1"
      When I create a team named "Platform" with idempotency key "K1"
      Then the request is rejected with "IDEMPOTENCY_KEY_REUSED"
      And no team named "Platform" exists

    @US-03.16 @AC-03.16.2 @could @security
    Scenario: The request fingerprint ignores prototype keys
      Given two request bodies that differ only by a "__proto__" or "constructor" key
      When the idempotency fingerprint of each is computed
      Then both fingerprints are identical
      And no prototype pollution occurs

    @US-03.16 @AC-03.16.4 @could
    Scenario: A malformed idempotency key is rejected
      When I create the task "Buy milk" with idempotency key "not-a-uuid"
      Then the request is rejected with "VALIDATION_FAILED"

    @US-03.16 @AC-03.16.5 @could
    Scenario: A key expires after 24 hours
      Given I created the task "Buy milk" with idempotency key "K1"
      When I create the task "Buy milk" again with idempotency key "K1" 25 hours later
      Then a new task is created
      And I have exactly 2 tasks titled "Buy milk"
