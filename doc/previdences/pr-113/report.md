# QA report: PR #113 (rules badges in the inbox, E04-S02)

Head tested: 73c6191. Environment: `next dev` on a fresh `easyrms_qa` database, seeded orders PL-10001 and PL-10005, QA agent. Browser: agent-browser 0.38.2 (Chrome 157). Scenario authored for this run (not committed).

| # | Pri | Flag | Step | Result | Evidence |
|---|---|---|---|---|---|
| 1 | P0 | on | Return of 39,99 zł: inbox row shows "Zalecana akceptacja" (R08) | PASS | 01-inbox-badges.png |
| 2 | P0 | on | Return of 349,99 zł: no badge | PASS | 01-inbox-badges.png |
| 3 | P1 | on | Complaint of 49 zł with refund: "Zalecana akceptacja" (R09) | PASS | 01-inbox-badges.png |
| 4 | P0 | on | No "Kierownik" badge on small requests | PASS | 01-inbox-badges.png |
| 5 | P0 | on | After approving the small return its badge is gone; the complaint keeps its badge | PASS | 02-after-approval.png |
| 6 | P1 | on | `?status=submitted` filter lists the pending ones and not the approved one | PASS | 03-submitted-filter.png |
| 7 | P0 | off | App restarted without the flag: no "Zalecana akceptacja" or "Kierownik" anywhere in the inbox | PASS | 04-flag-off-no-badges.png |

Overall: **PASS** for the steps exercised.

Not exercised: the "Kierownik" badge (R10c) on a real request, because no seeded order reaches 2000 zł (unit-tested); narrow viewport; keyboard-only use; paging with more than one page of badges.
