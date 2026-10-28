# QA evidence — PR #68 (agent list pagination, search, status filter)

Head tested: `f04f975`. Env: next dev (webpack/turbopack default) on a throwaway Postgres, 25 agents (1 manager, 24 seeded: 8 invited / 8 disabled / 9 active incl. manager), viewport 1280×900 and 390×844. Not formally reviewed before QA (no review verdict on the PR).

| # | Step | Result | Shot |
|---|---|---|---|
| 1 | Open `/admin/agents`: 10 rows, search + status select, "Strona 1 z 3", Poprzednia disabled | PASS | 01 |
| 2 | Następna → "Strona 2 z 3" | PASS | 02 |
| 3 | Następna → "Strona 3 z 3", Następna disabled | PASS | 03 |
| 4 | Search "agent testowy 07" → 1 row, pager hidden, page reset | PASS | 04 |
| 5 | Search "agent12@" (e-mail partial) → Agent Testowy 12 | PASS (text check) | — |
| 6 | Search "zzz-brak" → "Brak agentów pasujących do filtrów." | PASS | 05 |
| 7 | Status dropdown lists Wszystkie / Zaproszony / Aktywny / Wyłączony | PASS | 06 |
| 8 | Status = Wyłączony → exactly the 8 disabled agents, no pager | PASS | 07 |
| 9 | Mobile 390px layout | PASS (renders; see note) | 08 |

Verdict: **PASS**.

Observation (non-blocking, cosmetic): at 1280px the search placeholder ("Szukaj po imieniu, nazwisku lul…") and the select value ("Wszystkie statu…") are truncated by `sm:w-72` / `sm:w-44`; consider shorter placeholder or wider controls.

Not exercised: loading/error/no-permission states (unchanged by this PR), dark theme. No secrets in screenshots (demo QA account only).
