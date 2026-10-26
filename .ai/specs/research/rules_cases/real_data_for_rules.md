# Próba przypadków — follow-upy i pokrycie regułami [DATA]

- Data: 2026-10-26
- Liczba spraw (n): 50
- Okres (miesiące): lipiec 2026 – październik 2026
- Kanały: E-mail: 25, Telefon: 25
- Właściciel: kierownik obsługi klienta
- Źródło: anonimowa próba, zebrana z historii e-maili i rozmów telefonicznych

## A01 — follow-upy są głównym kosztem obsługi

- Sprawy z co najmniej jednym dopytaniem: **84% (71%–92%)** (przedział ufności 95%, Wilson)
- Wiadomości w sprawie: mediana 5, 75. percentyl 8,75
- Dopytania w sprawie: mediana 2
- Proponowana linia odcięcia z briefu: poniżej ok. 20% hipoteza upada (propozycja, nieuzgodniona z właścicielem).

## A04 — co najmniej 35% spraw da się rozstrzygnąć prostymi regułami

- Rozstrzygnięte regułą (R08, R09), wszystkie sprawy: **24% (14%–37%)**, próg hipotezy 35%
- Rozstrzygnięte regułą, tylko sprawy zamknięte: 28% (16%–43%)
- Zgodność z realnym wynikiem (sprawy rozstrzygnięte regułą): zgodne 8, fałszywe akceptacje 1, inne 3
- Wysoki udział spraw rozstrzygniętych regułą nie wspiera A04, jeśli towarzyszy mu wiele fałszywych akceptacji.

| Reguła | Dopasowania | Rozstrzyga |
| --- | --- | --- |
| R08 | 9 | tak |
| R09 | 3 | tak |
| R10a | 11 | nie |
| R10b | 7 | nie |
| R10c | 7 | nie |

## Czas rozstrzygnięcia

- Sprawy zamknięte: 40, otwarte: 10 (otwarte liczą się do n, nie liczą się do czasu rozstrzygnięcia)
- Mediana dni do rozstrzygnięcia wg rodzaju: Zwrot 3, Reklamacja 15, Szkoda transportowa 4,5, Brak w przesyłce 4

## Rozkłady

| Rodzaj | Liczba | Udział |
| --- | --- | --- |
| Zwrot | 16 | 32% |
| Reklamacja | 14 | 28% |
| Szkoda transportowa | 11 | 22% |
| Brak w przesyłce | 9 | 18% |

| Kanał | Liczba | Udział |
| --- | --- | --- |
| E-mail | 25 | 50% |
| Telefon | 25 | 50% |

| Wynik | Liczba | Udział |
| --- | --- | --- |
| Zaakceptowane | 25 | 50% |
| Odrzucone | 4 | 8% |
| Częściowo | 8 | 16% |
| Anulowane | 3 | 6% |
| Otwarte | 10 | 20% |

## Sprawy

