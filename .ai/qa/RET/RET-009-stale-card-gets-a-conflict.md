# RET-009: Decyzja z nieaktualnej karty kończy się konfliktem z aktualnym statusem

- **ID:** RET-009
- **Kategoria:** zwroty / panel agenta
- **Priorytet:** High
- **Typ:** UI z przygotowaniem danych przez API
- **Rola:** agent (konto QA z `MANAGE_RULES`); „drugi agent” to wywołanie API
- **Specyfikacja:** [2026-10-22-return-agent-decision](../../specs/implemented/2026-10-22-return-agent-decision.md)

## Test implementation

- [RET-009-stale-card-gets-a-conflict.sh](RET-009-stale-card-gets-a-conflict.sh) (agent-browser, POSIX sh)
- [RET-009-stale-card-gets-a-conflict.ps1](RET-009-stale-card-gets-a-conflict.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Zwrot powstaje przez API na PL-10001, pozycja L2.

## Scenariusz

```gherkin
Given agent A ma otwartą kartę zgłoszonego zwrotu
When agent B zatwierdza ten zwrot, a agent A klika „Zatwierdź” na nieaktualnej karcie
Then agent A widzi „Status zgłoszenia zmienił się w międzyczasie. Aktualny status: Zatwierdzone.”
And decyzja agenta B pozostaje po odświeżeniu
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Agent A otwiera kartę | Przycisk „Zatwierdź” |
| 2 | Agent B zatwierdza przez API | 200 |
| 3 | Agent A klika „Zatwierdź” (negatywny) | Komunikat o konflikcie z aktualnym statusem |
| 4 | Odświeżenie karty | Status „Zatwierdzone” |

## Przypadki brzegowe i uwagi

- Test sprawdza stan po odświeżeniu, a nie liczbę wpisów w historii (liczenie wystąpień „Zatwierdzone” jest niejednoznaczne, bo to też etykieta statusu).

## Sprzątanie

Zgłoszenia po `submitted` nie da się odrzucić przez API, więc sprzątanie zwalnia jego jednostkę bezpośrednio w jednorazowej bazie testowej (`db_release_rma`; zgoda użytkownika na ten wyjątek od zasady „SQL tylko w `db`”, tylko w skryptach QA).
