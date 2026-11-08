# KPI baselines: what is known today for WISMR, vouchers/exchanges, 14-day answers and mobile share

- Date: 2026-11-08
- Issue: #15 (E00-T02), assumptions A02, A03, A07, question Q02
- Tags: `[DATA]` = computed from the shop's own 50-case sample (`rules_cases/real_data_for_rules.csv`). `[BENCHMARK]` = public figures about other shops, **not** this shop's baseline. `[NOT MEASURABLE]` = no data available to us today.
- Method: the sample CSV was recomputed with a script; public figures come from web searches on 2026-11-08 (secondary sources, not verified against the original studies).
- Out of scope (as in the issue): choosing the primary metric or its date (Q02 stays with the owner), building analytics.

## Summary

| KPI | Shop baseline today | Source and period | Status |
|---|---|---|---|
| WISMR contacts per case (A07) | not known | none; the sample has no contact-type field | `[NOT MEASURABLE]` from what we hold; needs helpdesk / mailbox tagging |
| Share of vouchers/exchanges among returns (A03) | not known | none; sample `outcome` has no remedy type | `[NOT MEASURABLE]` from the sample; needs the order/refund system |
| Complaints resolved within 14 days (A07) | 4 of 14 complaints = 29% (Wilson 95% CI 12-55%) as a floor; at most 6 of 14 = 43% | `[DATA]` 50-case sample, 2026-07-01 to 2026-10-24, state as of the sample date 2026-10-26 | measured, as *resolved* not *answered* |
| Mobile share of traffic / contact page (A02) | not known | none | `[NOT MEASURABLE]` from what we hold; needs shop analytics |

## 1. Complaints within 14 days `[DATA]`

Sample: 14 complaints (kind `complaint`), opened 2026-07-03 to 2026-10-24. Days = `resolved_on - opened_on`.

- Resolved in 14 days or fewer: 4 (S10 14 d, S23 3 d, S26 12 d, S46 4 d).
- Resolved after more than 14 days: 5 (S02 15, S06 16, S13 19, S18 21, S33 15).
- Still open on 2026-10-26 and already older than 14 days: 3 (S30, S36, S40).
- Still open and younger than 14 days: 2 (S43, S50); their outcome is not yet decided.
- Baseline: **29% (4/14)** if both young open cases miss the deadline, **43% (6/14)** if both make it. The 95% Wilson interval for 4/14 is 12-55%.
- Median days to resolve a closed complaint: 15 (from `real_data_for_rules.md`).

Caveats:
- The CSV records the day a case was *resolved*, not the day the customer got a first *answer*. The KPI as the brief states it ("answered within 14 days") is not what is measured here; this is a stricter proxy, so the true answered-in-14-days share is higher or equal.
- n = 14, one small shop, undocumented sampling (Q21). Do not read the 29% as more than "most complaints in this sample took longer than 14 days to close".
- Polish consumer law requires a reply to a consumer complaint within 14 days, otherwise the complaint is treated as accepted (Art. 7a of the consumer rights act). Not checked against the statute text in this note; confirm with legal (R02/R04 wording is already an open item in the brief).

## 2. WISMR contacts per case `[NOT MEASURABLE]`

- The sample has `messages_exchanged` and `follow_up_requests` per case but no field that says what a message was about, so "where is my return?" contacts cannot be counted. The shop's e-mail and phone history is outside the repo.
- What is needed: tag or search 1-2 months of the shop mailbox and phone log (and Allegro messages) for status questions after a return was filed; denominator = number of return and complaint cases in the same period. BI/e-commerce owns this.
- `[BENCHMARK]` (other shops, not comparable until the definition matches): WISMO ("where is my order") is quoted at roughly 20-50% of e-commerce support contacts, often 25-40%. Nobody traced a primary study; one vendor says the common 40% goes back to a Forrester figure repeated by a marketing blog. WISMR is defined two ways ("where is my refund" vs "where is my return"). Also, shares of contacts and contacts per order are different metrics. Treat as an order of magnitude only, not as a baseline or a target check.
  - https://www.ship24.com/blog/why-common-wismo-statistics-are-hard-to-verify
  - https://amio.io/blog/wismo-ecommerce
  - https://branvas.com/blogs/news/wismo-benchmarks-where-is-my-order

## 3. Voucher / exchange share of returns `[NOT MEASURABLE]`

- The sample `outcome` is approved / partial / rejected / cancelled / open for all 16 returns (10 approved, 3 cancelled, 3 open), with no refund method, so how many were paid as voucher, exchange or money is unknown.
- The shop has no voucher flow today as far as the brief says (R12 is a proposal), so the true value may be close to 0 for vouchers and only exchanges exist. Ask the owner.
- What is needed: for the same period, split returns by remedy (refund / exchange / voucher) from the order system or the Allegro return records; denominator = returns, not orders.
- `[BENCHMARK]` (apparel-heavy, vendor material): one returns study splits processing as refunds 46%, exchanges 29%, store credit 25% (shares may overlap); exchange-conversion of 12-18% in refund-led flows and 35-55% in exchange-first flows is labelled "directional". Working range 30-50% for exchanges plus store credit in apparel. The brief's target (at least 25% instead of a money refund) sits inside this range, but the range is for other categories and says nothing about this shop. A03 stays `untested`.
  - https://www.shipaid.com/blogs/ecommerce-tips/exchange-rate-vs-refund-rate-returns-metric-retained-revenue
  - https://www.clickpost.ai/en-us/blog/returns-vs-exchanges

## 4. Mobile share `[NOT MEASURABLE]`

- No device data exists in the repo or the sample. Needed: share of sessions (or of contact-page sessions) by device class from the shop's analytics, last 3 months, same period as above. Allegro-side traffic is not the shop's own and should be reported separately.
- `[BENCHMARK]` Polish e-commerce, Criteo figures (year not stated in the secondary article): mobile 15-17% of *transactions* (smartphones about 7.5%), best sellers 22%. This is share of purchases, not of traffic, and traffic share is normally much higher than purchase share. Gemius "E-commerce 2025" and the e-Izba "Kupuję wygodnie 2025" report have mobile chapters, but no figure was reachable. Not usable for the A02 decision as is.
  - https://www.benchmark.pl/criteo-raport-state-of-mobile-commerce-7263105816113729a
  - https://www.przelewy24.pl/en/news/ecommerce-2025-online-shopping-trends-polish-consumers

## What this means for the KPIs (A07)

- Only one of the four baselines can be stated today, and only as a proxy (29-43% of complaints resolved within 14 days). The 7 KPIs still lack a baseline for WISMR, voucher/exchange share and mobile share.
- A07 stays `untested`; A02 and A03 stay `untested`. The public figures do not change them; they only show the targets are not absurd for the voucher/exchange share, and unknown for the others.
- Q02 stays open for the primary metric and date (owner's decision).

## Still needed from BI / e-commerce (owner, date not set)

1. Mailbox / phone / Allegro message tagging for status questions after a filed return, for one agreed period (WISMR per case).
2. Returns by remedy for the same period (refund / exchange / voucher).
3. Date of first reply per complaint, to replace the "resolved" proxy.
4. Device split of sessions on the shop and on its contact/returns page, last 3 months.
Propose using the same period as the 50-case sample (July-October 2026) so numbers can be compared.
