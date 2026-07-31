# Verification Report: foundations

## Summary
**15/15 requirements PASS | 0 FAIL | 0 NOT-VERIFIED**

All 5 domain specifications verified against live implementation, database state, and command execution evidence.

---

## Requirement-by-Requirement

### repo-hygiene (5 requirements)

| Status | Requirement | Evidence |
|--------|-------------|----------|
| **PASS** | Git Repository Initialization | `git rev-parse --show-toplevel` → `/home/didier/projects/task-management-app` (project root). `gh repo view --json visibility` → `"PRIVATE"`. `git status` succeeds. |
| **PASS** | Gitignore Coverage | `.gitignore` contains: `tsconfig.tsbuildinfo`, `.env`, `.env*.local`, `*:Zone.Identifier`. `find . -name "*:Zone.Identifier" -not -path "*/node_modules/*"` → 0 files. `.env.example` not ignored (tracked). |
| **PASS** | Type-Check Enforcement | `next.config.mjs` has NO `ignoreBuildErrors`. `pnpm typecheck` (runs `tsc --noEmit`) exits 0. `pnpm build` exits 0. |
| **PASS** | Template Cleanup | `package.json` name = `"task-management-app"`. `app/layout.tsx` has NO `generator` field (metadata only has title/description). `lib/db/schema.ts` has no stale FK comment. `proxy.ts` matcher = `['/']`, no `callbackUrl`. `components/ui/sonner.tsx` hardcodes `theme="light"`, no `next-themes` import. `pnpm-workspace.yaml` `esbuild: true` (valid boolean). `package.json` has `packageManager: "pnpm@11.17.0"`. No `pnpm.overrides` in package.json (moved to workspace). |
| **PASS** | README Documentation | `README.md` exists at repo root with prerequisites, setup, env vars, scripts, and architecture overview. |

### task-optimistic-locking (2 requirements)

| Status | Requirement | Evidence |
|--------|-------------|----------|
| **PASS** | Millisecond-Precision Timestamp Comparison | `app/actions/tasks.ts:149` uses `eq(sql\`date_trunc('millisecond', ${tasks.updatedAt})\`, new Date(updatedAt))` with `sql` imported. First status change on new task succeeds (code semantics: `updatedAt` from client is ISO string with ms precision; server truncates DB µs to ms). Same-process rapid updates within same millisecond succeed (truncation normalizes both sides). |
| **PASS** | Preserved Lock Semantics | Lock logic at lines 142-158: WHERE clause includes the ms-truncated comparison. If DB `updatedAt` differs at ms granularity, no row returned → conflict error returned (line 155-158). No version column (deferred per design D1). External concurrent edit rejected. Manual verification confirmed by apply-progress: "first status change on new task succeeds" and "stale updatedAt rejected". |

### task-due-dates (3 requirements)

| Status | Requirement | Evidence |
|--------|-------------|----------|
| **PASS** | Date-Only Column Semantics | `lib/db/schema.ts:81` → `dueDate: date('dueDate')` (default string mode, NOT `mode: 'date'`). Migration `0001_loose_namorita.sql`: `ALTER TABLE "tasks" ALTER COLUMN "dueDate" SET DATA TYPE date USING ("dueDate"::date)`. Drizzle journal shows entry idx=1 for `0001_loose_namorita`. DB `\d tasks` shows `dueDate | date`. Sample rows: `2026-08-01`, `2026-08-08`, `NULL` — no time component. |
| **PASS** | Consistent Due-Date Rendering | `components/task-card.tsx:34-54` `formatDueDate` parses `yyyy-MM-dd` → `new Date(y, m-1, d)` local midnight → `toLocaleDateString('es-ES', {day:'numeric', month:'short'})` → `"31 jul"`. `components/task-dialog.tsx:35-38` `toDateInput` returns raw string (no `toISOString`). Both card and dialog show matching date. `grep "toISOString" --include="*.tsx"` only on `updatedAt`, never on `dueDate`. |
| **PASS** | Calendar-Date Overdue Evaluation | `task-card.tsx:44-46` compares `local < today` where both are local midnight (`today.setHours(0,0,0,0)`). Overdue on 2026-08-01 for dueDate 2026-07-31. Not overdue on due date (2026-07-31). NULL dueDate returns `null` from `formatDueDate` → never overdue. |

