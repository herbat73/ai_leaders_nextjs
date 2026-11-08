# Decision record: rules recommendations slice (D17)

- Date: 2026-11-08
- Confirmed by: Adam Adamczyk (product owner), in the spec session for `.ai/specs/2026-11-08-rules-engine-recommendations.md` (answers: build now, one spec in phases, recommend-only, recommended defaults for the rest)
- Origin: the owner asked for epic #31 (E04) to start with the rules engine R08-R10.

## Decisions

1. **D15 is overridden for this slice only.** The rules engine is wired into the agent's decision card as a recommendation; it decides nothing and mails nothing (R08 stays "not auto-approved").
2. **Measure, do not automate.** Every approve/reject decision stores what the engine recommended and whether the agent followed it (`return_rule_comparisons`), behind `EASYRMS_RULES_RECOMMENDATIONS` (default off). Followed and disagreed counts per rule are the first real data for A04.
3. R08/R09 thresholds stay constants (D16). R10a has no live match until a transport kind exists; R10b waits for uploads (R07).

## What this does not establish

- Nothing about demand or the false-acceptance rate: no data yet. The sample's 24% (14-37%) and 1 false acceptance in 12 still stand alone (Q21 open).
- Agreement with a recommendation is ambiguous (anchoring); read it together with the disagreements per rule, not as proof the rules are right.
- Phases 2-3 (#109 inbox badges, #110 rules page) are not part of this decision's build; they follow in their own PRs.
