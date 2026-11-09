# QA evidence for PR #118 (read-only rules page and threshold what-if, #110)

Verdict: PASS. Scenarios `RULES-001` and `RULES-002` (agent-browser, fresh QA database, QA agent with `MANAGE_RULES`).

Provenance: the screenshots posted on the PR on 2026-11-09 (head `dc59969`) lived on a `qa-evidence-pr-118` branch that was deleted, so they were **re-captured** on `main` at `6f558b5`, which contains #118 and the later #120 (it only bounds the database read; the page is unchanged). The original run's results are recorded in the PR comments.

| Screenshot | What it shows |
|---|---|
| 01-rules-list | Manager sees R08, R09, R10a, R10b, R10c, read-only, Polish; what-if form below |
| 02-simulation-baseline | One seeded return evaluated with current thresholds: R08 1, settled 1 (100%) in both columns |
| 03-simulation-r08-zero | R08 threshold `0`: R08 goes 1 to 0 in "Po zmianie", "Obecnie" unchanged |
| 04-invalid-threshold | Threshold `abc`: Polish validation message |
| 05-mobile-header-wraps | 390 px: header nav wraps, no horizontal scroll (fixed in `dc59969`) |
| 06-empty-state | Empty database: "Brak spraw z kwotą do oceny" |
| 07-forbidden-without-manage-rules | Agent without `MANAGE_RULES`: no nav link, "Brak dostępu", no rules or form |

Also verified in the same runs (no screenshot): `GET /api/rules` and `POST /api/rules/simulate` answer 401 without a session and 403 for an agent without `MANAGE_RULES`; an `R10c` override is refused with 400; reloading the page leaves the inputs empty (nothing persisted).

Not exercised: the more-than-5000-requests truncation notice (unit tests only).
