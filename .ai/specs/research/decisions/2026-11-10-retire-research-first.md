# Decision record: retire research-first (D20, supersedes D15)

- Date: 2026-11-10
- Owner and confirmer: Adam Adamczyk (product owner), in the `om-discover --refresh` session of 2026-11-10
- Origin: the agent noted that D15 had been overridden three times (D17 rules slice, supplier list filters #123, supplier-claims list filters #124) and asked how Scope → Now should describe the rule. The agent offered three options (keep D15 with narrow exceptions, supersede with a new rule, retire); the owner chose to retire it.

## Decisions

1. **D15 is retired.** Research no longer gates implementation. A01 and A04 having data is no longer a precondition for new work.
2. **Research is treated as closed without the data it was meant to produce.** The tracker closed #13–#16 and #47–#49 on 2026-11-08 (#48 as not planned), with desk-research notes and short team comments (an internal estimate of about 12 PLN per follow-up, 24% accepted as the A04 level, no second sample needed) in place of baselines, supplier interviews or a measured follow-up cost. The matching assumptions stay `untested` or `partly supported`; accepting the risk is a decision, not evidence. (Corrected 2026-11-10: an earlier draft said the owner had paused these tasks; the tracker shows them closed.)
3. **Scope → Now is hardening and polish only**: security hardening and operational improvements on the shipped slices (returns, complaints, supplier claims, rules recommendations). New domain slices (transport damage and missing items, warehouse inspection, supplier portal, uploads/R07) stay in *Later* until the owner moves one into Now.
4. **The app is not live and has no go-live date.** Data from D17 (`return_rule_comparisons`) will stay empty until real agents decide real cases with `EASYRMS_RULES_RECOMMENDATIONS` on.

## What this does not establish

- Nothing about demand: Problems still rest on the team's description plus one 50-case sample (frequency of follow-ups 84%, cost unmeasured).
- Dropping research does not make A01–A07 true; it only records that nobody is testing them now.
- It does not say which items count as "hardening and polish"; the owner decides case by case.

## What would make us revisit it

- A go-live date, a pilot shop, or a request for a new domain slice.
