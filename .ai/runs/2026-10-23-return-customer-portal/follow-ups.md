# Follow-up issues to open (spec Phase 3 step 3)

Not opened automatically (creating tracker issues is outward-facing); each is ready to file with `om-prepare-issue`.

1. **Real order-platform adapter** for the `OrderLookup` port (the fake adapter fails closed in production, so production has no working customer flow).
2. **SMTP adapter** for `MailPort` (today a log-only mock; customers get no notifications).
3. **CAPTCHA after five lookup attempts** (R17/R14 deferred).
4. **Data retention and anonymisation (R16)**, with legal: customer e-mail and item comments are kept indefinitely.
5. **Agent preview of the customer tracker** (brief Q06), deferred with agent authentication.
6. **E-mail-link (magic link) login** to replace the 2 h guest session (Q5).
7. **Security review of R17's limits and D08 — gate before public deployment** (owner: security). Also covers the in-memory limiter being per process, `EASYRMS_TRUST_PROXY` semantics and the missing agent authentication.
8. Small: `POST /api/returns/submit` answers 405 (not 404) because `/api/returns/[id]` captures it; `conflict` has no core customer error key (mapped locally in the wizard); the lookup limiter is checked before and hit after the platform call, so a burst of in-flight lookups can slightly exceed 10/min.
