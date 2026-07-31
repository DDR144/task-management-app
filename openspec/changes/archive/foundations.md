# Archive: Foundations

**Archived:** 2026-07-31
**Change Period:** 2026-07-31
**SDD Cycle:** Exploration → Proposal → Spec (5 domains) → Design → Apply (5 PRs, stacked-to-main) → Verify (15/15 PASS) → Archive
**Archived Folder:** `openspec/changes/archive/foundations/`

---

## Executive Summary

Production-readiness milestone establishing version control, quality gates, and fixing two verified runtime bugs (optimistic-lock false conflicts, due-date timezone off-by-one) plus missing DB indexes. Delivered as 5 stacked-to-main chained PRs, all merged to `main` (fast-forward) and pushed to the private GitHub remote `DDR144/task-management-app`. Verification: 15/15 spec requirements PASS, 0 CRITICAL findings. Tests (vitest) deferred by decision.

---

## Intent

Establish version control (git + private GitHub), enforce quality gates (typecheck, ESLint 9, CI), fix the optimistic-lock false-conflict bug (µs/ms precision mismatch), fix the due-date timezone off-by-one (timestamp → date column), add FK-column indexes, clean template debt, and document the project.

---

## What Was Changed — 5 PRs

### PR 1 — Repo Hygiene (low risk)

| Item | Change |
|------|--------|
| Git init | `git init`, private repo `DDR144/task-management-app`, remote configured, first commit clean of secrets/artifacts |
| `.gitignore` rewrite | `tsconfig.tsbuildinfo`, `.env`/`.env*.local`, `**/*:Zone.Identifier`, `.claude/`, `.agents/`, `.atl/`, `.snowflake/`; kept `.env.example` tracked |
| Zone.Identifier cleanup | Deleted all 44 `*:Zone.Identifier` Windows transfer artifacts (verified count 0) |
| Typecheck gate | Removed `typescript.ignoreBuildErrors` from `next.config.mjs`; added `typecheck` script (`tsc --noEmit`) |
| Template cleanup | `package.json` name → `task-management-app`; removed `generator: 'v0.app'`; removed stale FK comment; narrowed `proxy.ts` matcher to `['/']` + dropped dead `callbackUrl`; hardcoded sonner `theme="light"` + dropped `next-themes`; fixed `pnpm-workspace.yaml` placeholder (`esbuild: true`); moved overrides to workspace; added `packageManager: pnpm@11.17.0` |
| README | Created with prerequisites, setup, env vars, scripts, architecture |

### PR 2 — Optimistic Lock (low risk)

| Item | Change |
|------|--------|
| A2 fix | `app/actions/tasks.ts:149-150` — replaced raw `eq(tasks.updatedAt, …)` with `eq(sql\`date_trunc('millisecond', ${tasks.updatedAt})\`, new Date(updatedAt))`; root cause: DB `timestamp` stores µs, JS `Date` is ms |
| Lock preserved | WHERE clause still rejects stale updates at ms granularity (no row returned → conflict error) |

### PR 3 — Due Dates (medium risk)

| Item | Change |
|------|--------|
| B1 fix | `lib/db/schema.ts:81` — `timestamp('dueDate')` → `date('dueDate')` in default string mode (explicitly NOT `mode: 'date'`) |
| Migration | `drizzle/0001_loose_namorita.sql` — `ALTER TABLE "tasks" ALTER COLUMN "dueDate" SET DATA TYPE date USING ("dueDate"::date)`; applied; sample rows verified (`2026-08-01`, `2026-08-08`, `NULL`) |
| String contract | `parseDueDate` → regex-validated `string \| null` (no `new Date()`); `Task.dueDate` is `string \| null` |
| Rendering | `task-card.tsx` `formatDueDate` → local-midnight parse → `"31 jul"` es-ES; `task-dialog.tsx` returns raw string; overdue = local date < today local midnight; NULL never overdue |

### PR 4 — DB Indexes (low risk)

| Item | Change |
|------|--------|
| Indexes | `lib/db/schema.ts` — `.index()` on `tasks.userId`, `session.userId`, `account.userId` (FK columns, `ON DELETE CASCADE`) |
| Migration | `drizzle/0002_short_nick_fury.sql` — three `CREATE INDEX IF NOT EXISTS` in one migration; applied; `pg_indexes` shows all 3 |

### PR 5 — Quality Gates (medium risk)

