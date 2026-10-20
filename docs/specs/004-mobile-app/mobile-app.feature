@mobile
Feature: Mobile app
  Marina, a team lead, uses the Teams & Tasks app on her phone to see her tasks
  across color-coded teams, focus on a single team, capture new tasks with valid
  data and update or delete them from the task detail in a tap.

  Background:
    Given I am signed in as "marina@example.com"
    And I have the teams:
      | name    | color   |
      | Backend | #0EA5E9 |
      | Design  | #EC4899 |
      | Mobile  | #7C3AED |
    And I have the tasks:
      | title                  | status      | teams           | due date   |
      | Implement login screen | IN_PROGRESS | Mobile, Backend | 2026-10-31 |
      | Fix crash on Android   | PENDING     | Mobile          | 2026-10-12 |
      | Define color palette   | DONE        | Design          |            |
      | Update dependencies    | PENDING     |                 |            |
    And today is "2026-10-20"

  # ---------------------------------------------------------------- US-04.1
  Rule: Only a signed-in user can reach the app's content

    @US-04.1 @AC-04.1.1 @could
    Scenario: A visitor is kept on the sign-in screen
      Given I am not signed in
      When I open the app
      Then I see the sign-in screen
      And I cannot open the tasks list, the teams list or any task

    @US-04.1 @AC-04.1.2 @could
    Scenario: Signing in with valid credentials keeps me signed in
      Given I am not signed in
      When I sign in with "marina@example.com" and the correct password
      Then I see the tasks list
      When I close and reopen the app
      Then I still see the tasks list without signing in again

    @US-04.1 @AC-04.1.3 @could
    Scenario: Wrong credentials are rejected without revealing which one is wrong
      Given I am not signed in
      When I sign in with "marina@example.com" and a wrong password
      Then I stay on the sign-in screen
      And I see the message "Incorrect email or password"

    @US-04.1 @AC-04.1.4 @could
    Scenario Outline: Sign-up password length
      Given I am not signed in
      When I sign up as "Ana" with email "ana@example.com" and a password of <length> characters
      Then the sign-up <outcome>

      Examples:
        | length | outcome                                                   |
        | 7      | is refused with "Password must be 8 to 128 characters"    |
        | 8      | succeeds and I see the tasks list                         |
        | 128    | succeeds and I see the tasks list                         |
        | 129    | is refused with "Password must be 8 to 128 characters"    |

    @US-04.1 @AC-04.1.4 @could
    Scenario: Signing up with an email already registered
      Given I am not signed in
      When I sign up with email "marina@example.com"
      Then I see "An account with this email already exists" on the email field

    @US-04.1 @AC-04.1.5 @could
    Scenario: Signing out removes my session and local data
      When I sign out
      Then I see the sign-in screen
      And no team or task of mine is kept on the device

    @US-04.1 @AC-04.1.6 @could
    Scenario: An expired session sends me back to sign in
      Given my session has expired
      When I refresh the tasks list
      Then I see the sign-in screen with "Your session has expired. Please sign in again."

  # ---------------------------------------------------------------- US-04.2
  Rule: Tapping a team shows only that team's tasks

    @US-04.2 @AC-04.2.1 @must
    Scenario: The teams list shows each team with color and task count
      When I open the teams list
      Then I see the teams in this order:
        | name    | tasks   |
        | Backend | 1 task  |
        | Design  | 1 task  |
        | Mobile  | 2 tasks |
      And each team is shown with its color

    @US-04.2 @AC-04.2.2 @must
    Scenario: Tapping a team filters the tasks by that team
      Given I am on the teams list
      When I open the team "Mobile"
      Then I see a tasks list titled "Mobile"
      And I see exactly the tasks "Implement login screen" and "Fix crash on Android"

    @US-04.2 @AC-04.2.3 @must
    Scenario: Teams load progressively
      Given I have 45 teams
      When I scroll to the end of the teams list
      Then all 45 teams are eventually shown

    @US-04.2 @AC-04.2.4 @must
    Scenario: Searching teams by name ignores case
      When I search the teams for "mob"
      Then I see only the team "Mobile"

  # ---------------------------------------------------------------- US-04.3
  Rule: Team names are 2 to 50 characters and unique per user

    @US-04.3 @AC-04.3.1 @could
    Scenario Outline: Team name length boundaries
      When I create a team named "<name>" with color "#10B981"
      Then the team <outcome>

      Examples:
        | name                                                | outcome                                                  |
        | Q                                                   | is not saved and I see "Name must be 2 to 50 characters" |
        | QA                                                  | "QA" appears in the teams list                           |
        | ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWX  | appears in the teams list                                |
        | ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXY | is not saved and I see "Name must be 2 to 50 characters" |

    @US-04.3 @AC-04.3.2 @could
    Scenario: A duplicate team name is rejected ignoring case
      When I create a team named "mobile" with color "#10B981"
      Then I see "You already have a team with this name." on the name field
      And I still have 3 teams

    @US-04.3 @AC-04.3.3 @could
    Scenario: Renaming and recoloring a team updates its chips everywhere
      When I change the team "Mobile" to name "iOS" and color "#F59E0B"
      Then the teams list shows "iOS" with color "#F59E0B"
      And the task "Implement login screen" shows the chips "iOS" and "Backend"

    @US-04.3 @AC-04.3.4 @could
    Scenario: Deleting a team keeps its tasks
      When I delete the team "Mobile" and confirm
      Then the team "Mobile" is no longer in the teams list
      And the task "Fix crash on Android" still exists without team chips
      And the task "Implement login screen" shows only the chip "Backend"

    @US-04.3 @AC-04.3.5 @could
    Scenario Outline: Choosing a team color
      When I enter the color "<value>" in the team form
      Then <result>

      Examples:
        | value   | result                                             |
        | #6366F1 | the chip preview shows that color                  |
        | #abcdef | the chip preview shows the color "#ABCDEF"         |
        | #12345  | I see "Use a color like #6366F1"                   |
        | blue    | I see "Use a color like #6366F1"                   |

  # ---------------------------------------------------------------- US-04.4
  Rule: The global list shows every task; a team list shows only that team's tasks

    @US-04.4 @AC-04.4.1 @must
    Scenario: The global list shows all tasks, including those without a team
      When I open the tasks list
      Then I see 4 tasks, newest first
      And I see the task "Update dependencies" without team chips
      And each task shows its title, status and due date when it has one

    @US-04.4 @AC-04.4.2 @must
    Scenario: A task in several teams appears in each team's list
      When I open the team "Backend"
      Then I see the task "Implement login screen"
      When I open the team "Mobile"
      Then I see the task "Implement login screen"

    @US-04.4 @AC-04.4.2 @must
    Scenario: Global list versus filtered list
      Given I am viewing the tasks of the team "Design"
      Then I see only "Define color palette"
      When I go to the global tasks list
      Then I see 4 tasks

    @US-04.4 @AC-04.4.3 @must
    Scenario: Tasks load page by page until the end
      Given I have 45 tasks
      When I keep scrolling the tasks list
      Then the tasks load in pages of 20
      And after 45 tasks I see "That's all (45 tasks)"

    @US-04.4 @AC-04.4.4 @must
    Scenario: Pull to refresh keeps the current filters
      Given I am viewing the "Pending" tasks of the team "Mobile"
      And another device created the pending task "Profile screen" in "Mobile"
      When I pull down to refresh
      Then I see "Profile screen"
      And the "Pending" filter is still selected

    @US-04.4 @AC-04.4.5 @must
    Scenario: Overdue tasks are marked with text and icon
      When I open the tasks list
      Then the task "Fix crash on Android" is marked "Overdue"
      And the task "Implement login screen" is not marked "Overdue"
      And the task "Define color palette" is not marked "Overdue"

    @US-04.4 @AC-04.4.6 @must
    Scenario: Opening a task from a list
      When I open the task "Implement login screen" from the tasks list
      Then I see the detail of "Implement login screen"

  # ---------------------------------------------------------------- US-04.5
  Rule: Status, search and sort narrow a list, and each list remembers its own filters

    @US-04.5 @AC-04.5.1 @could
    Scenario Outline: Filtering by status in the global list and in a team list
      When I view the tasks of "<scope>" with status "<status>"
      Then I see exactly the tasks <tasks>

      Examples:
        | scope      | status      | tasks                                              |
        | all teams  | Pending     | "Fix crash on Android", "Update dependencies"      |
        | all teams  | In progress | "Implement login screen"                           |
        | all teams  | Done        | "Define color palette"                             |
        | Mobile     | Pending     | "Fix crash on Android"                             |
        | Mobile     | All         | "Implement login screen", "Fix crash on Android"   |

    @US-04.5 @AC-04.5.2 @could
    Scenario: Searching matches title or description and waits for a pause
      Given the task "Implement login screen" has the description "Email + password, error states"
      When I type "password" quickly in the search
      Then a single search is performed after I pause
      And I see only "Implement login screen"
      When I clear the search
      Then I see 4 tasks

    @US-04.5 @AC-04.5.3 @could
    Scenario Outline: Sorting tasks
      When I sort the tasks by "<sort>"
      Then the first task is "<first>"
      And the current sort shows "<sort>"

      Examples:
        | sort               | first                  |
        | Due date (soonest) | Fix crash on Android   |
        | Title A–Z          | Define color palette   |

    @US-04.5 @AC-04.5.3 @could
    Scenario: Tasks without a due date come last when sorting by due date
      When I sort the tasks by "Due date (soonest)"
      Then "Define color palette" and "Update dependencies" are the last tasks

    @US-04.5 @AC-04.5.4 @could
    Scenario: No task matches the filters
      When I search the tasks for "nonexistent"
      Then I see "No tasks match your filters"
      When I clear the filters
      Then I see 4 tasks

    @US-04.5 @AC-04.5.5 @could
    Scenario: Each list keeps its own filters during the session
      Given I filter the global list by "Done"
      And I filter the tasks of "Mobile" by "Pending"
      When I go to the teams list and back to the global list
      Then the global list is filtered by "Done"
      When I open the team "Mobile"
      Then its tasks are filtered by "Pending"
      When I close and reopen the app
      Then the global list is not filtered

  # ---------------------------------------------------------------- US-04.6
  Rule: The task detail offers quick status change and confirmed deletion

    @US-04.6 @AC-04.6.1 @must
    Scenario: The detail shows every attribute of the task
      When I open the task "Implement login screen"
      Then I see the status "In progress"
      And I see the chips "Mobile" and "Backend"
      And I see the due date "Fri, Oct 31, 2026"
      And I see when it was created and last updated

    @US-04.6 @AC-04.6.2 @must
    Scenario Outline: Changing the status from the detail updates the server and every list
      Given I am viewing the task "Fix crash on Android"
      When I change its status to "<status>"
      Then the detail shows the status "<status>"
      And the server has the task "Fix crash on Android" with status "<status>"
      And the task shows the status "<status>" in the global list and in the "Mobile" list

      Examples:
        | status      |
        | In progress |
        | Done        |

    @US-04.6 @AC-04.6.2 @must
    Scenario: Reopening a done task
      Given I am viewing the task "Define color palette"
      When I change its status to "Pending"
      Then the detail shows the status "Pending"
      And it no longer shows a completion date

    @US-04.6 @AC-04.6.3 @must
    Scenario: Choosing the current status does nothing
      Given I am viewing the task "Fix crash on Android"
      When I choose the status "Pending"
      Then no change is sent to the server
      And no confirmation message is shown

    @US-04.6 @AC-04.6.4 @must
    Scenario: Deleting a task from the detail after confirming
      Given I am viewing the task "Update dependencies"
      When I delete the task and confirm
      Then I am back on the tasks list
      And I see "Task deleted"
      And "Update dependencies" no longer appears in any list
      And the server no longer returns the task "Update dependencies"

    @US-04.6 @AC-04.6.4 @must
    Scenario: Cancelling a deletion keeps the task
      Given I am viewing the task "Update dependencies"
      When I choose to delete the task and cancel
      Then I still see the detail of "Update dependencies"

    @US-04.6 @AC-04.6.5 @must
    Scenario: A rejected status change is reverted and explained
      Given the server will fail the next change with an internal error
      And I am viewing the task "Fix crash on Android"
      When I change its status to "Done"
      Then the detail shows the status "Pending"
      And I see "Something went wrong on our side. Please try again."

    @US-04.6 @AC-04.6.6 @must
    Scenario: Changing status from a list without opening the detail
      Given I am on the tasks list
      When I change the status of "Update dependencies" to "In progress" from the list
      Then the list shows "Update dependencies" as "In progress"
      And the server has the task "Update dependencies" with status "In progress"

    @US-04.6 @AC-04.6.7 @must
    Scenario: Opening a task deleted elsewhere
      Given the task "Update dependencies" was deleted on another device
      When I open the task "Update dependencies"
      Then I see "This task no longer exists."
      And I can go back to the tasks list

  # ---------------------------------------------------------------- US-04.7
  Rule: A task title has 3 to 120 characters after trimming

    @US-04.7 @AC-04.7.1 @AC-04.7.2 @AC-04.7.3 @must
    Scenario Outline: Title length boundaries
      When I create a task with the title "<title>"
      Then the task <outcome>

      Examples:
        | title    | outcome                                                       |
        | ab       | is not saved and I see "Title must be at least 3 characters"  |
        | "  ab  " | is not saved and I see "Title must be at least 3 characters"  |
        | abc      | is created with status "Pending" and appears first in the list |
        | <120 chars> | is created                                                 |
        | <121 chars> | is not saved and I see "Title must be at most 120 characters" |

    @US-04.7 @AC-04.7.2 @must
    Scenario: The title error disappears once the title is valid
      Given I entered the title "ab" and left the field
      And I see "Title must be at least 3 characters"
      When I change the title to "abc"
      Then the title error is no longer shown

    @US-04.7 @AC-04.7.3 @must
    Scenario: A description over 2000 characters cannot be saved
      When I try to enter a description of 2001 characters
      Then the description keeps at most 2000 characters

    @US-04.7 @AC-04.7.4 @must
    Scenario: Creating a complete task with two teams
      When I create a task with:
        | title       | Write release notes |
        | description | For version 1.0     |
        | status      | In progress         |
        | due date    | 2026-11-05          |
        | teams       | Mobile, Design      |
      Then I see "Task created"
      And the task "Write release notes" shows the chips "Mobile" and "Design"
      And it appears in the "Mobile" list and in the "Design" list

    @US-04.7 @AC-04.7.4 @must
    Scenario: At most 10 teams can be selected
      Given I have 11 teams
      When I select 10 teams in the task form
      Then the remaining team cannot be selected
      And I see "You can pick up to 10 teams"

    @US-04.7 @AC-04.7.4 @must
    Scenario: A past due date is allowed with a hint
      When I set the due date of a new task to "2026-10-01"
      Then I see "This date is in the past"
      And I can still save the task

    @US-04.7 @AC-04.7.5 @must
    Scenario: New task from a team list preselects the team
      Given I am viewing the tasks of the team "Design"
      When I start a new task
      Then the team "Design" is already selected

    @US-04.7 @AC-04.7.6 @must
    Scenario: Editing a task updates detail and lists
      When I edit the task "Fix crash on Android" to have the title "Fix crash on Android 14" and the teams "Mobile, Backend"
      Then I see "Changes saved"
      And the detail shows the title "Fix crash on Android 14"
      And it appears in the "Backend" list

    @US-04.7 @AC-04.7.6 @must
    Scenario: Editing a task changed elsewhere
      Given I am editing the task "Fix crash on Android"
      And the task was changed on another device
      When I save my changes
      Then I am told "This item was changed elsewhere. Reload to see the latest version."
      When I choose to reload
      Then the form shows the latest version of the task

    @US-04.7 @AC-04.7.7 @must
    Scenario: Cancelling a form with unsaved changes asks for confirmation
      Given I typed a title in a new task form
      When I cancel the form
      Then I am asked "Discard changes?"

    @US-04.7 @AC-04.7.8 @must
    Scenario: A selected team deleted elsewhere is removed from the form
      Given I am creating a task with the teams "Mobile" and "Design"
      And the team "Design" was deleted on another device
      When I save the task
      Then I see "Some teams no longer exist and were removed" on the teams field
      And "Mobile" is still selected and my title is preserved

  # ---------------------------------------------------------------- US-04.8
  Rule: Every task shows its teams as readable color chips

    @US-04.8 @AC-04.8.1 @must
    Scenario: Team chips use the team color in lists and detail
      When I open the tasks list
      Then the task "Implement login screen" shows the chip "Mobile" on "#7C3AED" and the chip "Backend" on "#0EA5E9"
      When I open the task "Implement login screen"
      Then I see the same chips

    @US-04.8 @AC-04.8.2 @must
    Scenario Outline: Chip text color follows the team color's contrast
      Given a team with color "<color>"
      Then its chip text is <text>

      Examples:
        | color   | text  |
        | #7C3AED | white |
        | #0EA5E9 | black |
        | #EAB308 | black |
        | #1E293B | white |
        | #FFFFFF | black |
        | #000000 | white |

    @US-04.8 @AC-04.8.2 @must
    Scenario Outline: Low-contrast chips get an outline
      Given the app uses the <theme> theme
      And a team with color "<color>"
      Then its chip <outline>

      Examples:
        | theme | color   | outline              |
        | light | #EAB308 | has an outline       |
        | light | #7C3AED | has no outline       |
        | dark  | #1E293B | has an outline       |
        | dark  | #EAB308 | has no outline       |

    @US-04.8 @AC-04.8.3 @must
    Scenario: More than three teams are summarized in lists
      Given the task "Implement login screen" is assigned to 5 teams
      When I open the tasks list
      Then the task shows 3 chips and "+2"
      When I open the task
      Then I see 5 chips

    @US-04.8 @AC-04.8.4 @must
    Scenario: A task without teams
      When I open the task "Update dependencies"
      Then I see "No teams"

    @US-04.8 @AC-04.8.5 @must
    Scenario: Chips are announced by screen readers
      Given a screen reader is on
      When I focus the task "Implement login screen" in the list
      Then I hear "Teams: Mobile, Backend"

  # ---------------------------------------------------------------- US-04.9
  Rule: Every screen tells me what is happening

    @US-04.9 @AC-04.9.1 @must
    Scenario: Placeholders while loading for the first time
      Given the server is slow to respond
      When I open the tasks list for the first time
      Then I see loading placeholders shaped like task rows

    @US-04.9 @AC-04.9.2 @must
    Scenario Outline: Empty lists explain and offer the next action
      Given I have no <items>
      When I open the <screen>
      Then I see "<message>" and the action "<action>"

      Examples:
        | items | screen     | message        | action      |
        | tasks | tasks list | No tasks yet   | New task    |
        | teams | teams list | No teams yet   | Create team |

    @US-04.9 @AC-04.9.3 @must
    Scenario: A failed load can be retried
      Given the server cannot be reached
      When I open the teams list
      Then I see "Can't reach the server. Check your connection." and "Try again"
      When the server becomes reachable and I choose "Try again"
      Then I see my teams

    @US-04.9 @AC-04.9.3 @must
    Scenario: A failed refresh keeps the content already shown
      Given I am on the tasks list
      And the server cannot be reached
      When I pull down to refresh
      Then I still see my 4 tasks
      And I see "Couldn't refresh. Showing saved data."

    @US-04.9 @AC-04.9.4 @must
    Scenario Outline: Successful actions are confirmed briefly
      When I <action>
      Then I see "<message>"
      And the message disappears on its own

      Examples:
        | action                                    | message       |
        | create the task "Plan sprint"             | Task created  |
        | edit the task "Update dependencies"       | Changes saved |
        | delete the task "Update dependencies"     | Task deleted  |
        | create the team "Platform"                | Team created  |

    @US-04.9 @AC-04.9.5 @must
    Scenario Outline: Server errors are shown as friendly messages
      Given the server answers the next request with the error "<code>"
      When I save a task
      Then I see "<message>"
      And I do not see "<code>"

      Examples:
        | code                   | message                                                            |
        | INTERNAL_ERROR         | Something went wrong on our side. Please try again.                |
        | RATE_LIMITED           | Too many requests. Try again in 30 s.                              |
        | TOO_MANY_TEAMS         | A task can have up to 10 teams.                                    |
        | IDEMPOTENCY_KEY_REUSED | This change conflicts with one already sent. Please try again.     |
        | SOMETHING_NEW          | Something went wrong on our side. Please try again.                |

    @US-04.9 @AC-04.9.6 @must
    Scenario: Saving twice quickly creates one task
      When I press "Create task" twice quickly with the title "Plan sprint"
      Then exactly one task "Plan sprint" exists

  # ---------------------------------------------------------------- US-04.10 / US-04.11
  Rule: Appearance and language follow the phone unless I choose otherwise

    @US-04.10 @AC-04.10.1 @could
    Scenario: The system theme is followed by default
      Given the phone uses the dark appearance
      When I open the app for the first time
      Then the app uses the dark theme
      When the phone switches to the light appearance
      Then the app uses the light theme

    @US-04.10 @AC-04.10.2 @could
    Scenario: A chosen theme is applied immediately and kept
      When I choose the "Dark" theme in Settings
      Then the app uses the dark theme immediately
      When I close and reopen the app
      Then the app uses the dark theme

    @US-04.11 @AC-04.11.1 @could
    Scenario Outline: Initial language follows the phone
      Given the phone language is "<phone>"
      When I open the app for the first time
      Then the tasks tab is labeled "<label>"

      Examples:
        | phone | label   |
        | pt-BR | Tarefas |
        | pt-PT | Tarefas |
        | en-US | Tasks   |
        | fr-FR | Tasks   |

    @US-04.11 @AC-04.11.2 @could
    Scenario: Changing language translates messages and dates
      When I choose "Português (Brasil)" in Settings
      Then the task "Implement login screen" shows the status "Em andamento"
      And its due date reads "31 de out."
      And server errors are shown in Portuguese

  # ---------------------------------------------------------------- US-04.12
  Rule: The app works with assistive technologies and accessibility settings

    @US-04.12 @AC-04.12.1 @could
    Scenario: Every control is named and large enough
      When I inspect any screen
      Then every interactive element has an accessible name and role
      And every interactive element has a touch area of at least 44 by 44 points

    @US-04.12 @AC-04.12.3 @could
    Scenario: Largest text size keeps everything reachable
      Given the system text size is 200 %
      When I create a task, change its status and delete it
      Then no text is cut off and every action is reachable

    @US-04.12 @AC-04.12.4 @could
    Scenario: Reduced motion disables decorative animation
      Given reduced motion is enabled
      When the tasks list is loading
      Then the placeholders do not shimmer

    @US-04.12 @AC-04.12.2 @AC-04.12.5 @could
    Scenario: Meaning never relies on color alone
      When I open the tasks list in either theme
      Then each status is shown with an icon and a label
      And overdue tasks show the word "Overdue"
