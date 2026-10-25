@mobile @offline
Feature: Offline sync
  Marina often works on unreliable mobile networks. The app keeps the teams and
  tasks she has seen, shows every change immediately, keeps changes made offline
  across restarts, and sends them in order when the connection returns. The API
  is last write wins; a change that can no longer be applied is discarded with a
  warning. UI copy is quoted in pt-BR, exactly as the app shows it.

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

    @US-05.1 @AC-05.1.1 @must
    Scenario: Lists are available offline after a restart
      Given I am offline
      When I close and reopen the app
      Then I see the 3 tasks without a loading placeholder
      And I see the 2 teams

    @US-05.1 @AC-05.1.2 @must
    Scenario: A previously viewed task opens offline
      Given I am offline
      When I open the task "Fix crash on Android"
      Then I see its detail

    @US-05.1 @AC-05.1.3 @must
    Scenario: Something never loaded shows the offline error and loads on reconnect
      Given I am offline
      When I open the tasks of the team "Backend" for the first time
      Then I see "Não foi possível conectar ao servidor. Verifique sua conexão." and "Tentar novamente"
      When the connection returns
      Then I see the task "Implement login screen"

    @US-05.1 @AC-05.1.4 @must
    Scenario: Saved data older than 24 hours is not shown as current
      Given my saved data is 25 hours old
      And I am online
      When I open the app
      Then I see loading placeholders
      And then the tasks from the server

    @US-05.1 @AC-05.1.5 @must
    Scenario: Another user never sees my saved data
      When I sign out
      And "ana@example.com" signs in on the same device while offline
      Then no team or task of "marina@example.com" is shown

  # ---------------------------------------------------------------- US-05.2
  Rule: Connectivity and pending changes are always visible

    @US-05.2 @AC-05.2.1 @must
    Scenario: Offline banner appears and disappears with connectivity
      When the connection is lost
      Then I see "Você está offline. As alterações serão sincronizadas ao reconectar."
      When the connection returns and nothing is pending
      Then the offline banner disappears

    @US-05.2 @AC-05.2.2 @AC-05.2.4 @must
    Scenario: Unconfirmed changes are marked pending
      Given I am offline
      When I change the status of "Fix crash on Android" to "Concluída"
      Then "Fix crash on Android" shows "Sincronização pendente"
      And the Tasks tab shows a pending indicator
      And Settings shows "1 alteração aguardando sincronização"

    @US-05.2 @AC-05.2.3 @must
    Scenario: Reconnecting syncs and clears the markers
      Given I am offline
      And I changed the status of 2 tasks
      When the connection returns
      Then I see "De volta online — sincronizando 2 alterações…"
      And then I see "Todas as alterações sincronizadas"
      And no task shows "Sincronização pendente"

  # ---------------------------------------------------------------- US-05.3
  Rule: A status change is shown immediately and reverted only if rejected

    @US-05.3 @AC-05.3.1 @AC-05.3.2 @must
    Scenario: Status change appears before the server answers
      Given the server takes 3 seconds to answer
      When I change the status of "Fix crash on Android" to "Concluída"
      Then the detail and the tasks list show "Concluída" immediately
      And "Fix crash on Android" shows "Sincronização pendente"
      When the server confirms
      Then "Fix crash on Android" shows "Concluída" without "Sincronização pendente"

    @US-05.3 @AC-05.3.3 @must
    Scenario Outline: A rejected status change is reverted everywhere
      Given the server will reject the next change with "<code>"
      When I change the status of "Fix crash on Android" to "Concluída"
      Then "Fix crash on Android" shows "Pendente" in the detail and in the lists
      And I see "<message>"

      Examples:
        | code              | message                                                                                                      |
        | VALIDATION_FAILED | Não foi possível salvar “Fix crash on Android”: Alguns campos são inválidos. Verifique os campos destacados. |
        | INTERNAL_ERROR    | Não foi possível salvar “Fix crash on Android”: Algo deu errado do nosso lado. Tente novamente.              |

    @US-05.3 @AC-05.3.4 @AC-05.7.4 @must
    Scenario: The last status chosen offline wins without self-conflict
      Given I am offline
      When I change the status of "Fix crash on Android" to "Concluída"
      And I change the status of "Fix crash on Android" to "Em andamento"
      And the connection returns
      Then the server has "Fix crash on Android" with status "Em andamento"
      And I see no message

    @US-05.3 @AC-05.3.5 @must
    Scenario: A task leaves a status-filtered list immediately
      Given I am viewing the "Pendente" tasks
      When I change the status of "Update dependencies" to "Concluída"
      Then "Update dependencies" is no longer in the list immediately

  # ---------------------------------------------------------------- US-05.4
  Rule: A deletion is shown immediately, and deleting twice is a success

    @US-05.4 @AC-05.4.1 @must
    Scenario: Deleting offline removes the task at once
      Given I am offline
      When I delete the task "Update dependencies" and confirm
      Then "Update dependencies" disappears from every list immediately
      When the connection returns
      Then the server no longer returns "Update dependencies"

    @US-05.4 @AC-05.4.2 @must
    Scenario: A rejected deletion restores the task
      Given the server will reject the next change with "INTERNAL_ERROR"
      When I delete the task "Update dependencies" and confirm
      Then "Update dependencies" reappears in the tasks list
      And I see "Não foi possível salvar “Update dependencies”: Algo deu errado do nosso lado. Tente novamente."

    @US-05.4 @AC-05.4.3 @AC-05.7.3 @must
    Scenario: Deleting a task already deleted elsewhere is a success
      Given I am offline
      And the task "Update dependencies" was deleted on another device
      When I delete the task "Update dependencies" and confirm
      And the connection returns
      Then I see no error message
      And "Update dependencies" does not appear in any list

    @US-05.4 @AC-05.4.4 @must
    Scenario: Deleting a team offline removes its chips at once
      Given I am offline
      When I delete the team "Backend" and confirm
      Then "Backend" disappears from the teams list
      And "Implement login screen" shows only the chip "Mobile"

  # ---------------------------------------------------------------- US-05.5
  Rule: Creations and edits are shown immediately and synced after anything they depend on

    @US-05.5 @AC-05.5.1 @must
    Scenario: Creating a task offline
      Given I am offline
      When I create the task "Write release notes" in the team "Mobile"
      Then I see "Salvo. Será sincronizado quando você estiver online."
      And "Write release notes" is first in the tasks list and in the "Mobile" list, marked "Sincronização pendente"

    @US-05.5 @AC-05.5.2 @must
    Scenario: Editing a task offline
      Given I am offline
      When I change the title of "Fix crash on Android" to "Fix crash on Android 14"
      Then the detail and the lists show "Fix crash on Android 14" marked "Sincronização pendente"

    @US-05.5 @AC-05.5.3 @AC-05.5.4 @must
    Scenario: Changes to a task created offline are applied after its creation
      Given I am offline
      And I created the task "Write release notes"
      When I open "Write release notes" and change its status to "Concluída"
      And the connection returns
      Then the server has exactly one task "Write release notes" with status "Concluída"
      And the detail of "Write release notes" is still open and shows "Concluída"

    @US-05.5 @AC-05.5.3 @must
    Scenario: A task created and deleted offline never reappears
      Given I am offline
      And I created the task "Temporary idea"
      When I delete the task "Temporary idea" and confirm
      And the connection returns
      Then the server does not return "Temporary idea"
      And "Temporary idea" does not appear in any list

    @US-05.5 @AC-05.5.5 @must
    Scenario: A creation rejected because a team no longer exists is reverted
      Given I am offline
      And I created the task "Plan sprint" in the team "Backend"
      And the team "Backend" was deleted on another device
      When the connection returns
      Then "Plan sprint" disappears from my lists
      And I see "Não foi possível salvar “Plan sprint”: Alguns times não existem mais e foram removidos."

    @US-05.5 @AC-05.5.6 @must
    Scenario: A task assigned to a team created offline syncs after the team
      Given I am offline
      When I create the team "Platform"
      And I create the task "Set up CI" in the team "Platform"
      And the connection returns
      Then the server has the team "Platform"
      And the server has the task "Set up CI" assigned to "Platform"

  # ---------------------------------------------------------------- US-05.6
  Rule: Pending changes are durable, ordered and safe to resend

    @US-05.6 @AC-05.6.1 @AC-05.6.2 @must
    Scenario: Pending changes survive a restart and sync in order
      Given I am offline
      When I create the task "Write release notes"
      And I change the status of "Fix crash on Android" to "Concluída"
      And I delete the task "Update dependencies" and confirm
      And I close and reopen the app
      Then I still see the 3 changes marked "Sincronização pendente" or applied
      When the connection returns
      Then the server receives the 3 changes in the order I made them
      And I see "Todas as alterações sincronizadas"

    @US-05.6 @AC-05.6.3 @must
    Scenario: An edit sent twice ends as if sent once
      Given the connection drops after the server stored my new title "Fix crash on Android 14" but before I got the answer
      When the edit is sent again
      Then the server has "Fix crash on Android 14" once
      And I see no error message

    @US-05.6 @AC-05.6.4 @must
    Scenario: Temporary server failures are retried, not discarded
      Given I am offline
      And I changed the status of "Fix crash on Android" to "Concluída"
      And the server is temporarily failing
      When the connection returns
      Then "Fix crash on Android" still shows "Concluída" marked "Sincronização pendente"
      When the server recovers
      Then the server has "Fix crash on Android" with status "Concluída"

    @US-05.6 @AC-05.6.5 @must
    Scenario Outline: Pending changes after the session expired
      Given I am offline
      And I changed the status of "Fix crash on Android" to "Concluída"
      And my session expired
      When the connection returns and "<user>" signs in
      Then the pending change is <outcome>

      Examples:
        | user               | outcome                                        |
        | marina@example.com | sent and the server has the status "Concluída" |
        | ana@example.com    | discarded and never sent                       |

    @US-05.6 @AC-05.6.5 @must @security
    Scenario: A queued change of one user is never sent with another user's session
      Given I am offline
      And "marina@example.com" queued a status change of "Fix crash on Android" to "Concluída"
      And the app is restarted and the stored session now belongs to "ana@example.com"
      When the app restores the pending changes and the connection returns
      Then the queued change is discarded before any request is made
      And the server receives no change for "Fix crash on Android"

    @US-05.6 @AC-05.6.5 @must @security
    Scenario: After a restart with an expired session nothing is sent until sign-in
      Given "marina@example.com" queued a status change of "Fix crash on Android" to "Concluída" while offline
      And my session has expired
      When the app is restarted and the connection returns
      Then no request carrying the queued change is made
      And the change still shows "Sincronização pendente"
      When "marina@example.com" signs in again
      Then the queued change is sent and the server has "Fix crash on Android" as "Concluída"

    @US-05.6 @AC-05.6.5 @must @security
    Scenario: A rejected session during replay clears cached data but keeps the queue
      Given "marina@example.com" has 2 queued changes
      When the server answers the replay with "UNAUTHENTICATED"
      Then the cached teams and tasks are cleared
      And the 2 queued changes are kept
      And I see the sign-in screen
      When "marina@example.com" signs in again
      Then the 2 queued changes are sent in the order I made them

    @US-05.6 @AC-05.6.6 @must
    Scenario: Signing out with pending changes asks for confirmation
      Given I am offline
      And I changed the status of 2 tasks
      When I choose to sign out
      Then I am warned "Você tem 2 alterações não sincronizadas. Ao sair, elas serão descartadas."
      When I cancel
      Then I am still signed in with 2 changes waiting to sync

  # ---------------------------------------------------------------- US-05.7
  Rule: The last write wins; a change that cannot be applied is discarded with a warning

    @US-05.7 @AC-05.7.1 @must
    Scenario: A pending edit overwrites a change made elsewhere
      Given I am offline
      And I changed the title of "Fix crash on Android" to "Fix Android crash"
      And another device changed the title of "Fix crash on Android" to "Fix crash on Pixel"
      When the connection returns
      Then the server has the title "Fix Android crash"
      And I see no message

    @US-05.7 @AC-05.7.2 @AC-05.7.5 @must
    Scenario: A pending change to a task deleted elsewhere is discarded with a warning
      Given I am offline
      And I changed the status of "Fix crash on Android" to "Concluída"
      And I changed the status of "Update dependencies" to "Concluída"
      And another device deleted "Fix crash on Android"
      When the connection returns
      Then "Fix crash on Android" disappears from my lists
      And I see "“Fix crash on Android” foi excluída em outro lugar."
      And the server has "Update dependencies" with status "Concluída"

    @US-05.7 @AC-05.7.3 @must
    Scenario: A replay whose effect is already on the server is a success
      Given my status change of "Fix crash on Android" to "Concluída" reached the server but the answer was lost
      When the change is sent again
      Then "Fix crash on Android" shows "Concluída" without "Sincronização pendente"
      And I see no message
