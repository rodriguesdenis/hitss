@api @teams
Feature: Team management
  Marina organizes her tasks into color-coded teams. She creates, finds,
  updates and deletes them. Lists come back a page at a time with metadata.
  Names are unambiguous, colors are valid, and deleting a team never deletes
  its tasks. Teams are private to their owner.

  Background:
    Given I am signed in as "marina@example.com"

  Rule: A team is created with a valid name, color and optional description

    @US-02.1 @AC-02.1.1 @must
    Scenario: Create a team
      When I create a team with name "  Mobile  ", color "#7c3aed" and description "iOS & Android squad"
      Then the team is created
      And it has name "Mobile", color "#7C3AED" and description "iOS & Android squad"
      And it has a task count of 0 and version 1
      And it has creation and update timestamps
      And the response gives the location of the new team
      And the response carries the version tag (ETag) for version 1

    @US-02.1 @AC-02.1.1 @must
    Scenario: Create a team without a description
      When I create a team with name "Design" and color "#F59E0B"
      Then the team is created with no description

    @US-02.1 @AC-02.1.2 @must
    Scenario Outline: Team name length boundaries
      When I create a team with a name of <length> characters and color "#0EA5E9"
      Then the creation is <outcome>

      Examples:
        | length | outcome                                            |
        | 1      | rejected with a validation error on field "name"  |
        | 2      | accepted                                           |
        | 50     | accepted                                           |
        | 51     | rejected with a validation error on field "name"  |

    @US-02.1 @AC-02.1.2 @must
    Scenario Outline: Team names are measured after trimming
      When I create a team with name "<name>" and color "#0EA5E9"
      Then the creation is <outcome>

      Examples:
        | name       | outcome                                           |
        | "   "      | rejected with a validation error on field "name" |
        | "  a  "    | rejected with a validation error on field "name" |
        | "  ab  "   | accepted with name "ab"                           |
        | ""         | rejected with a validation error on field "name" |

    @US-02.1 @AC-02.1.2 @must
    Scenario: Names are measured in characters, not bytes
      When I create a team with a name of 50 characters made of accented letters and emoji
      Then the team is created

    @US-02.1 @AC-02.1.10 @must @security
    Scenario Outline: Team names reject control characters
      When I create a team with a name containing <characters>
      Then the creation is rejected with a validation error on field "name"
      And no team is created

      Examples:
        | characters                      |
        | a newline between two words     |
        | a tab between two words         |
        | a NUL character                 |
        | an escape character             |
        | a carriage return at the end    |

    @US-02.1 @AC-02.1.2 @must
    Scenario: Missing name
      When I create a team with color "#0EA5E9" and no name
      Then the creation is rejected with a validation error on field "name"

    @US-02.1 @AC-02.1.3 @must
    Scenario Outline: Valid colors are normalized to upper case
      When I create a team named "Platform" with color "<input>"
      Then the team is created with color "<stored>"

      Examples:
        | input   | stored  |
        | #0ea5e9 | #0EA5E9 |
        | #0EA5E9 | #0EA5E9 |
        | #aBcDeF | #ABCDEF |
        | #000000 | #000000 |

    @US-02.1 @AC-02.1.3 @must
    Scenario Outline: Invalid colors are rejected
      When I create a team named "Platform" with color "<color>"
      Then the creation is rejected with a validation error on field "colorHex"
      And no team is created

      Examples:
        | color     |
        | #FFF      |
        | 7C3AED    |
        | #7C3AED0  |
        | #GGGGGG   |
        | red       |
        | #7C3AE    |
        | " #7C3AED"|
        |           |

    @US-02.1 @AC-02.1.4 @must
    Scenario Outline: Description length boundaries
      When I create a team named "Platform" with color "#0EA5E9" and a description of <length> characters
      Then the creation is <outcome>

      Examples:
        | length | outcome                                                 |
        | 280    | accepted                                                |
        | 281    | rejected with a validation error on field "description" |

    @US-02.1 @AC-02.1.4 @must
    Scenario Outline: Blank descriptions become no description
      When I create a team named "Platform" with color "#0EA5E9" and description "<description>"
      Then the team is created with no description

      Examples:
        | description |
        | ""          |
        | "    "      |

    @US-02.1 @AC-02.1.4 @must
    Scenario: Description is trimmed and measured after trimming
      When I create a team named "Platform" with color "#0EA5E9" and a description of 280 characters surrounded by spaces
      Then the team is created with that 280-character description without the surrounding spaces

    @US-02.1 @AC-02.1.8 @must @security
    Scenario Outline: Fields outside the contract are rejected
      When I create a team named "Platform" with color "#0EA5E9" and an extra field "<field>"
      Then the creation is rejected with a validation error on field "<field>"
      And no team is created

      Examples:
        | field       |
        | id          |
        | ownerId     |
        | owner_id    |
        | userId      |
        | owner       |
        | version     |
        | taskCount   |
        | createdAt   |
        | updatedAt   |
        | deletedAt   |
        | __proto__   |
        | constructor |

    @US-02.1 @AC-02.1.8 @must @security
    Scenario: An owner given as an object is rejected, not merged
      When I create a team named "Platform" with color "#0EA5E9" and an "owner" field holding an object with Rafael's id
      Then the creation is rejected with a validation error on field "owner"
      And no team is created

  Rule: Team names are unique per user, ignoring letter case

    @US-02.1 @AC-02.1.5 @must
    Scenario Outline: A name already used by one of my active teams is rejected
      Given I have a team named "Mobile"
      When I create a team named "<name>" with color "#10B981"
      Then the creation is rejected with status 409 and code "TEAM_NAME_ALREADY_EXISTS"
      And I still have exactly one team named like "Mobile"

      Examples:
        | name       |
        | Mobile     |
        | mobile     |
        | MOBILE     |
        | " Mobile " |

    @US-02.1 @AC-02.1.5 @must
    Scenario: Accents are significant in team names
      Given I have a team named "Équipe"
      When I create a team named "Equipe" with color "#10B981"
      Then the team is created

    @US-02.1 @AC-02.1.6 @must
    Scenario: The same name can exist for different users
      Given another user "rafael@example.com" has a team named "Mobile"
      When I create a team named "Mobile" with color "#10B981"
      Then the team is created

    @US-02.1 @AC-02.1.7 @must
    Scenario: A deleted team does not reserve its name
      Given I had a team named "Mobile" that I deleted
      When I create a team named "Mobile" with color "#10B981"
      Then the team is created

    @US-02.1 @AC-02.1.9 @must @concurrency
    Scenario: Concurrent creations with the same name
      When I send two requests at the same time to create a team named "Platform"
      Then exactly one team named "Platform" is created
      And the other request is rejected with status 409 and code "TEAM_NAME_ALREADY_EXISTS"

  Rule: Teams are listed a page at a time with pagination metadata

    @US-02.2 @AC-02.2.1 @must
    Scenario: The list contains only my active teams, with metadata
      Given I have teams "Mobile", "Backend" and "Design"
      And another user "rafael@example.com" has a team named "Ops"
      When I list my teams
      Then I see exactly "Mobile", "Backend" and "Design"
      And the metadata shows total 3, limit 20, offset 0 and no next page

    @US-02.2 @AC-02.2.2 @must
    Scenario: Default paging and order
      Given I created teams "First", "Second" and "Third" in that order
      When I list my teams without paging or sorting options
      Then I see "Third", "Second", "First" in that order
      And the metadata shows limit 20 and offset 0

    @US-02.2 @AC-02.2.3 @must
    Scenario Outline: Paging through 25 teams
      Given I have 25 teams
      When I list my teams with limit 10 and offset <offset>
      Then I receive <count> teams
      And the metadata shows total 25, limit 10, offset <offset> and hasNextPage <next>

      Examples:
        | offset | count | next  |
        | 0      | 10    | true  |
        | 10     | 10    | true  |
        | 20     | 5     | false |
        | 15     | 10    | false |

    @US-02.2 @AC-02.2.4 @must
    Scenario Outline: Offset at or beyond the total
      Given I have 3 teams
      When I list my teams with offset <offset>
      Then I receive an empty page
      And the metadata shows total 3, offset <offset> and no next page

      Examples:
        | offset |
        | 3      |
        | 1000   |

    @US-02.2 @AC-02.2.5 @must
    Scenario Outline: Invalid paging parameters
      When I list my teams with <parameter> "<value>"
      Then the request is rejected with a validation error on field "<parameter>"

      Examples:
        | parameter | value |
        | limit     | 0     |
        | limit     | 101   |
        | limit     | -1    |
        | limit     | 2.5   |
        | limit     | ten   |
        | offset    | -1    |
        | offset    | 1.5   |
        | offset    | abc   |

    @US-02.2 @AC-02.2.5 @must
    Scenario Outline: Paging limits that are accepted
      Given I have 3 teams
      When I list my teams with limit <limit>
      Then the request succeeds with limit <limit> in the metadata

      Examples:
        | limit |
        | 1     |
        | 100   |

    @US-02.2 @AC-02.2.6 @must
    Scenario: No teams yet
      Given I have no teams
      When I list my teams
      Then I receive an empty page
      And the metadata shows total 0 and no next page

    @US-02.2 @AC-02.2.7 @must
    Scenario: Deleted teams are not listed or counted
      Given I have teams "Mobile" and "Backend"
      And I deleted the team "Backend"
      When I list my teams
      Then I see only "Mobile"
      And the metadata shows total 1

    @US-02.2 @AC-02.2.8 @must
    Scenario Outline: Paging is stable when teams share a timestamp
      Given I have 7 teams created at the same instant
      When I page through my teams sorted by "<sort>" with limit 3
      Then every team appears exactly once across all pages

      Examples:
        | sort       |
        | -createdAt |
        | createdAt  |
        | updatedAt  |

    @US-02.2 @AC-02.2.9 @must
    Scenario: Unknown query parameters are rejected
      When I list my teams with an unknown parameter "color"
      Then the request is rejected with a validation error on field "color"

  Rule: Teams can be searched by name

    Background:
      Given I have teams "Mobile", "Backend" and "Mobile QA"

    @US-02.3 @AC-02.3.1 @must
    Scenario Outline: Case-insensitive substring search on the name
      When I search my teams for "<term>"
      Then I see exactly <teams>
      And the metadata shows total <total>

      Examples:
        | term   | teams                  | total |
        | mob    | "Mobile", "Mobile QA"  | 2     |
        | MOBILE | "Mobile", "Mobile QA"  | 2     |
        | end    | "Backend"              | 1     |
        | qa     | "Mobile QA"            | 1     |

    @US-02.3 @AC-02.3.2 @must
    Scenario: The search term is trimmed
      When I search my teams for "  backend  "
      Then I see exactly "Backend"

    @US-02.3 @AC-02.3.2 @must
    Scenario Outline: A search term that is blank after trimming is rejected
      When I search my teams for "<term>"
      Then the request is rejected with status 400 and code "VALIDATION_FAILED"
      And the error details name the field "search"

      Examples:
        | term  |
        |       |
        | "   " |

    @US-02.3 @AC-02.3.2 @must
    Scenario Outline: Search term length limit
      When I search my teams for a term of <length> characters
      Then the request <outcome>

      Examples:
        | length | outcome                                          |
        | 100    | succeeds                                         |
        | 101    | is rejected with a validation error on "search" |

    @US-02.3 @AC-02.3.3 @must @security
    Scenario Outline: Wildcard characters are matched literally
      Given I have teams "50% Growth" and "Team_A"
      When I search my teams for "<term>"
      Then I see exactly "<team>"

      Examples:
        | term | team       |
        | %    | 50% Growth |
        | _    | Team_A     |

    @US-02.3 @AC-02.3.4 @must
    Scenario: No team matches
      When I search my teams for "design"
      Then I receive an empty page
      And the metadata shows total 0 and no next page

    @US-02.3 @AC-02.3.5 @must @security
    Scenario: Search never returns other users' teams
      Given another user "rafael@example.com" has a team named "Mobile Ops"
      When I search my teams for "mobile"
      Then I see exactly "Mobile" and "Mobile QA"

  Rule: Teams can be sorted by name, creation or update time

    @US-02.4 @AC-02.4.1 @could
    Scenario Outline: Sort by name, case-insensitive
      Given I have teams "beta", "Alpha" and "Gamma"
      When I list my teams sorted by "<sort>"
      Then I see <order> in that order

      Examples:
        | sort  | order                       |
        | name  | "Alpha", "beta", "Gamma"    |
        | -name | "Gamma", "beta", "Alpha"    |

    @US-02.4 @AC-02.4.2 @could
    Scenario Outline: Sort by creation or update time
      Given I created teams "A", "B" and "C" in that order
      And I later updated team "A"
      When I list my teams sorted by "<sort>"
      Then I see <order> in that order

      Examples:
        | sort       | order           |
        | createdAt  | "A", "B", "C"   |
        | -createdAt | "C", "B", "A"   |
        | updatedAt  | "B", "C", "A"   |
        | -updatedAt | "A", "C", "B"   |

    @US-02.4 @AC-02.4.3 @could
    Scenario Outline: Unsupported sort values are rejected
      When I list my teams sorted by "<sort>"
      Then the request is rejected with a validation error on field "sort"

      Examples:
        | sort      |
        | color     |
        | taskCount |
        | --name    |
        | name,-id  |
        | ""        |

    @US-02.4 @AC-02.4.4 @could
    Scenario: Search, sort and paging combined
      Given I have teams "Mobile C", "Mobile A", "Backend" and "Mobile B"
      When I search my teams for "mobile" sorted by "name" with limit 2 and offset 0
      Then I see "Mobile A", "Mobile B" in that order
      And the metadata shows total 3 and hasNextPage true

  Rule: A single team can be viewed by its owner

    @US-02.5 @AC-02.5.1 @must
    Scenario: View my team
      Given I have a team named "Mobile" with 2 tasks assigned
      When I get the team "Mobile"
      Then I see its name, color, description, task count 2 and version
      And the response carries the version tag matching its version

    @US-02.5 @AC-02.5.2 @AC-02.5.3 @AC-02.5.4 @must @security
    Scenario Outline: Teams that are not mine or no longer exist are not found
      Given <situation>
      When I get that team
      Then the response is status 404 with code "TEAM_NOT_FOUND"
      And it is indistinguishable from the response for an id that never existed

      Examples:
        | situation                                              |
        | no team exists with the requested id                   |
        | the team belongs to another user "rafael@example.com"  |
        | I deleted the team                                     |

    @US-02.5 @AC-02.5.5 @must
    Scenario Outline: Malformed team ids
      When I get the team with id "<id>"
      Then the request is rejected with a validation error on field "id"

      Examples:
        | id                                    |
        | 123                                   |
        | not-a-uuid                            |
        | 6f1c2b9e-1b2a-4d7e-9a51-7a0c3b8f9e1   |

  Rule: Updating a team replaces its name, color and description

    Background:
      Given I have a team named "Backend" with color "#2563EB", description "APIs" and version 1

    @US-02.6 @AC-02.6.1 @must
    Scenario: Replace a team
      When I update the team "Backend" to name "Platform", color "#0ea5e9" and description "Infra & tooling"
      Then the team has name "Platform", color "#0EA5E9" and description "Infra & tooling"
      And its version is 2
      And its update time advanced and its creation time is unchanged
      And the response carries the version tag (ETag) for version 2

    @US-02.6 @AC-02.6.2 @must
    Scenario Outline: Invalid replacements leave the team unchanged
      When I update the team "Backend" with <change>
      Then the update is rejected with a validation error on field "<field>"
      And the team "Backend" is unchanged at version 1

      Examples:
        | change                               | field       |
        | a name of 1 character                | name        |
        | a name of 51 characters              | name        |
        | color "#12345"                       | colorHex    |
        | color "blue"                         | colorHex    |
        | a description of 281 characters      | description |
        | an extra field "ownerId"             | ownerId     |
        | an extra field "owner_id"            | owner_id    |
        | an extra field "userId"              | userId      |
        | an extra field "owner" holding an object | owner   |
        | an extra field "updatedAt"           | updatedAt   |
        | an extra field "deletedAt"           | deletedAt   |
        | an extra field "__proto__"           | __proto__   |
        | an extra field "constructor"         | constructor |
        | a name with a control character      | name        |
        | no name                              | name        |
        | no color                             | colorHex    |

    @US-02.6 @AC-02.6.3 @must
    Scenario: Omitting the description clears it
      When I update the team "Backend" with name "Backend" and color "#2563EB" and no description
      Then the team "Backend" has no description
      And its version is 2

    @US-02.6 @AC-02.6.4 @must
    Scenario Outline: Renaming to another of my team names is a conflict
      Given I have a team named "Mobile"
      When I rename the team "Backend" to "<name>"
      Then the update is rejected with status 409 and code "TEAM_NAME_ALREADY_EXISTS"
      And the team "Backend" is unchanged at version 1

      Examples:
        | name     |
        | Mobile   |
        | mobile   |
        | " MOBILE"|

    @US-02.6 @AC-02.6.4 @must
    Scenario: Renaming to a name used only by another user is allowed
      Given another user "rafael@example.com" has a team named "Mobile"
      When I rename the team "Backend" to "Mobile"
      Then the team is renamed to "Mobile"

    @US-02.6 @AC-02.6.5 @must
    Scenario: Changing only the letter case of a team's own name
      When I rename the team "Backend" to "BACKEND"
      Then the team is renamed to "BACKEND"
      And its version is 2

    @US-02.6 @AC-02.6.6 @must @security
    Scenario Outline: Updating a team that is not mine or no longer exists
      Given <situation>
      When I update that team to name "Hijacked" and color "#000000"
      Then the response is status 404 with code "TEAM_NOT_FOUND"
      And no team is named "Hijacked"

      Examples:
        | situation                                              |
        | no team exists with the requested id                   |
        | the team belongs to another user "rafael@example.com"  |
        | I deleted the team                                     |

    @US-02.6 @AC-02.6.7 @must
    Scenario: Submitting the current values changes nothing
      When I update the team "Backend" to name " Backend ", color "#2563eb" and description "APIs"
      Then the team is returned unchanged
      And its version is still 1
      And its update time is unchanged

  Rule: Deleting a team archives it and keeps its tasks

    @US-02.7 @AC-02.7.1 @must
    Scenario: Delete a team
      Given I have teams "Mobile" and "Backend"
      When I delete the team "Backend"
      Then the deletion succeeds with no content
      And getting the team "Backend" is not found
      And listing my teams shows only "Mobile" with total 1

    @US-02.7 @AC-02.7.2 @must
    Scenario: Tasks survive and are unassigned from the deleted team
      Given I have teams "Mobile" and "Backend"
      And I have a task "Login screen" assigned to "Mobile" and "Backend"
      And I have a task "Rate limiting" assigned to "Backend" only
      When I delete the team "Backend"
      Then the task "Login screen" still exists and is assigned only to "Mobile"
      And the task "Rate limiting" still exists and is assigned to no team
      And filtering my tasks by the deleted team returns no tasks

    @US-02.7 @AC-02.7.3 @must @security
    Scenario Outline: Deleting a team that is not mine or no longer exists
      Given <situation>
      When I delete that team
      Then the response is status 404 with code "TEAM_NOT_FOUND"
      And no team or task was changed

      Examples:
        | situation                                              |
        | no team exists with the requested id                   |
        | the team belongs to another user "rafael@example.com"  |
        | I already deleted the team                             |

    @US-02.7 @AC-02.7.4 @must
    Scenario: Deletion is all or nothing
      Given I have a team "Backend" with 2 tasks assigned
      And unassigning its tasks will fail
      When I delete the team "Backend"
      Then the deletion fails
      And the team "Backend" still exists
      And both tasks are still assigned to "Backend"

  Rule: Each team shows how many active tasks it has

    @US-02.8 @AC-02.8.1 @could
    Scenario: Task count counts active tasks of any status
      Given I have a team "Mobile"
      And I have tasks assigned to "Mobile" with statuses "PENDING", "IN_PROGRESS" and "DONE"
      And I have a deleted task that was assigned to "Mobile"
      When I list my teams
      Then the team "Mobile" shows a task count of 3
      And getting the team "Mobile" also shows a task count of 3

    @US-02.8 @AC-02.8.2 @could
    Scenario Outline: Task count decreases when a task leaves the team
      Given I have a team "Mobile" with 2 tasks assigned
      When I <action> one of those tasks
      Then the team "Mobile" shows a task count of 1

      Examples:
        | action                       |
        | delete                       |
        | unassign "Mobile" from       |

    @US-02.8 @AC-02.8.3 @could
    Scenario: A new team has no tasks
      When I create a team named "Fresh" with color "#22C55E"
      Then it has a task count of 0

  Rule: Updates and deletes can be protected against stale copies

    Background:
      Given I have a team named "Backend" at version 1

    @US-02.9 @AC-02.9.1 @could @concurrency
    Scenario Outline: A matching precondition lets the change through
      When I <operation> the team "Backend" with the precondition for version 1
      Then the <operation> succeeds

      Examples:
        | operation |
        | update    |
        | delete    |

    @US-02.9 @AC-02.9.2 @could @concurrency
    Scenario: A stale precondition blocks an update
      Given the team "Backend" was updated on another device to version 2
      When I update the team "Backend" with the precondition for version 1
      Then the update is rejected with status 412 and code "PRECONDITION_FAILED"
      And the error details show current version 2
      And the team "Backend" keeps the changes made on the other device

    @US-02.9 @AC-02.9.3 @could @concurrency
    Scenario: A stale precondition blocks a delete
      Given the team "Backend" was updated on another device to version 2
      When I delete the team "Backend" with the precondition for version 1
      Then the deletion is rejected with status 412 and code "PRECONDITION_FAILED"
      And the team "Backend" still exists

    @US-02.9 @AC-02.9.4 @could
    Scenario Outline: No precondition means the change applies to the current version
      Given the team "Backend" was updated on another device to version 2
      When I <operation> the team "Backend" without a precondition
      Then the <operation> succeeds

      Examples:
        | operation |
        | update    |
        | delete    |

    @US-02.9 @AC-02.9.5 @could @concurrency
    Scenario: Two concurrent updates from the same version
      When two updates of the team "Backend" with the precondition for version 1 arrive at the same time
      Then exactly one update succeeds and the team is at version 2
      And the other is rejected with status 412 and code "PRECONDITION_FAILED"

    @US-02.9 @AC-02.9.6 @could
    Scenario Outline: Unrecognizable preconditions never match
      When I update the team "Backend" with the precondition "<tag>"
      Then the update is rejected with status 412 and code "PRECONDITION_FAILED"

      Examples:
        | tag        |
        | W/"abc"    |
        | 1          |
        | W/"-1"     |
        | garbage    |

    @US-02.9 @AC-02.9.6 @could
    Scenario: A malformed precondition on delete is rejected
      When I delete the team "Backend" with the precondition "garbage"
      Then the deletion is rejected with status 412 and code "PRECONDITION_FAILED"
      And the team "Backend" still exists

    @US-02.9 @AC-02.9.7 @AC-02.9.8 @could
    Scenario Outline: Not found takes precedence over a precondition
      Given the team belongs to another user "rafael@example.com"
      When I <operation> that team with the precondition for version 1
      Then the response is status 404 with code "TEAM_NOT_FOUND"
      And the team is unchanged

      Examples:
        | operation |
        | update    |
        | delete    |

    @US-02.9 @AC-02.9.2 @could
    Scenario Outline: Validation runs before the precondition check
      Given the team "Backend" was updated on another device to version 2
      When I update the team "Backend" with <change> and the stale precondition for version 1
      Then the update is rejected with status 400 and code "VALIDATION_FAILED"
      And it is not rejected with "PRECONDITION_FAILED"

      Examples:
        | change                  |
        | a name of 1 character   |
        | color "blue"            |
        | an extra field "ownerId" |

    @US-02.9 @AC-02.9.2 @could
    Scenario: A malformed precondition together with an invalid body is a validation error
      When I update the team "Backend" with a name of 1 character and the precondition "garbage"
      Then the update is rejected with status 400 and code "VALIDATION_FAILED"

    @US-02.9 @AC-02.9.1 @could
    Scenario: A successful conditional update returns the new version tag
      When I update the team "Backend" with the precondition for version 1
      Then the response carries the version tag (ETag) for version 2

  Rule: Retried creations with the same idempotency key do not duplicate teams
    # "K1" denotes a fixed, valid UUID chosen by the test (e.g. 9b2f0c4e-…).

    @US-02.10 @AC-02.10.1 @could @idempotency
    Scenario: Retrying the same creation replays the original response
      Given I created a team named "Platform" with idempotency key "K1"
      When I send the same creation again with idempotency key "K1"
      Then I receive the original response with the same status, body, location and version tag
      And the response carries the header "Idempotent-Replayed: true"
      And the original response did not carry that header
      And I have exactly one team named "Platform"

    @US-02.10 @AC-02.10.1 @AC-02.10.8 @could @idempotency @concurrency
    Scenario: Concurrent identical creations with the same key
      When I send the same creation of a team named "Platform" twice at the same time with idempotency key "K1"
      Then exactly one team named "Platform" is created
      And one request receives the 201 creation
      And the other receives either the 201 replay or status 409 with code "IDEMPOTENCY_REQUEST_IN_PROGRESS"

    @US-02.10 @AC-02.10.8 @could @idempotency @concurrency
    Scenario: A request arriving while the first is still processing is not queued
      Given a creation with idempotency key "K1" is still being processed
      When I send the same creation again with idempotency key "K1"
      Then the request is rejected immediately with status 409 and code "IDEMPOTENCY_REQUEST_IN_PROGRESS"
      And the response carries a "Retry-After" value of 1
      And no second team is created

    @US-02.10 @AC-02.10.8 @could @idempotency
    Scenario: Retrying after the in-progress answer succeeds
      Given my request with idempotency key "K1" was answered with "IDEMPOTENCY_REQUEST_IN_PROGRESS"
      And the first request has since completed
      When I retry with idempotency key "K1"
      Then I receive the original response, marked as replayed

    @US-02.10 @AC-02.10.2 @could @idempotency
    Scenario: Reusing a key with a different body
      Given I created a team named "Platform" with idempotency key "K1"
      When I create a team named "Infra" with idempotency key "K1"
      Then the request is rejected with status 422 and code "IDEMPOTENCY_KEY_REUSED"
      And no team named "Infra" exists

    @US-02.10 @AC-02.10.3 @could @idempotency
    Scenario Outline: Idempotency keys must be UUIDs
      When I create a team named "Platform" with idempotency key "<key>"
      Then the request is rejected with a validation error on field "Idempotency-Key"
      And no team is created

      Examples:
        | key          |
        | abc          |
        | 12345        |
        | " "          |

    @US-02.10 @AC-02.10.4 @could @idempotency @security
    Scenario: Idempotency keys are scoped per user
      Given another user "rafael@example.com" created a team named "Ops" with idempotency key "K1"
      When I create a team named "Platform" with idempotency key "K1"
      Then my team "Platform" is created
      And I do not receive Rafael's response

    @US-02.10 @AC-02.10.9 @could @idempotency @concurrency @security
    Scenario: Another user's identical key is never blocked by an in-flight request
      Given a creation by "rafael@example.com" with idempotency key "K1" is still being processed
      When I create a team named "Platform" with idempotency key "K1"
      Then my team "Platform" is created
      And I do not receive status 409

    @US-02.10 @AC-02.10.5 @could @idempotency
    Scenario Outline: Failed attempts are not remembered
      Given my creation with idempotency key "K1" was rejected because <reason>
      When I retry with idempotency key "K1" and a corrected body
      Then the team is created

      Examples:
        | reason                          |
        | the name was too short          |
        | the name was already in use     |

    @US-02.10 @AC-02.10.6 @could @idempotency
    Scenario: Keys expire after 24 hours
      Given I created a team named "Platform" with idempotency key "K1" 25 hours ago
      And I since deleted the team "Platform"
      When I send the same creation again with idempotency key "K1"
      Then a new team named "Platform" is created with a different id

    @US-02.10 @AC-02.10.11 @could @idempotency @security
    Scenario: The request fingerprint ignores prototype keys
      Given two request bodies that differ only by a "__proto__" or "constructor" key
      When the idempotency fingerprint of each is computed
      Then both fingerprints are identical
      And no prototype pollution occurs

    @US-02.10 @AC-02.10.10 @could @idempotency
    Scenario: A key used for a team cannot be reused for a task
      Given I created a team named "Platform" with idempotency key "K1"
      When I create a task titled "Buy milk" with idempotency key "K1"
      Then the request is rejected with status 422 and code "IDEMPOTENCY_KEY_REUSED"
      And no task titled "Buy milk" exists

    @US-02.10 @AC-02.10.7 @could @idempotency
    Scenario: The idempotency key is optional
      When I create a team named "Platform" with color "#0EA5E9" and no idempotency key
      Then the team is created

  Rule: Teams are private to the signed-in user

    Background:
      Given another user "rafael@example.com" owns a team "Backend"

    @US-02.11 @AC-02.11.1 @must @security
    Scenario: Another user's team never appears in my list or search
      Given I have a team named "Mobile"
      When I list my teams
      Then I see "Mobile" and not "Backend"
      And the total counts only my teams
      When I search my teams for "Back"
      Then I receive no teams

    @US-02.11 @AC-02.11.1 @must @security
    Scenario Outline: By-id operations on another user's team look like a missing team
      When I <operation> Rafael's team "Backend" by its id
      Then the response is identical to the same operation on a nonexistent id
      And the status is 404 with code "TEAM_NOT_FOUND"
      And Rafael's team "Backend" is unchanged

      Examples:
        | operation |
        | get       |
        | update    |
        | delete    |

    @US-02.11 @AC-02.11.2 @must @security
    Scenario Outline: Anonymous access to team operations
      Given I am not signed in
      When I <operation>
      Then the request is rejected with status 401 and code "UNAUTHENTICATED"
      And no existence check was made on the team

      Examples:
        | operation        |
        | list teams       |
        | get a team       |
        | create a team    |
        | update a team    |
        | delete a team    |

    @US-02.11 @AC-02.11.3 @must @security
    Scenario: The owner of a new team is always the signed-in user
      When I create a team named "Platform" with color "#0EA5E9"
      Then the team belongs to "marina@example.com"
      And it does not appear in Rafael's list

    @US-02.11 @AC-02.11.4 @must
    Scenario: Equal names owned by different users do not interfere
      Given I have a team named "Backend"
      When I list my teams and Rafael lists his
      Then each sees only their own "Backend"
      And neither can read the other's team by id
