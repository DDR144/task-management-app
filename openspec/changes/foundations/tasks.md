# Tasks: Foundations

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~425 (160/5/70/30/160) |
| Suggested split | PR1 → PR2 → PR3 → PR4 → PR5 |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Focused test | Runtime harness | Rollback |
|------|------|----|--------------|-----------------|----------|
| 1 | Repo hygiene + README | PR1 | staged list clean | `pnpm build` passes | Revert commit; `rm -rf .git` pre-push |
| 2 | ms-truncated lock | PR2 | manual: first change succeeds | `pnpm dev` + status change | Restore raw `eq` line |
| 3 | date-only dueDate | PR3 | manual: "31 jul" renders | migrate + dev es-ES | Down-migration + revert |
| 4 | FK indexes | PR4 | `pg_indexes` shows 3 | migrate on docker DB | `DROP INDEX` × 3 |
| 5 | ESLint 9 + CI | PR5 | `pnpm lint` exit 0 | push PR, CI green | Revert PR5 files |

Each PR: `gh pr create --base main --head <branch>`; verify `gh pr view`.

## PR 1 — Repo Hygiene
- [x] 1.1 `git init`; `gh repo create --private`; add remote; verify toplevel == root.
- [x] 1.2 Rewrite `.gitignore`: tsconfig.tsbuildinfo, `.env*` (keep `.env.example`), `**/*:Zone.Identifier`, node_modules, .next.
- [x] 1.3 Delete 44 `*:Zone.Identifier`; verify `find` count == 0.
- [x] 1.4 Selective first commit; RED: staged list free of secrets/.env.local; push; verify private.
- [x] 1.5 Drop `ignoreBuildErrors` in next.config.mjs; add `typecheck` script; verify `pnpm build` passes.
- [x] 1.6 Cleanup: name/packageManager in package.json; overrides → pnpm-workspace.yaml (`esbuild: true`); drop layout generator; fix schema comment; proxy matcher `['/']` + drop callbackUrl; sonner light, drop next-themes; fresh install.
- [x] 1.7 Create README.md (prereqs, setup, env vars, scripts, architecture).

## PR 2 — Optimistic Lock
- [ ] 2.1 tasks.ts:150: `eq(sql\`date_trunc('ms', ${tasks.updatedAt})\`, new Date(updatedAt))` + import `sql`.
- [ ] 2.2 Manual: first status change on new task succeeds.
- [ ] 2.3 Manual: stale updatedAt rejected (lock preserved).

## PR 3 — Due Dates
- [ ] 3.1 schema.ts:75: `timestamp('dueDate')` → `date('dueDate')` string mode (not `mode:'date'`).
- [ ] 3.2 Generate 0001 (`USING ("dueDate"::date)`); sample rows pre/post.
- [ ] 3.3 Apply: docker compose up + `drizzle-kit migrate`.
- [ ] 3.4 parseDueDate: regex `^\d{4}-\d{2}-\d{2}$` → `string|null`; no `new Date()`.
- [ ] 3.5 task-card: local-midnight parse → es-ES "31 jul"; overdue vs local; NULL never.
- [ ] 3.6 task-dialog: return string as-is. Verify "31 jul" card+dialog; overdue 08-01, not 07-31.

## PR 4 — DB Indexes
- [ ] 4.1 schema.ts: `.index()` on the 3 userId FKs.
- [ ] 4.2 Generate 0002 (3 CREATE INDEX, IF NOT EXISTS if absent); apply.
- [ ] 4.3 Verify pg_indexes shows 3; EXPLAIN uses them.

## PR 5 — Quality Gates
- [ ] 5.1 devDeps: eslint@^9, eslint-config-next@16.2.12, typescript-eslint@^8.
- [ ] 5.2 eslint.config.mjs: core-web-vitals + tseslint + globalIgnores(node_modules/.next/drizzle).
- [ ] 5.3 Fix violations (autofix; disable-with-reason); `pnpm lint` exit 0.
- [ ] 5.4 ci.yml: install --frozen-lockfile → typecheck → lint; DB-free, no secrets; CI green.
