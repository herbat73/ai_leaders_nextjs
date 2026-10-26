# Provenance of sample_rules_2 — owner statement

- Date, owner: 2026-10-26, Adam Adamczyk (statement given in an `om-discover --refresh` session)
- Context: `.ai/specs/research/rules_cases/sample_rules_2.{md,csv}` entered the repo on 2026-10-26 as `rules_cases_tests/test_rules_2.*` (PR #41), marked `[TESTOWE]` / "not evidence" in the note and "test data" in `doc/instrukcja-proba-50-spraw.md`. PR #42 renamed the folder and files to `sample_rules_*`; PR #43 removed the test-data banner from the note without changing any number or CSV row, and its source line now reads "1 dane zabrane potrzeby sprawdzenia reguł".
- Statement: asked whether the sample is real, anonymised cases of the shop or data generated to test the rules, the owner answered "Prawdziwe sprawy".
- Not stated by the owner: who exported the cases, from which system, the selection of the 100 cases (the guide asks for the 50 most recent), how they were anonymised.
- Checked in this session: the committed note and the committed CSV do not agree (note: 66% with a follow-up, kinds 42/32/16/10, channels 56/44, 18% settled by rules; CSV re-analysed with the repo's `CaseSampleService`: 62% (52–71%), kinds 40/33/15/12, channels 53/47, 2% (0.6–7%) settled by R08/R09). The owner chose to use the CSV figures. The note's case ids (`C01…`) do not appear in the CSV (`S001…`).
- Consequence: the CSV is recorded as `[DATA]` on the owner's word; the note's figures are not used. Revisit if the owner finds the CSV was generated, or supplies the export trail.
- Status: active
