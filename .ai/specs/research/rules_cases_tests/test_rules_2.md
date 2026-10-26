# Próba przypadków — follow-upy i pokrycie regułami [DATA]

- Data: 2026-10-26
- Liczba spraw (n): 100
- Okres (miesiące): styczeń 2026 – październik 2026
- Kanały: E-mail: 56, Telefon: 44
- Właściciel: kierownik obsługi klienta
- Źródło: anonimowa próba, zebrana z historii e-maili i rozmów telefonicznych

## A01 — follow-upy są głównym kosztem obsługi

- Sprawy z co najmniej jednym dopytaniem: **66% (56%–75%)** (przedział ufności 95%, Wilson)
- Wiadomości w sprawie: mediana 4, 75. percentyl 6,25
- Dopytania w sprawie: mediana 1
- Proponowana linia odcięcia z briefu: poniżej ok. 20% hipoteza upada (propozycja, nieuzgodniona z właścicielem).

## A04 — co najmniej 35% spraw da się rozstrzygnąć prostymi regułami

- Rozstrzygnięte regułą (R08, R09), wszystkie sprawy: **18% (12%–27%)**, próg hipotezy 35%
- Rozstrzygnięte regułą, tylko sprawy zamknięte: 21% (13%–31%)
- Zgodność z realnym wynikiem (sprawy rozstrzygnięte regułą): zgodne 12, fałszywe akceptacje 3, inne 3
- Wysoki udział spraw rozstrzygniętych regułą nie wspiera A04, jeśli towarzyszy mu wiele fałszywych akceptacji.

| Reguła | Dopasowania | Rozstrzyga |
| --- | --- | --- |
| R08 | 12 | tak |
| R09 | 6 | tak |
| R10a | 16 | nie |
| R10b | 20 | nie |
| R10c | 0 | nie |

## Czas rozstrzygnięcia

- Sprawy zamknięte: 78, otwarte: 22 (otwarte liczą się do n, nie liczą się do czasu rozstrzygnięcia)
- Mediana dni do rozstrzygnięcia wg rodzaju: Zwrot 16, Reklamacja 18, Szkoda transportowa 21,5, Brak w przesyłce 9,5

## Rozkłady

| Rodzaj | Liczba | Udział |
| --- | --- | --- |
| Zwrot | 42 | 42% |
| Reklamacja | 32 | 32% |
| Szkoda transportowa | 16 | 16% |
| Brak w przesyłce | 10 | 10% |

| Kanał | Liczba | Udział |
| --- | --- | --- |
| E-mail | 56 | 56% |
| Telefon | 44 | 44% |

| Wynik | Liczba | Udział |
| --- | --- | --- |
| Zaakceptowane | 54 | 54% |
| Odrzucone | 10 | 10% |
| Częściowo | 8 | 8% |
| Anulowane | 6 | 6% |
| Otwarte | 22 | 22% |

## Sprawy

