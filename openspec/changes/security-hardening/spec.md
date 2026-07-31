# Security Hardening — Delta Specs

## PR1: Rate Limiting

### Requirement: Sliding-Window Rate Limiter on Auth Endpoints

The system SHALL apply a sliding-window rate limiter to all `/api/auth/*` routes. The limiter MUST differentiate requests by IP address and, for sign-in attempts, by email address.

The rate limit thresholds MUST be configurable via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_MAX` | `10` | Max requests per window |
| `RATE_LIMIT_WINDOW` | `60000` | Window size in milliseconds |

#### Scenario: Successful sign-in within limit

- GIVEN a user submits valid credentials
- WHEN the request count for their IP+email is below `RATE_LIMIT_MAX`
- THEN the sign-in request proceeds normally
- AND the session is created

#### Scenario: Sign-in blocked by rate limit

- GIVEN a user has exhausted `RATE_LIMIT_MAX` sign-in attempts within `RATE_LIMIT_WINDOW`
- WHEN they submit another sign-in request
- THEN the server responds with HTTP 429
- AND the response includes a `Retry-After` header with remaining seconds

#### Scenario: Non-sign-in auth routes rate-limited by IP only

- GIVEN a request to `/api/auth/*` that is not a sign-in (e.g., session check)
- WHEN the request count for the source IP exceeds `RATE_LIMIT_MAX`
- THEN the server responds with HTTP 429

#### Scenario: Window expiry resets counter

- GIVEN a user has exhausted their rate limit
- WHEN `RATE_LIMIT_WINDOW` milliseconds elapse
- THEN the next request is accepted and the counter resets

### Requirement: baseURL Startup Validation

The system MUST validate `BETTER_AUTH_URL` (or its computed fallback) on module load of `lib/auth.ts`. The validation MUST check that the URL has a valid `http` or `https` scheme and a non-empty hostname. An invalid value MUST throw an error at startup, preventing the server from starting.

#### Scenario: Valid explicit baseURL

- GIVEN `BETTER_AUTH_URL` is set to `https://app.example.com`
- WHEN `lib/auth.ts` loads
- THEN the URL is accepted and used as `baseURL`

#### Scenario: Invalid scheme throws at startup

- GIVEN `BETTER_AUTH_URL` is set to `ftp://example.com`
- WHEN `lib/auth.ts` loads
- THEN an error is thrown with a descriptive message
- AND the server fails to start

#### Scenario: Missing hostname throws at startup

- GIVEN `BETTER_AUTH_URL` is set to `https://`
- WHEN `lib/auth.ts` loads
- THEN an error is thrown

#### Scenario: No explicit URL — fallback validation

- GIVEN `BETTER_AUTH_URL` is unset and `VERCEL_PROJECT_PRODUCTION_URL` is `my-app.vercel.app`
- WHEN `lib/auth.ts` loads
- THEN the computed URL `https://my-app.vercel.app` is validated and accepted

---

## PR2: Cookie Security + trustedOrigins

### Requirement: Dev Cookie Attributes for HTTP Localhost

The system MUST detect development mode over HTTP on `localhost` and set cookie attributes to `sameSite: 'lax'` and `secure: false`. This allows cookies to work correctly in local HTTP environments.

#### Scenario: Dev HTTP localhost gets lax cookies

- GIVEN `NODE_ENV` is `development`
- AND the server is accessed via `http://localhost:3000`
- WHEN a session cookie is set
- THEN `sameSite` is `lax`
- AND `secure` is `false`

#### Scenario: Dev HTTPS localhost gets cross-site cookies

- GIVEN `NODE_ENV` is `development`
- AND the server is accessed via `https://localhost:3000` (e.g., iframe/preview)
- WHEN a session cookie is set
- THEN `sameSite` is `none`
- AND `secure` is `true`

### Requirement: Prod Cookie Attributes

The system MUST set explicit cookie attributes in production: `httpOnly: true`, `secure: true`, `sameSite: 'lax'`.

#### Scenario: Production cookies are hardened

- GIVEN `NODE_ENV` is `production`
- WHEN a session cookie is set
- THEN `httpOnly` is `true`
- AND `secure` is `true`
- AND `sameSite` is `lax`

### Requirement: trustedOrigins Sanitization

The system MUST filter `trustedOrigins` entries to only include well-formed URLs with `http` or `https` scheme and a valid hostname. Malformed entries MUST be dropped and logged as warnings at startup.

#### Scenario: Valid origins pass through

- GIVEN `VERCEL_URL` is `my-app-abc.vercel.app`
- WHEN `trustedOrigins` is computed
- THEN `https://my-app-abc.vercel.app` is included

#### Scenario: Malformed URL is filtered

- GIVEN `V0_RUNTIME_URL` is set to an empty string or a non-URL value like `not-a-url`
- WHEN `trustedOrigins` is computed
- THEN the entry is excluded from the list
- AND a warning is logged at startup

#### Scenario: Development origin included only in dev mode

- GIVEN `NODE_ENV` is `development`
- WHEN `trustedOrigins` is computed
- THEN `http://localhost:3000` is included
- AND production-only origins are not duplicated

---

## PR3: FK Constraint + Error Handling

### Requirement: FK Constraint on tasks.userId

The system MUST define a foreign key from `tasks.userId` to `user.id` with `onDelete: 'cascade'` in the Drizzle schema. A Drizzle migration MUST be generated and applied.

#### Scenario: Task creation respects FK

- GIVEN a user with a valid `user.id`
- WHEN a task is created with that `userId`
- THEN the task is inserted successfully
- AND the FK constraint is satisfied

#### Scenario: User deletion cascades to tasks

- GIVEN a user with associated tasks
- WHEN the user row is deleted
- THEN all tasks with that `userId` are cascade-deleted
- AND no orphan rows remain

#### Scenario: Invalid userId rejected

- GIVEN a task insert with a `userId` that does not exist in `user`
- WHEN the insert is executed
- THEN the database rejects it with a FK violation error

### Requirement: getUserId Returns Typed Error

The system MUST refactor `getUserId()` to return `ActionResult` (`{ ok: false, error: 'Unauthorized' }`) instead of throwing `Error('Unauthorized')`. All callers MUST handle the typed result.

#### Scenario: Unauthenticated request to getTasks

- GIVEN no valid session exists
- WHEN `getTasks()` is called
- THEN it returns `{ ok: false, error: 'Unauthorized' }`
- AND no database query is executed

#### Scenario: Unauthenticated request to createTask

- GIVEN no valid session exists
- WHEN `createTask()` is called
- THEN it returns `{ ok: false, error: 'Unauthorized' }`

#### Scenario: Unauthenticated request to updateTask

- GIVEN no valid session exists
- WHEN `updateTask()` is called
- THEN it returns `{ ok: false, error: 'Unauthorized' }`

#### Scenario: Unauthenticated request to updateTaskStatus

- GIVEN no valid session exists
- WHEN `updateTaskStatus()` is called
- THEN it returns `{ ok: false, error: 'Unauthorized' }`

#### Scenario: Unauthenticated request to deleteTask

- GIVEN no valid session exists
- WHEN `deleteTask()` is called
- THEN it returns `{ ok: false, error: 'Unauthorized' }`

---

## PR4: Route Protection + Minor Fixes

### Requirement: Auth Middleware for Protected Routes

The system MUST add `middleware.ts` at the project root. The middleware MUST check for a valid session on protected routes: `/` and `/tasks/*`. Unauthenticated requests MUST be redirected to `/sign-in`.

Public routes that MUST be excluded from session checks: `/sign-in`, `/sign-up`, `/api/auth/*`, `/_next/*`.

#### Scenario: Authenticated user accesses root

- GIVEN a valid session cookie exists
- WHEN the user navigates to `/`
- THEN the request proceeds normally

#### Scenario: Unauthenticated user accesses root

- GIVEN no valid session exists
- WHEN the user navigates to `/`
- THEN they are redirected to `/sign-in`

#### Scenario: Authenticated user accesses task route

- GIVEN a valid session cookie exists
- WHEN the user navigates to `/tasks/123`
- THEN the request proceeds normally

#### Scenario: Unauthenticated user accesses task route

- GIVEN no valid session exists
- WHEN the user navigates to `/tasks/123`
- THEN they are redirected to `/sign-in`

#### Scenario: Public routes bypass middleware

- GIVEN no valid session exists
- WHEN the user navigates to `/sign-in` or `/sign-up`
- THEN the request proceeds without redirect

#### Scenario: API auth routes bypass middleware

- GIVEN a request to `/api/auth/sign-in`
- WHEN the middleware evaluates the path
- THEN the request is NOT intercepted

### Requirement: XSS-Safe Encoding

The system MUST use `encodeURIComponent()` for user-supplied text rendered in URL contexts. For standard React rendering, auto-escaping is sufficient. This assumption MUST be documented.

#### Scenario: User task title rendered in JSX

- GIVEN a task with title `<script>alert(1)</script>`
- WHEN the title is rendered in a React component
- THEN React's auto-escaping prevents XSS
- AND no raw HTML is injected

#### Scenario: User text in URL parameter

- GIVEN a search query containing `&param=value`
- WHEN the query is placed in a URL
- THEN `encodeURIComponent()` encodes special characters

### Requirement: Optimistic Lock on updateTaskStatus

The system MUST compare `updatedAt` on update. If the provided `updatedAt` does not match the stored value, the system MUST return a conflict error indicating stale data.

#### Scenario: Concurrent update detected

- GIVEN task with `updatedAt` = T1
- WHEN `updateTaskStatus` is called with `updatedAt` = T0 (where T0 < T1)
- THEN the update is rejected
- AND the response is `{ ok: false, error: 'Conflicto: la tarea fue modificada. Recargá la página.' }`

#### Scenario: Valid update proceeds

- GIVEN task with `updatedAt` = T1
- WHEN `updateTaskStatus` is called with `updatedAt` = T1
- THEN the update succeeds
- AND `updatedAt` is set to the current timestamp

### Requirement: Drag-Drop Opaque Token

The system MUST use an opaque token (UUID or hash) in `dataTransfer` for drag operations instead of exposing raw database IDs. The token MUST be resolvable back to the task only server-side.

#### Scenario: Drag starts with opaque token

- GIVEN a task with `id` = 42
- WHEN the user begins dragging the task card
- THEN the `dataTransfer` payload contains a UUID/hashed token
- AND the raw numeric ID `42` is NOT present in the DOM or data transfer

#### Scenario: Drop resolves token to task

- GIVEN a drag token in `dataTransfer`
- WHEN the drop event fires
- THEN the system resolves the token to the correct task ID server-side

### Requirement: Dependency Audit and Version Pinning

The system MUST run `pnpm audit` and resolve all high/critical vulnerabilities. The following packages MUST be pinned: `drizzle-orm@0.45.2` and `pg@8.22.0`.

#### Scenario: Clean audit

- GIVEN `drizzle-orm` and `pg` are pinned to specified versions
- WHEN `pnpm audit` is executed
- THEN zero high/critical vulnerabilities are reported

#### Scenario: Pin survives update

- GIVEN `package.json` pins `drizzle-orm@0.45.2`
- WHEN `pnpm install` is run
- THEN the installed version matches `0.45.2`
