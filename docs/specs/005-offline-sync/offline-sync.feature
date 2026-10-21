@mobile @offline
Feature: Offline sync
  Marina often works on unreliable mobile networks. The app keeps the teams and
  tasks she has seen, shows every change immediately, keeps changes made offline
  across restarts, and sends them in order and exactly once when the connection
  returns — resolving collisions with changes made elsewhere and telling her
  what happened.

  Background:
    Given I am signed in as "marina@example.com"
    And I have the teams:
      | name    | color   |
      | Backend | #0EA5E9 |
      | Mobile  | #7C3AED |
    And I have the tasks:
      | title                  | status      | teams           |
      | Implement login screen | IN_PROGRESS | Mobile, Backend |
      | Fix crash on Android   | PENDING     | Mobile          |
      | Update dependencies    | PENDING     |                 |
    And I have viewed the tasks list, the teams list and the task "Fix crash on Android" while online

  # ---------------------------------------------------------------- US-05.1
  Rule: What I have seen stays available offline, for me only

    @US-05.1 @AC-05.1.1 @should
    Scenario: Lists are available offline after a restart
      Given I am offline
      When I close and reopen the app
      Then I see the 3 tasks without a loading placeholder
      And I see the 2 teams

    @US-05.1 @AC-05.1.2 @should
    Scenario: A previously viewed task opens offline
      Given I am offline
      When I open the task "Fix crash on Android"
      Then I see its detail

    @US-05.1 @AC-05.1.3 @should
    Scenario: Something never loaded shows the offline error and loads on reconnect
      Given I am offline
      When I open the tasks of the team "Backend" for the first time
      Then I see "Can't reach the server. Check your connection." and "Try again"
      When the connection returns
      Then I see the task "Implement login screen"

    @US-05.1 @AC-05.1.4 @should
    Scenario: Saved data older than 24 hours is not shown as current
      Given my saved data is 25 hours old
      And I am online
      When I open the app
      Then I see loading placeholders
      And then the tasks from the server

    @US-05.1 @AC-05.1.5 @should
    Scenario: Another user never sees my saved data
      When I sign out
      And "ana@example.com" signs in on the same device while offline
      Then no team or task of "marina@example.com" is shown

  # ---------------------------------------------------------------- US-05.2
  Rule: Connectivity and pending changes are always visible

    @US-05.2 @AC-05.2.1 @should
    Scenario: Offline banner appears and disappears with connectivity
      When the connection is lost
      Then I see "You're offline. Changes will sync when you reconnect."
      When the connection returns and nothing is pending
      Then the offline banner disappears

    @US-05.2 @AC-05.2.2 @AC-05.2.4 @should
    Scenario: Unconfirmed changes are marked pending
      Given I am offline
      When I change the status of "Fix crash on Android" to "Done"
      Then "Fix crash on Android" shows "Pending sync"
      And the Tasks tab shows a pending indicator
      And Settings shows "1 change waiting to sync"

    @US-05.2 @AC-05.2.3 @should
    Scenario: Reconnecting syncs and clears the markers
      Given I am offline
      And I changed the status of 2 tasks
      When the connection returns
      Then I see "Back online — syncing 2 changes…"
      And then I see "All changes synced"
      And no task shows "Pending sync"

  # ---------------------------------------------------------------- US-05.3
  Rule: A status change is shown immediately and reverted only if rejected

    @US-05.3 @AC-05.3.1 @AC-05.3.2 @should
    Scenario: Status change appears before the server answers
      Given the server takes 3 seconds to answer
      When I change the status of "Fix crash on Android" to "Done"
      Then the detail and the tasks list show "Done" immediately
      And "Fix crash on Android" shows "Pending sync"
      When the server confirms
      Then "Fix crash on Android" shows "Done" without "Pending sync"

    @US-05.3 @AC-05.3.3 @should
    Scenario Outline: A rejected status change is reverted everywhere
      Given the server will reject the next change with "<code>"
      When I change the status of "Fix crash on Android" to "Done"
      Then "Fix crash on Android" shows "Pending" in the detail and in the lists
      And I see "<message>"

      Examples:
        | code              | message                                          |
        | VALIDATION_FAILED | Couldn't save “Fix crash on Android”: Some fields are invalid. Check the highlighted fields. |
        | INTERNAL_ERROR    | Couldn't save “Fix crash on Android”: Something went wrong on our side. Please try again.  |

    @US-05.3 @AC-05.3.4 @AC-05.7.4 @should
    Scenario: The last status chosen offline wins without self-conflict
      Given I am offline
      When I change the status of "Fix crash on Android" to "Done"
      And I change the status of "Fix crash on Android" to "In progress"
      And the connection returns
      Then the server has "Fix crash on Android" with status "In progress"
      And I see no conflict message

    @US-05.3 @AC-05.3.5 @should
    Scenario: A task leaves a status-filtered list immediately
      Given I am viewing the "Pending" tasks
      When I change the status of "Update dependencies" to "Done"
      Then "Update dependencies" is no longer in the list immediately

  # ---------------------------------------------------------------- US-05.4
  Rule: A deletion is shown immediately and is idempotent

    @US-05.4 @AC-05.4.1 @should
    Scenario: Deleting offline removes the task at once
      Given I am offline
      When I delete the task "Update dependencies" and confirm
      Then "Update dependencies" disappears from every list immediately
      When the connection returns
      Then the server no longer returns "Update dependencies"

    @US-05.4 @AC-05.4.2 @should
    Scenario: A rejected deletion restores the task
      Given the server will reject the next change with "INTERNAL_ERROR"
      When I delete the task "Update dependencies" and confirm
      Then "Update dependencies" reappears in the tasks list
      And I see "Couldn't save “Update dependencies”: Something went wrong on our side. Please try again."

    @US-05.4 @AC-05.4.3 @AC-05.7.3 @should
    Scenario: Deleting a task already deleted elsewhere is a success
      Given I am offline
      And the task "Update dependencies" was deleted on another device
      When I delete the task "Update dependencies" and confirm
      And the connection returns
      Then I see no error or conflict message
      And "Update dependencies" does not appear in any list

    @US-05.4 @AC-05.4.4 @should
    Scenario: Deleting a team offline removes its chips at once
      Given I am offline
      When I delete the team "Backend" and confirm
      Then "Backend" disappears from the teams list
      And "Implement login screen" shows only the chip "Mobile"

  # ---------------------------------------------------------------- US-05.5
  Rule: Creations and edits are shown immediately and synced after anything they depend on

    @US-05.5 @AC-05.5.1 @should
    Scenario: Creating a task offline
      Given I am offline
      When I create the task "Write release notes" in the team "Mobile"
      Then I see "Saved. It will sync when you're back online."
      And "Write release notes" is first in the tasks list and in the "Mobile" list, marked "Pending sync"

    @US-05.5 @AC-05.5.2 @should
    Scenario: Editing a task offline
      Given I am offline
      When I change the title of "Fix crash on Android" to "Fix crash on Android 14"
      Then the detail and the lists show "Fix crash on Android 14" marked "Pending sync"

    @US-05.5 @AC-05.5.3 @AC-05.5.4 @should
    Scenario: Changes to a task created offline are applied after its creation
      Given I am offline
      And I created the task "Write release notes"
      When I open "Write release notes" and change its status to "Done"
      And the connection returns
      Then the server has exactly one task "Write release notes" with status "Done"
      And the detail of "Write release notes" is still open and shows "Done"

    @US-05.5 @AC-05.5.3 @should
    Scenario: A task created and deleted offline never reappears
      Given I am offline
      And I created the task "Temporary idea"
      When I delete the task "Temporary idea" and confirm
      And the connection returns
      Then the server does not return "Temporary idea"
      And "Temporary idea" does not appear in any list

    @US-05.5 @AC-05.5.5 @should
    Scenario: A creation rejected because a team no longer exists is reverted
      Given I am offline
      And I created the task "Plan sprint" in the team "Backend"
      And the team "Backend" was deleted on another device
      When the connection returns
      Then "Plan sprint" disappears from my lists
      And I see "Couldn't save “Plan sprint”: Some teams no longer exist and were removed."

    @US-05.5 @AC-05.5.6 @should
    Scenario: A task assigned to a team created offline syncs after the team
      Given I am offline
      When I create the team "Platform"
      And I create the task "Set up CI" in the team "Platform"
      And the connection returns
      Then the server has the team "Platform"
      And the server has the task "Set up CI" assigned to "Platform"

  # ---------------------------------------------------------------- US-05.6
  Rule: Pending changes are durable, ordered and applied exactly once

    @US-05.6 @AC-05.6.1 @AC-05.6.2 @should
    Scenario: Pending changes survive a restart and sync in order
      Given I am offline
      When I create the task "Write release notes"
      And I change the status of "Fix crash on Android" to "Done"
      And I delete the task "Update dependencies" and confirm
      And I close and reopen the app
      Then I still see the 3 changes marked "Pending sync" or applied
      When the connection returns
      Then the server receives the 3 changes in the order I made them
      And I see "All changes synced"

    @US-05.6 @AC-05.6.3 @should
    Scenario: A creation sent twice is applied once
      Given the connection drops after the server stored my new task "Write release notes" but before I got the answer
      When the creation is sent again
      Then the server has exactly one task "Write release notes"
      And my list shows exactly one "Write release notes"

    @US-05.6 @AC-05.6.3 @should
    Scenario: A creation answered as still in progress is retried, not failed
      Given I am offline and created the task "Write release notes"
      And the server answers its first send with "IDEMPOTENCY_REQUEST_IN_PROGRESS" and a "Retry-After" of 1 second
      When the connection returns
      Then the creation is sent again after the indicated delay with the same idempotency key
      And the server has exactly one task "Write release notes"
      And I see no error or conflict message

    @US-05.6 @AC-05.6.4 @should
    Scenario: Temporary server failures are retried, not discarded
      Given I am offline
      And I changed the status of "Fix crash on Android" to "Done"
      And the server is temporarily failing
      When the connection returns
      Then "Fix crash on Android" still shows "Done" marked "Pending sync"
      When the server recovers
      Then the server has "Fix crash on Android" with status "Done"

    @US-05.6 @AC-05.6.5 @should
    Scenario Outline: Pending changes after the session expired
      Given I am offline
      And I changed the status of "Fix crash on Android" to "Done"
      And my session expired
      When the connection returns and "<user>" signs in
      Then the pending change is <outcome>

      Examples:
        | user               | outcome                                       |
        | marina@example.com | sent and the server has the status "Done"     |
        | ana@example.com    | discarded and never sent                      |

    @US-05.6 @AC-05.6.5 @should @security
    Scenario: A queued change of one user is never sent with another user's session
      Given I am offline
      And "marina@example.com" queued a status change of "Fix crash on Android" to "Done"
      And the app is restarted and the stored session now belongs to "ana@example.com"
      When the app restores the pending changes and the connection returns
      Then the queued change is discarded before any request is made
      And the server receives no change for "Fix crash on Android"

    @US-05.6 @AC-05.6.5 @should @security
    Scenario: After a restart with an expired session nothing is sent until sign-in
      Given "marina@example.com" queued a status change of "Fix crash on Android" to "Done" while offline
      And my session has expired
      When the app is restarted and the connection returns
      Then no request carrying the queued change is made
      And the change still shows "Pending sync"
      When "marina@example.com" signs in again
      Then the queued change is sent and the server has "Fix crash on Android" as "Done"

    @US-05.6 @AC-05.6.5 @should @security
    Scenario: A rejected session during replay clears cached data but keeps the queue
      Given "marina@example.com" has 2 queued changes
      When the server answers the replay with "UNAUTHENTICATED"
      Then the cached teams and tasks are cleared
      And the 2 queued changes are kept
      And I see the sign-in screen
      When "marina@example.com" signs in again
      Then the 2 queued changes are sent in the order I made them

    @US-05.6 @AC-05.6.6 @should
    Scenario: Signing out with pending changes asks for confirmation
      Given I am offline
      And I changed the status of 2 tasks
      When I choose to sign out
      Then I am warned "You have 2 changes that haven't synced. Signing out will discard them."
      When I cancel
      Then I am still signed in with 2 changes waiting to sync

  # ---------------------------------------------------------------- US-05.7
  Rule: The server version wins on conflict, and I am told

    @US-05.7 @AC-05.7.1 @AC-05.7.5 @should
    Scenario: A pending edit collides with a change made elsewhere
      Given I am offline
      And I changed the title of "Fix crash on Android" to "Fix Android crash"
      And I changed the status of "Update dependencies" to "Done"
      And another device changed the title of "Fix crash on Android" to "Fix crash on Pixel"
      When the connection returns
      Then "Fix crash on Android" shows the title "Fix crash on Pixel"
      And I see "“Fix Android crash” was changed elsewhere. Showing the latest version."
      And the server has "Update dependencies" with status "Done"

    @US-05.7 @AC-05.7.2 @should
    Scenario: A pending change to a task deleted elsewhere
      Given I am offline
      And I changed the status of "Fix crash on Android" to "Done"
      And another device deleted "Fix crash on Android"
      When the connection returns
      Then "Fix crash on Android" disappears from my lists
      And I see "“Fix crash on Android” was deleted elsewhere."

    @US-05.7 @AC-05.7.3 @should
    Scenario: A replay whose effect is already on the server is a success
      Given my status change of "Fix crash on Android" to "Done" reached the server but the answer was lost
      When the change is sent again
      Then "Fix crash on Android" shows "Done" without "Pending sync"
      And I see no conflict message
