# PR 36 — UI QA report (complaints and vendor claim)

Date: 2026-10-25. Verdict: **PASS** for the exercised scenario; limits below. Browser: `agent-browser` 0.35.2 (Chrome 156), dark theme, 1280 px wide and 390 px wide. App: `next dev` on :3100 from this branch, a separate database (`easyrms_qa`, all migrations), fake order adapter, SMTP transport pointed at a local recording sink. One agent with `MANAGE_RULES` (demo data only). Scenario written by the agent from the diff.

| # | Step | Expected | Observed | Result | Screenshot |
|---|---|---|---|---|---|
| 1 | Look up order PL-10002 and open `/returns` | Both entry points shown: return and complaint | "Rozpocznij zwrot" and "Zgłoś reklamację produktu" | PASS | 02 |
| 2 | Open the complaint wizard | Items step; a non-returnable product (underwear) can be chosen (R06) | Both lines selectable | PASS | 03 |
| 3 | Advance with an empty defect form | Inline error on the date, others keep their values | "Podaj, kiedy zauważyłeś wadę." under the date field | PASS | 04 |
| 4 | Fill description and date | Counter and fields follow the input | Counter 64 / 2000, date accepted | PASS (date set through the page's input event, see limits) | 05 |
| 5 | Choose courier and refund | Server-computed amount, no shipping fee | Quote of 89,00 zł shown by the server | PASS | 06 |
| 6 | Summary, accept terms, submit | Redirect to the tracker with the new RMA | `RMA-2026-00002`, "Status reklamacji", defect and date shown, 2-day promise | PASS | 07, 08 |
| 7 | Agent inbox | Complaint listed with kind and days left | "Reklamacja", "zostaje 14 dni"; kind and status filters present | PASS | 09 |
| 8 | Decision card, approve, mark in transit | Defect details, buttons follow the complaint machine | Details shown; after in transit the two "Odebrane" buttons appear | PASS | 10, 11 |
| 9 | "Odebrane: wada potwierdzona" | Finding recorded; vendor section appears | "Ocena wady: Wada potwierdzona"; "Reklamacja do dostawcy" section | PASS | 12 |
| 10 | Pick vendor, add note | Guidelines shown, e-mail preview matches what is sent | Guidelines and preview shown; no customer address | PASS | 12 |
| 11 | Send | Claim created and delivered | Section shows `SC-…`, status "Wysłano"; sink received the mail | PASS | 13, 14 |
| 12 | Record acceptance above the claimed value, then at 89,00 | Error for the first, saved for the second | Second saved (status "Uznana"); the first attempt was not screenshotted | PASS (error state: API-verified, see 01) | 15 |
| 13 | Claims list, suppliers screen | Claim listed with vendor and status; supplier table with edit and toggle | As expected | PASS | 16, 17 |
| 14 | Narrow viewport (390 px) | No horizontal scroll | `scrollWidth` 390 / 390 on the decision card and on the wizard | PASS | 18, 19 |

## Found and fixed during QA
Complaints still said "Zwracane produkty", "← Wszystkie zwroty" and the inbox/nav title "Zwroty". Changed to "Reklamowane produkty" (complaints), "← Wszystkie zgłoszenia" and "Zwroty i reklamacje". Screenshots 09–13 were taken before this wording change.

## Limits (not exercised or not proved)
- The browser could not type into the native date field; the value was set through the input's `input` event, so typing a date by hand is not covered.
- The environment was started by hand (separate database, SMTP sink), not through `om-prepare-test-env`; the dev server was stopped afterwards.
- Not exercised in the browser: the vendor rejection form, `mail_not_configured` / `mail_failed` banners, the no-permission view of suppliers (an agent without `MANAGE_RULES`), the empty states, light theme, keyboard-only use and screen readers. Server behaviour for the error codes is covered by unit tests and the API smoke (01).
- No `.uxproof/` design contract exists in the repo, so contract conformance was not checked; `docs:check` (raw colours) passes.
