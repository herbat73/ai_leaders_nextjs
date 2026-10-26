# [SYNTETYCZNE] Próba przypadków — follow-upy i pokrycie regułami [DATA]

> **⚠️ DANE SYNTETYCZNE — NIE JEST TO DOWÓD.** Próba 50 spraw została wymyślona przez agenta AI (typowe sprawy e-commerce)
> i wgrana do laboratorium próbki spraw tylko po to, by sprawdzić działanie narzędzia. Liczby poniżej odzwierciedlają
> założenia przyjęte przy generowaniu danych i **nie wolno** ich używać do oceny hipotez A01 i A04. Do zastąpienia notatką
> z prawdziwej, zanonimizowanej próby (E00-T01, #14).


- Data: 2026-10-26
- Liczba spraw (n): 50
- Okres (miesiące): wrzesień 2026 – październik 2026
- Kanały: E-mail: 37, Telefon: 13
- Właściciel: kierownik obsługi klienta
- Źródło: dane syntetyczne wygenerowane przez agenta AI (nie historia e-maili i rozmów)

## A01 — follow-upy są głównym kosztem obsługi

- Sprawy z co najmniej jednym dopytaniem: **76% (63%–86%)** (przedział ufności 95%, Wilson)
- Wiadomości w sprawie: mediana 4, 75. percentyl 6
- Dopytania w sprawie: mediana 1
- Proponowana linia odcięcia z briefu: poniżej ok. 20% hipoteza upada (propozycja, nieuzgodniona z właścicielem).

## A04 — co najmniej 35% spraw da się rozstrzygnąć prostymi regułami

- Rozstrzygnięte regułą (R08, R09), wszystkie sprawy: **22% (13%–35%)**, próg hipotezy 35%
- Rozstrzygnięte regułą, tylko sprawy zamknięte: 23% (13%–37%)
- Zgodność z realnym wynikiem (sprawy rozstrzygnięte regułą): zgodne 7, fałszywe akceptacje 2, inne 2
- Wysoki udział spraw rozstrzygniętych regułą nie wspiera A04, jeśli towarzyszy mu wiele fałszywych akceptacji.

| Reguła | Dopasowania | Rozstrzyga |
| --- | --- | --- |
| R08 | 11 | tak |
| R09 | 0 | tak |
| R10a | 6 | nie |
| R10b | 9 | nie |
| R10c | 2 | nie |

## Czas rozstrzygnięcia

- Sprawy zamknięte: 44, otwarte: 6 (otwarte liczą się do n, nie liczą się do czasu rozstrzygnięcia)
- Mediana dni do rozstrzygnięcia wg rodzaju: Zwrot 2, Reklamacja 11, Szkoda transportowa 6, Brak w przesyłce 3,5

## Rozkłady

| Rodzaj | Liczba | Udział |
| --- | --- | --- |
| Zwrot | 22 | 44% |
| Reklamacja | 15 | 30% |
| Szkoda transportowa | 6 | 12% |
| Brak w przesyłce | 7 | 14% |

| Kanał | Liczba | Udział |
| --- | --- | --- |
| E-mail | 37 | 74% |
| Telefon | 13 | 26% |

| Wynik | Liczba | Udział |
| --- | --- | --- |
| Zaakceptowane | 32 | 64% |
| Odrzucone | 6 | 12% |
| Częściowo | 5 | 10% |
| Anulowane | 1 | 2% |
| Otwarte | 6 | 12% |

## Sprawy

| Id | Miesiąc | Rodzaj | Kanał | Wartość | Dopytania | Wiadomości | Dni | Wynik | Reguły |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C01 | 2026-09 | Zwrot | E-mail | 60–150 zł | 0 | 2 | 2 | Zaakceptowane | R08 |
| C02 | 2026-09 | Zwrot | E-mail | 150–500 zł | 1 | 4 | 3 | Zaakceptowane | — |
| C03 | 2026-09 | Zwrot | E-mail | 60–150 zł | 0 | 2 | 0 | Zaakceptowane | R08 |
| C04 | 2026-09 | Zwrot | Telefon | 60–150 zł | 0 | 1 | 0 | Zaakceptowane | R08 |
| C05 | 2026-09 | Zwrot | E-mail | 150–500 zł | 2 | 6 | 5 | Częściowo | — |
| C06 | 2026-09 | Zwrot | E-mail | 150–500 zł | 1 | 4 | 4 | Zaakceptowane | — |
| C07 | 2026-09 | Zwrot | Telefon | 500–2000 zł | 2 | 5 | 6 | Zaakceptowane | — |
| C08 | 2026-09 | Zwrot | E-mail | 60–150 zł | 0 | 2 | 1 | Zaakceptowane | R08 |
| C09 | 2026-09 | Zwrot | E-mail | 150–500 zł | 1 | 3 | 4 | Zaakceptowane | — |
| C10 | 2026-09 | Zwrot | E-mail | ≤ 60 zł | 0 | 2 | 1 | Zaakceptowane | R08 |
| C11 | 2026-09 | Zwrot | Telefon | 150–500 zł | 1 | 4 | 5 | Zaakceptowane | — |
| C12 | 2026-09 | Zwrot | E-mail | ≤ 60 zł | 1 | 3 | 1 | Odrzucone | R08 |
| C13 | 2026-09 | Zwrot | E-mail | 60–150 zł | 1 | 3 | 2 | Odrzucone | R08 |
| C14 | 2026-09 | Zwrot | E-mail | ≤ 60 zł | 0 | 2 | 0 | Zaakceptowane | R08 |
| C15 | 2026-09 | Zwrot | E-mail | 500–2000 zł | 2 | 6 | 6 | Zaakceptowane | — |
| C16 | 2026-09 | Zwrot | Telefon | 500–2000 zł | 3 | 8 | 8 | Zaakceptowane | — |
| C17 | 2026-09 | Zwrot | E-mail | 150–500 zł | 2 | 5 | 4 | Odrzucone | — |
| C18 | 2026-09 | Zwrot | E-mail | 150–500 zł | 0 | 2 | 2 | Zaakceptowane | — |
| C19 | 2026-09 | Zwrot | E-mail | 60–150 zł | 0 | 2 | 1 | Anulowane | R08 |
| C20 | 2026-09 | Zwrot | Telefon | 60–150 zł | 1 | 3 | 2 | Zaakceptowane | R08 |
| C21 | 2026-09 | Reklamacja | E-mail | 500–2000 zł | 3 | 9 | 14 | Zaakceptowane | R10b |
| C22 | 2026-09 | Reklamacja | E-mail | > 2000 zł | 4 | 12 | 21 | Zaakceptowane | R10b, R10c |
| C23 | 2026-09 | Reklamacja | Telefon | 150–500 zł | 2 | 6 | 9 | Częściowo | R10b |
| C24 | 2026-09 | Reklamacja | E-mail | 500–2000 zł | 4 | 11 | 17 | Zaakceptowane | R10b |
| C25 | 2026-09 | Reklamacja | E-mail | 500–2000 zł | 3 | 8 | 13 | Odrzucone | R10b |
| C26 | 2026-09 | Reklamacja | Telefon | > 2000 zł | 5 | 14 | 18 | Zaakceptowane | R10b, R10c |
| C27 | 2026-09 | Reklamacja | E-mail | 150–500 zł | 2 | 5 | 8 | Zaakceptowane | — |
| C28 | 2026-09 | Reklamacja | E-mail | 150–500 zł | 2 | 6 | 10 | Częściowo | — |
| C29 | 2026-09 | Reklamacja | E-mail | 150–500 zł | 3 | 7 | 11 | Zaakceptowane | — |
| C30 | 2026-09 | Reklamacja | Telefon | 60–150 zł | 1 | 4 | 6 | Zaakceptowane | — |
| C31 | 2026-09 | Reklamacja | E-mail | 60–150 zł | 3 | 8 | 14 | Odrzucone | R10b |
| C32 | 2026-09 | Reklamacja | E-mail | 60–150 zł | 2 | 5 | 9 | Zaakceptowane | — |
| C33 | 2026-09 | Reklamacja | E-mail | 60–150 zł | 1 | 4 | 7 | Zaakceptowane | — |
| C34 | 2026-09 | Szkoda transportowa | E-mail | 150–500 zł | 2 | 6 | 6 | Zaakceptowane | R10a |
| C35 | 2026-09 | Szkoda transportowa | Telefon | 500–2000 zł | 3 | 9 | 9 | Zaakceptowane | R10a |
| C36 | 2026-09 | Szkoda transportowa | E-mail | 500–2000 zł | 4 | 10 | 10 | Zaakceptowane | R10a |
| C37 | 2026-09 | Szkoda transportowa | E-mail | 60–150 zł | 1 | 3 | 3 | Zaakceptowane | R10a |
| C38 | 2026-09 | Szkoda transportowa | Telefon | 150–500 zł | 2 | 5 | 6 | Częściowo | R10a |
| C39 | 2026-09 | Brak w przesyłce | E-mail | 60–150 zł | 1 | 4 | 3 | Zaakceptowane | — |
| C40 | 2026-09 | Brak w przesyłce | E-mail | 150–500 zł | 2 | 5 | 5 | Zaakceptowane | — |
| C41 | 2026-09 | Brak w przesyłce | Telefon | ≤ 60 zł | 0 | 2 | 1 | Zaakceptowane | — |
| C42 | 2026-09 | Brak w przesyłce | E-mail | ≤ 60 zł | 0 | 2 | 1 | Zaakceptowane | — |
| C43 | 2026-09 | Brak w przesyłce | E-mail | ≤ 60 zł | 1 | 3 | 4 | Częściowo | — |
| C44 | 2026-09 | Brak w przesyłce | E-mail | 150–500 zł | 3 | 7 | 7 | Odrzucone | — |
| C45 | 2026-10 | Zwrot | E-mail | 150–500 zł | 1 | 3 | — | Otwarte | — |
| C46 | 2026-10 | Reklamacja | E-mail | 500–2000 zł | 2 | 5 | — | Otwarte | R10b |
| C47 | 2026-10 | Reklamacja | Telefon | 500–2000 zł | 1 | 3 | — | Otwarte | R10b |
| C48 | 2026-10 | Szkoda transportowa | E-mail | 500–2000 zł | 1 | 2 | — | Otwarte | R10a |
| C49 | 2026-10 | Zwrot | E-mail | 60–150 zł | 0 | 1 | — | Otwarte | R08 |
| C50 | 2026-10 | Brak w przesyłce | Telefon | 150–500 zł | 0 | 1 | — | Otwarte | — |

## Metoda i ograniczenia

- Sprawa jest *rozstrzygnięta regułą*, gdy dopasowuje się co najmniej jedna włączona reguła o działaniu rozstrzygającym (automatyczna akceptacja, klient zatrzymuje towar). Działania R10 (priorytet, dowód, przypisanie) kierują sprawę, ale jej nie rozstrzygają.
- Udziały mają przedział ufności Wilsona 95%; mianownikiem jest n (w tym sprawy anulowane i otwarte), chyba że napisano inaczej.
- Zgodność: dla `auto_approve` zgodny jest wynik „zaakceptowane”; dla `keep_item` „zaakceptowane” lub „częściowo”; „odrzucone” to fałszywa akceptacja; „anulowane” i „otwarte” liczą się jako inne.
- Wersje reguł: R08 (zwrot do 150 zł), R09 (reklamacja lub szkoda transportowa do 60 zł), R10a–R10c. R10b dotyczy tylko reklamacji elektroniki i AGD (interpretacja tej specyfikacji, zaakceptowana przez właściciela); zmienia tylko liczby dopasowań, nie udział spraw rozstrzygniętych.
- Wielkość próby: n = 50.
- Przedział 95% zakłada próbę losową. Ta próba to najnowsze sprawy, więc sezonowość i dobór nie są uwzględnione, a prawdziwa niepewność jest większa.
- Dane są spseudonimizowane, nie anonimowe: brak bezpośrednich identyfikatorów, a pasma wartości i miesiące zmniejszają, ale nie eliminują ryzyka ponownej identyfikacji.

Dane wejściowe (syntetyczne): `2026-10-26-case-sample-synthetic.csv` — wgrywane do `/admin/discovery/case-sample`.
