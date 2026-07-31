# Design: Foundations

## Technical Approach

Production-readiness milestone delivered as 5 stacked-to-main chained PRs, each independently revertible and ≤400 changed lines (delivery strategy: `ask-on-risk`). PRs land in order 1→5; branches cut from the previous PR's branch; every PR targets `main` with explicit `--base`. PRs 1–2–4 are low risk; PR3 (data-type migration) and PR5 (lint sweep) are medium. No test suite exists (`strict_tdd: false`) — verification is command-based RED checks per threat-matrix row and spec scenario.

## Architecture Decisions

| # | Decision | Options (tradeoff) | Choice |
|---|---|---|---|
| D1 | Optimistic lock (PR2) | A1 epsilon compare (weakens lock, TZ-fragile) · **A2 ms truncation** (exact root cause, 1 line, no migration) · A3 version column (exact, TZ-free, but schema+client change; defer until multi-user editing) · A4 drop lock (violates spec) | **A2**: `eq(sql\`date_trunc('millisecond', ${tasks.updatedAt})\`, new Date(updatedAt))` replacing `app/actions/tasks.ts:150`. Column has no index; row filtered by PK — function-on-column cost nil. |
| D2 | dueDate semantics (PR3) | B1 `date` column (kills TZ class entirely, migration) · B2 local-midnight handling (no migration, relies on process TZ stability) · B3 ISO-shift (fixes dialog only) | **B1** per spec: Drizzle `date('dueDate')` in **default string mode** (`'yyyy-MM-dd'`). Explicitly NOT `mode: 'date'` — that returns a UTC-midnight `Date` and reintroduces the off-by-one. |
| D3 | Indexes (PR4) | Single migration with 3 `CREATE INDEX` vs per-table migrations; optional composite `(userId, status, createdAt)` | **F1**: exactly the 3 spec'd FK-column indexes in one migration (`tasks_userId_idx`, `session_userId_idx`, `account_userId_idx`). Composite deferred — not in spec. |
| D4 | Lint (PR5) | E1 ESLint 9 flat config (Next 16 native) · E2 ESLint 8 rc (dead end, `next lint` removed) | **E1**: `eslint.config.mjs` = `eslint-config-next/core-web-vitals` + `typescript-eslint` recommended + `globalIgnores([node_modules, .next, drizzle])`. devDeps: `eslint@^9`, `eslint-config-next@16.2.12`, `typescript-eslint@^8`. |
| D5 | Theme (PR1) | hardcode `theme="light"` (matches locked light UI) vs add ThemeProvider (dark-mode feature, out of scope) | **Hardcode light**: remove `next-themes` import from `components/ui/sonner.tsx` and drop the dependency. |
| D6 | proxy cleanup (PR1) | narrow matcher to `['/']` + drop dead `callbackUrl` vs wire callbackUrl into auth-form (feature, out of scope) | **Narrow + drop**: matcher `['/']`; remove unused `callbackUrl` param (never read). |

## Data Flow

**Optimistic lock (PR2)** — client sends ms-precision UTC string; server truncates DB µs to ms:

```
TaskCard/KanbanBoard ── task.updatedAt.toISOString() (ms) ──▶ updateTaskStatus(id, status, updatedAt)
  ──▶ UPDATE tasks SET status, updatedAt=now()
      WHERE id AND userId AND date_trunc('millisecond', updatedAt) = new Date(updatedAt)
  ──▶ row? → ok:true → revalidatePath('/') → router.refresh()
      no row → ok:false "Conflicto…" → toast.error
```

**Due date (PR3)** — string-only contract, no `Date` crossing the wire:

```
<input type="date"> 'yyyy-MM-dd' ──▶ parseDueDate (regex-validated string)
  ──▶ Drizzle insert/update ──▶ PG date column
  ──▶ Drizzle read ──▶ string 'yyyy-MM-dd'
  ──▶ TaskCard: split('-') → new Date(y, m-1, d) local midnight → '31 jul' es-ES; overdue = d < todayLocalMidnight
  ──▶ TaskDialog: toDateInput returns string as-is (remove toISOString().slice(0,10))
```

## File Changes

