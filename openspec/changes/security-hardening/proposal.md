# Proposal: Security Hardening

## Intent

Fix 15 security findings from code audit — critical auth flaws first (rate limiting, baseURL validation), then cookie security, DB integrity, and defense-in-depth.

## Scope

**In:** Rate limiting on `/api/auth/*`, baseURL startup validation, cookie security (dev + prod), trustedOrigins sanitization, FK on `tasks.userId`, typed error handling (`getUserId`), auth middleware for route protection, XSS-safe encoding, optimistic locking for `updateTaskStatus`, stale `initialTasks` fix in drag-drop, task ID exposure in `dataTransfer`, dependency audit + version pinning, `V0_RUNTIME_URL` fallback cleanup.

**Out:** OAuth provider integration, session rotation/expiry overhaul, API token auth, cleanup of existing orphan rows.

## Capabilities

### New Capabilities
- `rate-limiting`: Configurable rate limiting on auth endpoints
- `auth-security`: baseURL validation, cookie attribute hardening, trustedOrigins sanitization
- `route-protection`: Next.js middleware auth guard for protected pages
- `db-integrity`: FK constraint `tasks.userId → user.id`

### Modified Capabilities
None — no existing specs.

## Approach

**PR1 (CRITICAL):** Rate limiting + baseURL validation. Wrap `auth.handler` with sliding-window rate limiter. Add `validateBaseUrl()` that fails fast on invalid `BETTER_AUTH_URL` scheme/port.

**PR2 (HIGH):** Cookie security + trustedOrigins. Fix dev: remove `secure:true` + `sameSite:none` for localhost HTTP. Add explicit prod: `httpOnly`, `secure`, `sameSite:lax`. Filter unverified/ malformed `trustedOrigins` entries.

**PR3 (HIGH):** FK constraint + typed errors. Add `references(() => user.id, { onDelete: 'cascade' })` on `tasks.userId`. Generate Drizzle migration. Refactor `getUserId` to return `ActionResult` instead of throwing.

**PR4 (MED/LOW):** Middleware + minor fixes. Add `middleware.ts` with session check on protected routes. XSS entity encoding on user text. Optimistic lock via `updatedAt` compare. Fix stale `initialTasks` in `handleDrop` — use local column state. Use opaque drag token (hash) instead of raw DB id. Dep audit + pin `drizzle-orm`/`pg`. Remove `V0_RUNTIME_URL` fallback if unused.

## Chained PR Strategy

**Chain:** stacked-to-main. Each PR independently revertible.

| PR | Priority | Focus | Risk |
|----|----------|-------|------|
| PR1 | P0-CRITICAL | Rate limiting + baseURL | Auth bypass |
| PR2 | P1-HIGH | Cookies + origins | Broken sessions |
| PR3 | P2-HIGH | FK + error types | Data integrity |
| PR4 | P3-MED/LOW | Middleware + misc | UX regressions |

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `lib/auth.ts` | Modified | baseURL validation, cookie attrs, trustedOrigins |
| `app/api/auth/[...all]/route.ts` | Modified | Rate limiter wrapper |
| `lib/db/schema.ts` | Modified | FK on tasks.userId |
| `app/actions/tasks.ts` | Modified | Error types, XSS encoding, optimistic lock |
| `middleware.ts` | New | Route auth guard |
| `components/kanban-board.tsx` | Modified | Stale state in handleDrop |
| `components/task-card.tsx` | Modified | Drag data payload (no raw ID) |
| `package.json` | Modified | Dep version pinning |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Rate limiting blocks legit users | Low | Configurable env var threshold |
| Cookie change breaks dev sessions | Med | Test HTTP localhost before deploy |
| FK fails on existing orphan rows | Med | Pre-migration data check |
| Middleware blocks public routes | Low | Explicit allowlist |

## Rollback Plan

Per-PR revert. No cross-PR blocking dependencies. For FK failures: fix orphan data then re-run migration.

## Success Criteria

- [ ] Rate limiting active on `/api/auth/*` with configurable threshold
- [ ] `baseURL` validated at startup — invalid config fails fast
- [ ] Dev cookies work over HTTP localhost; prod cookies: `httpOnly`, `secure`, `sameSite:lax`
- [ ] `trustedOrigins` filters unverified/malformed env var entries
- [ ] `tasks.userId` FK exists in schema + database
- [ ] No server action throws `Error` — all return typed `ActionResult`
- [ ] `middleware.ts` redirects unauthenticated requests
- [ ] Drag-drop uses opaque token, not raw DB ID
- [ ] `pnpm audit` passes with 0 high/critical vulnerabilities
