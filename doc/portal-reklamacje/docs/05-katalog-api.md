# 5. Katalog API (propozycja)

REST/JSON, prefiks `/api/v1`. Trzy przestrzenie: `/portal/*` (klient, token zamówienia lub sesja konta), `/bo/*` (pracownicy, SSO/OIDC), `/supplier/*` (dostawcy, konto organizacji dostawcy). Webhooki przychodzące: `/hooks/*`.

## 5.1. Konwencje

| Temat | Ustalenie |
|---|---|
| Uwierzytelnienie klienta | `POST /portal/orders/lookup` → `orderToken` (JWT, zakres: 1 zamówienie, 2 h) lub magic link → sesja konta (cookie `HttpOnly`, 30 dni) |
| Uwierzytelnienie pracownika | OIDC (SSO firmowe), role: `AGENT`, `MANAGER`, `WAREHOUSE`, `FINANCE`, `ADMIN` |
| Idempotencja | `Idempotency-Key` dla: `submit`, `refunds`, `replacement-orders`, `labels`, `supplier-claims/*/send` |
| Współbieżność | `ETag` / `If-Match` na `PATCH` zgłoszeń i wersji roboczych → `412` |
| Paginacja | `?page=&size=` → `{ items, page, size, total }`; skrzynka: kursor `?after=` |
| Kwoty | `{ "amount": "349.00", "currency": "PLN" }` |
| Daty | ISO 8601 ze strefą |
| Błędy | RFC 9457 Problem Details z `code` i `errors[{ field, code, message }]` |
| Rate limit | `/portal/orders/lookup`, `/portal/claims/status`: 10/min/IP, CAPTCHA po 5 błędach |

| HTTP | Kod | Zachowanie UI |
|---|---|---|
| 400/422 | `VALIDATION_FAILED`, `WINDOW_EXPIRED`, `NOT_ELIGIBLE` | błędy przy polach + podsumowanie |
| 401 | `UNAUTHENTICATED` | modal „Sesja wygasła” |
| 403/404 | `FORBIDDEN`, `NOT_FOUND` | X-01 lub komunikat neutralny |
| 409/412 | `STATE_CONFLICT`, `STALE_VERSION` | „Zgłoszenie zmieniło się — odśwież” |
| 402/502 | `PAYMENT_PROVIDER_ERROR`, `CARRIER_ERROR` | alert w akcji + ponów / alternatywa |
| 413/415 | `FILE_TOO_LARGE`, `UNSUPPORTED_TYPE` | błąd przy pliku |
| 5xx / sieć | — | stan error ekranu, „Spróbuj ponownie” |

## 5.2. Portal klienta — identyfikacja i konfiguracja

| Metoda | Endpoint | Opis | Ekrany |
|---|---|---|---|
| GET | `/portal/config` | branding, polityka (okno zwrotu, koszt odesłania, bonus bonu), dostępne typy | K-01, Z-04, Z-05 |
| POST | `/portal/orders/lookup` | `{ orderNumber, email \| phone }` → `{ orderToken, orderId }`; `404 ORDER_NOT_FOUND` (neutralny) | K-01, Z-00 |
| POST | `/portal/auth/magic-link` | `{ email }` → `202` (zawsze, bez ujawniania istnienia konta) | K-02 |
| POST | `/portal/auth/magic-link/verify` | `{ token }` → sesja konta | K-02 |
| POST | `/portal/auth/logout` | wylogowanie | nagłówek |
| GET | `/portal/me/orders` | zamówienia klienta `{ id, number, placedAt, deliveredAt, status, total, lines[] }` | K-03 |
| GET | `/portal/me/claims` | zgłoszenia klienta | K-03 |
| GET | `/portal/orders/{id}` | zamówienie z pozycjami | Z-01…Z-06 |
| GET | `/portal/orders/{id}/eligibility` | per typ i pozycja: `{ kind, available, deadline, lines: [{ lineId, eligible, reasonCode }] }` | Z-01, Z-02 |
| GET | `/portal/reasons?kind=` | słownik powodów | Z-03 |
| GET | `/portal/requirements?orderId=&lineIds=&kind=` | wymagane dowody per pozycja: `{ lineId, photos: { min }, video: bool, serial: bool, source: ["PRODUCT","SUPPLIER:CleanAir","RULE:R4"] }` | Z-03 |
| GET | `/portal/exchange-options?sku=` | warianty do wymiany z dostępnością | Z-04 |
| GET | `/portal/pickup-points?query=` | punkty nadania (paczkomaty) | Z-05 |
| GET | `/portal/stores` | sklepy stacjonarne przyjmujące zwroty | Z-05 |

## 5.3. Portal klienta — zgłoszenie

