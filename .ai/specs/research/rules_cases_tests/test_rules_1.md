# Próba przypadków — follow-upy i pokrycie regułami [DATA]

- Data: 2026-10-26
- Liczba spraw (n): 100
- Okres (miesiące): styczeń 2026 – październik 2026
- Kanały: E-mail: 53, Telefon: 47
- Właściciel: kierownik obsługi klienta
- Źródło: anonimowa próba, zebrana z historii e-maili i rozmów telefonicznych

## A01 — follow-upy są głównym kosztem obsługi

- Sprawy z co najmniej jednym dopytaniem: **62% (52%–71%)** (przedział ufności 95%, Wilson)
- Wiadomości w sprawie: mediana 3, 75. percentyl 5
- Dopytania w sprawie: mediana 1
- Proponowana linia odcięcia z briefu: poniżej ok. 20% hipoteza upada (propozycja, nieuzgodniona z właścicielem).

## A04 — co najmniej 35% spraw da się rozstrzygnąć prostymi regułami

- Rozstrzygnięte regułą (R08, R09), wszystkie sprawy: **2% (1%–7%)**, próg hipotezy 35%
- Rozstrzygnięte regułą, tylko sprawy zamknięte: 3% (1%–9%)
- Zgodność z realnym wynikiem (sprawy rozstrzygnięte regułą): zgodne 2, fałszywe akceptacje 0, inne 0
- Wysoki udział spraw rozstrzygniętych regułą nie wspiera A04, jeśli towarzyszy mu wiele fałszywych akceptacji.

| Reguła | Dopasowania | Rozstrzyga |
| --- | --- | --- |
| R08 | 2 | tak |
| R09 | 0 | tak |
| R10a | 12 | nie |
| R10b | 25 | nie |
| R10c | 23 | nie |

### Scenariusz z innymi progami

- R08: rodzaj: zwrot; wartość ≤ 300,00 zł
- R09: rodzaj: reklamacja, szkoda transportowa; wartość ≤ 100,00 zł
- Rozstrzygnięte regułą, wszystkie sprawy: **4% (2%–10%)**
- Rozstrzygnięte regułą, tylko sprawy zamknięte: 5% (2%–13%)
- Zgodność: zgodne 3, fałszywe akceptacje 1, inne 0

## Czas rozstrzygnięcia

- Sprawy zamknięte: 76, otwarte: 24 (otwarte liczą się do n, nie liczą się do czasu rozstrzygnięcia)
- Mediana dni do rozstrzygnięcia wg rodzaju: Zwrot 14, Reklamacja 19, Szkoda transportowa 17, Brak w przesyłce 10

## Rozkłady

| Rodzaj | Liczba | Udział |
| --- | --- | --- |
| Zwrot | 40 | 40% |
| Reklamacja | 33 | 33% |
| Szkoda transportowa | 12 | 12% |
| Brak w przesyłce | 15 | 15% |

| Kanał | Liczba | Udział |
| --- | --- | --- |
| E-mail | 53 | 53% |
| Telefon | 47 | 47% |

| Wynik | Liczba | Udział |
| --- | --- | --- |
| Zaakceptowane | 42 | 42% |
| Odrzucone | 15 | 15% |
| Częściowo | 10 | 10% |
| Anulowane | 9 | 9% |
| Otwarte | 24 | 24% |

## Sprawy

