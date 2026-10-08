# Tasks: Repository Debt Cleanup

Feature: Remove accumulated repository hygiene debt left after the project-workspace work.

Branch: `chore/repo-debt-cleanup`

## Context

Three unrelated working-tree / tracking defects were carried over from the previous session:

- `.opencode/` (66 MB, includes `node_modules`, 0 tracked files) is not covered by `.gitignore`,
  although `.claude/`, `.agents/` and `.atl/` already are.
- `skills-lock.json` is tracked since the initial commit, but every skill it references lives in
  the git-ignored `.agents/skills/` directory. The repo therefore versions a lockfile of
  machine-local tooling state that a fresh clone cannot reproduce.
- `openspec/changes/security-hardening/` was archived as a report (`archive/security-hardening.md`)
  but the change documents were never moved into `archive/security-hardening/`, unlike the
  `foundations` precedent (`archive/foundations.md` + `archive/foundations/`). Its `spec.md` is the
  only remaining copy of the security-hardening spec, since it was never promoted to
  `openspec/specs/`.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Untrack `skills-lock.json` and ignore it | Matches the already-ignored `.agents/` tooling directory; the lock describes content the repo does not carry. |
| D2 | Move (not delete) `changes/security-hardening/` into `archive/` | Lossless, and consistent with the existing `foundations` archive layout. |
| D3 | Ignore `.opencode/` as a tooling directory | 66 MB of untracked tooling state; sibling tool dirs are already ignored. |

## Tasks

- [x] 1. Add `.opencode/` and `skills-lock.json` to `.gitignore`
- [x] 2. Untrack `skills-lock.json` (`git rm --cached`, file preserved on disk)
- [x] 3. Move `openspec/changes/security-hardening/` to `openspec/changes/archive/security-hardening/`
- [x] 4. Verify: git tracking state, ignore rules, archived documents intact, no source touched

## Verification

Structural verification only — no application source file was modified, so no test-first cycle applies
(`git diff --cached --name-only` touches only `.gitignore`, the untracked lock, and the openspec move).

```
$ git check-ignore -v .opencode/node_modules skills-lock.json .agents/skills
.gitignore:27:.opencode/      .opencode/node_modules
.gitignore:31:skills-lock.json skills-lock.json
.gitignore:26:.agents/        .agents/skills

$ git ls-files skills-lock.json | wc -l
0

$ ls -la skills-lock.json     # file preserved on disk after untracking
6697 skills-lock.json

$ ls openspec/changes/
add-project-workspace-support/  archive/

$ ls openspec/changes/archive/
foundations/  security-hardening/  foundations.md  security-hardening.md

$ ls openspec/changes/archive/security-hardening/
apply-progress.md 3.8K  design.md 4.2K  proposal.md 4.2K  spec.md 10.5K  tasks.md 5.7K
```

- All five change documents preserved byte-for-byte; git recorded them as renames (`R`), so history follows the move.
- `openspec/changes/security-hardening/` no longer exists; the `archive/` layout now matches the `foundations` precedent.
- No tracked file removed except the `skills-lock.json` index entry; the on-disk file is untouched and now ignored.

## Commit evidence

(pending)
