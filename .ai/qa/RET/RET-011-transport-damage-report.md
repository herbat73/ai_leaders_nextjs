# RET-011: Klient zgłasza uszkodzenie w transporcie, agent je rozpatruje

- **ID:** RET-011
- **Kategoria:** uszkodzenie w transporcie / portal klienta i panel agenta
- **Priorytet:** High
- **Typ:** UI
- **Rola:** gość (klient), potem agent (konto QA z `MANAGE_RULES`)
- **Specyfikacja:** [2026-11-10-transport-damage-and-missing-items](../../specs/2026-11-10-transport-damage-and-missing-items.md) (Faza 1, bez zdjęć)

## Test implementation

- [RET-011-transport-damage-report.sh](RET-011-transport-damage-report.sh) (agent-browser, POSIX sh; wersji PowerShell nie ma)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD`.
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
| 4 | Poprawny opis, data, „Tak” przy adnotacji kuriera | Krok rozwiązania bez „Dosłanie…” i bez pytania o sposób odesłania |
| 5 | Wymiana, potwierdzenie, „Wyślij zgłoszenie uszkodzenia” | Strona zgłoszenia z RMA, trzy etapy, opis i adnotacja |
| 6 | Agent: „Zatwierdź”, „Zakończ” | Brak przycisku „Oznacz jako w drodze”; status „Zakończone” |
| 7 | „Podgląd widoku klienta” | „Aktualny status: Zakończone” |

## Sprzątanie

Jak w RET-007: skrypt zwalnia jednostkę zgłoszenia w jednorazowej bazie testowej (`qa_init` zaczyna od świeżej bazy).

## Stan wykonania

Skrypt napisany w ramach PR #139; nie został uruchomiony przez agenta autonomicznego (brak dostępu do `test-env.json` i danych logowania agenta QA). Uruchomić ręcznie przed scaleniem: `sh .ai/qa/RET/RET-011-transport-damage-report.sh`.