| Id | Miesiąc | Rodzaj | Kanał | Wartość | Dopytania | Wiadomości | Dni | Wynik | Reguły |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C01 | 2026-09 | Zwrot | Telefon | 500–2000 zł | 1 | 3 | — | Otwarte | — |
| C02 | 2026-09 | Reklamacja | E-mail | > 2000 zł | 1 | 3 | 19 | Częściowo | R10b, R10c |
| C03 | 2026-01 | Zwrot | Telefon | 150–500 zł | 1 | 4 | 22 | Anulowane | — |
| C04 | 2026-07 | Brak w przesyłce | E-mail | 500–2000 zł | 1 | 3 | 24 | Anulowane | — |
| C05 | 2026-08 | Zwrot | Telefon | 150–500 zł | 2 | 7 | 21 | Zaakceptowane | — |
| C06 | 2026-07 | Reklamacja | Telefon | > 2000 zł | 1 | 3 | — | Otwarte | R10b, R10c |
| C07 | 2026-08 | Reklamacja | E-mail | > 2000 zł | 1 | 3 | 16 | Odrzucone | R10c |
| C08 | 2026-09 | Brak w przesyłce | E-mail | 500–2000 zł | 0 | 3 | — | Otwarte | — |
| C09 | 2026-03 | Zwrot | Telefon | 500–2000 zł | 1 | 5 | 15 | Odrzucone | — |
| C10 | 2026-06 | Reklamacja | Telefon | > 2000 zł | 1 | 4 | 21 | Odrzucone | R10b, R10c |
| C11 | 2026-05 | Zwrot | Telefon | 500–2000 zł | 1 | 5 | 5 | Zaakceptowane | — |
| C12 | 2026-09 | Zwrot | E-mail | 500–2000 zł | 2 | 6 | 25 | Zaakceptowane | — |
| C13 | 2026-02 | Zwrot | E-mail | 150–500 zł | 2 | 7 | 23 | Zaakceptowane | — |
| C14 | 2026-09 | Szkoda transportowa | E-mail | 500–2000 zł | 1 | 4 | — | Otwarte | R10a |
| C15 | 2026-08 | Reklamacja | E-mail | > 2000 zł | 0 | 2 | — | Otwarte | R10b, R10c |
| C16 | 2026-03 | Zwrot | Telefon | 500–2000 zł | 1 | 4 | 25 | Odrzucone | — |
| C17 | 2026-10 | Zwrot | E-mail | 500–2000 zł | 1 | 5 | — | Otwarte | — |
| C18 | 2026-09 | Zwrot | Telefon | 500–2000 zł | 1 | 3 | 14 | Zaakceptowane | — |
| C19 | 2026-03 | Zwrot | E-mail | 500–2000 zł | 0 | 1 | 7 | Odrzucone | — |
| C20 | 2026-06 | Zwrot | Telefon | 500–2000 zł | 3 | 7 | — | Otwarte | — |
| C21 | 2026-03 | Reklamacja | E-mail | 500–2000 zł | 1 | 3 | 15 | Zaakceptowane | R10b |
| C22 | 2026-04 | Zwrot | E-mail | 150–500 zł | 1 | 3 | 3 | Częściowo | — |
| C23 | 2026-01 | Reklamacja | E-mail | > 2000 zł | 1 | 4 | 25 | Zaakceptowane | R10b, R10c |
| C24 | 2026-09 | Reklamacja | Telefon | > 2000 zł | 0 | 3 | — | Otwarte | R10b, R10c |
| C25 | 2026-02 | Reklamacja | Telefon | > 2000 zł | 0 | 2 | 6 | Zaakceptowane | R10b, R10c |
| C26 | 2026-09 | Zwrot | E-mail | 500–2000 zł | 1 | 5 | 4 | Zaakceptowane | — |
| C27 | 2026-02 | Zwrot | E-mail | 500–2000 zł | 1 | 4 | — | Otwarte | — |
| C28 | 2026-03 | Zwrot | Telefon | 150–500 zł | 1 | 5 | 22 | Zaakceptowane | — |
| C29 | 2026-04 | Reklamacja | Telefon | 500–2000 zł | 0 | 3 | 19 | Odrzucone | R10b |
| C30 | 2026-02 | Reklamacja | E-mail | > 2000 zł | 0 | 1 | 25 | Częściowo | R10b, R10c |
| C31 | 2026-02 | Zwrot | Telefon | 60–150 zł | 0 | 2 | 11 | Zaakceptowane | R08 |
| C32 | 2026-05 | Brak w przesyłce | E-mail | 60–150 zł | 0 | 1 | 1 | Zaakceptowane | — |
| C33 | 2026-06 | Reklamacja | E-mail | > 2000 zł | 1 | 5 | 15 | Zaakceptowane | R10c |
| C34 | 2026-04 | Zwrot | Telefon | 500–2000 zł | 4 | 9 | 14 | Odrzucone | — |
| C35 | 2026-07 | Brak w przesyłce | Telefon | 150–500 zł | 1 | 3 | 23 | Zaakceptowane | — |
| C36 | 2026-03 | Brak w przesyłce | Telefon | 500–2000 zł | 0 | 1 | 14 | Zaakceptowane | — |
| C37 | 2026-02 | Zwrot | Telefon | 500–2000 zł | 0 | 1 | 4 | Zaakceptowane | — |
| C38 | 2026-07 | Reklamacja | E-mail | > 2000 zł | 0 | 2 | 13 | Zaakceptowane | R10b, R10c |
| C39 | 2026-10 | Zwrot | E-mail | 150–500 zł | 3 | 7 | 13 | Częściowo | — |
| C40 | 2026-05 | Reklamacja | E-mail | > 2000 zł | 0 | 3 | — | Otwarte | R10b, R10c |
| C41 | 2026-09 | Reklamacja | E-mail | 500–2000 zł | 1 | 5 | 11 | Anulowane | R10b |
| C42 | 2026-01 | Zwrot | Telefon | 500–2000 zł | 1 | 3 | — | Otwarte | — |
| C43 | 2026-04 | Zwrot | Telefon | 500–2000 zł | 0 | 1 | 9 | Odrzucone | — |
| C44 | 2026-08 | Reklamacja | Telefon | 500–2000 zł | 1 | 4 | — | Otwarte | R10b |
| C45 | 2026-07 | Brak w przesyłce | E-mail | 500–2000 zł | 1 | 4 | 27 | Anulowane | — |
| C46 | 2026-05 | Zwrot | Telefon | 500–2000 zł | 0 | 1 | 24 | Zaakceptowane | — |
| C47 | 2026-07 | Brak w przesyłce | E-mail | 150–500 zł | 2 | 7 | 17 | Odrzucone | — |
| C48 | 2026-06 | Szkoda transportowa | E-mail | 500–2000 zł | 0 | 3 | 10 | Odrzucone | R10a |
| C49 | 2026-10 | Zwrot | E-mail | 500–2000 zł | 4 | 9 | 5 | Zaakceptowane | — |
| C50 | 2026-08 | Reklamacja | E-mail | 500–2000 zł | 3 | 9 | 25 | Zaakceptowane | R10b |
| C51 | 2026-03 | Reklamacja | E-mail | > 2000 zł | 1 | 5 | 4 | Zaakceptowane | R10c |
| C52 | 2026-06 | Zwrot | Telefon | 150–500 zł | 1 | 3 | 5 | Zaakceptowane | — |
| C53 | 2026-02 | Brak w przesyłce | Telefon | 150–500 zł | 0 | 1 | 20 | Zaakceptowane | — |
| C54 | 2026-07 | Reklamacja | E-mail | 500–2000 zł | 3 | 8 | 15 | Częściowo | — |
| C55 | 2026-05 | Szkoda transportowa | Telefon | 500–2000 zł | 0 | 2 | 8 | Częściowo | R10a |
| C56 | 2026-09 | Brak w przesyłce | Telefon | 150–500 zł | 0 | 2 | 6 | Zaakceptowane | — |
| C57 | 2026-07 | Zwrot | Telefon | 500–2000 zł | 2 | 7 | 15 | Zaakceptowane | — |
| C58 | 2026-06 | Szkoda transportowa | Telefon | 500–2000 zł | 1 | 3 | 28 | Zaakceptowane | R10a |
| C59 | 2026-10 | Brak w przesyłce | Telefon | 500–2000 zł | 0 | 2 | 9 | Anulowane | — |
| C60 | 2026-07 | Szkoda transportowa | E-mail | > 2000 zł | 2 | 6 | 22 | Zaakceptowane | R10a, R10c |
| C61 | 2026-01 | Reklamacja | Telefon | 500–2000 zł | 2 | 5 | — | Otwarte | R10b |
| C62 | 2026-08 | Reklamacja | E-mail | 500–2000 zł | 1 | 4 | 26 | Anulowane | — |
| C63 | 2026-05 | Reklamacja | Telefon | > 2000 zł | 0 | 2 | 25 | Zaakceptowane | R10b, R10c |
| C64 | 2026-10 | Reklamacja | E-mail | > 2000 zł | 0 | 1 | 4 | Częściowo | R10b, R10c |
| C65 | 2026-06 | Zwrot | E-mail | 500–2000 zł | 2 | 7 | 14 | Zaakceptowane | — |
| C66 | 2026-08 | Zwrot | Telefon | 500–2000 zł | 2 | 5 | 18 | Zaakceptowane | — |
| C67 | 2026-06 | Zwrot | E-mail | 500–2000 zł | 0 | 2 | 16 | Zaakceptowane | — |
| C68 | 2026-09 | Zwrot | Telefon | 150–500 zł | 2 | 6 | 9 | Anulowane | — |
| C69 | 2026-06 | Szkoda transportowa | Telefon | 500–2000 zł | 2 | 5 | 2 | Zaakceptowane | R10a |
| C70 | 2026-09 | Reklamacja | Telefon | 500–2000 zł | 1 | 4 | — | Otwarte | R10b |
| C71 | 2026-10 | Zwrot | Telefon | 500–2000 zł | 0 | 2 | — | Otwarte | — |
| C72 | 2026-04 | Brak w przesyłce | E-mail | 500–2000 zł | 0 | 3 | 8 | Zaakceptowane | — |
| C73 | 2026-05 | Szkoda transportowa | Telefon | 500–2000 zł | 1 | 5 | 23 | Anulowane | R10a |
| C74 | 2026-09 | Reklamacja | E-mail | > 2000 zł | 0 | 3 | 18 | Odrzucone | R10c |
| C75 | 2026-10 | Zwrot | E-mail | 500–2000 zł | 3 | 8 | — | Otwarte | — |
| C76 | 2026-07 | Brak w przesyłce | E-mail | 500–2000 zł | 0 | 1 | 6 | Zaakceptowane | — |
| C77 | 2026-10 | Reklamacja | E-mail | 500–2000 zł | 0 | 3 | — | Otwarte | R10b |
| C78 | 2026-03 | Szkoda transportowa | E-mail | 60–150 zł | 0 | 3 | — | Otwarte | R10a |
| C79 | 2026-05 | Zwrot | E-mail | 500–2000 zł | 0 | 1 | 1 | Zaakceptowane | — |
| C80 | 2026-03 | Reklamacja | Telefon | 500–2000 zł | 4 | 9 | 22 | Zaakceptowane | — |
| C81 | 2026-07 | Reklamacja | Telefon | > 2000 zł | 1 | 4 | 10 | Częściowo | R10b, R10c |
| C82 | 2026-04 | Brak w przesyłce | E-mail | 500–2000 zł | 0 | 3 | 3 | Zaakceptowane | — |
| C83 | 2026-08 | Zwrot | Telefon | 500–2000 zł | 0 | 1 | 14 | Zaakceptowane | — |
| C84 | 2026-01 | Zwrot | E-mail | 500–2000 zł | 3 | 8 | 15 | Zaakceptowane | — |
| C85 | 2026-04 | Zwrot | E-mail | 500–2000 zł | 1 | 5 | — | Otwarte | — |
| C86 | 2026-06 | Reklamacja | E-mail | 500–2000 zł | 0 | 2 | 22 | Częściowo | — |
| C87 | 2026-02 | Zwrot | Telefon | 500–2000 zł | 1 | 4 | 3 | Odrzucone | — |
| C88 | 2026-08 | Szkoda transportowa | E-mail | 150–500 zł | 0 | 2 | 18 | Odrzucone | R10a |
| C89 | 2026-05 | Zwrot | E-mail | 500–2000 zł | 2 | 5 | 2 | Zaakceptowane | — |
| C90 | 2026-06 | Brak w przesyłce | Telefon | 150–500 zł | 4 | 9 | 10 | Częściowo | — |
| C91 | 2026-09 | Reklamacja | E-mail | > 2000 zł | 0 | 1 | — | Otwarte | R10b, R10c |
| C92 | 2026-09 | Szkoda transportowa | Telefon | > 2000 zł | 1 | 4 | 16 | Odrzucone | R10a, R10c |
| C93 | 2026-03 | Reklamacja | E-mail | > 2000 zł | 1 | 4 | 28 | Zaakceptowane | R10b, R10c |
| C94 | 2026-03 | Brak w przesyłce | E-mail | 500–2000 zł | 0 | 2 | — | Otwarte | — |
| C95 | 2026-02 | Reklamacja | E-mail | > 2000 zł | 4 | 10 | 26 | Anulowane | R10b, R10c |
| C96 | 2026-03 | Zwrot | E-mail | 150–500 zł | 0 | 2 | 30 | Odrzucone | — |
| C97 | 2026-10 | Szkoda transportowa | Telefon | 500–2000 zł | 1 | 3 | — | Otwarte | R10a |
| C98 | 2026-01 | Reklamacja | Telefon | > 2000 zł | 3 | 7 | — | Otwarte | R10b, R10c |
| C99 | 2026-02 | Zwrot | Telefon | 60–150 zł | 0 | 3 | 1 | Zaakceptowane | R08 |
| C100 | 2026-10 | Szkoda transportowa | E-mail | 500–2000 zł | 1 | 5 | — | Otwarte | R10a |