| Id | Miesiąc | Rodzaj | Kanał | Wartość | Dopytania | Wiadomości | Dni | Wynik | Reguły |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C01 | 2026-04 | Reklamacja | E-mail | 150–500 zł | 1 | 4 | — | Otwarte | R10b |
| C02 | 2026-09 | Brak w przesyłce | E-mail | ≤ 60 zł | 0 | 2 | 7 | Częściowo | — |
| C03 | 2026-10 | Reklamacja | Telefon | 150–500 zł | 2 | 5 | 16 | Zaakceptowane | R10b |
| C04 | 2026-08 | Zwrot | Telefon | 150–500 zł | 1 | 5 | 4 | Zaakceptowane | — |
| C05 | 2026-08 | Zwrot | E-mail | 150–500 zł | 1 | 3 | 24 | Zaakceptowane | — |
| C06 | 2026-01 | Zwrot | E-mail | 150–500 zł | 0 | 3 | 12 | Zaakceptowane | — |
| C07 | 2026-03 | Zwrot | E-mail | 150–500 zł | 2 | 7 | 24 | Zaakceptowane | — |
| C08 | 2026-06 | Brak w przesyłce | E-mail | 150–500 zł | 0 | 3 | — | Otwarte | — |
| C09 | 2026-10 | Zwrot | Telefon | 150–500 zł | 3 | 7 | — | Otwarte | — |
| C10 | 2026-04 | Zwrot | E-mail | 150–500 zł | 0 | 3 | — | Otwarte | — |
| C11 | 2026-06 | Zwrot | Telefon | 150–500 zł | 0 | 3 | 3 | Zaakceptowane | — |
| C12 | 2026-06 | Zwrot | E-mail | 60–150 zł | 0 | 2 | 30 | Zaakceptowane | R08 |
| C13 | 2026-06 | Szkoda transportowa | Telefon | ≤ 60 zł | 1 | 3 | 9 | Zaakceptowane | R09, R10a |
| C14 | 2026-10 | Reklamacja | E-mail | 150–500 zł | 0 | 2 | — | Otwarte | R10b |
| C15 | 2026-06 | Reklamacja | Telefon | 150–500 zł | 0 | 3 | 5 | Zaakceptowane | R10b |
| C16 | 2026-04 | Zwrot | E-mail | 60–150 zł | 0 | 1 | 7 | Odrzucone | R08 |
| C17 | 2026-04 | Reklamacja | E-mail | 150–500 zł | 2 | 7 | 22 | Częściowo | R10b |
| C18 | 2026-06 | Reklamacja | E-mail | 150–500 zł | 2 | 5 | 10 | Zaakceptowane | R10b |
| C19 | 2026-01 | Zwrot | Telefon | 150–500 zł | 4 | 11 | 19 | Zaakceptowane | — |
| C20 | 2026-04 | Zwrot | E-mail | 150–500 zł | 2 | 6 | — | Otwarte | — |
| C21 | 2026-05 | Brak w przesyłce | Telefon | ≤ 60 zł | 1 | 5 | 5 | Anulowane | — |
| C22 | 2026-02 | Zwrot | E-mail | 150–500 zł | 2 | 6 | — | Otwarte | — |
| C23 | 2026-08 | Szkoda transportowa | E-mail | 150–500 zł | 0 | 1 | 1 | Zaakceptowane | R10a |
| C24 | 2026-03 | Szkoda transportowa | E-mail | 150–500 zł | 1 | 5 | 30 | Zaakceptowane | R10a |
| C25 | 2026-04 | Zwrot | E-mail | 150–500 zł | 3 | 9 | — | Otwarte | — |
| C26 | 2026-01 | Reklamacja | Telefon | 150–500 zł | 1 | 3 | 30 | Zaakceptowane | — |
| C27 | 2026-01 | Zwrot | Telefon | 150–500 zł | 2 | 7 | 19 | Zaakceptowane | — |
| C28 | 2026-01 | Zwrot | E-mail | 60–150 zł | 1 | 3 | 22 | Zaakceptowane | R08 |
| C29 | 2026-10 | Szkoda transportowa | Telefon | 150–500 zł | 3 | 9 | — | Otwarte | R10a |
| C30 | 2026-07 | Zwrot | E-mail | 150–500 zł | 1 | 3 | — | Otwarte | — |
| C31 | 2026-04 | Reklamacja | E-mail | 150–500 zł | 2 | 5 | — | Otwarte | R10b |
| C32 | 2026-01 | Reklamacja | Telefon | 150–500 zł | 0 | 3 | 13 | Częściowo | — |
| C33 | 2026-08 | Brak w przesyłce | Telefon | 150–500 zł | 2 | 5 | 9 | Odrzucone | — |
| C34 | 2026-07 | Reklamacja | E-mail | ≤ 60 zł | 3 | 8 | 2 | Zaakceptowane | R09, R10b |
| C35 | 2026-09 | Zwrot | Telefon | 60–150 zł | 2 | 7 | — | Otwarte | R08 |
| C36 | 2026-04 | Brak w przesyłce | Telefon | 150–500 zł | 3 | 7 | 10 | Częściowo | — |
| C37 | 2026-09 | Zwrot | Telefon | ≤ 60 zł | 0 | 3 | 17 | Zaakceptowane | R08 |
| C38 | 2026-05 | Reklamacja | E-mail | 150–500 zł | 0 | 1 | 16 | Zaakceptowane | R10b |
| C39 | 2026-09 | Reklamacja | Telefon | 150–500 zł | 0 | 3 | 18 | Zaakceptowane | — |
| C40 | 2026-02 | Zwrot | Telefon | 150–500 zł | 3 | 9 | 8 | Odrzucone | — |
| C41 | 2026-01 | Szkoda transportowa | E-mail | 60–150 zł | 1 | 3 | 27 | Zaakceptowane | R10a |
| C42 | 2026-05 | Reklamacja | E-mail | 150–500 zł | 3 | 7 | 19 | Odrzucone | R10b |
| C43 | 2026-04 | Zwrot | Telefon | 150–500 zł | 1 | 4 | 4 | Anulowane | — |
| C44 | 2026-09 | Zwrot | E-mail | 150–500 zł | 0 | 2 | 26 | Zaakceptowane | — |
| C45 | 2026-01 | Zwrot | E-mail | 60–150 zł | 0 | 2 | 11 | Zaakceptowane | R08 |
| C46 | 2026-07 | Brak w przesyłce | Telefon | 150–500 zł | 0 | 1 | 28 | Zaakceptowane | — |
| C47 | 2026-07 | Brak w przesyłce | Telefon | 150–500 zł | 0 | 2 | 19 | Zaakceptowane | — |
| C48 | 2026-03 | Zwrot | E-mail | 150–500 zł | 0 | 3 | 1 | Częściowo | — |
| C49 | 2026-10 | Reklamacja | Telefon | 150–500 zł | 0 | 3 | — | Otwarte | — |
| C50 | 2026-03 | Zwrot | Telefon | ≤ 60 zł | 1 | 4 | 17 | Odrzucone | R08 |
| C51 | 2026-04 | Reklamacja | E-mail | 150–500 zł | 3 | 8 | 18 | Anulowane | — |
| C52 | 2026-09 | Zwrot | E-mail | 150–500 zł | 1 | 5 | 28 | Zaakceptowane | — |
| C53 | 2026-01 | Zwrot | Telefon | 60–150 zł | 3 | 9 | 25 | Zaakceptowane | R08 |
| C54 | 2026-08 | Reklamacja | E-mail | 150–500 zł | 0 | 3 | 30 | Zaakceptowane | — |
| C55 | 2026-10 | Zwrot | E-mail | 150–500 zł | 0 | 2 | 3 | Zaakceptowane | — |
| C56 | 2026-10 | Zwrot | E-mail | 60–150 zł | 1 | 4 | 5 | Zaakceptowane | R08 |
| C57 | 2026-01 | Zwrot | Telefon | 60–150 zł | 1 | 5 | — | Otwarte | R08 |
| C58 | 2026-03 | Zwrot | E-mail | 150–500 zł | 1 | 3 | 17 | Zaakceptowane | — |
| C59 | 2026-04 | Zwrot | Telefon | 150–500 zł | 2 | 5 | 11 | Zaakceptowane | — |
| C60 | 2026-03 | Reklamacja | E-mail | ≤ 60 zł | 0 | 3 | 24 | Zaakceptowane | R09, R10b |
| C61 | 2026-02 | Reklamacja | Telefon | 150–500 zł | 0 | 2 | 25 | Zaakceptowane | — |
| C62 | 2026-02 | Zwrot | E-mail | ≤ 60 zł | 1 | 5 | 18 | Zaakceptowane | R08 |
| C63 | 2026-03 | Zwrot | E-mail | 150–500 zł | 2 | 7 | 17 | Zaakceptowane | — |
| C64 | 2026-08 | Szkoda transportowa | E-mail | 150–500 zł | 3 | 8 | 6 | Zaakceptowane | R10a |
| C65 | 2026-05 | Zwrot | E-mail | 150–500 zł | 2 | 5 | 30 | Zaakceptowane | — |
| C66 | 2026-08 | Reklamacja | E-mail | 150–500 zł | 2 | 5 | 24 | Częściowo | R10b |
| C67 | 2026-07 | Reklamacja | E-mail | 150–500 zł | 0 | 3 | 6 | Zaakceptowane | — |
| C68 | 2026-07 | Reklamacja | E-mail | 150–500 zł | 1 | 5 | 21 | Zaakceptowane | R10b |
| C69 | 2026-10 | Zwrot | E-mail | 150–500 zł | 0 | 1 | — | Otwarte | — |
| C70 | 2026-01 | Szkoda transportowa | E-mail | 150–500 zł | 2 | 7 | 26 | Odrzucone | R10a |
| C71 | 2026-09 | Zwrot | E-mail | 150–500 zł | 1 | 5 | 2 | Zaakceptowane | — |
| C72 | 2026-02 | Reklamacja | E-mail | 150–500 zł | 4 | 11 | — | Otwarte | R10b |
| C73 | 2026-01 | Zwrot | E-mail | 150–500 zł | 3 | 8 | 15 | Odrzucone | — |
| C74 | 2026-02 | Zwrot | Telefon | 150–500 zł | 4 | 11 | 5 | Zaakceptowane | — |
| C75 | 2026-01 | Szkoda transportowa | E-mail | 60–150 zł | 0 | 3 | 25 | Odrzucone | R10a |
| C76 | 2026-02 | Reklamacja | Telefon | 150–500 zł | 2 | 7 | 11 | Anulowane | R10b |
| C77 | 2026-05 | Szkoda transportowa | Telefon | 150–500 zł | 0 | 2 | 5 | Zaakceptowane | R10a |
| C78 | 2026-04 | Reklamacja | Telefon | 150–500 zł | 0 | 2 | 26 | Zaakceptowane | R10b |
| C79 | 2026-05 | Reklamacja | Telefon | 150–500 zł | 1 | 4 | 9 | Zaakceptowane | — |
| C80 | 2026-04 | Brak w przesyłce | Telefon | 150–500 zł | 1 | 5 | 4 | Zaakceptowane | — |
| C81 | 2026-06 | Reklamacja | Telefon | 150–500 zł | 1 | 3 | 25 | Zaakceptowane | — |
| C82 | 2026-02 | Reklamacja | Telefon | ≤ 60 zł | 2 | 6 | 30 | Zaakceptowane | R09, R10b |
| C83 | 2026-07 | Szkoda transportowa | E-mail | 150–500 zł | 4 | 10 | 22 | Anulowane | R10a |
| C84 | 2026-03 | Szkoda transportowa | E-mail | ≤ 60 zł | 0 | 2 | 24 | Odrzucone | R09, R10a |
| C85 | 2026-09 | Szkoda transportowa | E-mail | 150–500 zł | 2 | 7 | 16 | Zaakceptowane | R10a |
| C86 | 2026-10 | Zwrot | Telefon | 150–500 zł | 1 | 5 | — | Otwarte | — |
| C87 | 2026-07 | Brak w przesyłce | Telefon | 150–500 zł | 1 | 3 | — | Otwarte | — |
| C88 | 2026-02 | Reklamacja | Telefon | 150–500 zł | 1 | 4 | 14 | Zaakceptowane | — |
| C89 | 2026-03 | Szkoda transportowa | Telefon | 60–150 zł | 1 | 3 | 22 | Częściowo | R10a |
| C90 | 2026-05 | Reklamacja | E-mail | ≤ 60 zł | 2 | 7 | 17 | Zaakceptowane | R09, R10b |
| C91 | 2026-04 | Zwrot | Telefon | 60–150 zł | 0 | 2 | 15 | Częściowo | R08 |
| C92 | 2026-08 | Brak w przesyłce | E-mail | 150–500 zł | 0 | 3 | 17 | Anulowane | — |
| C93 | 2026-10 | Zwrot | Telefon | 150–500 zł | 1 | 4 | — | Otwarte | — |
| C94 | 2026-01 | Szkoda transportowa | E-mail | 150–500 zł | 0 | 1 | 4 | Zaakceptowane | R10a |
| C95 | 2026-04 | Szkoda transportowa | Telefon | 60–150 zł | 0 | 2 | 21 | Zaakceptowane | R10a |
| C96 | 2026-07 | Reklamacja | E-mail | 150–500 zł | 1 | 3 | 19 | Zaakceptowane | — |
| C97 | 2026-03 | Reklamacja | E-mail | 60–150 zł | 2 | 7 | 2 | Odrzucone | R10b |
| C98 | 2026-10 | Zwrot | E-mail | 150–500 zł | 2 | 6 | — | Otwarte | — |
| C99 | 2026-09 | Reklamacja | Telefon | 150–500 zł | 1 | 4 | — | Otwarte | R10b |
| C100 | 2026-10 | Szkoda transportowa | Telefon | 150–500 zł | 2 | 6 | — | Otwarte | R10a |

