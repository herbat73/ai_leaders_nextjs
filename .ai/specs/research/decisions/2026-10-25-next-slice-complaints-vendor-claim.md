# Decision record: next slice is complaints with the vendor claim flow

- Date: 2026-10-25
- Confirmed by: Adam Adamczyk (product owner), in an `om-discover --refresh` session
- Origin: the owner chose the direction ("build complaints next, starting with the vendor claim flow"). The agent offered the three choices below and recommended running the supplier conversations in parallel.

## Decisions

1. **Next slice after returns: complaints (kind COMPLAINT) with the vendor claim flow.** The slice has three parts: customer complaint intake (UC-03), the agent decision on a complaint (UC-10 extended), and the claim to the vendor (UC-12).
   - Entry point: complaint intake and vendor claim in the same slice. The owner did not pick "vendor claim on existing returns" or "manual intake only".
2. **Vendor channel: email out, agent records the answer.** The vendor gets the claim by email. The agent records the vendor's reply and any credit note in the system. No supplier login, and D-01 (supplier portal) is out of this slice.
   - The owner did not pick "supplier portal" or "email now, portal later". The data model may still keep the portal possible, but that is not a commitment.
3. **Supplier conversations (E00-T03, #16) run in parallel with spec writing,** as with the returns slice. They are not a precondition for the spec.

## What this does not establish

- No data came with this decision. The owner said the case sample, KPI baselines and supplier notes do not exist yet. Nothing here is evidence of demand.
- A05 (suppliers accept claims through a portal and credit at least 60% of the value) stays untested. Choosing the email channel means it no longer blocks this slice, but it is still unverified for the later portal.
- A01 and A04 stay untested.
- Complaint volume and the share of complaints that reach a vendor are unknown. No source says how many complaints end up as vendor claims.

## Open for the owner (not decided in this session)

- What a claim to the vendor must contain, and the "kontrola wytycznych" (vendor guideline check) from UC-12.
- Who sends the vendor email and from which address (the existing `MailPort` is a log adapter).
- How a credit note is recorded and who owns the money flow.
- The R04 consequence: no answer to the customer within 14 days counts as acceptance. Legal needs to confirm how the system tracks it.
