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

- [ ] 2.1 core: EvidencePort, MalwareScannerPort, ImageSanitizerPort, EvidenceService (limits, ordering, authorization)
- [ ] 2.2 db: evidence entity, migration, repository (staged insert under order lock with quota, attach, delete-for-request, orphan purge)
- [ ] 2.3 app: ClamAV adapter, sharp sanitizer, env wiring, docker-compose ClamAV, Configuration.md and .env.example
- [ ] 2.4 app: POST /api/evidence and GET /api/evidence/[id], integration tests, threat-model status update