| Metoda | Endpoint | Opis | Ekrany |
|---|---|---|---|
| POST | `/portal/claims/drafts` | `{ orderId, kind }` → `201 { id }` | Z-01 |
| PATCH | `/portal/claims/drafts/{id}` | autozapis kroków (JSON Merge Patch, `If-Match`) | Z-01…Z-06 |
| POST | `/portal/claims/drafts/{id}/attachments` | `multipart { file, lineId, type: PHOTO\|VIDEO\|DOCUMENT }` → `{ id, scanStatus }` | Z-03 |
| DELETE | `/portal/claims/drafts/{id}/attachments/{aid}` | usunięcie pliku | Z-03 |
| POST | `/portal/claims/drafts/{id}/quote` | kalkulacja: `{ options: [{ resolution, available, amount, fee, bonus, note }] }` | Z-04 |
| POST | `/portal/claims/drafts/{id}/submit` | `{ consents }` + `Idempotency-Key` → `201 { claimId, number, status, appliedRules[], label? }` | Z-06 → Z-07 |
| POST | `/portal/claims/status` | `{ number, email }` → `{ claimId, accessToken }` (dostęp do K-05) | K-04 |
| GET | `/portal/claims/{id}` | szczegóły, „co teraz”, pozycje, oś czasu, propozycja | K-05 |
| GET | `/portal/claims/{id}/messages` · POST | wątek wiadomości (1–2000 znaków, ≤ 5 plików) | K-05 |
| POST | `/portal/claims/{id}/responses` | odpowiedź na prośbę o informacje `{ message, attachmentIds[] }` | K-05 |
| POST | `/portal/claims/{id}/offer/accept` · `/decline` | decyzja o propozycji `{ comment? }` | K-05 |
| GET | `/portal/claims/{id}/label` | etykieta PDF / kod QR `{ carrier, code, qrPayload, expiresAt }` | Z-07, K-05 |
| POST | `/portal/claims/{id}/cancel` | anulowanie (do nadania paczki) → `409` gdy już nadana | K-05 |

## 5.4. Back-office — zgłoszenia

| Metoda | Endpoint | Opis | Ekrany |
|---|---|---|---|
| GET | `/bo/claims?status=&kind=&priority=&assignee=&sla=&q=&sort=` | skrzynka z licznikami widoków | B-01 |
| POST | `/bo/claims` | zgłoszenie w imieniu klienta `{ orderId, kind, channel, … }` | Z-00…Z-06 |
| GET | `/bo/claims/{id}` | pełna karta: zamówienie, klient (historia), pozycje, załączniki, reguły, rekomendacja | B-02 |
| PATCH | `/bo/claims/{id}` | `{ assignee, priority, tags, team }` | B-01, B-02 |
| POST | `/bo/claims/{id}/decision` | `{ action: APPROVE\|REQUEST_INFO\|OFFER\|REJECT, resolution?, offer?: { resolution, amount, text }, requested?: [PHOTO,VIDEO,SERIAL,RECEIPT], message, keepItem? }` | B-02 |
| POST | `/bo/claims/{id}/messages` | `{ body, internal: bool, templateId? }` | B-02 |
| GET | `/bo/templates` | szablony odpowiedzi | B-02, B-07 |
| GET | `/bo/claims/{id}/recommendation` | `{ resolution, confidence, rationale[], checks[] }` (asystent AI) | B-02 |
| POST | `/bo/claims/{id}/labels` | generuj / wygeneruj ponownie etykietę | B-02 |
| POST | `/bo/claims/{id}/refunds` | `{ amount, method: ORIGINAL\|STORE_CREDIT\|BANK_TRANSFER }` → `201` / `502 PAYMENT_PROVIDER_ERROR` | B-02 |
| POST | `/bo/claims/{id}/replacement-orders` | `{ lines[], shippingAddress }` → nr zamówienia zamiennego | B-02 |
| POST | `/bo/claims/{id}/service-orders` | wysłanie do serwisu | B-02 |
| POST | `/bo/claims/{id}/close` | zamknięcie z rozwiązaniem | B-02 |

## 5.5. Back-office — magazyn, dostawcy, reguły, analityka, ustawienia

