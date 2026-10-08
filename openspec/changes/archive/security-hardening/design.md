# Design: Security Hardening

## Technical Approach

Four chained PRs (stacked-to-main) addressing 15 findings from critical to low. In-memory rate limiting on auth endpoints, cookie security hardening, DB integrity via FK migration, typed error handling, middleware route protection, and defensive client-side fixes.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|----------|--------|-------------|-----------|
| Rate limiter storage | In-memory Map | Redis, Upstash | No external deps; simple sliding window; no Redis in local setup |
| baseURL validation | Module-level validateUrl() | Middleware check, ENV-only | Fail-fast at server start, not on first request |
| Dev cookie detection | `NODE_ENV` + request URL schema | Always-lax, always-none | Correct behavior for HTTP localhost vs HTTPS preview |
| Middleware auth | better-auth `getSession()` on cookie | JWT decode, manual header check | Leverages existing auth lib; same pattern as server component |
| FK migration | Drizzle generate + push | Raw SQL, knex | Follows existing Drizzle setup; schema-defined |
| Optimistic lock | `updatedAt` compare | Version column, ETag | No schema change needed; uses existing column |
| Drag token | Server-generated UUID per drag | Client-side hash, encrypted ID | Prevents ID enumeration; no extra DB query |

## Data Flow

```
Rate Limiter:
  Request → route.ts → rateLimiter middleware → auth.handler → response
                       ↓ (429 if over limit)
                       Retry-After header

Middleware:
  Request → middleware.ts → session check → page.tsx (authenticated)
                            ↓ redirect → /sign-in (unauthenticated)

Tasks CRUD:
  Client action → getUserId() → ActionResult → DB query → response
                  ↓ {ok:false}                          ↓ {ok:true}
                  return 401                            return data
```

## File Changes

| File | Action | PR |
|------|--------|----|
| `app/api/auth/[...all]/route.ts` | Modify | PR1: wrap handler with rate limiter |
| `lib/auth.ts` | Modify | PR1-PR2: baseURL validation, cookie attrs, trustedOrigins filter |
| `lib/db/schema.ts` | Modify | PR3: add FK on tasks.userId |
| `app/actions/tasks.ts` | Modify | PR3-PR4: typed errors, optimistic lock, XSS |
| `middleware.ts` | Create | PR4: auth guard for / and /tasks/* |
| `components/kanban-board.tsx` | Modify | PR4: stale state in handleDrop, new client nonce |
| `components/task-card.tsx` | Modify | PR4: opaque drag token |
| `package.json` | Modify | PR4: version pinning |
| `drizzle/*` | Generate | PR3: migration file |

## Interfaces / Contracts

```typescript
// getUserId now returns ActionResult
type ActionResult =
  | { ok: true; userId: string }
  | { ok: false; error: string }

// Rate limiter config
type RateLimiterConfig = {
  maxRequests: number        // RATE_LIMIT_MAX (default 10)
  windowMs: number           // RATE_LIMIT_WINDOW (default 60000)
}

// Optimistic lock payload on updateTaskStatus
type UpdateStatusInput = {
  id: number
  status: TaskStatus
  updatedAt: string  // ISO timestamp from client
}
```

## Testing Strategy

No automated test suite exists in the project. Verify manually:
- Start app with invalid BETTER_AUTH_URL → fails at startup
- Sign in > 10 times in 60s → 429 response
- Set NODE_ENV=development, access HTTP localhost → cookies with lax + no secure
- Delete user → tasks cascade-deleted
- Call createTask without session → 401 (no stack trace)
- Access `/` without session → redirect to /sign-in
- Concurrent drag-drop + dropdown status change → conflict detected

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary changes.

## Migration / Rollout

PR3 requires a migration. Run before deploy:
```bash
npx drizzle-kit generate
npx drizzle-kit push
```
If existing orphan rows exist (tasks with deleted user), migration will fail. Run a pre-check query:
```sql
SELECT * FROM tasks WHERE "userId" NOT IN (SELECT id FROM "user");
```
Delete or reassign orphans before pushing.

## Open Questions

- None resolved at proposal/spec level. Rate limit thresholds configurable via env vars with defaults.
