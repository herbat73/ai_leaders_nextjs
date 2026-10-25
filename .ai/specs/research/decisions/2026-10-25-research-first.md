# Decision record: research first, no new build

- Date: 2026-10-25
- Confirmed by: Adam Adamczyk (product owner), in an `om-discover --refresh` session
- Origin: the agent recommended it; the owner chose it over transport damage, warehouse inspection and the rules engine.

## Decisions

1. **Next step is research only (E00, #13–#16):** case sample (A01, A04, Q02), KPI baselines (A02, A03, A07), supplier conversations (A05). No new implementation slice until A01 and A04 have data.
2. **Q16–Q19 are closed as answered by the build (PR #36).** Legal wording for R02/R04, the shipping-cost rule (D14) and customer-data retention before real mail stay open and non-blocking.

## What this does not establish

- No research material exists yet (owner confirmed). Nothing here is evidence of demand.
- Whether the shipped complaint flow matches what suppliers expect is unverified.