| Metoda | Endpoint | Opis | Ekrany |
|---|---|---|---|
| GET | `/bo/warehouse/inbound?status=EXPECTED\|RECEIVED_TODAY` | oczekiwane i przyjęte przesyłki | B-03 |
| GET | `/bo/warehouse/lookup?code=` | wyszukanie po RMA / numerze etykiety | B-03 |
| POST | `/bo/claims/{id}/inspection` | `{ lines: [{ lineId, qtyReceived, condition, complete, grade, defectConfirmed, disposition, notes, photoIds }] }` | B-03 |
| GET | `/bo/suppliers` | dostawcy z warunkami gwarancji i wytycznymi | B-04, B-07 |
| GET | `/bo/supplier-claims?status=&supplierId=` | reklamacje do dostawców | B-04 |
| POST | `/bo/supplier-claims` | `{ claimId, lineIds[] }` → dodanie do zbiorczej reklamacji (`DRAFT`) | B-02 |
| POST | `/bo/supplier-claims/{id}/send` | wysyłka do dostawcy | B-04 |
| GET | `/bo/rules` · POST · PATCH `/bo/rules/{id}` · DELETE | reguły (warunki, akcja, kolejność, włączona) | B-05 |
| POST | `/bo/rules/simulate` | `{ rule, period: 90d }` → `{ matched, sample[] }` | B-05 |
| GET | `/bo/analytics/summary?from=&to=&kind=` | KPI | B-06 |
| GET | `/bo/analytics/breakdown?dimension=reason\|product\|resolution\|week` | rozkłady | B-06 |
| GET · PUT | `/bo/settings/return-policy` | polityka zwrotów | B-07 |
| GET · PUT | `/bo/templates/{id}` | szablony | B-07 |

## 5.6. Portal dostawcy

| Metoda | Endpoint | Opis | Ekrany |
|---|---|---|---|
| GET | `/supplier/claims?status=` | reklamacje przekazane temu dostawcy | D-01 |
| GET | `/supplier/claims/{id}` | szczegóły z dowodami (zdjęcia, opis, nr seryjny, inspekcja, dowód zakupu) | D-01 |
| POST | `/supplier/claims/{id}/response` | `{ decision: ACCEPT\|REJECT, creditAmount?, creditNoteNo?, reason? }` | D-01 |

## 5.7. Webhooki przychodzące (integracje)

| Endpoint | Źródło | Efekt |
|---|---|---|
| `POST /hooks/carrier` | przewoźnik | `PARCEL_POSTED` → `IN_TRANSIT`; `DELIVERED_TO_WAREHOUSE` → oczekuje na skan |
| `POST /hooks/platform/orders` | platforma sklepu | synchronizacja zamówień, statusów dostawy |
| `POST /hooks/payments/refunds` | bramka płatności | potwierdzenie zwrotu środków |

## 5.8. Model danych — zgłoszenie (skrót)

```jsonc
{
  "id": "clm_8f2", "number": "RMA-2026-00912", "kind": "COMPLAINT",   // RETURN | COMPLAINT | TRANSPORT | MISSING
  "status": "SUBMITTED", "channel": "PORTAL",                           // PORTAL | PHONE | STORE | EMAIL
  "order": { "id": "ord_10482", "number": "TS-10482", "deliveredAt": "2026-10-08", "paymentMethod": "CARD" },
  "customer": { "name": "Anna Kowalska", "email": "anna@example.com", "phone": "+48600700789" },
  "items": [{
    "lineId": "l1", "sku": "SP-X2-BLK", "name": "Słuchawki SoundPro X2", "qty": 1, "unitPrice": "349.00",
    "reason": "INTERMITTENT", "description": "Lewa słuchawka traci połączenie…", "detectedAt": "2026-10-11",
    "serial": "SPX2-88412", "attachments": [{ "id": "att_1", "type": "PHOTO" }, { "id": "att_2", "type": "VIDEO" }]
  }],
  "resolution": { "requested": "REPLACEMENT", "final": null },          // REFUND | STORE_CREDIT | EXCHANGE | REPLACEMENT | REPAIR | PRICE_REDUCTION | SPARE_PART
  "return": { "method": "PARCEL_LOCKER", "pickupPointId": "WAW123M", "label": { "carrier": "Paczkomat", "code": "6620 1145 9921", "expiresAt": "2026-10-27" } },
  "refund": { "method": "ORIGINAL", "account": null, "amount": "349.00" },
  "priority": "NORMAL", "team": "Elektronika", "assignee": null,
  "appliedRules": ["R4"], "responseDueAt": "2026-10-27",
  "recommendation": { "resolution": "REPLACEMENT", "confidence": 0.82 }
}
```

## 5.9. Wymagania niefunkcjonalne

- Upload: zdjęcia ≤ 15 MB (JPG, PNG, HEIC), wideo ≤ 100 MB (MP4, MOV), PDF ≤ 10 MB; max 10 plików na pozycję; skan AV; automatyczna kompresja zdjęć po stronie klienta.
- Portal klienta: LCP < 2,5 s na 4G; działa bez konta; WCAG 2.1 AA.
- Audyt każdej decyzji i zwrotu pieniędzy (kto, kiedy, kwota); limity kwot per rola (np. agent ≤ 2000 zł, wyżej — kierownik/finanse).
- Retencja: zdjęcia i dane zgłoszeń 3 lata (okres przedawnienia), potem anonimizacja.
