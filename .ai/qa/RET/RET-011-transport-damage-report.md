# RET-011: Klient zgłasza uszkodzenie w transporcie, agent je rozpatruje

- **ID:** RET-011
- **Kategoria:** uszkodzenie w transporcie / portal klienta i panel agenta
- **Priorytet:** High
- **Typ:** UI
- **Rola:** gość (klient), potem agent (konto QA z `MANAGE_RULES`)
- **Specyfikacja:** [2026-11-10-transport-damage-and-missing-items](../../specs/implemented/2026-11-10-transport-damage-and-missing-items.md) (Faza 1, bez zdjęć)

## Test implementation

- [RET-011-transport-damage-report.sh](RET-011-transport-damage-report.sh) (agent-browser, POSIX sh; wersji PowerShell nie ma)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD`.
- Potrzebny działający kontener skanera (`docker compose up -d --wait clamav`).
- Dane: PL-10001 / anna.kowalska@example.pl, dostarczone 3 dni temu, pozycja „Buty trekkingowe”.

## Scenariusz

```gherkin
Given zamówienie dostarczono w ciągu ostatnich 14 dni
When klient zgłasza uszkodzenie w transporcie z opisem, datą i adnotacją kuriera
Then powstaje zgłoszenie ze statusem „Zgłoszone” i trzema etapami (Zgłoszone, Rozpatrzone, Rozwiązane)
And agent zatwierdza i kończy je bez etapu odesłania, a podgląd klienta pokazuje „Zakończone”
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Wyszukaj zamówienie, „Uszkodzenie w transporcie” | Krok z listą produktów |
| 2 | „Dalej” bez wyboru (negatywny) | „Wybierz co najmniej jeden produkt.” |
| 3 | Produkt, opis „za krótko” (negatywny) | „Opisz problem w co najmniej 20 znakach.” |
| 4 | Poprawny opis, data, „Tak” przy adnotacji kuriera | Krok „Dodaj zdjęcia” |
| 4a | „Dalej” bez zdjęcia (negatywny) | „Dodaj co najmniej jedno zdjęcie.” |
| 4b | Plik SVG pod nazwą .png (negatywny), potem „Usuń”, potem poprawny JPEG | „To nie jest zdjęcie…”; „Dodane”, „1 z 6 zdjęć”; przyciski „Dodaj zdjęcia” i „Usuń zdjęcie ok.jpg” mają nazwy, pole pliku nie jest w kolejności tabulacji, `fieldset` z legendą |
| 4c | „Dalej” | Krok rozwiązania bez „Dosłanie…” i bez pytania o sposób odesłania |
| 5 | Wymiana, potwierdzenie, „Wyślij zgłoszenie uszkodzenia” | Strona zgłoszenia z RMA, trzy etapy, opis, adnotacja i miniatura „Otwórz zdjęcie: ok.jpg” |
| 6 | Agent: karta ze zdjęciem, „Zatwierdź”, „Zakończ” | Miniatura na karcie; brak przycisku „Oznacz jako w drodze”; status „Zakończone” |
| 7 | „Podgląd widoku klienta” | „Aktualny status: Zakończone” |

## Sprzątanie

Jak w RET-007: skrypt zwalnia jednostkę zgłoszenia w jednorazowej bazie testowej (`qa_init` zaczyna od świeżej bazy).

## Stan wykonania

Faza 1 (#139) zaliczona ręcznie przez właściciela. Rozszerzony o zdjęcia w #143: zaliczony 2026-11-11, zrzuty w `doc/previdences/pr-143/`.
