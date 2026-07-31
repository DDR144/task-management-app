# Quality Gates Specification

## Purpose

Establish automated code quality enforcement via ESLint 9 flat configuration and continuous integration to catch type errors and lint violations before merge.

## Requirements

### Requirement: ESLint 9 Flat Configuration

The project MUST use ESLint 9 with flat config format (`eslint.config.mjs`). Legacy `.eslintrc` files MUST NOT exist.

#### Scenario: ESLint config present

- GIVEN the project root
- WHEN `eslint.config.mjs` is inspected
- THEN it exists and uses the flat config format (exported array of config objects)
- AND it extends `eslint-config-next/core-web-vitals` and `typescript-eslint` recommended rules

#### Scenario: Global ignores defined

- GIVEN the ESLint config
- WHEN a developer inspects the config
- THEN `globalIgnores` excludes build output directories (`node_modules`, `.next`, `drizzle`)

#### Scenario: Lint passes on clean codebase

- GIVEN the ESLint config and all source files
- WHEN a developer runs `pnpm lint`
- THEN the process exits with code 0
- AND no warnings or errors are reported (after violations are fixed)

### Requirement: ESLint Dependencies Installed

The following packages MUST be installed as devDependencies: `eslint@^9`, `eslint-config-next@16.2.12`, `typescript-eslint@^8`.

#### Scenario: Lint command available

- GIVEN the project is set up with `pnpm install`
- WHEN a developer runs `pnpm lint`
- THEN ESLint executes without "command not found" errors

### Requirement: Continuous Integration

The project MUST have a GitHub Actions CI workflow that runs on pull requests to the main branch.

#### Scenario: CI runs typecheck and lint

- GIVEN a developer opens a pull request
- WHEN the CI workflow triggers
- THEN it runs `pnpm install`, `tsc --noEmit`, and `pnpm lint`
- AND all three steps must pass for the workflow to succeed

#### Scenario: CI fails on type error

- GIVEN a PR introduces a TypeScript error
- WHEN CI runs `tsc --noEmit`
- THEN the workflow fails and the PR is blocked from merge

#### Scenario: CI fails on lint error

- GIVEN a PR introduces an ESLint violation
- WHEN CI runs `pnpm lint`
- THEN the workflow fails and the PR is blocked from merge

#### Scenario: CI runs on private repo

- GIVEN the GitHub repository is private
- WHEN CI configuration is inspected
- THEN the workflow does not require public-repo-only features
- AND secrets are not hardcoded in the workflow file
