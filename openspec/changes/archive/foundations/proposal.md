# Proposal: Foundations

## Intent

Production-readiness milestone: establish version control, enforce quality gates, and fix two verified runtime bugs — optimistic-lock false conflicts and due-date timezone off-by-one — plus missing DB indexes. Tests deferred by decision.

## Scope

**In:**
- Git init + `.gitignore` rewrite + delete 44 Zone.Identifier files; host as GitHub PRIVATE repo
- Optimistic-lock fix A2: server-side `date_trunc('millisecond', updatedAt)` compare
- Due-date fix B1: migrate `dueDate` to Drizzle `date` column via `USING ("dueDate"::date)`
- Indexes on `tasks.userId`, `session.userId`, `account.userId`
- Remove `typescript.ignoreBuildErrors`; add `typecheck` script
- ESLint 9 flat config; GitHub Actions CI (typecheck + lint)
- Hard-lock light theme (sonner/next-themes); cleanup debt; minimal README

**Out:**
- Vitest unit/e2e suite (deferred)
- Version-counter lock A3 (defer until multi-user editing materializes)
- Dark mode (future feature); `callbackUrl` wiring; orphan-row cleanup

## Capabilities

No main specs exist (`openspec/specs/` absent) — all capabilities new. Delta specs MUST use RFC 2119 keywords.

### New Capabilities
- `repo-hygiene`: git baseline, ignore rules, typecheck gate, metadata, README
- `task-optimistic-locking`: ms-truncated compare; supersedes the raw-`updatedAt` lock in archived security-hardening
- `task-due-dates`: date-only semantics, consistent rendering, overdue evaluation
- `db-indexes`: FK-column indexes
- `quality-gates`: ESLint 9 flat config + CI

### Modified Capabilities
None — no existing main specs.

## Approach

Stacked-to-main chain; each PR revertible, ≤400 lines:

| PR | Scope | Risk |
|----|-------|------|
| 1 | Repo hygiene: git init, .gitignore, Zone files, typecheck, cleanup, light theme, README | Low |
| 2 | Optimistic lock A2 in `updateTaskStatus` | Low |
| 3 | Due date B1: `date` column migration + action/components | Med |
| 4 | Indexes: one Drizzle migration, 3 `CREATE INDEX` | Low |
| 5 | ESLint 9 flat config + violation fixes, then CI | Med |

## Affected Areas

| Area | Impact | PR |
|------|--------|-----|
| `app/actions/tasks.ts` | Modified | 2 (lock :150), 3 (dueDate :41-46) |
| `components/task-card.tsx`, `task-dialog.tsx` | Modified | 3 (display/overdue) |
| `lib/db/schema.ts` | Modified | 1 (comment), 3 (date type), 4 (indexes) |
| `drizzle/*` | Modified | 3, 4 (migrations) |
| `next.config.mjs` | Modified | 1 (ignoreBuildErrors) |
| `package.json`, `pnpm-workspace.yaml`, `proxy.ts`, `app/layout.tsx`, `components/ui/sonner.tsx` | Modified | 1 (cleanup) |
| `.gitignore`, `README.md` | New | 1 |
| `eslint.config.mjs`, `.github/workflows/ci.yml` | New | 5 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Secrets in first commit | Med | `.env*.local` ignored; verify `git status` pre-commit |
| ESLint 9 violations spread | Med | PR5 isolated to linting |
| `::date` cast truncates values | Low | Sample-check rows pre/post migration |
| Removing ignoreBuildErrors breaks future builds | Low | Intended; typecheck in CI |

## Rollback Plan

Per-PR revert; no cross-PR blockers. Indexes: `DROP INDEX`. Due date: reverse migration. Git: delete `.git` pre-push. Lock: restore raw compare.

## Dependencies

- GitHub remote (PR1)
- Fresh `pnpm install` (PR1, PR5)
- Running Postgres for migrations (PR3, PR4)

## Success Criteria

- [ ] `git status` clean of secrets/artifacts; private repo pushed
- [ ] First status change on a new task succeeds — no false conflict
- [ ] Picked 31 July renders "31 jul" in card, dialog, overdue check
- [ ] `pg_indexes` shows 3 new indexes
- [ ] `pnpm lint` and `pnpm typecheck` pass; CI green on PRs
- [ ] `pnpm install` clean — no overrides warning
