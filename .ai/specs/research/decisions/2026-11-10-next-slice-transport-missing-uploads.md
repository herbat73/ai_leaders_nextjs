# Decision record: next slice is transport damage and missing items, with file uploads (D21)

- Date: 2026-11-10
- Owner and confirmer: Adam Adamczyk (product owner), in the `om-discover --refresh` session of 2026-11-10
- Origin: after D20 retired D15, the owner asked to pick the next slice. The agent offered four *Later* slices (transport damage and missing items, transport damage only, warehouse inspection, supplier portal) and noted the sample data below. The owner chose the first, and chose to include file uploads (R07) in it. The agent's offer to keep text-only evidence, or to defer the upload choice, was declined.

## What the agent showed the owner (facts, from the 50-case sample)

`[DATA]` `real_data_for_rules.csv`, one small shop, 2026-07 to 2026-10, sampling undocumented (Q21): 11 transport-damage cases (10 with a follow-up, median 7 messages, median value 799 PLN) and 9 missing-item cases (8 with a follow-up, median 4 messages, median value 130 PLN), 20 of 50 cases; the app handles only returns and complaints.

## Decisions

1. **Transport damage (UC-04) and missing items (UC-05) move from *Later* into Now**, as one slice. R03 (14-day window, configurable 1-30) and Q14 (at least 1 photo for transport damage) apply.
2. **File uploads (R07) are part of this slice**, replacing text-only evidence for it. This brings in file storage, malware scanning (AV), the allowed types and sizes, and retention (R16, still deferred), which are not yet decided.
3. The slice still has no go-live date and the app is not live (D20).

## What this does not establish

- Demand: the 40% share is from one undocumented sample. That the portal reduces follow-ups for these kinds (A01) is still an assumption; there is no cost data.
- Nothing about how uploads will be stored, scanned or retained; those are open questions (Q23) and need a security review before a public launch.

## What would make us revisit it

- A threat model for uploads finding a risk the owner will not accept, or a legal answer on retention (R16) that changes the design.
- A pilot shop whose case mix differs from the sample.
