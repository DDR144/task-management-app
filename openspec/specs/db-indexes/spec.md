# Database Indexes Specification

## Purpose

Add indexes on foreign key columns to ensure efficient query performance for the most common access patterns (user-scoped queries) and to support cascading deletes.

## Requirements

### Requirement: Foreign Key Column Indexes

The system MUST have database indexes on the following foreign key columns: `tasks.userId`, `session.userId`, `account.userId`. These columns participate in `ON DELETE CASCADE` relationships and are the primary filter for user-scoped queries.

#### Scenario: tasks.userId indexed

- GIVEN the `tasks` table has a `userId` foreign key column
- WHEN a query filters by `tasks.userId` (e.g., fetching a user's tasks)
- THEN the database uses the index to locate matching rows
- AND `EXPLAIN` confirms index usage for the query plan

#### Scenario: session.userId indexed

- GIVEN the `session` table has a `userId` foreign key column
- WHEN a query filters by `session.userId` (e.g., finding active sessions for a user)
- THEN the database uses the index to locate matching rows

#### Scenario: account.userId indexed

- GIVEN the `account` table has a `userId` foreign key column
- WHEN a query filters by `account.userId` (e.g., finding linked accounts for a user)
- THEN the database uses the index to locate matching rows

### Requirement: Single Drizzle Migration

All three indexes MUST be added in a single Drizzle-generated migration file.

#### Scenario: Migration produces correct SQL

- GIVEN the Drizzle schema defines the three indexes
- WHEN `drizzle-kit generate` is run
- THEN the migration file contains three `CREATE INDEX` statements
- AND the migration applies cleanly with `drizzle-kit migrate`

#### Scenario: Migration is idempotent-safe

- GIVEN the migration has already been applied
- WHEN the migration is run again (or the app starts)
- THEN no errors occur due to duplicate index creation