| File | Action | PR |
|---|---|---|
| `.gitignore` | Rewrite | 1 |
| `README.md` | Create | 1 |
| `next.config.mjs` | Modify (drop `ignoreBuildErrors`) | 1 |
| `package.json` | Modify (name, `typecheck`, remove overrides, add `packageManager: pnpm@11.17.0`) | 1 |
| `pnpm-workspace.yaml` | Modify (`overrides: hono 4.12.25`, `esbuild: true`) | 1 |
| `app/layout.tsx` | Modify (remove `generator`) | 1 |
| `lib/db/schema.ts` | Modify (comment, `date('dueDate')`, 3 `.index()`) | 1,3,4 |
| `proxy.ts` | Modify (matcher, drop callbackUrl) | 1 |
| `components/ui/sonner.tsx` | Modify (hardcode light) | 1 |
| 44 `*:Zone.Identifier` | Delete | 1 |
| `app/actions/tasks.ts` | Modify (lock :150; parseDueDate) | 2,3 |
| `components/task-card.tsx`, `task-dialog.tsx` | Modify (string semantics) | 3 |
| `drizzle/0001_*.sql`, `0002_*.sql` | Create (generate) | 3,4 |
| `eslint.config.mjs` | Create | 5 |
| `.github/workflows/ci.yml` | Create | 5 |

## Interfaces / Contracts

`parseDueDate` returns `string | null` (was `Date | null`); validates `/^\d{4}-\d{2}-\d{2}$/`. `Task.dueDate` becomes `string | null` via Drizzle `date` default mode — all consumers (card, dialog, action) switch from `Date` to string; no `new Date()` on server for dueDate.

CI workflow (private-repo safe, DB-free):

```yaml
name: CI
on: { pull_request: { branches: [main] }, push: { branches: [main] } }
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4        # reads packageManager field
      - uses: actions/setup-node@v4        # node 24, cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Verification (no runner) | First status change on new task succeeds; concurrent T2 update rejected | Manual via app; `date_trunc` behavior confirmed by exploration |
| Verification | `2026-07-31` renders "31 jul" in card+dialog; overdue on 08-01, not on 07-31 | Manual, es-ES locale |
| Verification | `pg_indexes` shows 3 indexes; `EXPLAIN` uses them | psql |
| Verification | `pnpm typecheck`, `pnpm lint` exit 0; CI green | Commands per PR |
| RED checks | git add list free of `.env*`, `*.tsbuildinfo`, `*:Zone.Identifier` | `git diff --cached --name-only` pre-commit |

## Threat Matrix

| Boundary | Applicability | Design response | RED test |
|---|---|---|---|
| Git repo selection | Applicable (PR1) | init only at root; verify `rev-parse --show-toplevel` == project root | root check passes; `git status` OK |
| Commit state | Applicable (PR1) | selective first commit after .gitignore verified | staged list has no secrets/artifacts |
| Push state | Applicable (PR1) | `-u origin main`; `gh repo view --json visibility` == private | visibility check |
| PR commands | Applicable (all) | `gh pr create --base main --head <branch>` per PR | `gh pr view --json baseRefName,headRefName` |
| Documentation-like paths | N/A | README.md non-executable; no scripts | — |

## Migration / Rollout

Schema edit → `pnpm exec drizzle-kit generate` → review SQL → `pnpm exec drizzle-kit migrate` (requires `DATABASE_URL` from `.env.local`; `docker compose up -d` for local Postgres). Order: PR3 lands first (0001: `ALTER TABLE "tasks" ALTER COLUMN "dueDate" SET DATA TYPE date USING ("dueDate"::date);`), PR4 second (0002: three `CREATE INDEX IF NOT EXISTS` — verify drizzle-kit emits `IF NOT EXISTS`; add manually if not). Migrations are independent — no cross-PR coupling. Sample-check `dueDate` rows pre/post cast (time components were bug artifacts; truncation is intended).

## Rollback

| PR | Rollback |
|---|---|
| 1 | Revert commit; pre-push: `rm -rf .git` |
| 2 | Restore raw `eq(tasks.updatedAt, …)` (1 line) |
| 3 | Manual down: `SET DATA TYPE timestamp USING ("dueDate"::timestamp)` + revert schema/components (dev data, lossless re-expansion) |
| 4 | `DROP INDEX tasks_userId_idx, session_userId_idx, account_userId_idx` + revert schema |
| 5 | Remove config/deps/workflow; CI stops |

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Secrets in first commit (Med) | `.gitignore` covers `.env`, `.env*.local`; RED staged-list check; `git status` before commit |
| ESLint sweep scope creep (Med) | PR5 isolated; autofix safe rules, manual rest; disable-with-reason over mass-rewrite |
| `::date` cast truncation (Low) | Sample-check rows pre/post |
| pnpm overrides move breaks install | Fresh `pnpm install`; verify no warning; `esbuild: true` (valid boolean) |
| `openspec/config.yaml` truncated at `delivery_s` | Flag for docs pass (out of scope) |

## Open Questions

- [ ] `esbuild: true` vs `false` in `allowBuilds` — confirm with fresh install (currently unverifiable without rerun)
- [ ] Drop `next-themes` from deps entirely (recommended) — confirm no other import (exploration says sonner-only)
