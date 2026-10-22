# Archive: Add Project Workspace Support

**Archived:** 2026-10-10
**Change Period:** 2026-10-10
**SDD Cycle:** Proposal → Spec → Apply (single PR) → Verify (code review) → Archive
**Archived Folder:** `openspec/changes/archive/add-project-workspace-support/`

---

## Executive Summary

Project workspace support delivered as a single feature commit (`f53b224`) on `main`. The change wires an existing `projects` table and project server actions into the UI: the app header gained a project selector and create-project control, the home page became project-scoped, and the task dialog passes the selected `projectId` as a hidden field. A "Personal" project is auto-created on first use. Verification: 8 spec requirements established, 0 CRITICAL findings. One proposal claim differs from shipped behavior: tasks do not strictly "require" `projectId` at the database level, and new tasks default to the currently selected project rather than always to "Personal".

---

## Intent

Users can create projects to group tasks, with a project-centric Kanban board that filters tasks by selected project. The database schema and server actions already existed; this change added the UI integration layer.

---

## What Was Changed

| Item | Change |
|------|--------|
| `app/page.tsx` | Lifted project selection from URL `projectId` search param; calls `ensurePersonalProject()` and `getTasks(selectedProject.id)`; renders project name and passes `projectId` to `KanbanBoard`. |
| `components/app-header.tsx` | Added project selector `Select`, create-project `Plus` button + dialog, `localStorage` restore of last selected project (`taskflow:lastProjectId`), and sign-out handling. |
| `components/task-dialog.tsx` | Added hidden `<input name="projectId">` so tasks are created/updated within the selected project. |
| `components/kanban-board.tsx` | Received `projectId` prop and `initialTasks` already filtered server-side; no client-side project filtering. |
| `app/actions/projects.ts` | Existing actions reused; `ensurePersonalProject()` auto-creates a "Personal" project when the user has none. |

---

## Key Decisions

| # | Decision | Choice |
|---|----------|--------|
| D1 | Project persistence | **URL search param + localStorage fallback** — `/?projectId=<id>` is the source of truth; `localStorage` restores the last selection only when the URL has no explicit `projectId`. |
| D2 | First-use default | **Auto-create "Personal"** — `ensurePersonalProject()` inserts a project named "Personal" with `color = 'default'` if the user has none. |
| D3 | New task default project | **Selected project** — new tasks inherit the board's current `projectId`, not always "Personal". |
| D4 | Task project field | **Hidden input** — `TaskDialog` passes `projectId` as a hidden form field to the existing `createTask`/`updateTask` actions. |
| D5 | Project deletion | **Task-count guard** — a project with tasks cannot be deleted; the user must move or remove tasks first. |

---

## Verification Results

| Check | Result |
|-------|--------|
| Requirements | **8/8 established** in `openspec/specs/project-workspace/spec.md` — derived directly from shipped code. |
| Implementation commit | ✅ `f53b224` on `main` (pushed). |
| Code-review claim check | ✅ All spec statements traceable to `app/page.tsx`, `components/app-header.tsx`, `components/task-dialog.tsx`, `components/kanban-board.tsx`, `app/actions/projects.ts`, or `lib/db/schema.ts`. |

### WARNINGS / SUGGESTIONS (non-blocking)
- `tasks.projectId` remains nullable (`lib/db/schema.ts:90`) with `ON DELETE SET NULL`. The UI currently always supplies a value, but the schema permits null.
- Project edit, color picker, and description fields exist in `createProject`/`updateProject` actions but are not exposed in the header create dialog beyond `name`.
- The proposal stated "Tasks now require projectId"; this is not enforced at the database or action level — task creation accepts a null project id.

---

## Proposal Claims vs. Shipped Code

| Proposal Claim | Status | Evidence |
|----------------|--------|----------|
| Project selector dropdown in app-header | ✅ Implemented | `components/app-header.tsx:119` |
| Project-filtered Kanban board | ✅ Implemented | `app/page.tsx:31` calls `getTasks(selectedProject.id)` |
| Project selection field in TaskDialog | ✅ Implemented | `components/task-dialog.tsx:102` hidden `projectId` input |
| Auto-create "Personal" project on first use | ✅ Implemented | `app/actions/projects.ts:46` |
| Persist selected project across reloads (localStorage) | ✅ Implemented | `components/app-header.tsx:48` restore effect; `components/app-header.tsx:72` on selection change |
| Tasks now require projectId | ⚠️ NOT enforced | `lib/db/schema.ts:90` `projectId` is nullable; `app/actions/tasks.ts:75` allows null project id |
| New tasks default to "Personal" project | ⚠️ NOT as stated | New tasks default to the currently selected project (`components/task-dialog.tsx:102`), not specifically "Personal" |

---

## Deferred Items (documented, out of scope)

| Item | Reason | Where documented |
|------|--------|------------------|
| Project sharing/collaboration | Out of scope | Proposal Out of Scope |
| Project-level permissions | Out of scope | Proposal Out of Scope |
| Archive/restore projects | Out of scope | Proposal Out of Scope |
| Project analytics/reporting | Out of scope | Proposal Out of Scope |
| Project editing UI (description, color) | UI limited to creation flow | This report |

---

## SDD Artifacts

| Artifact | File |
|----------|------|
| Proposal | `openspec/changes/archive/add-project-workspace-support/proposal.md` |
| Spec (promoted) | `openspec/specs/project-workspace/spec.md` |
| Archive Report | `openspec/changes/archive/add-project-workspace-support.md` *(this report)* |

---

## Main Spec Established

The change established a new promoted spec:

- `openspec/specs/project-workspace/spec.md` (8 requirements)

---

*SDD cycle complete. Archived 2026-10-10.*
