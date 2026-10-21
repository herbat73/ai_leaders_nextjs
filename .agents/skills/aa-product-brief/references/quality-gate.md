# Quality gate (run before step 6)

- [ ] Every substantive line has one tag and a `file:section` or `path:line` pointer.
- [ ] No user need, frequency, value or KPI baseline tagged as sourced unless the concept cites real research or data.
- [ ] Concept ids (`UC-xx`, screen ids, rule ids) copied exactly; spot-check five against the source.
- [ ] Every doc ↔ mockup contradiction found in step 4 has a Q id; none silently resolved.
- [ ] Conflicts with `AGENTS.md`/`CLAUDE.md` decisions raised as Q ids.
- [ ] Now/Later split stated by use-case id; if the concept doesn't define it, Scope Now is `proposal` and a Q asks the owner.
- [ ] Targets: each has a metric and either a measured baseline or "baseline unknown".
- [ ] No duplicated prose — rules worded once in Business rules, referenced elsewhere.
- [ ] No verbatim demo personal data (e-mails, names, order numbers).
- [ ] Coverage line produced by `scripts/count-coverage.mjs` on the final text (no hand counts).
- [ ] Prose outside tables under ~800 words; Business rules > ~15 rows or > ~6 traceability gaps → full lists in the traceability file.
