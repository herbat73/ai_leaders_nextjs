# [TESTOWE] Próba przypadków — follow-upy i pokrycie regułami [DATA]

> **⚠️ DANE TESTOWE — NIE JEST TO DOWÓD.** Próba została wygenerowana jako zestaw przypadków testowych reguł
> (`rules_cases_tests`), a nie zebrana z prawdziwych spraw. Liczby poniżej wynikają z założeń przyjętych przy generowaniu
> danych i **nie wolno** ich używać do oceny hipotez A01 i A04. Do zastąpienia notatką z prawdziwej, zanonimizowanej
> próby (E00-T01, #14).

- Data: 2026-10-26
- Liczba spraw (n): 100
- Okres (miesiące): styczeń 2026 – październik 2026
- Kanały: E-mail: 56, Telefon: 44
- Właściciel: kierownik obsługi klienta
- Źródło: dane testowe wygenerowane na potrzeby sprawdzenia reguł (nie historia prawdziwych spraw)

## A01 — follow-upy są głównym kosztem obsługi

- Sprawy z co najmniej jednym dopytaniem: **52% (42%–62%)** (przedział ufności 95%, Wilson)
- Wiadomości w sprawie: mediana 3, 75. percentyl 5
- Dopytania w sprawie: mediana 1
- Proponowana linia odcięcia z briefu: poniżej ok. 20% hipoteza upada (propozycja, nieuzgodniona z właścicielem).

## A04 — co najmniej 35% spraw da się rozstrzygnąć prostymi regułami

- Rozstrzygnięte regułą (R08, R09), wszystkie sprawy: **14% (9%–22%)**, próg hipotezy 35%
- Rozstrzygnięte regułą, tylko sprawy zamknięte: 11% (6%–19%)
- Zgodność z realnym wynikiem (sprawy rozstrzygnięte regułą): zgodne 7, fałszywe akceptacje 1, inne 6
- Wysoki udział spraw rozstrzygniętych regułą nie wspiera A04, jeśli towarzyszy mu wiele fałszywych akceptacji.

| Reguła | Dopasowania | Rozstrzyga |
| --- | --- | --- |
| R08 | 11 | tak |
| R09 | 3 | tak |
| R10a | 15 | nie |
| R10b | 17 | nie |
| R10c | 0 | nie |

## Czas rozstrzygnięcia

- Sprawy zamknięte: 83, otwarte: 17 (otwarte liczą się do n, nie liczą się do czasu rozstrzygnięcia)
- Mediana dni do rozstrzygnięcia wg rodzaju: Zwrot 15,5, Reklamacja 10, Szkoda transportowa 13,5, Brak w przesyłce 10,5

## Rozkłady

| Rodzaj | Liczba | Udział |
| --- | --- | --- |
| Zwrot | 36 | 36% |
| Reklamacja | 30 | 30% |
| Szkoda transportowa | 15 | 15% |
| Brak w przesyłce | 19 | 19% |

| Kanał | Liczba | Udział |
| --- | --- | --- |
| E-mail | 56 | 56% |
| Telefon | 44 | 44% |

| Wynik | Liczba | Udział |
| --- | --- | --- |
| Zaakceptowane | 50 | 50% |
| Odrzucone | 15 | 15% |
| Częściowo | 7 | 7% |
| Anulowane | 11 | 11% |
| Otwarte | 17 | 17% |

## Sprawy

| Id | Miesiąc | Rodzaj | Kanał | Wartość | Dopytania | Wiadomości | Dni | Wynik | Reguły |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C01 | 2026-08 | Szkoda transportowa | Telefon | 150–500 zł | 0 | 2 | 7 | Zaakceptowane | R10a |
| C02 | 2026-09 | Reklamacja | E-mail | 150–500 zł | 1 | 5 | 8 | Zaakceptowane | — |
| C03 | 2026-03 | Zwrot | E-mail | 150–500 zł | 2 | 7 | 24 | Zaakceptowane | — |
| C04 | 2026-09 | Reklamacja | E-mail | 150–500 zł | 3 | 7 | 2 | Zaakceptowane | R10b |
| C05 | 2026-04 | Zwrot | E-mail | 150–500 zł | 0 | 1 | 7 | Zaakceptowane | — |
| C06 | 2026-06 | Zwrot | E-mail | 150–500 zł | 0 | 2 | 10 | Zaakceptowane | — |
| C07 | 2026-04 | Szkoda transportowa | Telefon | 150–500 zł | 1 | 5 | 13 | Anulowane | R10a |
| C08 | 2026-06 | Reklamacja | E-mail | 150–500 zł | 0 | 1 | — | Otwarte | R10b |
| C09 | 2026-09 | Reklamacja | Telefon | 60–150 zł | 0 | 3 | 11 | Zaakceptowane | — |
| C10 | 2026-03 | Zwrot | E-mail | 150–500 zł | 1 | 3 | 22 | Odrzucone | — |
| C11 | 2026-08 | Szkoda transportowa | E-mail | 60–150 zł | 0 | 2 | 20 | Zaakceptowane | R10a |
| C12 | 2026-02 | Brak w przesyłce | E-mail | 150–500 zł | 0 | 3 | 1 | Zaakceptowane | — |
| C13 | 2026-01 | Reklamacja | E-mail | 150–500 zł | 0 | 2 | — | Otwarte | — |
| C14 | 2026-03 | Brak w przesyłce | E-mail | 60–150 zł | 1 | 3 | 15 | Zaakceptowane | — |
| C15 | 2026-01 | Reklamacja | Telefon | 150–500 zł | 1 | 5 | 17 | Odrzucone | — |
| C16 | 2026-09 | Zwrot | Telefon | 60–150 zł | 0 | 1 | — | Otwarte | R08 |
| C17 | 2026-03 | Reklamacja | E-mail | 150–500 zł | 1 | 4 | 8 | Zaakceptowane | — |
| C18 | 2026-05 | Reklamacja | E-mail | 150–500 zł | 1 | 5 | 12 | Anulowane | — |
| C19 | 2026-04 | Szkoda transportowa | E-mail | 150–500 zł | 0 | 1 | 11 | Anulowane | R10a |
| C20 | 2026-05 | Brak w przesyłce | Telefon | 60–150 zł | 2 | 6 | 7 | Odrzucone | — |
| C21 | 2026-06 | Zwrot | E-mail | 150–500 zł | 0 | 1 | 10 | Anulowane | — |
| C22 | 2026-01 | Szkoda transportowa | E-mail | 150–500 zł | 3 | 9 | 10 | Zaakceptowane | R10a |
| C23 | 2026-10 | Zwrot | Telefon | 60–150 zł | 3 | 8 | — | Otwarte | R08 |
| C24 | 2026-05 | Reklamacja | Telefon | 150–500 zł | 1 | 4 | 22 | Anulowane | R10b |
| C25 | 2026-05 | Reklamacja | E-mail | 150–500 zł | 0 | 3 | 28 | Zaakceptowane | — |
| C26 | 2026-06 | Reklamacja | E-mail | 150–500 zł | 3 | 9 | 7 | Zaakceptowane | R10b |
| C27 | 2026-05 | Zwrot | Telefon | 150–500 zł | 1 | 4 | 15 | Zaakceptowane | — |
| C28 | 2026-04 | Reklamacja | E-mail | 150–500 zł | 0 | 3 | 3 | Zaakceptowane | — |
| C29 | 2026-03 | Szkoda transportowa | E-mail | 60–150 zł | 0 | 3 | 24 | Częściowo | R10a |
| C30 | 2026-02 | Brak w przesyłce | Telefon | 150–500 zł | 0 | 1 | — | Otwarte | — |
| C31 | 2026-04 | Reklamacja | E-mail | 150–500 zł | 2 | 7 | — | Otwarte | R10b |
| C32 | 2026-08 | Zwrot | Telefon | 60–150 zł | 1 | 3 | 7 | Anulowane | R08 |
| C33 | 2026-03 | Zwrot | Telefon | 150–500 zł | 0 | 2 | 28 | Zaakceptowane | — |
| C34 | 2026-09 | Zwrot | E-mail | 150–500 zł | 0 | 2 | 1 | Zaakceptowane | — |
| C35 | 2026-08 | Szkoda transportowa | Telefon | 150–500 zł | 4 | 11 | 17 | Zaakceptowane | R10a |
| C36 | 2026-03 | Reklamacja | E-mail | 150–500 zł | 0 | 2 | 9 | Zaakceptowane | R10b |
| C37 | 2026-02 | Zwrot | E-mail | 60–150 zł | 0 | 1 | — | Otwarte | R08 |
| C38 | 2026-10 | Brak w przesyłce | Telefon | 150–500 zł | 0 | 2 | 3 | Zaakceptowane | — |
| C39 | 2026-02 | Reklamacja | Telefon | 150–500 zł | 0 | 1 | 21 | Zaakceptowane | R10b |
| C40 | 2026-03 | Zwrot | Telefon | ≤ 60 zł | 1 | 3 | 11 | Zaakceptowane | R08 |
| C41 | 2026-05 | Reklamacja | E-mail | 60–150 zł | 0 | 2 | — | Otwarte | R10b |
| C42 | 2026-03 | Zwrot | Telefon | 150–500 zł | 1 | 5 | 12 | Zaakceptowane | — |
| C43 | 2026-03 | Zwrot | E-mail | 150–500 zł | 0 | 3 | 30 | Anulowane | — |
| C44 | 2026-05 | Brak w przesyłce | Telefon | ≤ 60 zł | 0 | 1 | 2 | Anulowane | — |
| C45 | 2026-06 | Zwrot | Telefon | 60–150 zł | 1 | 5 | 16 | Zaakceptowane | R08 |
| C46 | 2026-03 | Zwrot | Telefon | 150–500 zł | 0 | 2 | — | Otwarte | — |
| C47 | 2026-04 | Brak w przesyłce | E-mail | 150–500 zł | 2 | 7 | 24 | Częściowo | — |
| C48 | 2026-08 | Reklamacja | Telefon | 60–150 zł | 1 | 3 | 4 | Częściowo | R10b |
| C49 | 2026-04 | Zwrot | Telefon | 60–150 zł | 4 | 11 | 13 | Zaakceptowane | R08 |
| C50 | 2026-06 | Zwrot | Telefon | 150–500 zł | 1 | 5 | 30 | Zaakceptowane | — |
| C51 | 2026-09 | Brak w przesyłce | Telefon | 150–500 zł | 0 | 3 | 13 | Zaakceptowane | — |
| C52 | 2026-08 | Reklamacja | Telefon | 150–500 zł | 1 | 4 | 17 | Anulowane | R10b |
| C53 | 2026-01 | Szkoda transportowa | Telefon | 150–500 zł | 2 | 7 | 20 | Częściowo | R10a |
| C54 | 2026-09 | Zwrot | E-mail | 150–500 zł | 1 | 3 | 25 | Częściowo | — |
| C55 | 2026-08 | Zwrot | Telefon | 150–500 zł | 3 | 8 | 8 | Zaakceptowane | — |
| C56 | 2026-05 | Szkoda transportowa | Telefon | 60–150 zł | 0 | 2 | 9 | Odrzucone | R10a |
| C57 | 2026-03 | Reklamacja | E-mail | 150–500 zł | 3 | 8 | 3 | Odrzucone | — |
| C58 | 2026-02 | Brak w przesyłce | E-mail | 60–150 zł | 2 | 6 | 29 | Zaakceptowane | — |
| C59 | 2026-05 | Brak w przesyłce | E-mail | 150–500 zł | 1 | 4 | 8 | Odrzucone | — |
| C60 | 2026-01 | Reklamacja | Telefon | ≤ 60 zł | 1 | 4 | — | Otwarte | R09, R10b |
| C61 | 2026-08 | Brak w przesyłce | Telefon | ≤ 60 zł | 1 | 3 | 26 | Odrzucone | — |
| C62 | 2026-03 | Zwrot | Telefon | 150–500 zł | 0 | 1 | 9 | Odrzucone | — |
| C63 | 2026-06 | Brak w przesyłce | E-mail | 150–500 zł | 1 | 3 | 7 | Częściowo | — |
| C64 | 2026-02 | Zwrot | Telefon | 150–500 zł | 1 | 3 | 19 | Odrzucone | — |
| C65 | 2026-02 | Reklamacja | E-mail | 150–500 zł | 0 | 1 | 24 | Zaakceptowane | — |
| C66 | 2026-04 | Brak w przesyłce | Telefon | 150–500 zł | 0 | 1 | 12 | Zaakceptowane | — |
| C67 | 2026-05 | Zwrot | E-mail | 150–500 zł | 0 | 2 | 2 | Zaakceptowane | — |
| C68 | 2026-07 | Szkoda transportowa | Telefon | 150–500 zł | 0 | 3 | 17 | Zaakceptowane | R10a |
| C69 | 2026-07 | Reklamacja | Telefon | 150–500 zł | 0 | 2 | 5 | Zaakceptowane | — |
| C70 | 2026-01 | Zwrot | E-mail | 150–500 zł | 1 | 3 | — | Otwarte | — |
| C71 | 2026-05 | Szkoda transportowa | Telefon | 60–150 zł | 0 | 2 | 29 | Częściowo | R10a |
| C72 | 2026-05 | Brak w przesyłce | Telefon | 150–500 zł | 0 | 3 | 18 | Zaakceptowane | — |
| C73 | 2026-07 | Brak w przesyłce | Telefon | 60–150 zł | 1 | 4 | 29 | Zaakceptowane | — |
| C74 | 2026-09 | Reklamacja | E-mail | 150–500 zł | 2 | 6 | 4 | Zaakceptowane | R10b |
| C75 | 2026-05 | Szkoda transportowa | E-mail | 150–500 zł | 3 | 7 | 9 | Zaakceptowane | R10a |
| C76 | 2026-09 | Brak w przesyłce | E-mail | 150–500 zł | 0 | 3 | 20 | Zaakceptowane | — |
| C77 | 2026-03 | Reklamacja | Telefon | 150–500 zł | 0 | 2 | 10 | Anulowane | R10b |
| C78 | 2026-01 | Reklamacja | E-mail | 60–150 zł | 2 | 7 | 25 | Odrzucone | R10b |
| C79 | 2026-01 | Brak w przesyłce | Telefon | 150–500 zł | 1 | 4 | 6 | Anulowane | — |
| C80 | 2026-01 | Zwrot | Telefon | 150–500 zł | 4 | 10 | 19 | Odrzucone | — |
| C81 | 2026-10 | Zwrot | E-mail | 150–500 zł | 0 | 2 | — | Otwarte | — |
| C82 | 2026-04 | Zwrot | E-mail | 150–500 zł | 0 | 3 | 25 | Odrzucone | — |
| C83 | 2026-07 | Zwrot | E-mail | 150–500 zł | 2 | 5 | 8 | Zaakceptowane | — |
| C84 | 2026-09 | Zwrot | E-mail | 60–150 zł | 2 | 5 | 16 | Zaakceptowane | R08 |
| C85 | 2026-07 | Brak w przesyłce | E-mail | 60–150 zł | 1 | 5 | 3 | Zaakceptowane | — |
| C86 | 2026-05 | Szkoda transportowa | Telefon | ≤ 60 zł | 0 | 2 | 14 | Zaakceptowane | R09, R10a |
| C87 | 2026-07 | Zwrot | E-mail | 150–500 zł | 0 | 2 | — | Otwarte | — |
| C88 | 2026-07 | Reklamacja | E-mail | 150–500 zł | 2 | 7 | 28 | Odrzucone | — |
| C89 | 2026-05 | Szkoda transportowa | Telefon | 150–500 zł | 1 | 5 | 9 | Zaakceptowane | R10a |
| C90 | 2026-02 | Reklamacja | E-mail | 150–500 zł | 1 | 4 | — | Otwarte | R10b |
| C91 | 2026-04 | Zwrot | E-mail | 150–500 zł | 0 | 2 | — | Otwarte | — |
| C92 | 2026-05 | Reklamacja | E-mail | 150–500 zł | 0 | 2 | 9 | Odrzucone | R10b |
| C93 | 2026-08 | Zwrot | E-mail | ≤ 60 zł | 0 | 3 | 16 | Odrzucone | R08 |
| C94 | 2026-02 | Reklamacja | E-mail | 150–500 zł | 1 | 4 | 27 | Zaakceptowane | — |
| C95 | 2026-02 | Zwrot | E-mail | 60–150 zł | 0 | 1 | 17 | Zaakceptowane | R08 |
| C96 | 2026-08 | Brak w przesyłce | E-mail | 150–500 zł | 0 | 1 | 9 | Zaakceptowane | — |
| C97 | 2026-06 | Szkoda transportowa | E-mail | 150–500 zł | 1 | 5 | — | Otwarte | R10a |
| C98 | 2026-07 | Zwrot | E-mail | ≤ 60 zł | 4 | 10 | 15 | Zaakceptowane | R08 |
| C99 | 2026-07 | Zwrot | E-mail | 150–500 zł | 0 | 3 | 19 | Zaakceptowane | — |
| C100 | 2026-03 | Reklamacja | Telefon | ≤ 60 zł | 0 | 1 | — | Otwarte | R09, R10b |

## Metoda i ograniczenia

- Sprawa jest *rozstrzygnięta regułą*, gdy dopasowuje się co najmniej jedna włączona reguła o działaniu rozstrzygającym (automatyczna akceptacja, klient zatrzymuje towar). Działania R10 (priorytet, dowód, przypisanie) kierują sprawę, ale jej nie rozstrzygają.
- Udziały mają przedział ufności Wilsona 95%; mianownikiem jest n (w tym sprawy anulowane i otwarte), chyba że napisano inaczej.
- Zgodność: dla `auto_approve` zgodny jest wynik „zaakceptowane”; dla `keep_item` „zaakceptowane” lub „częściowo”; „odrzucone” to fałszywa akceptacja; „anulowane” i „otwarte” liczą się jako inne.
- Wersje reguł: R08 (zwrot do 150 zł), R09 (reklamacja lub szkoda transportowa do 60 zł), R10a–R10c. R10b dotyczy tylko reklamacji elektroniki i AGD (interpretacja tej specyfikacji, zaakceptowana przez właściciela); zmienia tylko liczby dopasowań, nie udział spraw rozstrzygniętych.
- Wielkość próby: n = 100.
- Przedział 95% zakłada próbę losową. Ta próba to najnowsze sprawy, więc sezonowość i dobór nie są uwzględnione, a prawdziwa niepewność jest większa.
- Dane są spseudonimizowane, nie anonimowe: brak bezpośrednich identyfikatorów, a pasma wartości i miesiące zmniejszają, ale nie eliminują ryzyka ponownej identyfikacji.
