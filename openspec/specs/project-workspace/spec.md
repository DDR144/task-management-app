# Project Workspace Specification

## Purpose

Ensure every authenticated user has at least one project (auto-created as "Personal"), that tasks are created and viewed within a selected project, and that project selection is scoped to the user and recoverable across reloads.

## Requirements

### Requirement: User-Owned Projects

Projects MUST be owned by a single user and isolated per user. The `projects` table MUST reference the authenticated user via `userId` with `ON DELETE CASCADE`, and project queries MUST filter by the current user's id.

#### Scenario: Project belongs to authenticated user

- GIVEN the authenticated user's id is `U`
- WHEN `getProjects` (`app/actions/projects.ts:30`) queries the database
- THEN it selects only rows where `projects.userId = U`
- AND orders results by `createdAt` ascending, then `id` ascending

#### Scenario: Deleting a user cascades to their projects

- GIVEN a user row exists with associated projects
- WHEN that user row is deleted
- THEN the `ON DELETE CASCADE` FK on `projects.userId` (`lib/db/schema.ts:89`) removes the associated project rows

### Requirement: Auto-Created Default Project

On first load of the authenticated home page, the system MUST ensure the user has at least one project. If the user has no projects, a "Personal" project MUST be created automatically and selected by default.

#### Scenario: First-time user sees Personal project

- GIVEN the authenticated user has no projects
- WHEN `Page` (`app/page.tsx:18`) calls `ensurePersonalProject()`
- THEN `ensurePersonalProject` (`app/actions/projects.ts:46`) inserts a project with `name = 'Personal'` and `color = 'default'`
- AND the page renders with that project selected

#### Scenario: Existing projects skip auto-creation

- GIVEN the authenticated user already has one or more projects
- WHEN `ensurePersonalProject()` runs
- THEN it returns the oldest existing project
- AND does not create a new "Personal" project

### Requirement: Project-Scoped Task Visibility

The home page MUST fetch and display only tasks belonging to the currently selected project. The Kanban board MUST receive the selected `projectId` and render only the tasks fetched for that project.

#### Scenario: Board shows only selected project tasks

- GIVEN `Page` (`app/page.tsx:9`) resolves `selectedProject` from `projectId` search param or the first project
- WHEN it calls `getTasks(selectedProject.id)` (`app/page.tsx:31`)
- THEN `getTasks` (`app/actions/tasks.ts:56`) returns tasks matching both `tasks.userId` and `tasks.projectId = selectedProject.id`
- AND `KanbanBoard` (`components/kanban-board.tsx:29`) receives those tasks as `initialTasks`

### Requirement: Header Project Selector

The application header MUST provide a dropdown to switch between the user's projects and a control to create a new project.

#### Scenario: User switches project from header

- GIVEN `AppHeader` (`components/app-header.tsx:31`) receives `projects` and `selectedProjectId`
- WHEN the user selects a different project from the `Select` (`components/app-header.tsx:119`)
- THEN `handleSelectProject` (`components/app-header.tsx:70`) writes the id to `localStorage` under `taskflow:lastProjectId`
- AND navigates to `/?projectId=<id>` with `router.push`

#### Scenario: User creates a project from header

- GIVEN the user opens the create-project dialog from the `Plus` button (`components/app-header.tsx:143`)
- WHEN the form submits
- THEN `handleCreateProject` (`components/app-header.tsx:78`) calls `createProject` (`app/actions/projects.ts:70`) with `name`
- AND on success stores the new id in `localStorage` and navigates to `/?projectId=<id>`

### Requirement: Project Selection Persistence

The last selected project id MUST be persisted across reloads using `localStorage`, and restored when the URL has no explicit `projectId`. Restored ids MUST be validated against the current user's project list.

#### Scenario: Reload restores last selected project

- GIVEN the user previously selected a project with id `N`
- AND `taskflow:lastProjectId` in `localStorage` equals `N`
- WHEN the page loads without a `projectId` search param
- THEN `AppHeader` (`components/app-header.tsx:48`) reads `N`, validates it exists in `projects`, and navigates to `/?projectId=N`

#### Scenario: Stale localStorage id is ignored

- GIVEN `taskflow:lastProjectId` contains an id that no longer belongs to the user
- WHEN the restore effect runs
- THEN the invalid id is silently ignored
- AND the page remains on the first available project

### Requirement: Task Creation Scoped to Selected Project

New tasks MUST be created with the `projectId` of the currently selected project. The task dialog MUST pass `projectId` as a hidden field so server actions receive it.

#### Scenario: New task belongs to current project

- GIVEN `KanbanBoard` (`components/kanban-board.tsx:26`) is rendered with `projectId`
- WHEN the user creates a task via `TaskDialog` (`components/task-dialog.tsx:40`)
- THEN the form includes `<input type="hidden" name="projectId" value={projectId} />` (`components/task-dialog.tsx:102`)
- AND `createTask` (`app/actions/tasks.ts:75`) stores `projectId` on the new task

#### Scenario: Task dialog uses selected project when editing

- GIVEN the user edits an existing task
- WHEN `TaskDialog` opens
- THEN the hidden `projectId` field is still set to the board's selected `projectId`
- AND `updateTask` (`app/actions/tasks.ts:117`) writes that `projectId` to the task

### Requirement: Project Name Validation

Project names MUST be non-empty and no longer than 100 characters. Both creation and update actions MUST enforce these limits and return a Spanish error message on failure.

#### Scenario: Empty project name rejected

- GIVEN `createProject` (`app/actions/projects.ts:70`) receives a `FormData` with blank `name`
- WHEN it validates the name
- THEN it returns `{ ok: false, error: 'El nombre del proyecto es obligatorio.' }`

#### Scenario: Oversized project name rejected

- GIVEN `createProject` receives a `name` longer than 100 characters
- WHEN it validates the name
- THEN it returns `{ ok: false, error: 'El nombre no puede superar 100 caracteres.' }`

### Requirement: Project Deletion Guard

A project MUST NOT be deleted while it still contains tasks. The deletion action MUST verify ownership, check for related tasks, and reject the request if any exist.

#### Scenario: Project with tasks cannot be deleted

- GIVEN `deleteProject` (`app/actions/projects.ts:129`) is called for a project that owns tasks
- WHEN it counts tasks where `tasks.projectId = id`
- THEN it returns `{ ok: false, error: 'No se puede eliminar un proyecto que tiene tareas. Mueve o elimina las tareas primero.' }`
- AND the project row is not deleted

#### Scenario: Only owned projects can be deleted

- GIVEN a user requests deletion of a project belonging to another user
- WHEN `deleteProject` checks ownership (`app/actions/projects.ts:139`)
- THEN it returns `{ ok: false, error: 'No se encontró el proyecto.' }`

## Notes

- The `tasks.projectId` column is nullable (`lib/db/schema.ts:90`) with `ON DELETE SET NULL`, so tasks created without an explicit project id will have `projectId = NULL`. The UI currently always supplies a project id.
- Project update, color, and description fields exist in `app/actions/projects.ts` but are only used by the header create flow in this version; project editing UI is deferred.