## Metoda i ograniczenia

- Sprawa jest *rozstrzygnięta regułą*, gdy dopasowuje się co najmniej jedna włączona reguła o działaniu rozstrzygającym (automatyczna akceptacja, klient zatrzymuje towar). Działania R10 (priorytet, dowód, przypisanie) kierują sprawę, ale jej nie rozstrzygają.
- Udziały mają przedział ufności Wilsona 95%; mianownikiem jest n (w tym sprawy anulowane i otwarte), chyba że napisano inaczej.
- Zgodność: dla `auto_approve` zgodny jest wynik „zaakceptowane”; dla `keep_item` „zaakceptowane” lub „częściowo”; „odrzucone” to fałszywa akceptacja; „anulowane” i „otwarte” liczą się jako inne.
- Wersje reguł: R08 (zwrot do 150 zł), R09 (reklamacja lub szkoda transportowa do 60 zł), R10a–R10c. R10b dotyczy tylko reklamacji elektroniki i AGD (interpretacja tej specyfikacji, zaakceptowana przez właściciela); zmienia tylko liczby dopasowań, nie udział spraw rozstrzygniętych.
- Wielkość próby: n = 100.
- Przedział 95% zakłada próbę losową. Ta próba to najnowsze sprawy, więc sezonowość i dobór nie są uwzględnione, a prawdziwa niepewność jest większa.
- Dane są spseudonimizowane, nie anonimowe: brak bezpośrednich identyfikatorów, a pasma wartości i miesiące zmniejszają, ale nie eliminują ryzyka ponownej identyfikacji.
