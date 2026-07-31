# Task Due Dates Specification

## Purpose

Ensure task due dates are treated as calendar dates (no timezone semantics), displayed consistently across all views, and evaluated correctly for overdue status.

## Requirements

### Requirement: Date-Only Column Semantics

The `tasks.dueDate` column MUST be a PostgreSQL `date` type (not `timestamp`). The migration MUST cast existing values using `USING ("dueDate"::date)` to strip time components.

#### Scenario: Date column stores calendar date

- GIVEN a task has `dueDate` set to `2026-07-31`
- WHEN the value is read from the database
- THEN it returns the calendar date `2026-07-31` with no time component
- AND no timezone conversion is applied

#### Scenario: Migration preserves existing values

- GIVEN existing tasks have `dueDate` as a `timestamp` column
- WHEN the migration runs `USING ("dueDate"::date)`
- THEN all existing due dates are truncated to their calendar date
- AND no data is lost beyond the time component

### Requirement: Consistent Due-Date Rendering

All UI components that display a task's due date MUST render it as a calendar date in the user's locale, with no time-of-day information.

#### Scenario: Task card shows calendar date

- GIVEN a task has `dueDate` set to `2026-07-31`
- WHEN the task card renders in `es-ES` locale
- THEN the displayed text is `"31 jul"` (day + abbreviated month)

#### Scenario: Task dialog shows matching date

- GIVEN a task has `dueDate` set to `2026-07-31`
- WHEN the task dialog opens with the date input field
- THEN the input value is `2026-07-31` (ISO date string, no time)
- AND it matches what the card displays

### Requirement: Calendar-Date Overdue Evaluation

Overdue checks MUST compare the task's due date against the current local calendar date, not against the current UTC timestamp.

#### Scenario: Task is overdue

- GIVEN today's local date is `2026-08-01`
- WHEN a task has `dueDate` of `2026-07-31`
- THEN the task is marked as overdue

#### Scenario: Task is not overdue on due date

- GIVEN today's local date is `2026-07-31`
- WHEN a task has `dueDate` of `2026-07-31`
- THEN the task is NOT marked as overdue

#### Scenario: Task with no due date is never overdue

- GIVEN a task has `dueDate` of `NULL`
- WHEN overdue status is evaluated
- THEN the task is NOT marked as overdue
