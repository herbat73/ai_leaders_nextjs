# Acceptance walkthrough — return customer portal

Run 2026-10-23T21:25:17Z (HEAD 0566376 plus docs). Scratch database `easyrms_walk` (migrated, dropped afterwards), `next dev` on :3611, fake order source, `EASYRMS_RETURN_SHIPPING_FEE=12.50`.
Driven over HTTP (fetch with a cookie jar and the CSRF header) and by reading the rendered HTML of the pages. **No browser was available in this sandbox, so click-through behaviour (step gating, focus movement, retry button) was not exercised; those rely on the pure step-validity tests in core and the stories.**

## Customer
- ✅ wrong e-mail → neutral 404
- ✅ wrong order → same neutral 404
- ✅ undelivered order → trackingUrl, no cookie
- ✅ request without the CSRF header → 403 csrf_rejected
- ✅ outside-window line disabled (outside_window), non-returnable line disabled (not_returnable)
- ✅ lookup typed with another case and spaces → canonical PL-10005 session
- ✅ quote refund via courier = 138,00 − 12,50 = 125,50 zł; store credit +10% = 151,80 zł; exchange has no amount; quote without a session → 401
- ✅ submit → 201 with RMA; same key → 200 same RMA; consumed line → 400 already_claimed; legacy body → 400 validation_error
- ✅ tracker renders; another order's session → 404; no session → redirect to `/`; overview lists the request; wizard renders; `/returns/lookup` → 308 to `/`
- ✅ Wyloguj clears the cookie; repeated bad lookups → 429

## Agent
- ✅ inbox lists the new request; approve → in transit → received → resolved all 200 and each reflected on the tracker; a move from resolved → 409
- ✅ decision card shows the item, the customer comment and the return method
- ✅ exchange submission has no amount; rejection with a note shows the reason on the tracker

**Result: 36 checks, all ✅.**