| Item | Change |
|------|--------|
| ESLint 9 flat config | `eslint.config.mjs` — `eslint-config-next/core-web-vitals` + `typescript-eslint` recommended + `globalIgnores` (node_modules, .next, drizzle, .agents) |
| Dependencies | devDeps: `eslint@^9`, `eslint-config-next@16.2.12`, `typescript-eslint@^8` |
| Violations fixed | Autofix + disable-with-reason; `pnpm lint` exits 0 |
| CI | `.github/workflows/ci.yml` — triggers on PR + push to main; `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm lint`; DB-free, no secrets; later aligned to `node-version: 24` |

---

## Key Decisions (from Design)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Optimistic lock | **A2** — server-side ms truncation (`date_trunc('millisecond', updatedAt)`). Exact root cause, 1 line, no migration. A3 version counter deferred until multi-user editing materializes. |
| D2 | dueDate semantics | **B1** — PostgreSQL `date` column in Drizzle default string mode. Kills the timezone class entirely; explicitly NOT `mode: 'date'` (reintroduces off-by-one). |
| D3 | Indexes | **F1** — exactly the 3 spec'd FK-column indexes in one migration. Composite deferred (not in spec). |
| D4 | Lint | **E1** — ESLint 9 flat config (Next 16 native; E2 ESLint 8 rc is a dead end). |
| D5 | Theme | **Hardcode light** — sonner `theme="light"`, drop `next-themes`. Dark mode is a future feature. |
| D6 | proxy cleanup | **Narrow + drop** — matcher `['/']`; remove unused `callbackUrl` (never read). Wiring it into auth-form is out of scope. |

---

## Verification Results

| Check | Result |
|-------|--------|
| Requirements | **15/15 PASS** (repo-hygiene 5, task-optimistic-locking 2, task-due-dates 3, db-indexes 2, quality-gates 3) — 0 FAIL, 0 NOT-VERIFIED, **0 CRITICAL** |
| `pnpm typecheck` / `pnpm build` | ✅ Exit 0 |
| `pnpm lint` | ✅ Exit 0 |
| `gh repo view --json visibility` | ✅ `"PRIVATE"` |
| Zone.Identifier count | ✅ 0 |
| DB `dueDate` column | ✅ `date` type, no time component |
| `pg_indexes` | ✅ 3 new indexes |
| PRs merged | ✅ 5/5 merged to main (fast-forward), pushed to `origin/main` |
| CI | ✅ Running on final push (Node 24) |

### WARNINGS / SUGGESTIONS (non-blocking)
- `next-themes` present in `node_modules/.pnpm/` as transitive dep — not declared, not imported anywhere (sonner hardcodes light). Acceptable.
- CI Node version aligned from 20 → 24 post-verify (commit `ee395b2`).
- `pnpm-workspace.yaml` `esbuild: true` confirmed valid on fresh install.

---

## Deferred Items (documented, out of scope)

| Item | Reason | Where documented |
|------|--------|------------------|
| Vitest unit/e2e suite | No infra, `strict_tdd: false`, change already large | Exploration H1, Proposal Out |
| Version-counter lock (A3) | Defer until multi-user editing materializes; A2 covers current single-user semantics | Design D1, spec scenario "No version-counter lock (deferred)" |
| Dark mode | Future feature; light theme locked | Design D5 |
| `callbackUrl` wiring into auth-form | Out of scope; param removed as dead code | Design D6, exploration risk |
| Orphan-row cleanup | Out of scope | Proposal Out |

---

## SDD Artifacts

| Artifact | File | Engram Obs ID |
|----------|------|--------------|
| Exploration | `openspec/changes/archive/foundations/exploration.md` | #44 |
| Proposal | `openspec/changes/archive/foundations/proposal.md` | #45 |
| Spec (5 delta domains) | `openspec/changes/archive/foundations/specs/{db-indexes,quality-gates,repo-hygiene,task-due-dates,task-optimistic-locking}/spec.md` | #46 |
| Design | `openspec/changes/archive/foundations/design.md` | #47 |
| Tasks | `openspec/changes/archive/foundations/tasks.md` (23/23 complete) | #48 |
| Apply Progress | apply-progress observations (PR1–PR5) | #49 |
| Verify Report | `openspec/changes/archive/foundations/verify-report.md` | #50 |
| Archive Report | `openspec/changes/archive/foundations.md` | *(this report)* |

---

## Main Specs Established

The change established the project's initial main specs (previously `openspec/specs/` was empty). Delta specs were full specs — copied directly:

- `openspec/specs/repo-hygiene/spec.md` (5 requirements)
- `openspec/specs/task-optimistic-locking/spec.md` (2 requirements)
- `openspec/specs/task-due-dates/spec.md` (3 requirements)
- `openspec/specs/db-indexes/spec.md` (2 requirements)
- `openspec/specs/quality-gates/spec.md` (3 requirements)

---

*SDD cycle complete. Archived 2026-07-31.*
