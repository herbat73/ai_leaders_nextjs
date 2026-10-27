> **Repo-local override.** Makes the markdown scenario mandatory (stored in `.ai/qa/{AREA}/`, linked to its agent-browser script) and binds the skill to `doc/best-practices-testow-integracyjnych.md`.

## Runner (replace)

- Executable tests are written with **agent-browser only**, as a POSIX `sh` plus a native PowerShell launcher doing the same actions. Do not use Playwright and do not scaffold a TypeScript runner, even when the base skill would propose one.
- The scripts live next to their scenario, in `.ai/qa/{AREA}/`, and share its base name: `{AREA}-{number}-{slug}.sh` and `.ps1`. Screenshots go to the gitignored `.ai/qa/artifacts_{AREA}-{number}/`. The script ID in headers, session names and output is `{AREA}-{number}`.
- Model new scripts on `.ai/qa/RET/RET-001-customer-return-happy-path.sh` (env bootstrap, `trap` cleanup, API setup and cleanup).

## Step 8 — markdown scenario (replace)

- Writing the scenario is **mandatory** for every test this skill creates or changes. The base rule "the markdown scenario is not mandatory" does not apply here.
- Path: `.ai/qa/{AREA}/{AREA}-{number}-{slug}.md`, e.g. `.ai/qa/RET/RET-003-customer-cancels-return.md`.
  - `{AREA}` is the upper-case concept code (today `RET` for `returns`); `{number}` is zero-padded to 3 digits and is the next free number in that folder; `{slug}` is kebab-case.
  - Create the `{AREA}` folder when its first scenario is added. Do not renumber existing files.
- Keep the base content (test ID, category, priority, type, prerequisites, step/expected table, edge cases) filled with the actions and results actually observed in step 6, plus the Given–When–Then of the case, in Polish.
- Every scenario carries a **Test implementation** section with relative Markdown links to its `.sh` and `.ps1` scripts, and each script carries the scenario path in its header comment, so one is found from the other.
- When a script is renamed, moved or removed, update the link in its scenario in the same change.

## Rules (add)

- MUST read `doc/best-practices-testow-integracyjnych.md` before authoring or changing a test and apply all of it. In particular:
  - test observable behavior, never implementation details;
  - one scenario = one business case, structured as Given–When–Then;
  - deterministic: no unseeded random data, no dependence on the current date or test order, no fixed `sleep`/`wait(n)` — wait for a concrete state;
  - independent: the test creates its own data (via API when the UI path is not the subject) and cleans up;
  - verify only the result levels relevant to the case; do not mock our own components under test, replace only external systems with controlled fakes;
  - cover positive, negative and boundary cases, and idempotency where it applies;
  - stable selectors in the order role + name, label, visible text, `data-testid`; never structural paths;
  - concrete assertions, small single-purpose helpers, test names stating action + condition + result.
- The expected result of a scenario MUST come from the spec or product brief, never from the model's guess or from echoing what the app currently does; when no source defines it, ask the user.
- Scenarios drafted by the agent are drafts: tell the user that a human has to review them.
