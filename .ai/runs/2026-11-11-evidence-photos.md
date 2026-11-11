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

- [x] 3.1 core and app: POST /api/returns accepts evidenceFileIds, attached once inside the order lock, then required (1 to 6) — 0eb3694
- [x] 3.2 app: wizard photo step with upload, progress, errors, removal, counters, accessibility — 9f2dd37
- [x] 3.3 app and ui: agent-card and tracker thumbnails, Storybook stories — 78a180c
- [x] 3.4 QA scenarios and evidence, brief and threat-model updates, full gate

## Outcome

Phase 3 implemented; with Phases 1 and 2 merged the D21 slice is complete. #140 is closed by this PR.

- Gate: `typecheck`, `test` (core 1024, app 27, plus db), `lint` (0 errors), `audit`, `docs:check` (43 components), `storybook:build`, `NODE_ENV=production npm run build` all green.
- `npm run test:db` (outside the gate): 171 passed, including the attach inside the submit transaction (a refused photo rolls the request back), `deleteStaged`, and evidence in the request detail.
- Scenarios against the running app with the real ClamAV container, all passing: RET-011 (browser: photo step, negatives, thumbnails, agent card, accessibility names), RET-012, EVD-001, EVD-002 (attach, foreign and reused ids, take-back, replay, tracker and card links).
- Screenshots: `doc/previdences/pr-143/`.
- Decisions made without asking: `DELETE /api/evidence/[id]` was added (staged files of the own order only) so a customer can take a photo back without using up the 6-file count; upload progress is an indeterminate bar plus text because `fetch` has no upload progress and `apiCall` stays the only fetch site; `PhotoThumbnails` is one public component used by the customer tracker, the agent preview and the decision card (admin imports it from `@easyrms/ui/public`); photos are required by the schema and checked again in the service.
- Not done on purpose: retention job and automatic erasure (T-21), audit events (T-23), photos in claim mail (Q9), uploads after submit (Q12).
