# Transport damage and missing items — Phase 1 (text evidence)

Source doc: .ai/specs/2026-11-10-transport-damage-and-missing-items.md

## Goal
Customers report transport damage (UC-04) or a missing/wrong item (UC-05) in the existing wizard, and agents decide them. Text evidence only.

## Scope
Phase 1 of the spec only (Implementation Plan steps 1–5c). Phases 2 (evidence backend) and 3 (photos in the product) are NOT in this run: Phase 2 is gated on security/legal confirming Q5–Q8 and owner approval of new dependencies (`sharp`, ClamAV); Phase 3 depends on it. No `evidenceFileIds`, no upload routes, no new dependencies.

## Non-goals
Photos, scanner, `evidence_files`, thumbnails, carrier/supplier claims (Q9), customer uploads after submit (Q12).

## Risks
- `risk-high` per spec (new public contract values, schema migration). Migration is expand-only (`courier_note` nullable).
- Interim deviation from Q14 (≥ 1 photo for transport) accepted by the owner under Q2.
- `test:db` and QA scenarios need a database; if unavailable they are reported as not run.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Transport damage and missing items, text evidence

- [ ] 1.1 core: request kinds, damage state machine, resolution resend_part, reason codes
- [ ] 1.2 core: eligibility with transport window setting, shared quantity pool, quote reuse
- [ ] 1.3 core: submit/quote validators, wizard steps, ReturnService branch
- [ ] 1.4 db: migration courier_note, entity, repository mapping and test
- [ ] 1.5 app: API routes accept the new kinds, route tests
- [ ] 1.6 app: customer entry cards, wizard, summary, tracker mapping, Polish copy
- [ ] 1.7 app: agent inbox kind filter, decision card, R10a badge, QA scenario
