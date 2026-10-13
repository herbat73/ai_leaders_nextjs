<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project memory and spec-driven development (SDD)

This repo uses a `.ai/` folder as persistent, file-based memory and spec tracking for AI agents. Everything below is mandatory process, not optional bookkeeping — follow it on every task unless the user explicitly says otherwise.

## `.ai/specs/` — specifications

Specs describe a feature or change before it's built (spec-driven development). Every spec is a single markdown file named:

```
YYYY-MM-DD-slug.md
```

- `YYYY-MM-DD` is the date the spec was written (use the actual current date, not an estimate).
- `slug` is a short kebab-case description, e.g. `2026-10-13-user-avatar-upload.md`.

Lifecycle:

- **New specs** go directly in `.ai/specs/`.
- Once a spec has been fully implemented, move it to `.ai/specs/implemented/` (keep the same filename). This keeps `.ai/specs/` showing only what's pending or in progress.
- If a spec is abandoned, superseded, or otherwise no longer relevant, move it to `.ai/specs/archive/` instead of deleting it.

Before starting work on a feature, check `.ai/specs/` for an existing spec covering it. For any non-trivial feature or change, write a spec there first and get it reviewed/approved before implementing, rather than jumping straight to code.

## `.ai/runs/` — autonomous run logs

Every autonomous AI run (unattended multi-step work, scheduled/looped runs, long background agent tasks) must write a log file to `.ai/runs/` named:

```
YYYY-MM-DD-slug.md
```

Same naming convention as specs: current date + short kebab-case slug describing the run. The log should capture what was attempted, what changed, and the outcome, so a human or another agent can reconstruct what happened without replaying the whole session.

## `.ai/lessons.md` and `.ai/lessons/` — long-term lessons learned

`.ai/lessons.md` is the running index of lessons learned by AI agents working in this repo: bug root causes, gotchas, footguns, things that cost time to figure out, or approaches that turned out to be wrong.

- **Read `.ai/lessons.md` before starting non-trivial work** so you don't repeat a past mistake.
- **After fixing a bug, or whenever you learn something non-obvious worth keeping long-term, append an entry to `.ai/lessons.md`.** Keep entries short; newest at the top.
- If a lesson needs more depth (code samples, multi-part explanation), write it as its own file under `.ai/lessons/YYYY-MM-DD-slug.md` and link it from the index entry instead of inlining everything into `.ai/lessons.md`.

## Keep AGENTS.md up to date (correction feedback loop)

Treat this file as a living document that you improve whenever you get corrected (practice from Boris Cherny's Claude Code tips).

- After the user corrects you or points out a mistake, update this file (or add an entry to `.ai/lessons.md` for narrower, one-off gotchas) with a rule that prevents the same mistake from happening again. If the user says "update your AGENTS.md so you don't make that mistake again", do exactly that.
- Write the rule yourself, concisely and specifically (what to do or avoid, and why). Prefer a short, actionable rule over a long explanation.
- Edit or merge existing rules instead of piling up near-duplicates, and remove rules that turn out to be wrong or obsolete.
- Keep iterating: the goal is for the mistake rate to measurably drop over time.

## Summary

| Path | Purpose | Naming |
|---|---|---|
| `.ai/specs/` | Pending/active specs | `YYYY-MM-DD-slug.md` |
| `.ai/specs/implemented/` | Completed specs | `YYYY-MM-DD-slug.md` |
| `.ai/specs/archive/` | Abandoned/superseded specs | `YYYY-MM-DD-slug.md` |
| `.ai/runs/` | Autonomous run logs | `YYYY-MM-DD-slug.md` |
| `.ai/lessons.md` | Index of lessons learned | — |
| `.ai/lessons/` | Deep-dive lesson writeups | `YYYY-MM-DD-slug.md` |