| Id | Miesiąc | Rodzaj | Kanał | Wartość | Dopytania | Wiadomości | Dni | Wynik | Reguły |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C01 | 2026-07 | Zwrot | E-mail | 60–150 zł | 2 | 5 | 3 | Zaakceptowane | R08 |
| C02 | 2026-07 | Reklamacja | Telefon | 150–500 zł | 3 | 12 | 15 | Częściowo | R10b |
| C03 | 2026-07 | Szkoda transportowa | E-mail | 500–2000 zł | 4 | 15 | 17 | Zaakceptowane | R10a |
| C04 | 2026-07 | Brak w przesyłce | Telefon | ≤ 60 zł | 1 | 3 | 2 | Zaakceptowane | — |
| C05 | 2026-07 | Zwrot | E-mail | ≤ 60 zł | 0 | 2 | 2 | Zaakceptowane | R08 |
| C06 | 2026-07 | Reklamacja | Telefon | 150–500 zł | 5 | 14 | 16 | Odrzucone | — |
| C07 | 2026-07 | Szkoda transportowa | E-mail | 500–2000 zł | 3 | 11 | 15 | Zaakceptowane | R10a |
| C08 | 2026-07 | Zwrot | Telefon | 150–500 zł | 2 | 6 | — | Otwarte | — |
| C09 | 2026-07 | Brak w przesyłce | E-mail | 60–150 zł | 1 | 4 | 5 | Zaakceptowane | — |
| C10 | 2026-07 | Reklamacja | Telefon | 60–150 zł | 2 | 8 | 14 | Częściowo | — |
| C11 | 2026-07 | Zwrot | E-mail | > 2000 zł | 1 | 3 | 7 | Zaakceptowane | R10c |
| C12 | 2026-07 | Szkoda transportowa | Telefon | ≤ 60 zł | 0 | 2 | 2 | Zaakceptowane | R09, R10a |
| C13 | 2026-08 | Reklamacja | E-mail | > 2000 zł | 4 | 18 | 19 | Częściowo | R10b, R10c |
| C14 | 2026-08 | Zwrot | Telefon | ≤ 60 zł | 0 | 2 | 2 | Anulowane | R08 |
| C15 | 2026-08 | Brak w przesyłce | E-mail | 500–2000 zł | 3 | 9 | — | Otwarte | — |
| C16 | 2026-08 | Szkoda transportowa | Telefon | ≤ 60 zł | 1 | 3 | 2 | Zaakceptowane | R09, R10a |
| C17 | 2026-08 | Zwrot | E-mail | ≤ 60 zł | 1 | 3 | 3 | Zaakceptowane | R08 |
| C18 | 2026-08 | Reklamacja | Telefon | > 2000 zł | 5 | 22 | 21 | Odrzucone | R10b, R10c |
| C19 | 2026-08 | Zwrot | E-mail | 500–2000 zł | 2 | 7 | 7 | Zaakceptowane | — |
| C20 | 2026-08 | Brak w przesyłce | Telefon | 150–500 zł | 2 | 6 | 7 | Częściowo | — |
| C21 | 2026-08 | Szkoda transportowa | E-mail | 500–2000 zł | 3 | 12 | 16 | Zaakceptowane | R10a |
| C22 | 2026-08 | Zwrot | Telefon | 60–150 zł | 1 | 4 | 4 | Zaakceptowane | R08 |
| C23 | 2026-08 | Reklamacja | E-mail | ≤ 60 zł | 0 | 2 | 3 | Odrzucone | R09 |
| C24 | 2026-08 | Szkoda transportowa | Telefon | > 2000 zł | 4 | 10 | — | Otwarte | R10a, R10c |
| C25 | 2026-09 | Zwrot | E-mail | 150–500 zł | 1 | 3 | 3 | Zaakceptowane | — |
| C26 | 2026-09 | Reklamacja | Telefon | 60–150 zł | 3 | 9 | 12 | Częściowo | — |
| C27 | 2026-09 | Brak w przesyłce | E-mail | ≤ 60 zł | 1 | 3 | 3 | Zaakceptowane | — |
| C28 | 2026-09 | Zwrot | Telefon | 500–2000 zł | 0 | 2 | 4 | Anulowane | — |
| C29 | 2026-09 | Szkoda transportowa | E-mail | 150–500 zł | 2 | 5 | 4 | Zaakceptowane | R10a |
| C30 | 2026-09 | Reklamacja | Telefon | 500–2000 zł | 2 | 7 | — | Otwarte | R10b |
| C31 | 2026-09 | Zwrot | E-mail | 60–150 zł | 1 | 3 | 3 | Zaakceptowane | R08 |
| C32 | 2026-09 | Brak w przesyłce | Telefon | 500–2000 zł | 3 | 8 | 7 | Częściowo | — |
| C33 | 2026-09 | Reklamacja | E-mail | 150–500 zł | 4 | 13 | 15 | Odrzucone | — |
| C34 | 2026-09 | Szkoda transportowa | Telefon | 60–150 zł | 1 | 3 | 3 | Zaakceptowane | R10a |
| C35 | 2026-09 | Zwrot | E-mail | 60–150 zł | 0 | 2 | 3 | Zaakceptowane | R08 |
| C36 | 2026-09 | Reklamacja | Telefon | 500–2000 zł | 3 | 8 | — | Otwarte | R10b |
| C37 | 2026-10 | Brak w przesyłce | E-mail | 500–2000 zł | 2 | 6 | 7 | Zaakceptowane | — |
| C38 | 2026-10 | Zwrot | Telefon | 60–150 zł | 1 | 3 | 2 | Anulowane | R08 |
| C39 | 2026-10 | Szkoda transportowa | E-mail | > 2000 zł | 4 | 14 | 13 | Częściowo | R10a, R10c |
| C40 | 2026-10 | Reklamacja | Telefon | 150–500 zł | 1 | 4 | — | Otwarte | — |
| C41 | 2026-10 | Zwrot | E-mail | 150–500 zł | 2 | 5 | 3 | Zaakceptowane | — |
| C42 | 2026-10 | Brak w przesyłce | Telefon | ≤ 60 zł | 0 | 2 | 2 | Zaakceptowane | — |
| C43 | 2026-10 | Reklamacja | E-mail | > 2000 zł | 5 | 16 | — | Otwarte | R10b, R10c |
| C44 | 2026-10 | Szkoda transportowa | Telefon | 150–500 zł | 2 | 7 | 5 | Zaakceptowane | R10a |
| C45 | 2026-10 | Zwrot | E-mail | 500–2000 zł | 1 | 3 | — | Otwarte | — |
| C46 | 2026-10 | Reklamacja | Telefon | 150–500 zł | 2 | 6 | 4 | Częściowo | — |
| C47 | 2026-10 | Brak w przesyłce | E-mail | ≤ 60 zł | 1 | 3 | 2 | Zaakceptowane | — |
| C48 | 2026-10 | Zwrot | Telefon | 60–150 zł | 0 | 1 | — | Otwarte | R08 |
| C49 | 2026-10 | Szkoda transportowa | E-mail | 500–2000 zł | 1 | 4 | 2 | Zaakceptowane | R10a |
| C50 | 2026-10 | Reklamacja | Telefon | > 2000 zł | 2 | 5 | — | Otwarte | R10b, R10c |

