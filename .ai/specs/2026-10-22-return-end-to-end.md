# Return end-to-end: customer wizard, status tracking, agent decision

## 📝 TLDR
Customers of the shop and the support agents who handle their returns need one place where a return is requested with complete data, tracked, and decided. Today (current behavior) `/` has a minimal form (order number, e-mail, free-text reason) and `/admin/returns` lists requests with five statuses (`requested`, `approved`, `rejected`, `received`, `refunded`). Proposed (future behavior): the first scope slice of the portal concept — UC-01 identify order, UC-02 return wizard, UC-06 status tracker, UC-10 agent decision — built by evolving `ReturnRequest` toward the `Claim` model, so agents stop chasing customers for missing data.

## ❓ Open Questions
Decisions already made in the brief and not reopened here: single Next.js app with route per shell (Q03), evolve `ReturnRequest` by migration with `kind` and new statuses (Q04), `MANAGE_RULES` permission on `AGENT` (Q05), read-only K-05 for agents (Q06), status tracker banners (Q09), 2-day internal reply target (Q10), shop platform + e-mail only (Q11), rules only and no AI recommendation (Q12), first slice = UC-01/02/06/10 (Q13).

- **Q1 — Scope split.** The slice bundles a customer side (UC-01/02/06) and an agent side (UC-10). Each is useless alone, but the agent side can ship first as a status model + decision screen on the existing form. One spec or two? Proposed: one spec, phased agent side first.
- **Q2 — Order source.** Q11 says the shop platform is the source of orders, but no platform is named and no API exists. Which platform, or do we build a `OrderLookup` port with a seeded/fake adapter now and a real adapter later? Proposed: port + fake adapter.
- **Q3 — Items in the first slice.** Q04 defers item tables, yet UC-02 (Z-02/Z-03) selects items and reasons per item. Include `claim_items` now, or keep one reason per claim and add items next? Proposed: include items (otherwise the wizard is not UC-02).
- **Q4 — Resolution choice and quote (Z-04).** Include the customer choosing refund / voucher +10% / exchange and the computed amount? Money stays manual (Q08, Q11). Proposed: yes, record the choice and amount only.
- **Q5 — Customer identification (UC-01).** Guest lookup (order number + e-mail → 2 h order-scoped session) only, or also e-mail magic link (D05, K-02/K-03)? Proposed: guest lookup only; magic link in a later slice.
- **Q6 — Auto-acceptance (R08, return ≤ 150 zl).** The rules engine is out of scope. Hard-code R08 as one service rule, or have every return go to an agent? Proposed: no auto-acceptance; every return goes to an agent.
- **Q7 — Shipping states.** With no carrier or warehouse integration, who moves a return through `APPROVED → IN_TRANSIT → RECEIVED → RESOLVED`? Proposed: the agent, manually, in `/admin/returns`.
- **Q8 — Back-office access.** `/admin` has no authentication today. Is login for agents (D05: SSO/OIDC) part of this slice or a prerequisite spec? Proposed: separate prerequisite spec; this slice keeps the current access model and flags it as a risk.

## 📝 Problem Statement
Support handles returns by e-mail and phone and repeatedly asks for order number, photos and serial numbers (brief, Problems). The belief that this follow-up is the main cost is an assumption (A01), untested until the ~50-case sample is collected, and the KPI baselines (Q02) are still being gathered. The spec therefore treats completeness of data as a hypothesis to measure, not a proven problem.

## 📝 Proposed Solution
Evolve the existing `returns` concept instead of adding a parallel one: a migration adds `kind` (default `RETURN`) and the 9-status model, with `requested` mapped to `SUBMITTED`; the wizard (K-01, Z-01…Z-07) and tracker (K-04/K-05) live on the public side with Tailwind; the agent inbox and decision card (B-01/B-02) live under `/admin/returns` with shadcn/ui. Alternatives considered: a new `Claim` entity beside `ReturnRequest` (rejected in Q04 — duplicates the concept) and three separate apps (rejected in Q03 — conflicts with AGENTS.md).

## 📝 Decisions in play
Relies on: R01 (return window), R06 (non-returnable products), R12 (voucher +10%), R13 (one claim = one type, one order), R14 (neutral lookup error, throttling), R15 (rejection reason ≥ 30 chars, cancel until shipped), R16 (retention, WCAG 2.1 AA), D02, D03, D06 (narrowed to the slice by Q13). Owner for confirmation: Adam Adamczyk; legal for R01. Supersedes: none.
