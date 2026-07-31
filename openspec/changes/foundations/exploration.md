# Exploration: foundations

Status: verified against real code, live DB, and executed tool output (2026-07-31)

## Current State

Next.js 16.2.12 + Better Auth + Drizzle/PostgreSQL task management app. Core features work (auth, Kanban CRUD), but the project has no version control, type-checking is disabled, lint is broken, and two runtime bugs affect task status changes and due dates.

### Findings (all verified)

1. **Optimistic-lock false conflicts** — `app/actions/tasks.ts:150` compares `eq(tasks.updatedAt, new Date(updatedAt))`. Migration and live DB use `timestamp without time zone` (microsecond precision); JS `Date` has millisecond precision. Empirically proven: `now() = date_trunc('milliseconds', now())` returns `f`. `createTask` does not set `updatedAt` (DB `now()` → µs), so the first status change on every new task fails with a false "modified" conflict until the task is fully edited once. Secondary fragility: wall-clock round-trip is TZ-sensitive (writing and comparing processes with different TZ break the lock entirely).

2. **Due-date timezone off-by-one** — `app/actions/tasks.ts:41-46` parses `new Date("2026-07-31")` as UTC midnight; pg stores the local wall-clock (`2026-07-30 19:00:00` on UTC-5); `components/task-card.tsx:34-51` displays via `toLocaleDateString('es-ES')` → shows "30 jul" for a picked 31 July. `task-dialog.tsx:35-40` re-shows via `toISOString().slice(0,10)` → disagrees with the card. Overdue check (`task-card.tsx:42-43`) also affected.

3. **No git repository** — `.git` absent (root and parents). `.gitignore` is v0-sandbox-oriented; gaps: `tsconfig.tsbuildinfo` (513 KB regenerated artifact) and plain `.env` not ignored. **44 `*:Zone.Identifier` files** (all 0 bytes, Windows transfer artifacts) mirror every source file; a naive `git add .` would commit all of them.

4. **Type checking disabled** — `next.config.mjs:3-5` sets `typescript.ignoreBuildErrors: true`. `pnpm exec tsc --noEmit` exits 0 (clean). Safe to remove.

5. **Lint broken** — `pnpm lint` fails: `eslint: not found`. eslint never installed (0 mentions in lockfile), no config anywhere. Next 16 removed `next lint`; flat config is the only sane path.

6. **Missing DB indexes** — no `.index()` on any table (`lib/db/schema.ts`); live `pg_indexes` confirms only PKs + `user_email_unique` + `session_token_unique`. No index on `tasks.userId`, `session.userId`, `account.userId` (FK columns with `ON DELETE CASCADE`).

7. **Template/cleanup debt** (all verified) — `package.json` name `my-project`; `app/layout.tsx:24` `generator: 'v0.app'`; stale FK comment `lib/db/schema.ts:63-64`; `proxy.ts:22-24` matcher references nonexistent `/tasks/:path*` route and `callbackUrl` (line 15) is never read; `next-themes` imported only in `sonner.tsx` with no `ThemeProvider` (UI hard-locked light); `pnpm-workspace.yaml:2` literal placeholder `esbuild: set this to true or false`; `pnpm.overrides` in package.json no longer read (warning on every pnpm command); no `packageManager` field.

8. **No README** — absent. Needed: prerequisites, setup, env vars, scripts, architecture.

9. **No tests/CI** — no test runner/config, no CI config. openspec config records `strict_tdd: false`.

## Affected Areas

- `app/actions/tasks.ts` — optimistic lock (`updateTaskStatus` :127-164, line 150), `parseDueDate` :41-46
- `components/task-card.tsx` — `formatDueDate` :34-51, overdue check :42-43
- `components/task-dialog.tsx` — `toDateInput` :35-40
- `components/kanban-board.tsx` :83, `components/ui/sonner.tsx` :3 — callers/theme
- `lib/db/schema.ts` — `tasks` table :68-78, dueDate :75, stale comment :63-64
- `drizzle/0000_sleepy_enchantress.sql` — timestamp columns :36-38; `drizzle/meta/0000_snapshot.json` — no indexes
- `next.config.mjs` — `ignoreBuildErrors` :3-5
- `package.json` — name :2, lint script :9, ignored `pnpm.overrides` :40-44, missing `packageManager`
- `proxy.ts` — matcher :22-24, callbackUrl :15
- `pnpm-workspace.yaml` — placeholder :2
- `app/layout.tsx` — generator :24
- repo root — `.gitignore`, 44 `*:Zone.Identifier` files, no README

## Approaches

### 1. Optimistic lock
- **A1 — Epsilon/range compare** — `gte`/`lte` on updatedAt ±1-2 ms. Pros: ~5 lines, no migration. Cons: weakens lock window; TZ fragility remains. Effort: Low.
- **A2 — Server-side ms truncation** — compare `sql\`date_trunc('millisecond', updatedAt)\`` vs `new Date(updatedAt)`. Pros: exact root-cause fix, preserves PR4 lock semantics, no migration. Cons: column-side function (no index on updatedAt anyway). Effort: Low. **RECOMMENDED.**
- **A3 — Version counter column** — `version int default 1`, `SET version = version + 1 WHERE version = $clientVersion`. Pros: exact, TZ-free, multi-user future-proof. Cons: migration + schema + client API change. Effort: Medium. Defer unless multi-user editing is near-term.
- **A4 — Drop the lock** — compare id + userId only. Pros: simplest. Cons: violates PR4 spec requirement, silent last-write-wins. Not recommended.

