# Evidence photos — Phase 3 (photos in the product)

Source doc: .ai/specs/2026-11-10-transport-damage-and-missing-items.md

## Goal
Customers attach 1 to 6 photos to a transport damage or missing item report, agents and customers see them as thumbnails, and photos become required, closing Q14.

## Scope
Phase 3 of the spec (Implementation Plan steps 10–13). Phases 1 (#139) and 2 (#142) are merged; the owner cleared every gate on 2026-11-11. Closes #140.

## Non-goals
Attaching files to supplier claim mail (Q9), customer uploads after submit (Q12), the retention job (T-21, legal sets the period), audit events (T-23), a private object store.

## Risks
- `risk-high`: public contract change (`evidenceFileIds`), photos can show a home or a person. Needs a second reviewer and a security review before any public deployment.
- Required photos is a breaking change for any client that submits transport or missing reports without `evidenceFileIds`; the only client is the portal wizard, changed in the same PR.
- Browser QA needs the ClamAV container and the QA credentials; if unavailable the scenarios are reported as not run.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 3: Photos in the product

- [ ] 3.1 core and app: POST /api/returns accepts evidenceFileIds, attached once inside the order lock, then required (1 to 6)
- [ ] 3.2 app: wizard photo step with upload, progress, errors, removal, counters, accessibility
- [ ] 3.3 app and ui: agent-card and tracker thumbnails, Storybook stories
- [ ] 3.4 QA scenarios and evidence, brief and threat-model updates, full gate