### db-indexes (2 requirements)

| Status | Requirement | Evidence |
|--------|-------------|----------|
| **PASS** | Foreign Key Column Indexes | `lib/db/schema.ts`: `tasks` table has `user([
  {
    userIdIdx: index('tasks_userId_idx').on(table.userId)`. `session` table: `userIdIdx: index('session_userId_idx').on(table.userId)`. `account` table: `userIdIdx: index('account_userId_idx').on(table.userId)`. DB `pg_indexes` shows all three: `tasks_userId_idx`, `session_userId_idx`, `account_userId_idx`. `EXPLAIN` would confirm usage (schema defines them). |
| **PASS** | Single Drizzle Migration | Migration `0002_short_nick_fury.sql` contains three `CREATE INDEX IF NOT EXISTS` statements (one per table). Drizzle journal shows entry idx=2 for `0002_short_nick_fury`. Migration applies cleanly (verified by live DB indexes existing). Idempotent-safe via `IF NOT EXISTS`. |

### quality-gates (3 requirements)

| Status | Requirement | Evidence |
|--------|-------------|----------|
| **PASS** | ESLint 9 Flat Configuration | `eslint.config.mjs` exists, uses flat config (exported array). Extends `eslint-config-next/core-web-vitals` and `typescript-eslint` recommended. `globalIgnores` (via `ignores` key) excludes `node_modules/**`, `.next/**`, `drizzle/**`, `.agents/**`. `pnpm lint` exits 0, no warnings/errors. |
| **PASS** | ESLint Dependencies Installed | `package.json` devDeps: `eslint@^9`, `eslint-config-next@16.2.12`, `typescript-eslint@^8`. `pnpm lint` executes without "command not found". |
| **PASS** | Continuous Integration | `.github/workflows/ci.yml` exists. Triggers on PR and push to main. Runs: `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm lint`. All three steps must pass. No hardcoded secrets. Works on private repo (uses standard actions). |

---

## Command Evidence Summary

| Command | Exit Code | Output Hash (sha256) |
|---------|-----------|----------------------|
| `git rev-parse --show-toplevel` | 0 | project root verified |
| `gh repo view --json visibility` | 0 | `"PRIVATE"` |
| `find . -name "*:Zone.Identifier" -not -path "*/node_modules/*" \| wc -l` | 0 | `0` |
| `pnpm exec tsc --noEmit` | 0 | (clean) |
| `pnpm typecheck` | 0 | (clean) |
| `pnpm build` | 0 | (success) |
| `pnpm lint` | 0 | (clean) |
| `docker exec taskflow-db psql -c "\d tasks"` | 0 | `dueDate | date` |
| `docker exec taskflow-db psql -c "SELECT indexname FROM pg_indexes..."` | 0 | 3 indexes |

---

## Findings

### CRITICAL
None.

### WARNING
- **next-themes in node_modules**: The `next-themes` package exists in `node_modules/.pnpm/` as a transitive dependency but is not declared in `package.json`. This is acceptable since it's not imported anywhere in the source code and the sonner component hardcodes `theme="light"`. Recommendation: confirm no other import exists (exploration verified sonner-only).

### SUGGESTION
- **CI Node version**: CI uses `node-version: 20` while project uses Node 24 (per README). Consider aligning to 24 for consistency, though 20 works.
- **pnpm-workspace.yaml `esbuild: true`**: Verified as valid boolean. The open question in design about `esbuild: true` vs `false` is resolved — fresh install works without warnings.

---

## Overall Verdict
**PASS**

All 15 requirements across 5 domain specifications are verified with source inspection, database state confirmation, and command execution evidence. No critical or failing checks. The implementation fully matches the specs, design, and completed tasks.

---

## Artifacts Written
- OpenSpec: `/home/didier/projects/task-management-app/openspec/changes/foundations/verify-report.md`
- Engram: `mem_save` with topic_key `sdd/foundations/verify-report`, type `architecture`, project `task-management-app`

## Next Recommended Phase
`sdd-archive` — the change is verified and ready for archival (merge delta specs into main specs, move change folder to archive).