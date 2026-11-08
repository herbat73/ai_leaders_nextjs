# Desk research: what suppliers typically ask for when a shop registers a complaint (Allegro context)

- Date: 2026-11-08
- Issue: #16 (E00-T03), assumption A05, question Q16
- Tag: `[DESK RESEARCH]`. This is **not** `[INTERVIEW]`: no supplier was spoken to, and it does not satisfy the "Done when" of #16.
- Method: web search (Polish sources), 2026-11-08. Sources are supplier RMA forms, e-commerce guides and Allegro community threads. No Allegro policy page for supplier-side (B2B) complaints was found.

## What was found

Typical fields a supplier / distributor RMA form asks for (from three public forms: a distributor, a B2B retailer, a manufacturer):

| Field | Evidence |
|---|---|
| Company data of the reporting shop (name, NIP) | Komputronik Biznes form requires the recipient NIP |
| Purchase invoice number and date | Komputronik Biznes (required); ALSTOR (invoice or warranty number) |
| Product name and quantity | e-commerce complaint form templates |
| Serial number | ALSTOR, Komputronik Biznes, ACTE; ties the claim to one physical unit |
| Defect description (what, how it shows, when first noticed) | all of the above; required at ALSTOR |
| Photos: whole item, defect close-up, rating plate with serial number | RMA system guidance; ALSTOR accepts JPEG/PNG/PDF and rejects archives |
| Requested remedy (repair, replacement, refund) | e-commerce complaint form templates |

Transport damage: carrier damage protocol and photos of the outer package, the item and the filler. Forum threads mention a 7-day window for the protocol; Allegro Delivery moderators say the protocol is not needed there but photos help. These are user/community statements, not official rules.

Channels seen: web RMA form (ALSTOR, Komputronik Biznes), e-mail to a service address (ACTE). EDI was not seen anywhere in this search.

Dropshipping: a wholesaler has no statutory duty to take returns from the shop's customers; in practice it asks the shop to collect photos / defect description and may ask for the item for verification (industry article, low confidence).

## What this means for EasyRMS

- The claim e-mail sent by UC-12 (D13) today carries a subject and body snapshot. Against these forms it may be missing: serial number, invoice number and date, shop NIP, and photo attachments. This is a hypothesis to check, not a finding about any real supplier.
- The portal-vs-e-mail question (A05) is partly informed: public supplier channels are web forms or e-mail, so an e-mail first step (D13) matches what is seen. Whether suppliers would use a portal D-01 is untested.
- Nothing here speaks to the second half of A05 (crediting at least 60% of value). No data was found.

## Limits

- Sources are public forms of three companies and general guides, not the suppliers of the shop in the 50-case sample.
- B2B distributor-to-reseller complaint terms (deadlines, document duties) were not found; they depend on each supplier's own terms.
- Generic complaint templates are consumer-to-shop, so only the supplier forms count as direct evidence.

## Still needed for #16

Interviews with 2-3 key suppliers (as roles) on channel, format and share of value credited. Suggested questions drawn from the above: which of the fields in the table do you require, do you accept photos by e-mail, do you assign your own RMA number, how long do you take to answer, what share of claim value do you usually credit.

## Sources

- ALSTOR RMA form: https://alstor.pl/serwis/zgloszenie-rma/
- Komputronik Biznes RMA form: https://www.komputronikbiznes.pl/strefa-klienta/formularz-rma/
- ACTE RMA form: https://acte.pl/formularz-rma
- Studio RMA.net, defect photos: https://reklamacje.net.pl/zdjecia-wady/
- Allegro community, complaint threads: https://spolecznosc.allegro.pl/t5/allegro-delivery/w-jaki-spos%C3%B3b-z%C5%82o%C5%BCy%C4%87-reklamacj%C4%99-dostawy-przy-allegro-delivery/td-p/1039225
- iFirma, complaint form contents: https://www.ifirma.pl/blog/formularz-zwrotu-i-formularz-reklamacji-w-sklepie-online-jak-je-stworzyc-wzory-do-pobrania/
