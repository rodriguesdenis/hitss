@api @auth
Feature: Authentication, sessions and ownership
  Marina creates an account and signs in from her phone or a script.
  Every business operation requires her session, she only ever sees her own
  data, and the authentication surface resists brute force. A demo account
  lets an evaluator try the product immediately.

  Rule: A person can create an account with a name, email and password

    @US-01.1 @AC-01.1.1 @could
    Scenario: Sign up with valid details
      Given no account exists for "marina@example.com"
      When I sign up as "Marina" with email "marina@example.com" and password "s3cure-pass"
      Then my account is created
      And I am signed in with a new session
      And the response shows my id, name "Marina" and email "marina@example.com"
      And the response contains no password or password hash

    @US-01.1 @AC-01.1.2 @could
    Scenario Outline: Sign up with an email that is already registered
      Given an account exists for "marina@example.com" with password "original-pass"
      When I sign up as "Someone" with email "<email>" and password "another-pass"
      Then sign-up is rejected because the email is already registered
      And there is exactly one account for "marina@example.com"
      And "marina@example.com" can still sign in with password "original-pass"

      Examples:
        | email              |
        | marina@example.com |
        | MARINA@Example.com |

    @US-01.1 @AC-01.1.3 @could
    Scenario Outline: Password length boundaries on sign-up
      When I sign up as "Marina" with email "marina@example.com" and a password of <length> characters
      Then sign-up is <outcome>

      Examples:
        | length | outcome  |
        | 7      | rejected |
        | 8      | accepted |
        | 128    | accepted |
        | 129    | rejected |

    @US-01.1 @AC-01.1.4 @could
    Scenario Outline: Malformed email on sign-up
      When I sign up as "Marina" with email "<email>" and password "s3cure-pass"
      Then sign-up is rejected
      And no account is created

      Examples:
        | email               |
        | marina.example.com  |
        | marina@             |
        | @example.com        |
        |                     |

    @US-01.1 @AC-01.1.5 @could
    Scenario Outline: Name rules on sign-up
      When I sign up with name "<name>", email "marina@example.com" and password "s3cure-pass"
      Then sign-up is <outcome>

      Examples:
        | name                     | outcome  |
        |                          | rejected |
        | "   "                    | rejected |
        | M                        | accepted |
        | a name of 100 characters | accepted |
        | a name of 101 characters | rejected |

    @US-01.1 @AC-01.1.5 @could
    Scenario: Name is stored trimmed
      When I sign up with name "  Marina  ", email "marina@example.com" and password "s3cure-pass"
      Then my account name is "Marina"

    @US-01.1 @AC-01.1.6 @could
    Scenario: Email is normalized to lower case
      When I sign up as "Marina" with email "Marina@Example.COM" and password "s3cure-pass"
      Then my account email is "marina@example.com"
      And I can sign in with email "MARINA@example.com" and password "s3cure-pass"

  Rule: A person signs in with email and password and gets a usable session

    Background:
      Given an account exists for "marina@example.com" with password "s3cure-pass"

    @US-01.2 @AC-01.2.1 @could
    Scenario: Sign in with correct credentials
      When I sign in with email "marina@example.com" and password "s3cure-pass"
      Then I receive a session as a bearer token
      And I receive the same session as a session cookie
      And the response contains my user data and no secret

    @US-01.2 @AC-01.2.2 @AC-01.2.3 @could
    Scenario Outline: Failed sign-in does not reveal whether the account exists
      When I sign in with email "<email>" and password "<password>"
      Then sign-in is rejected as "invalid email or password"
      And no session is issued

      Examples:
        | email                 | password    |
        | marina@example.com    | wrong-pass  |
        | nobody@example.com    | s3cure-pass |

    @US-01.2 @AC-01.2.3 @could
    Scenario: Wrong password and unknown email produce identical responses
      When I sign in with a wrong password for "marina@example.com"
      And I sign in with any password for "nobody@example.com"
      Then both responses have the same status, code and message

    @US-01.2 @AC-01.2.4 @could
    Scenario: The bearer token authenticates business requests
      Given I signed in as "marina@example.com"
      When I list my teams using only my bearer token
      Then the request is processed as "marina@example.com"

    @US-01.2 @AC-01.2.5 @could
    Scenario: The session cookie authenticates business requests
      Given I signed in as "marina@example.com"
      When I list my teams using only my session cookie
      Then the request is processed as "marina@example.com"

  Rule: Signing out revokes only the current session

    Background:
      Given an account exists for "marina@example.com" with password "s3cure-pass"

    @US-01.3 @AC-01.3.1 @could
    Scenario: A signed-out session can no longer be used
      Given I signed in as "marina@example.com"
      When I sign out
      Then using that session for a business request is rejected as unauthenticated
      And requesting the current session with it reports no active session

    @US-01.3 @AC-01.3.2 @could
    Scenario: Signing out on one device keeps the other device signed in
      Given I signed in as "marina@example.com" on my phone
      And I signed in as "marina@example.com" on my tablet
      When I sign out on my phone
      Then my tablet session can still list my teams

    @US-01.3 @AC-01.3.3 @could
    Scenario: Signing out without a session has no side effects
      Given "marina@example.com" is signed in on her phone
      When an anonymous client signs out
      Then the response is not a server error
      And Marina's phone session is still valid

  Rule: The current session can be checked

    Background:
      Given an account exists for "marina@example.com" with name "Marina"

    @US-01.4 @AC-01.4.1 @could
    Scenario: Current session for a signed-in user
      Given I signed in as "marina@example.com"
      When I request the current session
      Then I see user "marina@example.com" with name "Marina"
      And I see when the session expires

    @US-01.4 @AC-01.4.2 @could
    Scenario: Current session without credentials
      When an anonymous client requests the current session
      Then the response states there is no active session

    @US-01.4 @AC-01.4.3 @could
    Scenario: An expired session is not a session
      Given I signed in as "marina@example.com"
      And my session has expired
      When I request the current session
      Then the response states there is no active session
      And using that session for a business request is rejected as unauthenticated

    @US-01.4 @AC-01.4.4 @could
    Scenario: Sessions are renewed when used
      Given I signed in as "marina@example.com"
      And my session was last renewed 2 days ago
      When I make a business request with it
      Then my session now expires 7 days from now

  Rule: Every business endpoint requires authentication unless declared public

    @US-01.5 @AC-01.5.1 @could
    Scenario Outline: Anonymous requests to business endpoints are rejected
      When an anonymous client calls "<operation>"
      Then the request is rejected with status 401 and code "UNAUTHENTICATED"
      And the error follows the standard error envelope
      And no data was changed

      Examples:
        | operation           |
        | list teams          |
        | get a team          |
        | create a team       |
        | update a team       |
        | delete a team       |
        | list tasks          |
        | get a task          |
        | create a task       |
        | update a task       |
        | change task status  |
        | delete a task       |

    @US-01.5 @AC-01.5.2 @could
    Scenario Outline: Invalid credentials are treated as anonymous
      Given an account exists for "marina@example.com"
      When a client lists teams with <credential>
      Then the request is rejected with status 401 and code "UNAUTHENTICATED"

      Examples:
        | credential                              |
        | a malformed bearer token                |
        | a forged bearer token                   |
        | a bearer token from a signed-out session |
        | a bearer token from an expired session  |
        | an empty bearer header                  |
        | a non-bearer authorization scheme       |

    @US-01.5 @AC-01.5.3 @could
    Scenario Outline: Health checks are public
      When an anonymous client calls the "<check>" health check
      Then it responds normally

      Examples:
        | check     |
        | liveness  |
        | readiness |

    @US-01.5 @AC-01.5.4 @could
    Scenario: Endpoints are private by default
      Given the complete inventory of business endpoints exposed by the API
      Then every endpoint requires authentication except those explicitly declared public
      And the explicitly public endpoints are exactly the health checks

    @US-01.5 @AC-01.5.5 @could
    Scenario: Authentication is checked before existence
      Given "marina@example.com" owns a team "Mobile"
      When an anonymous client requests team "Mobile" by its id
      And an anonymous client requests a team by an id that does not exist
      Then both responses are 401 with code "UNAUTHENTICATED"

  Rule: A user only ever sees and changes their own data

    Background:
      Given I am signed in as "marina@example.com"
      And another user "rafael@example.com" owns a team "Backend" and a task "Deploy API"

    @US-01.6 @AC-01.6.1 @could
    Scenario Outline: Listings contain only my items
      Given I own a <resource> named "<mine>"
      When I list my <resource>s
      Then I see "<mine>"
      And I do not see "<theirs>"
      And the total counts only my <resource>s

      Examples:
        | resource | mine            | theirs     |
        | team     | Mobile          | Backend    |
        | task     | Write release   | Deploy API |

    @US-01.6 @AC-01.6.2 @could
    Scenario Outline: Another user's resource looks like it does not exist
      When I get Rafael's <resource> "<theirs>" by its id
      Then the response is identical to getting a nonexistent <resource>
      And the status is 404 with code "<code>"

      Examples:
        | resource | theirs     | code           |
        | team     | Backend    | TEAM_NOT_FOUND |
        | task     | Deploy API | TASK_NOT_FOUND |

    @US-01.6 @AC-01.6.3 @could
    Scenario Outline: I cannot change another user's resource
      When I <action> Rafael's <resource> "<theirs>"
      Then the status is 404 with code "<code>"
      And Rafael's <resource> "<theirs>" is unchanged

      Examples:
        | action | resource | theirs     | code           |
        | update | team     | Backend    | TEAM_NOT_FOUND |
        | delete | team     | Backend    | TEAM_NOT_FOUND |
        | update | task     | Deploy API | TASK_NOT_FOUND |
        | delete | task     | Deploy API | TASK_NOT_FOUND |

    @US-01.6 @AC-01.6.4 @could
    Scenario Outline: The owner cannot be chosen by the client
      When I <action> including an owner field set to Rafael's id
      Then the request is rejected with status 400 and code "VALIDATION_FAILED"
      And the error details name the field "ownerId"

      Examples:
        | action          |
        | create a team   |
        | update a team   |
        | create a task   |
        | update a task   |

  Rule: Authentication and the business API are rate limited

    @US-01.7 @AC-01.7.1 @could
    Scenario: Too many authentication attempts from one address
      Given a client made 10 credential requests within the last minute
      When it attempts to sign in again within that minute
      Then the request is rejected as "too many requests"
      And the response says how many seconds to wait
      And the credentials were not checked

    @US-01.7 @AC-01.7.2 @could
    Scenario: Authentication throttling ends after the window
      Given a client was throttled on authentication
      When the one-minute window has passed
      And it signs in with valid credentials
      Then sign-in succeeds

    @US-01.7 @AC-01.7.3 @could
    Scenario: Too many business requests from one user
      Given I am signed in as "marina@example.com"
      And I made 100 business requests within the last minute
      When I make another business request within that minute
      Then the request is rejected with status 429 and code "RATE_LIMITED"
      And the response has a "Retry-After" value

    @US-01.7 @AC-01.7.4 @could
    Scenario: Throttling one user does not affect another
      Given "marina@example.com" is being rate limited on the business API
      When "rafael@example.com" lists his teams
      Then his request succeeds

    @US-01.7 @AC-01.7.5 @could
    Scenario: Health checks are never throttled
      When an anonymous client calls the liveness health check 150 times within a minute
      Then every call responds normally

    @US-01.7 @AC-01.7.6 @could @security
    Scenario: Spoofed client addresses do not bypass authentication throttling
      Given a client was throttled on authentication
      When it attempts to sign in again claiming a different client address in a forwarding header
      Then the request is rejected as "too many requests"

    @US-01.7 @AC-01.7.7 @could
    Scenario: Frequent session checks are not throttled by the credential limit
      Given I am signed in as "marina@example.com"
      When I request the current session 30 times within a minute
      Then every request reports my active session

  Rule: A demo account exists in every fresh environment

    @US-01.8 @AC-01.8.1 @could
    Scenario: Sign in with the demo account
      Given a freshly started and seeded environment
      When I sign in with email "demo@teams-tasks.dev" and password "Demo@1234"
      Then sign-in succeeds

    @US-01.8 @AC-01.8.2 @could
    Scenario: Re-seeding keeps a single, unchanged demo account
      Given the seed has run
      When the seed runs again
      Then there is exactly one account for "demo@teams-tasks.dev"
      And its id is the same as before
      And it still signs in with password "Demo@1234"

    @US-01.8 @AC-01.8.3 @could
    Scenario: The demo account owns the sample data
      Given a freshly started and seeded environment
      When I sign in as "demo@teams-tasks.dev" and list my teams and tasks
      Then I see 3 teams and 10 tasks
