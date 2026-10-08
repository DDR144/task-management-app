# Tasks: Security Hardening

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 280–370 (across 4 PRs) |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3 → PR4 (stacked-to-main) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Rate limiting + baseURL validation | PR1 | `pnpm dev` + curl POST /api/auth/sign-in x15 | Set BETTER_AUTH_URL=invalid then start server → fails | Revert `lib/rate-limiter.ts` and `lib/auth.ts` validateUrl() |
| 2 | Cookie security + trustedOrigins filter | PR2 | `pnpm dev` + inspect Set-Cookie header | NODE_ENV=development HTTP localhost → sameSite=lax, secure=false | Revert `lib/auth.ts` advanced block + trustedOrigins changes |
| 3 | FK constraint + typed error handling | PR3 | `npx drizzle-kit generate && npx drizzle-kit push` | Delete user → verify tasks cascade; call createTask without session → no throw | Revert `schema.ts`, delete migration, revert `getUserId()` |
| 4 | Middleware + minor fixes | PR4 | `pnpm dev` + visit `/` without session → redirect | Inspect network tab drag-drop payload (no raw ID) | Revert `middleware.ts`, `kanban-board.tsx`, `task-card.tsx` |

## PR1 (P0-CRITICAL): Rate Limiting + baseURL Validation

- [x] 1.1 Create `lib/rate-limiter.ts` — in-memory sliding window with per-key mutex, lazy cleanup, MAX_KEYS eviction, key-length truncation, env-var validation.
- [x] 1.2 Modify `app/api/auth/[...all]/route.ts` — hardened IP resolution (x-real-ip → x-forwarded-for with IPv4 validation → fallback), content-length/body-size guard, Content-Type-aware body parsing, POST-only rate limiting.
- [x] 1.3 Modify `lib/auth.ts` — add `validateUrl()` function at module level that checks scheme is `http` or `https` and hostname is non-empty. Run it on `baseURL` after the fallback chain. Throw with descriptive message on invalid input. Fail fast at module load.

### PR1 Review Fixes (judgment-day adversarial review)

- [x] 1.4 Fix BLOCKER: TOCTOU race condition — replaced read-filter-check-write with per-key promise chain mutex
- [x] 1.5 Fix BLOCKER: setInterval timer leak — removed setInterval, replaced with lazy per-call pruning
- [x] 1.6 Fix BLOCKER: Map key exhaustion — added MAX_KEYS (10,000) with insertion-order eviction
- [x] 1.7 Fix CRITICAL: X-Forwarded-For spoofing — x-real-ip first, IPv4 validation on forwarded, fallback to 127.0.0.1
- [x] 1.8 Fix BLOCKER: Body parse race / no size limit — content-length check (100KB), Content-Type gate before JSON parse, catch TypeError from double-clone
- [x] 1.9 Fix WARNING: parseInt without validation — env vars validated with Number.isFinite + clamped ranges

## PR2 (P1-HIGH): Cookie Security + trustedOrigins

- [x] 2.1 Modify `lib/auth.ts` — replace blanket dev `sameSite:none, secure:true` with conditional: detect HTTP localhost → `sameSite:'lax', secure:false`; detect HTTPS localhost → `sameSite:'none', secure:true`. Use `NODE_ENV` + URL scheme inspection.
- [x] 2.2 Modify `lib/auth.ts` — add explicit prod `defaultCookieAttributes` block for `NODE_ENV=production`: `httpOnly:true, secure:true, sameSite:'lax'`.
- [x] 2.3 Modify `lib/auth.ts` `trustedOrigins` — iterate entries before passing to `betterAuth()`. Drop malformed/empty URLs, log `console.warn` for each filtered entry. Keep `http://localhost:3000` only in dev.

## PR3 (P2-HIGH): FK Constraint + Typed Error Handling

- [x] 3.1 Modify `lib/db/schema.ts` — add `.references(() => user.id, { onDelete: 'cascade' })` to `tasks.userId` column.
- [x] 3.2 Generate Drizzle migration — run `npx drizzle-kit generate`, commit the generated migration file.
- [x] 3.3 Modify `app/actions/tasks.ts` — refactor `getUserId()` to return `ActionResult` (`{ ok: false, error: 'Unauthorized' }`) instead of throwing `Error`. Remove the throw.
- [x] 3.4 Modify all 5 callers in `tasks.ts` — `getTasks()`, `createTask()`, `updateTask()`, `updateTaskStatus()`, `deleteTask()` — handle the new `ActionResult` from `getUserId()`. Return early with `{ ok: false, error: 'Unauthorized' }` when not authenticated. No DB query should execute.

## PR4 (P3-MED/LOW): Middleware + Minor Fixes

- [x] 4.1 Create `middleware.ts` at project root — check session via `better-auth` `getSession()` on protected routes (`/`, `/tasks/*`). Redirect to `/sign-in` if unauthenticated. Allowlist: `/sign-in`, `/sign-up`, `/api/auth/*`, `/_next/*`.
- [x] 4.2 Modify `updateTaskStatus` in `app/actions/tasks.ts` — accept `updatedAt` param, compare with stored `updatedAt` before update. Return `{ ok: false, error: 'Conflicto: la tarea fue modificada. Recargá la página.' }` on mismatch.
- [x] 4.3 Modify `components/kanban-board.tsx` `handleDrop` — stop deriving task data from `initialTasks`. Pass a server-generated nonce from `task-card` on drag start; resolve it server-side. Trust server result over local state.
- [x] 4.4 Modify `components/task-card.tsx` `handleDragStart` — generate opaque UUID/hash token per drag operation, store in `dataTransfer` instead of raw `task.id`. Map token to task ID server-side.
- [x] 4.5 Run `pnpm audit`, pin `drizzle-orm@0.45.2` and `pg@8.22.0` in `package.json`. Resolve any high/critical vulnerabilities.
- [x] 4.6 Add comment/doc in `app/actions/tasks.ts` — document XSS-safe encoding assumption: React's auto-escaping is sufficient for JSX rendering. Use `encodeURIComponent()` for user text in URL contexts only.