## Metoda i ograniczenia

- Sprawa jest *rozstrzygnięta regułą*, gdy dopasowuje się co najmniej jedna włączona reguła o działaniu rozstrzygającym (automatyczna akceptacja, klient zatrzymuje towar). Działania R10 (priorytet, dowód, przypisanie) kierują sprawę, ale jej nie rozstrzygają.
- Udziały mają przedział ufności Wilsona 95%; mianownikiem jest n (w tym sprawy anulowane i otwarte), chyba że napisano inaczej.
- Zgodność: dla `auto_approve` zgodny jest wynik „zaakceptowane”; dla `keep_item` „zaakceptowane” lub „częściowo”; „odrzucone” to fałszywa akceptacja; „anulowane” i „otwarte” liczą się jako inne.
- Wersje reguł: R08 (zwrot do 150 zł), R09 (reklamacja lub szkoda transportowa do 60 zł), R10a–R10c. R10b dotyczy tylko reklamacji elektroniki i AGD (interpretacja tej specyfikacji, zaakceptowana przez właściciela); zmienia tylko liczby dopasowań, nie udział spraw rozstrzygniętych.
- Wielkość próby: n = 100.
- Przedział 95% zakłada próbę losową. Ta próba to najnowsze sprawy, więc sezonowość i dobór nie są uwzględnione, a prawdziwa niepewność jest większa.
- Dane są spseudonimizowane, nie anonimowe: brak bezpośrednich identyfikatorów, a pasma wartości i miesiące zmniejszają, ale nie eliminują ryzyka ponownej identyfikacji.
