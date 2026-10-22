# Tasks: Close Backlog Gaps

Feature: Close the four verified pending items of task-management-app, in the order the user approved.

Branch: `chore/close-backlog-gaps` (base `main` @ `e9fa49d`)

## Specs

S1 — GitHub Actions bump. The workflow `.github/workflows/ci.yml` must use current action majors:
`actions/checkout@v7`, `actions/setup-node@v7`, `pnpm/action-setup@v6` (latest published majors verified via
`gh api repos/<action>/releases/latest`: v7.0.1, v7.1.0, v6.1.0). `node-version: 24` stays as is. The
Node.js 20 deprecation annotation must no longer be attributable to our workflow.

S2 — Close the open OpenSpec change. `openspec/changes/add-project-workspace-support/` must stop reporting the
feature as in progress: its spec is promoted to `openspec/specs/`, an archive report is written, and the change
directory moves under `openspec/changes/archive/`, matching the `foundations` precedent
(`archive/<name>.md` report + `archive/<name>/` folder with the full documents).

S3 — First automated test suite. The project must gain a runnable `test` script and tests covering the pure
behavior that already produced real bugs: due-date parsing/validation and due-date rendering/overdue evaluation
(calendar-date semantics, no timezone shift). CI must run the suite. Tests must not require a live database.

S4 — README coverage. `README.md` must document the project/workspace feature (top-bar selector, tasks scoped to
their project, auto-created "Personal" project) and the new test script.

## Tasks

- [x] 1. Bump the three GitHub Actions to their current majors (S1)
- [x] 2. Close and archive the `add-project-workspace-support` OpenSpec change (S2)
- [x] 3. Add the first test suite for due-date behavior and wire it into CI (S3)
- [x] 4. Document the projects feature and the test script in the README (S4)
- [ ] 5. Verify everything (typecheck, lint, tests, CI wiring) and integrate into `main`

## Log

L1 (user, verbatim): "comencemos por el orden que sugeriste"

L2 (agreed order, from the pending-items report the user accepted):
1. Bump de las GitHub Actions — minutos, saca el ruido y el vencimiento de Ubuntu 26.
2. Cerrar el cambio de openspec — barato, deja la documentación diciendo la verdad.
3. Primera suite de tests — el mayor valor real, empezando por lock, fechas y filtrado.
4. README del feature — cierra la brecha de documentación.

L3 (decision): S3 starts with the pure date behavior because the optimistic-lock and project-filtering bugs live in
DB-backed code and would require an integration harness (live Postgres). Those stay documented as the next slice
rather than being faked with mocks that cannot catch the real regression.

## Verification

- `pnpm test` → 1 file, 12 tests passed (vitest 5.0.5). The suite is offline and needs no database.
- `pnpm typecheck` → exit 0.
- `pnpm lint` → "ESLint: No issues found" (after ignoring the untracked `.opencode/` tooling directory).
- Extraction verified by diff: `app/actions/tasks.ts` and `components/task-card.tsx` only lost their local definitions
  and gained the import; `lib/task-dates.ts` holds the identical implementations. The only signature difference is the
  parameter type widening from `FormDataEntryValue | null` to `string | File | null`, the same union.
- Vitest's ESM/CommonJS config warning was removed by renaming the config to `vitest.config.mts` and deriving the root
  from `import.meta.url` instead of `__dirname`; tests still pass.
- The openspec move is recorded as a rename by git; the promoted spec carries eight requirements with `path:line`
  evidence and the archive report records the two proposal claims the shipped code does not match.
- NOT verified: the GitHub Actions bump and the new CI test step can only be proven by a CI run, which requires a push.
- NOT covered by the suite: the optimistic-lock and project-filtering bugs live in DB-backed code and need an
  integration harness. Recorded as the next slice rather than faked with mocks that could not catch the regression.

## Delivery slice

Six commits, 487 authored changed lines excluding lock files, so the ~400-line review slice is exceeded. The repository
policy is `delivery_strategy: ask-on-risk` (`openspec/config.yaml`), so the delivery decision belongs to the user and is
requested before the next commit.

## Commit evidence

- `03476c3` docs(odd): track backlog closeout tasks
- `38e8094` chore(ci): bump GitHub Actions to current majors (S1)
- `a875ea1` test: add due-date suite and run it in CI (S3)
- `f8c8227` chore(lint): ignore the untracked tooling directory
- `1e1b41d` docs(readme): document projects feature and test script (S4)
- `51063c6` docs(openspec): close and archive the project workspace change (S2)
