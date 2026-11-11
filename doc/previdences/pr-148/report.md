## 🤖 `om-auto-qa-pr` — UI and job verification of #148

**Verdict: PASS** at head `222122a`. Local app (`next dev`) on a fresh copy of the migrated QA database, the QA agent in the browser (agent-browser), a real ClamAV-scanned photo, `npm run retention:run` and `retention:erase` run from the worktree against that database. Evidence only: no labels changed.

| # | Step | Expected | Result |
|---|---|---|---|
| 1 | Customer files a transport report (A, PL-10001) and a missing-item report (B, PL-10005), each with a scanned photo; agent approves and resolves A, B stays submitted | A closed, B open | ✅ |
| 2 | Card of A before retention | e-mail, defect text and photo link shown | ✅ `01-card-closed-before.png`, `02-inbox-before.png` |
| 3 | Backdate both to 400 days; `retention:run --dry-run` | lists A only, changes nothing | ✅ |
| 4 | `EASYRMS_RETENTION_DAYS=7` (invalid) | refused, nothing erased | ✅ non-zero exit, message names the range |
| 5 | `EASYRMS_RETENTION_DAYS=500` | 400-day-old requests stay | ✅ "anonymized 0" |
| 6 | `retention:run` (default 365) | A anonymized, B untouched | ✅ 1 request, 1 file, 2 audit rows; A keeps order number and status; B keeps e-mail, text and photo |
| 7 | Rerun | no-op | ✅ "anonymized 0" |
| 8 | `retention:erase` on open B / unknown RMA / already erased A | refused / refused / "already erased" | ✅ B unchanged |
| 9 | Card of A after | "Zanonimizowano 11 listopada 2026" instead of e-mail, no defect text, no photo, photo URL 404 | ✅ `03-card-closed-after.png` |
| 10 | Inbox after | A shows "Zanonimizowano", B still shows its e-mail | ✅ `04-inbox-after.png` |
| 11 | Card of open B after | unchanged, photo opens (200) | ✅ `05-card-open-unchanged.png` |
| 12 | Customer tracker of A (guest session) | status page 200, no defect text, no photo link | ✅ |

### Not exercised
`retention:erase --force` on an open request; the orphan staged-photo purge through the real app (covered by the DB test; the run had 0 orphans); the narrow viewport and loading states (the only UI change is one text label in two places); the job under a scheduler. Seed data is the app's demo orders; no real customer data.

### Observations
The card of an erased request still shows the non-personal facts that the spec keeps: order number, status, resolution, "Uszkodzenie zauważone" date and the SLA deadline. That matches Q3.
