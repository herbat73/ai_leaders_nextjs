# Decision record: supplier list filters (D15 override for #123)

- Date: 2026-11-10
- Confirmed by: Adam Adamczyk (product owner), in the spec session for `.ai/specs/2026-11-10-supplier-list-filters.md` (Q1: "implement, as it is small improvement")
- Origin: issue #123, "Add filter for suppliers list".

## Decisions

1. **D15 (research first, no new implementation) is overridden for this one screen only**, as D17 was for the rules slice. The change is UI-only: paging by 10, a status dropdown and name / e-mail search on `/admin/suppliers`, with filtering in memory. No data model, API or dependency change.
2. Other implementation requests stay under D15 until A01 and A04 have data.

## What this does not establish

- Nothing about demand for supplier tooling or about A05 (supplier conversations, E00-T03 #16 stays open).
- In-memory filtering is right for a directory of tens of suppliers; revisit (SQL) if the list reaches the thousands.
