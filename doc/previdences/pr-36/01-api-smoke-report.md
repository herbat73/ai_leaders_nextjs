# PR 36 — API smoke report (complaints and vendor claim)

Date: 2026-10-25. Dev server on :3100 against a separate database (`easyrms_qa`, all migrations applied), fake order adapter, `EASYRMS_MAIL_TRANSPORT=smtp` pointed at a local sink that records each message. One agent (with `MANAGE_RULES`) created through `npm run agent:create`, invite accepted and logged in through the API.

| Step | Request | Result |
|---|---|---|
| Quote a complaint refund | `POST /api/returns/quote` `kind: complaint`, order PL-10001, line L1 | 200, 349,99 zł, fee 0,00 zł (no shipping deduction) |
| Submit a complaint | `POST /api/returns` `kind: complaint`, replacement, serial `SN-4242` | 201, `RMA-2026-00001`, no amount |
| Replay the same key | same body | 200, same RMA |
| Return the same unit | `POST /api/returns` (return) | 400, `items.L1: already_claimed` (shared pool) |
| Inbox | `GET /api/returns?kind=complaint` | the complaint with `daysLeft: 14` |
| Move to received without a finding | `PATCH` `received` | 400, `fieldErrors.defectConfirmed` |
| Move to received with a finding | `PATCH` `received` + `defectConfirmed: true` | 200 |
| Claim for an unknown supplier | `POST /api/supplier-claims` | 400, `supplierId: unknown` |
| Create a supplier / duplicate name in another case | `POST /api/suppliers` | 201 / 409 `fieldErrors.name` |
| Create the claim | `POST /api/supplier-claims` | 201, `SC-2026-00001`, status `sent` (delivered through SMTP) |
| Second claim for the complaint | same | 409 `claim_exists` |
| Accept above the claimed value | `PATCH` accepted, 9999,00 | 400, `creditAmount: above_claim_value` |
| Accept / reopen / credit | `PATCH` | 200 accepted (349,99) / 409 `Cannot move from accepted to rejected` / 200 credited |

The supplier message as received by the sink: sent from the shared address `zwroty@sklep.example`, `To` the supplier, `Reply-To` the agent, Polish text with RMA, order, product, serial number, defect and the agent's note, and **no customer e-mail address**. The four customer mails of the flow went to the order's address.

Not covered here: the UI screens (the QA screenshots are attached to the PR).
