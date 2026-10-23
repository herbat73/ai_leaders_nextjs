# QA evidence: PR #26, case sample lab (`/admin/discovery/case-sample`)

Environment: `next dev` on the PR head, Postgres not running, agent-browser 0.35.2 (Chrome 156), fixture `packages/core/src/services/discovery/__fixtures__/case-sample.csv`. Evidence-only run; no labels changed.

| # | Step | Expected | Observed | Result | Screenshot |
|---|---|---|---|---|---|
| 1 | Open the page | Intro, rule summaries, template link, file drop zone | As expected | PASS | 01-idle.png |
| 2 | Upload the fixture | Tiles: 12 cases, 75% (47–91%), median 4, 58% (32–81%); breakdowns kind 6/3/2/1, channel 8/4, outcome 6/2/2/1/1 | Exactly these values; cases `C01…C12`, no `case_ref` | PASS | 02-results-fixture.png |
| 3 | What-if R08 = `200,00` | Only the scenario column changes: R08 4 to 5; scenario settled 67% (39–86%) | R08 5, others unchanged, 67% (39%–86%) | PASS | 03-what-if-r08-200.png |
| 4 | What-if R08 = `abc` | Results stay; threshold error beside the inputs | Results kept; "Popraw progi… R08 — Kwota od 0 do 1 000 000 zł" | PASS | 04-bad-threshold-keeps-results.png |
| 5 | Upload a file with a bad row | Row list with line and column, no values | Lines 2: `case_ref`, `value_pln` messages | PASS | 05-row-errors.png |
| 6 | Upload a file with an e-mail in a dropped column | Rejected naming the row, not the value | "Wiersz wygląda na dane osobowe…", row 2 | PASS | 06-personal-data-rejected.png |
| 7 | Narrow viewport 375 px | Page usable | Captured after re-uploading the fixture | PASS (visual only) | 07-mobile-375.png |

Not exercised: the "Pobierz notatkę" download and "Kopiuj" (clipboard), the non-UTF-8 client-side rejection, keyboard-only file selection, dark theme. These remain for the manual QA reviewer (`needs-qa`).