### 2. Due date
- **B1 — Date-only column** — `date('dueDate')` in Drizzle, migration `USING ("dueDate"::date)`. Pros: correct calendar-date semantics, eliminates the timezone class entirely. Cons: migration, `Task.dueDate` becomes string, touches action + both components. Effort: Medium. **RECOMMENDED (end state).**
- **B2 — Explicit local-date handling** — local midnight parse, local components in `toDateInput`, keep timestamp column. Pros: no migration. Cons: relies on process-TZ stability. Effort: Low-Medium. Acceptable interim.
- **B3 — Shift to local midnight before ISO** — tiny. Cons: fixes only dialog, inconsistent views persist. Not recommended alone.

### 3. Git
- **C1 — `git init` + rewrite `.gitignore` + delete 44 Zone.Identifier files** — Pros: enables history/CI/review; all files 0 bytes, zero risk. .gitignore additions: `*.tsbuildinfo`, `.env`, `**/*:Zone.Identifier`, `.claude/`, `.agents/`, `.atl/`, `.snowflake/`. Commit `drizzle/meta/` and `openspec/`. Verify `.env.local` stays out. Effort: Low. **RECOMMENDED.**

### 4. Typecheck
- **D1 — Remove `ignoreBuildErrors`; add `"typecheck": "tsc --noEmit"` script** — proven safe (clean today), fail-fast going forward. Effort: Low. **RECOMMENDED.**

### 5. Lint
- **E1 — ESLint 9 flat config** — devDeps `eslint@^9`, `eslint-config-next@16.2.12`, `typescript-eslint@^8`; `eslint.config.mjs` via `eslint-config-next/core-web-vitals` + tseslint recommended + globalIgnores. Pros: current standard, Next 16 native. Cons: existing violations need fixing. Effort: Medium. **RECOMMENDED.**
- **E2 — ESLint 8 legacy rc** — dead end (ESLint 9 deprecates rc; Next 16 dropped `next lint`). Not recommended.

### 6. Indexes
- **F1 — One Drizzle migration** adding `tasks(userId)`, `session(userId)`, `account(userId)` (optionally composite `tasks(userId, status, createdAt)` matching `getTasks`'s WHERE/ORDER BY). Pros: cheap, standard for cascade FK columns. Effort: Low. **RECOMMENDED.**

### 7. Cleanup debt
All Low effort, one-line changes except: hono override (move `overrides:` to `pnpm-workspace.yaml`), sonner/next-themes (hardcode `theme="light"` to match locked light UI — or add ThemeProvider only if dark mode becomes a requirement), proxy.ts (narrow matcher to `['/']`, drop unused `callbackUrl` or wire it into auth-form — out of scope). **Fix all now.**

### 8. README
- **G1 — Minimal README** — prerequisites (node 24, pnpm 11, Docker), setup (`docker compose up -d`, `cp .env.example .env.local`, `pnpm install`, migrate), env vars (`DATABASE_URL`, `BETTER_AUTH_URL`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`), scripts, architecture. Effort: Low. **RECOMMENDED.**

### 9. Tests/CI
- **H1 — Defer test suite** (vitest). No infra, `strict_tdd: false`, this change is already large. Effort if done: High. **Defer.**
- **H2 — Minimal CI now** (GitHub Actions: install, `tsc --noEmit`, `lint` on PRs). Cheap once lint lands. Effort: Low. **RECOMMENDED (after E1).**

## Recommendation

"Foundations" milestone, split into 5 PRs (ordering matters):

1. **PR 1 — Repo hygiene** (all Low, zero behavior risk): git init + .gitignore rewrite + delete 44 Zone.Identifier files; remove `ignoreBuildErrors` + add `typecheck` script; all cleanup debt (name, generator, stale comment, proxy.ts, sonner theme, workspace placeholder, hono override move, packageManager); README.
2. **PR 2 — Optimistic lock fix**: A2 (server-side ms truncation). Defer A3 version counter as follow-up only if multi-user editing materializes.
3. **PR 3 — Due-date correctness**: B1 (date-only column).
4. **PR 4 — Indexes**: F1 migration (three CREATE INDEX).
5. **PR 5 — Lint + CI**: E1 (ESLint 9 flat config) then H2 (minimal typecheck+lint CI).

**Deferred:** vitest suite + e2e (H1), version-counter lock (A3), full theme system (add ThemeProvider only if dark mode becomes a requirement).

## Risks

- **Secrets in first commit:** `.env.local` ignored by `.env*.local` — verify with `git status` before the initial commit.
- **`tsconfig.tsbuildinfo`** regenerated artifact, 513 KB — ignore it in PR 1.
- **Removing `ignoreBuildErrors`:** safe now (clean pass); future type errors break build — intended, keep typecheck in CI.
- **`proxy.ts` matcher:** if task-detail routes are planned, keep matcher and wire `callbackUrl` into `auth-form.tsx` instead of removing.
- **Timestamp round-trip is TZ-sensitive:** A2 fixes µs only; B1/A3 remove timestamps from the equation entirely.
- **ESLint 9:** fixing violations touches several files — keep PR 5 isolated to linting.
- **pnpm 11:** moving overrides + fixing workspace placeholder requires fresh `pnpm install`.
- **Spec drift observed (out of scope):** openspec config says Next 16.2.6 (installed 16.2.12); PR4 spec says `middleware.ts` (implemented as `proxy.ts`); drag-token resolution implemented client-side. Flag for a docs pass.

## Ready for Proposal

**Yes.** All 9 findings verified against real files, live DB, and executed tool output. Well-scoped as 5 PRs; tests/CI correctly deferred. Produce the openspec `foundations` proposal per project convention; PR 1 can start immediately with near-zero risk.
