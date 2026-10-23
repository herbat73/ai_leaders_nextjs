# Run log: case sample lab and platform primitives (2026-10-23)

Spec: `.ai/specs/2026-10-22-case-sample-lab-and-platform-primitives.md` (issue #14). PR: #26, branch `feat/case-sample-lab`. Plan: `.ai/runs/2026-10-23-case-sample-lab.md`.

## What changed
- `core`: `domain/` (`Money`, `ClaimKind`, `ClaimFacts`), `rules/` (schema, `evaluate`, `simulate`, `withThresholds`, `describeRule`, `BRIEF_RULES`), `metrics/`, `tabular/` (`parseTable`, personal-data guard, `papaparse`), `validators/discovery/`, `services/discovery/` (`CaseSampleService`, note renderer, fixture), `PayloadTooLargeError` and the optional `maxBytes` on `parseJsonBody`.
- `app`: `getCoreContainer()` + `resolveCaseSampleService()`, `POST /api/discovery/case-sample`, the page `/admin/discovery/case-sample`, `public/case-sample-template.csv`.
- `ui`: `FileImport`, `StatTile`/`StatRow`, `BreakdownTable`, `RuleSummary`, `TableCaption` and the optional `DataTable` `caption`, each with stories.

## Evidence
- Fixture oracle (12 rows) reproduced by `case-sample.service.test.ts`: follow-up share 0.75 (47–91%), messages median 4 / p75 6.25, days by kind 3 / 14 / 4.5, settled 7 of 12 (32–81%), among resolved 7 of 11 (35–85%), matches R08 4, R09 3, R10a 2, R10b 2, R10c 2, agreement 5 / 1 / 1, what-if R08 = 200 zł: R08 5, settled 8 of 12 (39–86%), agreement 6 / 1 / 1.
- `curl` against `next dev` with Postgres stopped (`pg_isready`: no response): 200 with the fixture and `thresholds.R08 = "200,00"` (matches above); 400 with `row.2.case_ref` and `row.2.value_pln`; 400 guard `row.2`; 413 `payload_too_large` at ~1.1 MB; 400 `thresholds.R10c`. No `x-requested-with` header was needed: the CSRF check from the customer-portal spec does not exist yet.
- Gate per step: `typecheck`, `npm test` (core), `lint` (0 errors), `audit`, `storybook:build`.

## UI verification
Browser walkthrough against the fixture (agent-browser, `next dev`, Postgres stopped) passed: tiles 12 / 75% (47–91%) / 4 / 58% (32–81%), what-if R08 = 200 zł changes only the scenario column, bad threshold keeps the results, bad rows and a personal-data file are rejected by row. Evidence: `doc/previdences/pr-26/`.

## Not done here
- Issue #14 comment (after merge); note download, clipboard copy, keyboard-only selection and dark theme were not exercised.
- Review follow-ups accepted as minor: papaparse quote errors are ignored and line numbers drift for multi-line quoted cells.
