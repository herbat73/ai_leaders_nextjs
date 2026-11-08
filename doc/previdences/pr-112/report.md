# QA report: PR #112 (rules recommendations, E04-S01)

Head tested: b3a7475. Environment: `next dev` on a fresh `easyrms_qa` database, seeded order PL-10001, QA agent. Browser: agent-browser 0.38.2 (Chrome 157). Scenario authored for this run (not committed as a RET script).

| # | Pri | Flag | Step | Result | Evidence |
|---|---|---|---|---|---|
| 1 | P0 | on | Return of 39,99 zł: card shows "Rekomendacja reguł", "Zalecana akceptacja", rule R08 and the advisory line | PASS | 01-small-return-recommends-approval.png |
| 2 | P0 | on | Approve it: `return_rule_comparisons` row `approve / R08 / approved / followed=true` | PASS | 02-approved.png |
| 3 | P0 | on | Return of 349,99 zł: "Brak rekomendacji.", no approval text | PASS | 03-large-return-no-recommendation.png |
| 4 | P0 | on | Reject it: row `none / (no rules) / rejected / followed=null` | PASS | (DB assertion) |
| 5 | P1 | on | Customer view of the approved return shows no "Rekomendacja" and no rule id | PASS | 04-customer-view-clean.png |
| 6 | P0 | off | Same small return, app restarted without the flag: no box; approving writes no comparison row | PASS | 05-flag-off-no-box.png |

Overall: **PASS** for the steps exercised.

Not exercised: R09 (complaint up to 60 zł) and the R10c manager hint (no seeded order reaches 2000 zł) are covered by unit tests only; keyboard-only operation and the narrow viewport were not checked; exchange (no amount) covered by unit test only; the invalid-flag 500 (P2) not run.

Side effect: starting the environment ran `db:migrate` on the developer database `easyrms` (adds the new table; additive).
