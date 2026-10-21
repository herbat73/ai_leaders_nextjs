# Brief template

Headings from `## Decision summary` through `## Collection plan` match `om-discover`'s `product-brief.md`, so `om-brainstorm`, `om-spec-writing`, `om-backlog`, `om-code-review` and `om-ux-review-pr` can read it. The two concept sections (`## Concept surface`, `## Traceability`) are additive — keep them, other skills ignore them. Write in the concept's language (or `--lang`); keep headings in English so consumers can find them.

Ids: keep the concept's own ids (`UC-02`, `K-01`, `R1`) and cite them; brief-level ids (`D01`, `R01`, `N01`, `A01`, `Q01`) are stable across `--refresh`. When the concept already uses `R1`… for rules, map them: `R01` row → "Concept rule R1".

```markdown
# {Product name} — product brief

- Date: {YYYY-MM-DD}
- Mode: own (from early concept); Owner: {person running the session}; Pass: concept synthesis (aa-product-brief)
- Evidence basis: {concept docs + mockup; say whether any real research/data is cited; name the most consequential untested belief}
- Coverage: {n} claims — {a} sourced (interview {i}, data {d}, document {c}, product {p}, benchmark {b}), {s} synthetic, {u} assumed; {k} entries on the collection plan
- Synthetic hypotheses outside Coverage: {count}
- Definition of Ready signed by: not yet signed — {what is missing}; ready for: {research | spec writing of Now scope}
- Sources: {concept-dir}/README.md, {concept-dir}/docs/…, {concept-dir}/mockup/

## Decision summary

{3–5 sentences: what the concept proposes, for whom, what is decided vs. proposed, the biggest gap or contradiction, the next action.}

## Vision

{One sentence — the team's intended direction.} `[DOCUMENT]` {source}

## Target group and stakeholders

- Customer (pays): … `[tag]` {source}
- User (uses): {one line per role from the users doc} `[tag]` {source}
- Stakeholders: … `[tag]` {source}
- Decider for scope decisions: {name/role or Q id}

## Problems, with evidence

- {Specified problem} `[DOCUMENT]` {source}
- {Claim it is real/frequent for users} `[ASSUMPTION]` → A{nn}

## Product and how it stands out

- What it is: … `[DOCUMENT]` {source}
- What makes it different: … `[tag]`

| reference | what it does well | where it falls short for our users | checked on | link |
|---|---|---|---|---|

## Goals and success criteria

- Business goal: … `[tag]` {source or Q id}
- User outcome: … `[tag]`
- Primary metric, baseline today, threshold, date: {from targets doc; missing baseline = unknown}
- What must not get worse: …

## Scope

- **Now:** {use cases / apps in the first release, by id}
- **Later:** {deferred use cases, by id}
- **Not doing:** see Non-goals

## Concept surface

| App / shell | Users | Screens (ids) | In mockup |
|---|---|---|---|

- Use cases: {count} ({id list}); statuses: {status model in one line}
- Simulated in mockup: {backend, SSO, payments, AI…}

## Traceability

- Covered end-to-end (UC → screen → mockup): {n}/{total}
- Gaps: {one line each, most consequential first; full matrix in product-brief-traceability.md when --matrix}
- Doc ↔ mockup contradictions: {one line each with both values → Q id}

## Domain glossary

| Term | Meaning | Owned by | Visible to |
|---|---|---|---|

## Key flows

- Current state: {only if the concept describes today's process} `[tag]`
- Future state: {main flows of Now scope, by UC id, steps referencing screen ids} `[DOCUMENT]`

## Business rules

| Id | Rule | Applies to | Source | Status | Review by | Required path to change | Owner | Supersedes |
|---|---|---|---|---|---|---|---|---|

## Non-goals

| Id | We are not building | Why | Owner | Status | Review by | Required path to change | Source | Supersedes |
|---|---|---|---|---|---|---|---|---|

## Decisions

| Id | Date | Decision | Why | Owner | Status | Review by | Required path to change | Source | Supersedes |
|---|---|---|---|---|---|---|---|---|---|

## Riskiest assumptions

| Id | Assumption | Importance | Evidence today | If false | Smallest test | Owner | By when | Result |
|---|---|---|---|---|---|---|---|---|

## Kill criteria

{What result would stop or reshape this; or "not decided" with who should decide.}

## Hypotheses to test

{Only [SYNTHETIC] claims, if any; otherwise "none".}

## Open questions

| Id | Question | Blocking | Who can answer | Status |
|---|---|---|---|---|

## Definition of Ready addendum (own)

{Is there real support for Problems and Target group? Which Now decisions are open? What is ready: research, spec writing, or implementation planning.}

## Collection plan

{Material needed for the next decision: who, how, owner. Typical: interviews with the target role, current return/claim volumes, baseline for each KPI.}
```

## Traceability file (`--matrix`)

```markdown
# {Product name} — traceability

| Use case | Actor | Screens (docs) | Mockup route / file | Rules | Status |
|---|---|---|---|---|---|
| UC-02 | Customer | K-01, Z-01…Z-05 | `#/zgloszenie/1` → `mockup/src/screens/wizard.ts` | R1, R2 | covered / partial / missing |

## Screens not tied to a use case
## Mockup screens not in the screen map
## Doc ↔ mockup differences
```
