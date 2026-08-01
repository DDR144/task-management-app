# Task Optimistic Locking Specification

## Purpose

Ensure concurrent task updates are detected correctly without false conflicts, while preserving the requirement that task updates MUST fail when the task was modified concurrently by another process.

## Requirements

### Requirement: Millisecond-Precision Timestamp Comparison

The system MUST compare task `updatedAt` timestamps at millisecond precision on the server side when evaluating optimistic locks. The comparison MUST use `date_trunc('millisecond', updatedAt)` against the raw client-supplied ISO string (e.g. `2026-07-31T23:42:06.095Z`) to eliminate microsecond false conflicts. The `updatedAt` column MUST be `timestamp with time zone` so the comparison is timezone-independent. The client-supplied value MUST NOT be re-wrapped in `new Date(...)` before comparison, because node-postgres serializes `Date` objects with the local timezone offset, which can diverge from the stored value.

#### Scenario: First status change on new task succeeds

- GIVEN a task was just created (DB `now()` produced microsecond-precision timestamp)
- AND the `updatedAt` column is `timestamp with time zone`
- WHEN the same user changes the task status immediately
- THEN the update succeeds without a false "modified concurrently" conflict

#### Scenario: Concurrent modification detected

- GIVEN a task was updated at time T1 by process A
- WHEN process B attempts to update the same task with the original T1 value
- AND the task's `updatedAt` in the database is now T2 (T2 > T1 at millisecond granularity)
- THEN the update fails with a conflict error

#### Scenario: Same-process rapid updates succeed

- GIVEN a user changes a task status twice within the same millisecond
- WHEN the second update is submitted with the original `updatedAt` value
- THEN both updates succeed (no false conflict)

### Requirement: Preserved Lock Semantics

The optimistic lock MUST remain a correctness guard — updates to a task that was modified by another process since the client last read it MUST be rejected. Dropping the lock entirely is not permitted.

#### Scenario: External concurrent edit detected

- GIVEN a task's `updatedAt` is T1 on the client
- WHEN another user or process updates the task before this client's request arrives
- AND the database `updatedAt` is now T2 where T2 ≠ T1 at millisecond granularity
- THEN the client's update is rejected with a conflict response

#### Scenario: No version-counter lock (deferred)

- GIVEN the system does not yet have a `version` counter column
- WHEN optimistic locking is evaluated
- THEN the lock operates solely on `updatedAt` millisecond comparison
- AND this constraint is documented as deferred until multi-user editing materializes
