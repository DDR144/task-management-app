# Repo Hygiene Specification

## Purpose

Establish git version control baseline, enforce type-checking, clean template debt, and provide project documentation for the task-management-app.

## Requirements

### Requirement: Git Repository Initialization

The project MUST have a git repository initialized at the repo root with a private GitHub remote.

#### Scenario: Git repository exists

- GIVEN the project root directory
- WHEN a developer runs `git status`
- THEN the command succeeds without error
- AND the remote is configured as a private GitHub repository

#### Scenario: Zone.Identifier files removed

- GIVEN the repository contains 44 `*:Zone.Identifier` files (Windows transfer artifacts)
- WHEN the developer runs `git add .`
- THEN zero Zone.Identifier files are staged for commit

### Requirement: Gitignore Coverage

The `.gitignore` file MUST exclude all build artifacts, secrets, OS files, and Windows transfer artifacts.

#### Scenario: Build artifacts ignored

- GIVEN a `tsconfig.tsbuildinfo` file is regenerated during builds
- WHEN the developer runs `git status`
- THEN `tsconfig.tsbuildinfo` does not appear as untracked

#### Scenario: Environment files ignored

- GIVEN `.env`, `.env.local`, and `.env*.local` files exist
- WHEN the developer runs `git status`
- THEN none of these files appear as untracked
- AND `.env.example` IS tracked (template for new developers)

#### Scenario: Zone.Identifier patterns ignored

- GIVEN any file has a `:Zone.Identifier` NTFS alternate data stream
- WHEN the developer runs `git status`
- THEN all `*:Zone.Identifier` patterns are excluded from staging

### Requirement: Type-Check Enforcement

The system MUST fail the build when TypeScript errors are present. The `typescript.ignoreBuildErrors` option MUST NOT be set in `next.config.mjs`.

#### Scenario: Build fails on type error

- GIVEN a TypeScript error is introduced into the codebase
- WHEN a developer runs `pnpm build` or CI runs `tsc --noEmit`
- THEN the process exits with a non-zero code
- AND the error is reported in the output

#### Scenario: Typecheck script available

- GIVEN the project is set up
- WHEN a developer runs `pnpm typecheck`
- THEN `tsc --noEmit` executes and reports type errors (or clean pass)

### Requirement: Template Cleanup

The project MUST be free of template/scaffold artifacts that misrepresent the project identity.

#### Scenario: Package name corrected

- GIVEN the project `package.json` has a name field
- WHEN the file is inspected
- THEN the name is `"task-management-app"` (not `"my-project"`)

#### Scenario: Layout generator removed

- GIVEN `app/layout.tsx` has a `generator` metadata field
- WHEN the file is inspected
- THEN the generator field references the project itself (not `'v0.app'`)

#### Scenario: Stale schema comment removed

- GIVEN `lib/db/schema.ts` has an outdated FK comment
- WHEN the file is inspected
- THEN no stale comment remains that contradicts the actual schema

#### Scenario: Proxy matcher narrowed

- GIVEN `proxy.ts` has a route matcher
- WHEN the file is inspected
- THEN the matcher only includes routes the app actually serves (not `/tasks/:path*`)

#### Scenario: Sonner theme locked

- GIVEN `components/ui/sonner.tsx` imports `next-themes`
- WHEN the component is inspected
- THEN the theme is hardcoded to `"light"` (matching the locked light UI)

#### Scenario: Workspace placeholder fixed

- GIVEN `pnpm-workspace.yaml` has a placeholder value
- WHEN the file is inspected
- THEN the value is a valid boolean (not the literal string `"esbuild: set this to true or false"`)

#### Scenario: Package manager declared

- GIVEN `package.json` is inspected
- WHEN the `packageManager` field is checked
- THEN it specifies the exact pnpm version used by the project

### Requirement: README Documentation

The project MUST include a `README.md` at the repository root.

#### Scenario: README present and useful

- GIVEN a new developer clones the repository
- WHEN they read `README.md`
- THEN they find prerequisites, setup instructions, environment variables, available scripts, and a brief architecture overview
