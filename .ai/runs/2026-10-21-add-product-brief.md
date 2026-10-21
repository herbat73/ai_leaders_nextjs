# Execution plan — add product brief

- Brief: `add product-brief`
- Engine: om-auto-create-pr (steps: 5, --loop: no)
- Branch: `feat/add-product-brief` → base `main`

## Goal

Land the `aa-product-brief` skill and the EasyRMS product brief it produced (`.ai/specs/product-brief.md`, synthesized from `doc/portal-reklamacje`) on `main`, so `om-discover`, `om-brainstorm`, `om-spec-writing` and `om-backlog` can read a shared product context.

## Scope

The content already exists on the local `skills-update` branch (commits `6967ae2`, `305e01e`, `d4f2acd`); this run carries only the product-brief parts onto a clean branch off `main`:

- `.agents/skills/aa-product-brief/**` — skill, references, `count-coverage.mjs` helper.
- `.claude/skills/aa-product-brief` and `.grok/skills/aa-product-brief` — symlinks to `.agents/skills/aa-product-brief`, matching how every `om-*` skill is exposed to both agents.
- `.ai/specs/product-brief.md` — the brief. It keeps the fixed name `product-brief.md` (not `YYYY-MM-DD-slug.md`) because every `om-*` consumer reads `${SPECS_DIR}/product-brief.md`; it is a product-context record, not a feature spec.
- `.ai/lessons.md` — the Windows symlink lesson; without `core.symlinks=true` the new skill link checks out as a text file and the skill is invisible.
- A `node:test` unit test for `count-coverage.mjs` (no new dependency).

### Non-goals

- `.idea/*` and `.ai/cezar/*` from `skills-update` — local IDE/tool state, not product content.
- Editing the brief's content, ids, decisions or open questions — they stay `proposal` until an owner confirms them (brief Q01).
- Wiring the discovery layer (`om-setup-discovery-pipeline`, `SDLC.md` Definition of Ready) — a separate decision.
- Any application code under `packages/`.

## Implementation Plan

### Phase 1: Skill

1. Add the `aa-product-brief` skill files under `.agents/skills/aa-product-brief/`.
2. Link the skill into `.claude/skills/` and `.grok/skills/` as relative symlinks.
3. Add a `node:test` unit test for `scripts/count-coverage.mjs`.

### Phase 2: Brief

1. Add `.ai/specs/product-brief.md`; check its `Coverage:` header against `count-coverage.mjs`.
2. Add the Windows symlink lesson to `.ai/lessons.md`.

## Risks

- Symlinks: Windows clones with `core.symlinks=false` see the skill link as a text file (mitigated by the lesson entry).
- `npm run lint` (`eslint .`) also lints `.agents/**/*.mjs`; the helper and its test must pass it.
- The brief is written in Polish and rests on assumptions (A01–A07); the PR ships it as a draft product context, not approved decisions.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Skill

- [x] 1.1 Add the aa-product-brief skill files — d55ab8c
- [x] 1.2 Link the skill into .claude and .grok — 5c14134
- [x] 1.3 Unit test count-coverage.mjs — 90c453c

### Phase 2: Brief

- [x] 2.1 Add the EasyRMS product brief — 3a6b8e1
- [x] 2.2 Add the Windows symlink lesson — 25f29bc
- [x] Post-review fix: run `npm audit` via `npm_execpath` so the gate works on Windows — 8f1e708
- [x] Post-review fix: document `product-brief.md` as a fixed-name exception in `AGENTS.md` — f008ad9
- [x] Post-review fix: record the Windows `spawnSync("npm")` lesson — 50a9ddc
