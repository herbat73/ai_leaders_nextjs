# Decision record: supplier claims list filters (D15 override for #124)

- Date: 2026-11-10
- Confirmed by: Adam Adamczyk (product owner), in the spec session for `.ai/specs/implemented/2026-11-10-supplier-claims-list-filters.md` (Q1: yes)
- Origin: issue #124, "Filtr do Reklamacje do dostawców".

## Decisions

1. **D15 (research first, no new implementation) is overridden for this one screen only**, as it was for #123 (supplier list) and D17 (rules). The change is UI-only: paging by 10, a status dropdown, a number search (claim number or RMA), a supplier-name search and a creation-day range on `/admin/supplier-claims`, with filtering in memory. No data model, API or dependency change.
2. Other implementation requests stay under D15 until A01 and A04 have data.

## What this does not establish

- Nothing about demand for supplier tooling or about A05 (supplier conversations, E00-T03 #16 stays open).
- In-memory filtering is right while claims number in the tens to low hundreds; revisit (SQL, like the inbox) if the list reaches the thousands.