## Metoda i ograniczenia

- Sprawa jest *rozstrzygnięta regułą*, gdy dopasowuje się co najmniej jedna włączona reguła o działaniu rozstrzygającym (automatyczna akceptacja, klient zatrzymuje towar). Działania R10 (priorytet, dowód, przypisanie) kierują sprawę, ale jej nie rozstrzygają.
- Udziały mają przedział ufności Wilsona 95%; mianownikiem jest n (w tym sprawy anulowane i otwarte), chyba że napisano inaczej.
- Zgodność: dla `auto_approve` zgodny jest wynik „zaakceptowane”; dla `keep_item` „zaakceptowane” lub „częściowo”; „odrzucone” to fałszywa akceptacja; „anulowane” i „otwarte” liczą się jako inne.
- Wersje reguł: R08 (zwrot do 150 zł), R09 (reklamacja lub szkoda transportowa do 60 zł), R10a–R10c. R10b dotyczy tylko reklamacji elektroniki i AGD (interpretacja tej specyfikacji, zaakceptowana przez właściciela); zmienia tylko liczby dopasowań, nie udział spraw rozstrzygniętych.
- Wielkość próby: n = 50.
- Przedział 95% zakłada próbę losową. Ta próba to najnowsze sprawy, więc sezonowość i dobór nie są uwzględnione, a prawdziwa niepewność jest większa.
- Dane są spseudonimizowane, nie anonimowe: brak bezpośrednich identyfikatorów, a pasma wartości i miesiące zmniejszają, ale nie eliminują ryzyka ponownej identyfikacji.
