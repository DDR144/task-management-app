# Tasks: Add Project Workspace Support

Feature: Project workspace UI integration (grouping tasks by project, project-scoped Kanban).

Source: `openspec/changes/add-project-workspace-support/proposal.md`

## State on resume

- DB schema + migration 0004 written but NOT applied to the database.
- `app/actions/projects.ts` exists but does not compile (type errors + missing imports).
- UI layer not started.

## Tasks

- [x] 1. Fix schema: `projectId` integer (FK to `projects.id` serial), remove unused `ProjectRole` enum
- [x] 2. Regenerate migration 0004 cleanly
- [x] 3. Rewrite `app/actions/projects.ts` (discriminated getUserId, imports, ensurePersonalProject)
- [x] 4. Wire `projectId` into `createTask`/`updateTask` (validate ownership)
- [x] 5. `AppHeader`: project selector dropdown + create-project dialog
- [x] 6. `app/page.tsx`: lift project state, auto-create "Personal", filter tasks by project
- [x] 7. `KanbanBoard` + `TaskDialog`: accept/pass `projectId`
- [x] 8. Verify: typecheck + lint + build

## Verification

- `npm run typecheck` → PASS
- `npm run build` (Turbopack) → PASS
- `npm run lint` → 16 pre-existing errors only in `.opencode/skills/*/scripts/*.cjs` (tooling scripts, unrelated); no errors in feature files.
- Migration `0004_sloppy_frog_thor.sql` applied to local `taskflow` DB. `tasks.projectId` is `integer` with `ON DELETE SET NULL` FK.

## Commit evidence

(pending — no commit yet; user has not authorized commit)
