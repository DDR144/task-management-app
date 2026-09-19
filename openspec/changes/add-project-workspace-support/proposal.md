# Proposal: Add Project Workspace Support

## Intent
Users can create projects to group tasks, with a project-centric Kanban board that filters tasks by selected project. The database schema and server actions already exist — this change adds the UI integration layer.

## Scope

### In Scope
- Project selector dropdown in app-header
- Project-filtered Kanban board (centered on selected project)
- Project selection field in TaskDialog (create/edit)
- Auto-create "Personal" project on first use
- Persist selected project across reloads (localStorage)

### Out of Scope
- Project sharing/collaboration
- Project-level permissions
- Archive/restore projects
- Project analytics/reporting

## Capabilities

### New Capabilities
- `project-workspace`: Project grouping, selection, and project-scoped task visibility

### Modified Capabilities
- `task-management`: Tasks now require projectId; creation defaults to "Personal" project
- `kanban-board`: Board filters to single project instead of showing all tasks

## Approach
1. **AppHeader**: Add project selector dropdown calling `getProjects` action, store selection in React state + localStorage
2. **Page**: Lift `selectedProjectId` state, pass to KanbanBoard; on mount, restore from localStorage or auto-create "Personal"
3. **KanbanBoard**: Accept `projectId` prop, filter `initialTasks` by project, pass projectId to TaskDialog
4. **TaskDialog**: Add projectId field (hidden for "Personal" default), pass to `createTask`/`updateTask` actions
5. **Actions**: `getAllTasks` → `getTasksByProject(projectId)` in page.tsx

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `components/app-header.tsx` | Modified | Add project selector dropdown |
| `app/page.tsx` | Modified | Lift projectId state, filter tasks by project |
| `components/kanban-board.tsx` | Modified | Accept projectId prop, filter columns |
| `components/task-dialog.tsx` | Modified | Add projectId field, default to Personal |
| `app/actions/projects.ts` | Modified | Add `ensurePersonalProject()` helper |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `projectId` nullable in DB | Medium | Default to "Personal" project on task create; validate in actions |
| No project selected on first load | High | Auto-create "Personal" project, select it by default |
| localStorage mismatch after project delete | Low | Validate selected project exists on mount; fallback to first available |

## Rollback Plan
Revert changes to 4 components and page.tsx. Database schema unchanged — no migration rollback needed. Tasks without projectId will show in "Personal" after rollback.

## Dependencies
- Existing `projects` table and `projectId` FK on tasks (already migrated)
- Existing project CRUD actions in `app/actions/projects.ts`

## Success Criteria
- [ ] User can create/select projects from header dropdown
- [ ] Kanban shows only tasks for selected project
- [ ] New tasks default to "Personal" project
- [ ] Project selection persists across reloads
- [ ] No console errors or failed actions