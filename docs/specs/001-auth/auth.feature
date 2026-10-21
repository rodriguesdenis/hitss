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

    @US-01.1 @AC-01.1.5 @could @security
    Scenario Outline: Names reject control characters
      When I sign up with a name containing <characters>, email "marina@example.com" and password "s3cure-pass"
      Then sign-up is rejected
      And no account is created

      Examples:
        | characters                  |
        | a newline between two words |
        | a tab between two words     |
        | a NUL character             |
        | an escape character         |

    @US-01.1 @AC-01.1.6 @could
    Scenario: Email is normalized to lower case
      When I sign up as "Marina" with email "Marina@Example.COM" and password "s3cure-pass"
      Then my account email is "marina@example.com"
      And I can sign in with email "MARINA@example.com" and password "s3cure-pass"

  Rule: A person signs in with email and password and gets a usable session

    Background:
      Given an account exists for "marina@example.com" with password "s3cure-pass"

    @US-01.2 @AC-01.2.1 @must
    Scenario: Sign in with correct credentials
      When I sign in with email "marina@example.com" and password "s3cure-pass"
      Then I receive a session as a bearer token
      And I receive the same session as a session cookie
      And the response contains my user data and no secret

    @US-01.2 @AC-01.2.2 @AC-01.2.3 @must
    Scenario Outline: Failed sign-in does not reveal whether the account exists
      When I sign in with email "<email>" and password "<password>"
      Then sign-in is rejected as "invalid email or password"
      And no session is issued

      Examples:
        | email                 | password    |
        | marina@example.com    | wrong-pass  |
        | nobody@example.com    | s3cure-pass |

    @US-01.2 @AC-01.2.3 @must
    Scenario: Wrong password and unknown email produce identical responses
      When I sign in with a wrong password for "marina@example.com"
      And I sign in with any password for "nobody@example.com"
      Then both responses have the same status, code and message

    @US-01.2 @AC-01.2.7 @must
    Scenario: Sign-in for an unknown email still spends the password-hash time
      When I sign in with an email that has no account and any password
      Then the password hash function is still run once
      And the response is identical to a wrong password for an existing account

    @US-01.2 @AC-01.2.6 @must
    Scenario: Surrounding spaces in the email are trimmed on sign-in
      When I sign in with email "  marina@example.com  " and password "s3cure-pass"
      Then sign-in succeeds

    @US-01.2 @AC-01.2.6 @must
    Scenario Outline: Passwords are compared exactly, never trimmed
      Given an account exists for "spacey@example.com" with password "  pass word  "
      When I sign in with email "spacey@example.com" and password "<password>"
      Then sign-in is <outcome>

      Examples:
        | password        | outcome  |
        | "  pass word  "   | accepted |
        | "pass word"      | rejected |

    @US-01.2 @AC-01.2.8 @must @security
    Scenario: Sign-in from an untrusted origin is rejected
      When a browser page from the untrusted origin "https://evil.example" signs in as "marina@example.com"
      Then the request is rejected
      And no session is issued

    @US-01.2 @AC-01.2.8 @must @security
    Scenario: Sign-in from a trusted origin works
      When a client with the trusted origin signs in as "marina@example.com"
      Then sign-in succeeds

    @US-01.2 @AC-01.2.4 @must
    Scenario: The bearer token authenticates business requests
      Given I signed in as "marina@example.com"
      When I list my teams using only my bearer token
      Then the request is processed as "marina@example.com"

    @US-01.2 @AC-01.2.5 @must
    Scenario: The session cookie authenticates business requests
      Given I signed in as "marina@example.com"
      When I list my teams using only my session cookie
      Then the request is processed as "marina@example.com"

  Rule: Signing out revokes only the current session

    Background:
      Given an account exists for "marina@example.com" with password "s3cure-pass"

    @US-01.3 @AC-01.3.1 @must
    Scenario: A signed-out session can no longer be used
      Given I signed in as "marina@example.com"
      When I sign out
      Then using that session for a business request is rejected as unauthenticated
      And requesting the current session with it reports no active session

    @US-01.3 @AC-01.3.2 @must
    Scenario: Signing out on one device keeps the other device signed in
      Given I signed in as "marina@example.com" on my phone
      And I signed in as "marina@example.com" on my tablet
      When I sign out on my phone
      Then my tablet session can still list my teams

    @US-01.3 @AC-01.3.3 @must
    Scenario: Signing out without a session has no side effects
      Given "marina@example.com" is signed in on her phone
      When an anonymous client signs out
      Then the response is not a server error
      And Marina's phone session is still valid

  Rule: The current session can be checked

    Background:
      Given an account exists for "marina@example.com" with name "Marina"

    @US-01.4 @AC-01.4.1 @must
    Scenario: Current session for a signed-in user
      Given I signed in as "marina@example.com"
      When I request the current session
      Then I see user "marina@example.com" with name "Marina"
      And I see when the session expires

    @US-01.4 @AC-01.4.2 @must
    Scenario: Current session without credentials
      When an anonymous client requests the current session
      Then the response states there is no active session

    @US-01.4 @AC-01.4.3 @must
    Scenario: An expired session is not a session
      Given I signed in as "marina@example.com"
      And my session has expired
      When I request the current session
      Then the response states there is no active session
      And using that session for a business request is rejected as unauthenticated

    @US-01.4 @AC-01.4.4 @must
    Scenario: Sessions are renewed when used
      Given I signed in as "marina@example.com"
      And my session was last renewed 2 days ago
      When I make a business request with it
      Then my session now expires 7 days from now

  Rule: Every business endpoint requires authentication unless declared public

    @US-01.5 @AC-01.5.1 @must
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

    @US-01.5 @AC-01.5.2 @AC-01.5.6 @must
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
        | an unsigned raw session token           |

    @US-01.5 @AC-01.5.7 @must
    Scenario: A bearer token wins over a different session cookie
      Given "marina@example.com" and "rafael@example.com" are signed in
      When I list teams sending Marina's bearer token and Rafael's session cookie
      Then the request is processed as "marina@example.com"

    @US-01.5 @AC-01.5.8 @AC-01.5.9 @must @security
    Scenario Outline: Cookie-authenticated writes from an untrusted site are rejected
      Given I am signed in as "marina@example.com" with a session cookie
      When a request <request> is sent with only the session cookie
      Then the request is rejected with status <status> and code "<code>"
      And no data was changed

      Examples:
        | request                                                         | status | code                    |
        | creating a team comes from an untrusted Origin                  | 403    | CSRF_REJECTED           |
        | creating a team comes from an untrusted Referer and no Origin   | 403    | CSRF_REJECTED           |
        | creating a team is marked as a cross-site fetch                 | 403    | CSRF_REJECTED           |
        | creating a team has a form content type instead of JSON        | 415    | UNSUPPORTED_MEDIA_TYPE  |

    @US-01.5 @AC-01.5.8 @AC-01.5.10 @must @security
    Scenario Outline: The cross-site guard allows legitimate clients
      When a client creates a team <circumstance>
      Then the request is processed

      Examples:
        | circumstance                                                         |
        | with a session cookie and a trusted Origin                           |
        | with a session cookie and no Origin or Referer, as the mobile app does |
        | with a bearer token from an untrusted Origin                         |
        | with a session cookie and a same-site fetch metadata header          |

    @US-01.5 @AC-01.5.8 @must @security
    Scenario: Safe methods are not subject to the cross-site guard
      When a cookie-authenticated list of teams comes from an untrusted Origin
      Then the request is processed

    @US-01.5 @AC-01.5.3 @must
    Scenario Outline: Health checks are public
      When an anonymous client calls the "<check>" health check
      Then it responds normally

      Examples:
        | check     |
        | liveness  |
        | readiness |

    @US-01.5 @AC-01.5.4 @must
    Scenario: Endpoints are private by default
      Given the complete inventory of business endpoints exposed by the API
      Then every endpoint requires authentication except those explicitly declared public
      And the explicitly public endpoints are exactly the health checks, plus the API documentation when it is enabled

    @US-01.5 @AC-01.5.4 @must
    Scenario Outline: API documentation is public only when enabled
      Given the API documentation setting is <setting>
      When an anonymous client requests the documentation page and the OpenAPI document
      Then they are <availability>

      Examples:
        | setting                   | availability  |
        | left at its default       | served        |
        | disabled                  | not found     |

    @US-01.8 @AC-01.8.6 @must @security
    Scenario: API documentation is forced off in production
      Given the environment is production and the API documentation setting is enabled
      When an anonymous client requests the documentation page
      Then it is not found

    @US-01.5 @AC-01.5.5 @must
    Scenario: Authentication is checked before existence
      Given "marina@example.com" owns a team "Mobile"
      When an anonymous client requests team "Mobile" by its id
      And an anonymous client requests a team by an id that does not exist
      Then both responses are 401 with code "UNAUTHENTICATED"

  Rule: A user only ever sees and changes their own data

    Background:
      Given I am signed in as "marina@example.com"
      And another user "rafael@example.com" owns a team "Backend" and a task "Deploy API"

    @US-01.6 @AC-01.6.1 @must
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

    @US-01.6 @AC-01.6.2 @must
    Scenario Outline: Another user's resource looks like it does not exist
      When I get Rafael's <resource> "<theirs>" by its id
      Then the response is identical to getting a nonexistent <resource>
      And the status is 404 with code "<code>"

      Examples:
        | resource | theirs     | code           |
        | team     | Backend    | TEAM_NOT_FOUND |
        | task     | Deploy API | TASK_NOT_FOUND |

    @US-01.6 @AC-01.6.3 @must
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

    @US-01.6 @AC-01.6.5 @must
    Scenario Outline: Another user's team behaves as an unknown team
      When I <action> using Rafael's team "Backend"
      Then the team is treated as unknown
      And no task of Rafael's is changed

      Examples:
        | action                                  |
        | assign it to one of my tasks            |
        | filter my tasks by it                   |

    @US-01.6 @AC-01.6.4 @must
    Scenario Outline: The owner cannot be chosen by the client
      When I <action> including the field "<field>" set to Rafael's id
      Then the request is rejected with status 400 and code "VALIDATION_FAILED"
      And the error details name the field "<field>"
      And nothing is created or changed

      Examples:
        | action          | field     |
        | create a team   | ownerId   |
        | update a team   | ownerId   |
        | create a task   | ownerId   |
        | update a task   | ownerId   |
        | create a team   | owner_id  |
        | update a team   | owner_id  |
        | create a task   | owner_id  |
        | update a task   | owner_id  |
        | create a team   | userId    |
        | update a team   | userId    |
        | create a task   | userId    |
        | update a task   | userId    |

    @US-01.6 @AC-01.6.6 @must @security
    Scenario Outline: Server-managed and prototype fields are rejected on create and update
      When I <action> including the field "<field>"
      Then the request is rejected with status 400 and code "VALIDATION_FAILED"
      And the error details name the field "<field>"
      And nothing is created or changed

      Examples:
        | action          | field       |
        | create a team   | updatedAt   |
        | update a team   | updatedAt   |
        | create a team   | deletedAt   |
        | update a team   | deletedAt   |
        | create a task   | updatedAt   |
        | update a task   | updatedAt   |
        | create a task   | deletedAt   |
        | update a task   | deletedAt   |
        | create a team   | __proto__   |
        | update a team   | __proto__   |
        | create a task   | constructor |
        | update a task   | constructor |

    @US-01.6 @AC-01.6.6 @must @security
    Scenario Outline: An owner given as an object is rejected, not merged
      When I <action> including an "owner" field that is an object holding Rafael's id
      Then the request is rejected with status 400 and code "VALIDATION_FAILED"
      And the error details name the field "owner"

      Examples:
        | action          |
        | create a team   |
        | update a team   |
        | create a task   |
        | update a task   |

  Rule: Authentication and the business API are rate limited
    # The client address is the socket address, or the forwarded one only when the
    # request comes through a configured trusted proxy. Behind Docker Desktop / WSL
    # NAT every host request may share one source address; this is documented, and
    # e2e tests assert the resolved address instead of relying on the library's
    # fixed test-environment address.

    @US-01.7 @AC-01.7.1 @could
    Scenario Outline: Too many attempts on one credential endpoint from one address
      Given a client made 10 "<endpoint>" requests within the last minute
      When it makes an 11th "<endpoint>" request within that minute
      Then the request is rejected as "too many requests"
      And the response says how many seconds to wait
      And the credentials were not checked

      Examples:
        | endpoint |
        | sign-up  |
        | sign-in  |
        | sign-out |

    @US-01.7 @AC-01.7.1 @could
    Scenario: Credential endpoints are limited independently, not combined
      Given a client made 10 "sign-in" requests within the last minute
      When it makes a "sign-up" request within that minute
      Then the sign-up request is not throttled

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

    @US-01.7 @AC-01.7.3 @could
    Scenario: The per-user business limit follows the configured value
      Given the per-user limit is configured to 5 requests per minute
      And I am signed in as "marina@example.com"
      When I make 6 business requests within that minute
      Then the first 5 succeed
      And the 6th is rejected with status 429 and code "RATE_LIMITED"

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
    Scenario Outline: Spoofed client addresses do not bypass authentication throttling
      Given a client was throttled on authentication
      When it attempts to sign in again claiming a different client address in the "<header>" header
      Then the request is rejected as "too many requests"

      Examples:
        | header           |
        | X-Forwarded-For  |
        | X-Real-IP        |
        | Forwarded        |
        | X-Tt-Client-Ip   |

    @US-01.7 @AC-01.7.6 @could @security
    Scenario: The resolved client address ignores an incoming internal address header
      When a client sends a request with the header "X-Tt-Client-Ip" set to "203.0.113.9"
      Then the address used for rate limiting is the connection's own address
      And it is not "203.0.113.9"

    @US-01.7 @AC-01.7.8 @could @security
    Scenario: Clients at different addresses have independent credential limits
      Given a client at address A made 10 sign-in requests within the last minute
      When a client at address B signs in within that minute
      Then the request from address B is not throttled

    @US-01.7 @AC-01.7.8 @could @security
    Scenario: Throttling client A does not throttle client B
      Given the client at address A is throttled on authentication
      When the client at address B makes 10 sign-in requests within the same minute
      Then all 10 are processed
      And address A is still throttled

    @US-01.7 @AC-01.7.8 @could @security
    Scenario: The limiter test asserts the resolved address
      Given the limiter is exercised through the real request pipeline
      When requests arrive from two distinct addresses
      Then the limiter keys its counters by those two distinct addresses
      And the test does not rely on a fixed test-environment address

    @US-01.7 @AC-01.7.11 @could @security
    Scenario: A forwarded address is trusted only from a trusted proxy
      Given the trusted proxy networks are configured to include the connection's address
      When a request carries the forwarded address "198.51.100.7"
      Then the address used for rate limiting is "198.51.100.7"
      Given the trusted proxy networks are configured and the connection's address is outside them
      When a request carries the forwarded address "198.51.100.7"
      Then the address used for rate limiting is the connection's own address
      Given no trusted proxy networks are configured
      When a request carries the forwarded address "198.51.100.7"
      Then the address used for rate limiting is the connection's own address

    @US-01.7 @AC-01.7.7 @could
    Scenario Outline: Session checks have their own, higher limit
      Given I am signed in as "marina@example.com"
      When I request the current session <count> times from one address within a minute
      Then <outcome>

      Examples:
        | count | outcome                                             |
        | 30    | every request reports my active session             |
        | 100   | every request reports my active session             |
        | 101   | the 101st request is rejected as "too many requests" |

    @US-01.7 @AC-01.7.7 @could
    Scenario: Session checks do not consume the credential limit
      Given I am signed in as "marina@example.com"
      And I requested the current session 50 times within the last minute
      When I sign in again
      Then sign-in is not throttled

    @US-01.7 @AC-01.7.9 @could @security
    Scenario: Anonymous traffic from one address is throttled before authentication
      Given the per-address limit is configured to 5 requests per minute
      When an anonymous client sends 6 business requests from one address within a minute
      Then the first 5 are rejected with status 401 and code "UNAUTHENTICATED"
      And the 6th is rejected with status 429 and code "RATE_LIMITED"

    @US-01.7 @AC-01.7.9 @could @security
    Scenario: The per-address limit defaults to 300 requests per minute
      When an anonymous client sends 301 requests to a business endpoint from one address within a minute
      Then the 301st is rejected with status 429 and code "RATE_LIMITED"

    @US-01.7 @AC-01.7.10 @could @security
    Scenario Outline: Oversized authentication bodies are refused before hashing
      When a client posts a <size> body to the sign-in endpoint
      Then the response status is <status>
      And no password hash was computed

      Examples:
        | size              | status |
        | 1 kB              | not 413 |
        | 16 kB             | not 413 |
        | more than 16 kB   | 413    |

  Rule: A demo account exists in every fresh environment

    @US-01.8 @AC-01.8.1 @must
    Scenario: Sign in with the demo account
      Given a freshly started and seeded environment
      When I sign in with email "demo@teams-tasks.dev" and password "Demo@1234"
      Then sign-in succeeds

    @US-01.8 @AC-01.8.2 @must
    Scenario: Re-seeding keeps a single, unchanged demo account
      Given the seed has run
      When the seed runs again
      Then there is exactly one account for "demo@teams-tasks.dev"
      And its id is the same as before
      And it still signs in with password "Demo@1234"

    @US-01.8 @AC-01.8.4 @must @security
    Scenario Outline: The demo account is created only where demo seeding is allowed
      Given the environment is "<environment>" and demo seeding is "<setting>"
      When the seed runs
      Then the demo account "demo@teams-tasks.dev" <outcome>

      Examples:
        | environment | setting  | outcome           |
        | development | enabled  | exists            |
        | development | disabled | does not exist    |
        | production  | enabled  | does not exist    |
        | production  | disabled | does not exist    |

    @US-01.8 @AC-01.8.3 @must
    Scenario: The demo account owns the sample data
      Given a freshly started and seeded environment
      When I sign in as "demo@teams-tasks.dev" and list my teams and tasks
      Then I see 3 teams and 10 tasks

  Rule: The service fails safely: unsafe production configuration is refused and failures do not leak internals

    @US-01.8 @AC-01.8.5 @must @security
    Scenario Outline: Unsafe production settings are rejected at startup
      Given the environment is production
      And <setting>
      When the API starts
      Then startup fails with an error naming the setting but not its value

      Examples:
        | setting                                               |
        | the public authentication URL uses http               |
        | the allowed origins include "*"                       |
        | the allowed origins include an http:// origin         |
        | the allowed origins include a localhost origin        |
        | authentication rate limiting is disabled              |
        | the app scheme is "exp"                               |

    @US-01.8 @AC-01.8.5 @must
    Scenario: A safe production configuration starts
      Given the environment is production with an https URL, https origins, rate limiting enabled and a custom app scheme
      When the API starts
      Then it starts

    @US-01.8 @AC-01.8.5 @must
    Scenario: The same unsafe settings are accepted outside production
      Given the environment is development with an http URL and a localhost origin
      When the API starts
      Then it starts

    @US-01.4 @AC-01.4.5 @must @security
    Scenario: A database failure on an authentication route does not leak internals
      Given the database is unavailable
      When a client signs in
      Then the response is a generic error
      And it contains no SQL, table name or Prisma error text
