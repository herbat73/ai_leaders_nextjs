# Instrukcja: próba 50 ostatnich spraw (zwroty i reklamacje)

Dla: kierownika obsługi klienta. Czas: ok. 2–3 godzin. Cel: sprawdzić na prawdziwych danych dwie hipotezy z briefu (zadanie E00-T01, #14):

- **A01**: dopytania i wymiana wiadomości są głównym kosztem obsługi.
- **A04**: co najmniej 35% spraw da się rozstrzygnąć prostymi regułami (zwrot do 150 zł, reklamacja lub szkoda transportowa do 60 zł).

Wynikiem jest plik CSV, który wgrywasz do narzędzia. Narzędzie niczego nie zapisuje w bazie i zwraca notatkę z liczbami.

## 1. Które sprawy wziąć

- **50 ostatnich zamkniętych i otwartych spraw** zgłoszonych mailowo lub telefonicznie, bez wybierania. Nie pomijaj trudnych ani nietypowych, bo zafałszujesz wynik.
- Liczą się zwroty, reklamacje, szkody transportowe i braki w przesyłce. Zapytania o status zamówienia i sprawy niezwiązane ze zwrotem pomiń, ale zapisz, ile ich było.
- Jeśli sprawa była prowadzona i mailem, i telefonem, wpisz kanał, którym została **zgłoszona**.
- Zapisz, z jakiego okresu pochodzi próba (od kiedy do kiedy). Narzędzie wylicza to z dat, ale warto to wiedzieć.

## 2. Plik i kolumny

Pobierz szablon ze strony `/admin/discovery/case-sample` (przycisk szablonu CSV) albo użyj `packages/app/public/case-sample-template.csv`. Jedna sprawa to jeden wiersz, a nagłówka nie zmieniaj.

| Kolumna | Co wpisać | Jak to ustalić |
|---|---|---|
| `case_ref` | Własny numer: litera i cyfry, np. `S01`–`S50` | Nadajesz go sam. **Nie wpisuj numeru zamówienia ani sprawy z systemu** (musi zaczynać się literą) |
| `channel` | `mail` albo `phone` | Kanał pierwszego zgłoszenia |
| `kind` | `return`, `complaint`, `transport` albo `missing` | Zwrot z prawa odstąpienia / reklamacja wadliwego towaru / uszkodzenie w transporcie / brak w przesyłce |
| `category` | `electronics`, `appliances`, `home`, `clothing`, `hygiene` albo `other` | Kategoria głównego produktu w sprawie |
| `value_pln` | Wartość sprawy w zł, np. `149,99` | Wartość zwracanych lub reklamowanych pozycji (nie całego zamówienia, jeśli jest większe) |
| `opened_on` | Data zgłoszenia: `RRRR-MM-DD` lub `DD.MM.RRRR` | Pierwszy kontakt klienta |
| `resolved_on` | Data zamknięcia, **puste dla spraw otwartych** | Dzień ostatecznej decyzji lub wypłaty, nie dzień ostatniego maila |
| `follow_up_requests` | Liczba | Ile razy trzeba było **dopytać klienta** (brakujące zdjęcie, numer zamówienia, powód, dane do zwrotu) lub poprosić o uzupełnienie. Pierwsze zgłoszenie się nie liczy |
| `messages_exchanged` | Liczba | Wszystkie maile i notatki z rozmów w sprawie, w obie strony |
| `outcome` | `approved`, `rejected`, `partial`, `cancelled` albo `open` | Uznana / odrzucona / uznana częściowo / klient zrezygnował / jeszcze w toku |

Zasady spójności, które narzędzie sprawdza (błąd zatrzymuje cały import):
- pusta `resolved_on` oznacza `outcome` = `open` i odwrotnie,
- data zamknięcia nie może być wcześniejsza niż data otwarcia,
- wartość od 0 do 1 000 000 zł, dopytania do 50, wiadomości do 200.

## 3. Jak liczyć dopytania i wiadomości

Najwięcej rozbieżności wychodzi właśnie tu, więc przyjmij jedną zasadę dla wszystkich 50 spraw:

1. Otwórz wątek mailowy lub notatki z rozmów dla sprawy.
2. **Wiadomości**: policz każdy mail i każdą notatkę z rozmowy, wysłane przez klienta i przez was.
3. **Dopytania**: policz tylko wiadomości od was, w których prosicie klienta o coś, czego brakowało do rozpatrzenia sprawy. Potwierdzenia przyjęcia i informacje o statusie to nie dopytania.
4. Jeśli nie da się ustalić dokładnie, wpisz najlepsze oszacowanie i oznacz sprawę w osobnej kolumnie notatek (poza CSV, np. w arkuszu roboczym). Nie zgaduj bez śladu.

## 4. Anonimizacja (obowiązkowa)

- Do pliku CSV **nie wpisuj**: imion, nazwisk, adresów, maili, telefonów, numerów zamówień, numerów przesyłek ani żadnych fragmentów treści wiadomości.
- Jedyne powiązanie z oryginałem to twój własny `case_ref` (`S01`…`S50`). Tabelę łączącą `S01` z prawdziwym numerem sprawy trzymaj w osobnym pliku, **poza repozytorium**.
- To dane spseudonimizowane, nie w pełni anonimowe. Miesiąc zgłoszenia i pasmo wartości nadal mogą ułatwić zidentyfikowanie klienta, więc plik traktuj jak dane wewnętrzne.

## 5. Wgranie i wynik

1. Wejdź na `/admin/discovery/case-sample` (wymaga zalogowania jako agent).
2. Wgraj CSV. Jeśli pojawi się błąd, komunikat wskaże kolumnę i wiersz, ale nie pokaże wartości komórki.
3. Opcjonalnie zmień progi reguł (what-if) i porównaj wynik z podstawowym.
4. Pobierz notatkę przyciskiem „Pobierz notatkę” (plik `RRRR-MM-DD-case-sample.md`).
5. Zapisz notatkę w `.ai/specs/research/` i dołącz CSV obok niej, tak jak przykładowe pliki testowe w `.ai/specs/research/rules_cases_tests/` (`test_rules_*.md` i `.csv`). **Plik z prawdziwymi danymi nie powinien mieć w nazwie ani treści oznaczenia „syntetyczne”.**

## 6. Jak czytać wynik

- Przy 50 sprawach przedział ufności 95% to około ±13 punktów. Wynik 30% dla A04 nie przesądza o porażce, jeśli 35% mieści się w przedziale.
- „Najnowsze 50 spraw” to nie próba losowa, więc prawdziwa niepewność jest większa niż pokazany przedział. Notatka sama to odnotowuje.
- Wysoki udział spraw rozstrzygniętych regułą nie wspiera A04, jeśli towarzyszy mu dużo „fałszywych akceptacji” (reguła zaakceptowałaby sprawę, którą wy odrzuciliście).
- Granica poniżej ok. 20% spraw z dopytaniem osłabia A01. To propozycja z briefu, do uzgodnienia z właścicielem produktu.

## 7. Lista kontrolna przed wgraniem

- [ ] 50 wierszy, kolejne `case_ref` od litery
- [ ] brak danych osobowych, numerów zamówień i treści wiadomości
- [ ] sprawy otwarte mają pustą `resolved_on` i `outcome` = `open`
- [ ] dopytania i wiadomości liczone według jednej zasady z pkt 3
- [ ] tabela `case_ref` → numer prawdziwej sprawy zapisana poza repozytorium
