# Evidence backend — Phase 2 (uploads, no product change)

Source doc: .ai/specs/2026-11-10-transport-damage-and-missing-items.md

## Goal
Order-scoped image evidence storage with scanning, re-encoding and authorized download, testable by API, not user-visible.

## Scope
Phase 2 of the spec (Implementation Plan steps 6–9). Gate cleared by the owner on 2026-11-11 (Q5–Q8 confirmed, `sharp` and ClamAV approved). Phase 3 is NOT in this run: no change to `POST /api/returns`, no wizard step, no thumbnails. Tracks #140; must not close it.

## Non-goals
Photos in the product, retention job (T-21), audit events (T-23), a private object store.

## Risks
- `risk-high`: new dependency (native `sharp`), new service, new upload surface, new table. Needs a second reviewer and a security review before any public deployment.
- ClamAV is unavailable in this environment unless Docker can run it; contract tests use a stub clamd, the EICAR check is run only when the container is up.
- Migration `down` refuses once evidence rows exist.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 2: Evidence backend

- [x] 2.1 core: EvidencePort, MalwareScannerPort, ImageSanitizerPort, EvidenceService (limits, ordering, authorization) — 3c07646
- [x] 2.2 db: evidence entity, migration, repository (staged insert under order lock with quota, attach, delete-for-request, orphan purge) — 44e0f43
- [x] 2.3 app: ClamAV adapter, sharp sanitizer, env wiring, docker-compose ClamAV, Configuration.md and .env.example — 444fbc4
- [x] 2.4 app: POST /api/evidence and GET /api/evidence/[id], integration tests, threat-model status update — 6dafb15

## Outcome

Phase 2 implemented; Phase 3 is not started (#140 stays open).

- Gate: `typecheck`, `test` (core 1007, app 27, plus the db suite below), `lint` (0 errors), `audit`, `docs:check`, `storybook:build` and `NODE_ENV=production npm run build` all green.
- `npm run test:db` (outside the gate) against the local Docker Postgres: 14 files, evidence repository and migration tests included, including the two-tab quota race and the atomic double attach.
- Real scanner: `CLAMD_LIVE=1 npm test -w @easyrms/app` against the `clamav-debian:1.4` container flags the EICAR string as infected.
- `EVD-001` (curl against the running app, real clamd, QA database) passes, including the 503 with the scanner container stopped and the recovery afterwards.
- Not done on purpose: no change to `POST /api/returns`, no wizard step, no thumbnails, no retention job (T-21), no audit events (T-23), no PowerShell version of EVD-001.
- Deviation from the spec text: `clamav/clamav` has no arm64 image, so `docker-compose.yml` uses `clamav/clamav-debian:1.4`.
