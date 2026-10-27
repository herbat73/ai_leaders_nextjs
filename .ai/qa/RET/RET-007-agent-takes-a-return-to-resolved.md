# RET-007: Agent prowadzi zwrot od zgłoszenia do zakończenia

- **ID:** RET-007
- **Kategoria:** zwroty / panel agenta
- **Priorytet:** High
- **Typ:** UI (strona agenta) z przygotowaniem danych przez API
- **Rola:** agent (konto QA z `MANAGE_RULES`)
- **Specyfikacja:** [2026-10-22-return-agent-decision](../../specs/implemented/2026-10-22-return-agent-decision.md)

## Test implementation

- [RET-007-agent-takes-a-return-to-resolved.sh](RET-007-agent-takes-a-return-to-resolved.sh) (agent-browser, POSIX sh)
- [RET-007-agent-takes-a-return-to-resolved.ps1](RET-007-agent-takes-a-return-to-resolved.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Zwrot powstaje przez API na PL-10001, pozycja L2.

## Scenariusz

```gherkin
Given w skrzynce jest zgłoszony zwrot
When agent zatwierdza, oznacza w drodze, odebrane i zakończone
Then karta pokazuje „Zakończone” i brak dalszych akcji, a historia zawiera każdy ruch
And podgląd widoku klienta pokazuje „Aktualny status: Zakończone”
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Setup przez API, logowanie, otwarcie karty | Karta zgłoszenia |
| 2 | „Zatwierdź”, „Oznacz jako w drodze”, „Oznacz jako odebrane”, „Zakończ” | Kolejne statusy do „Zakończone” |
| 3 | Historia i akcje | Wpisy dla każdego ruchu, „Dla tego statusu nie ma dostępnych akcji.” |
| 4 | „Podgląd widoku klienta” | „Aktualny status: Zakończone” |

## Sprzątanie

Zgłoszenia po `submitted` nie da się odrzucić przez API, więc sprzątanie zwalnia jego jednostkę bezpośrednio w jednorazowej bazie testowej (`db_release_rma`; zgoda użytkownika na ten wyjątek od zasady „SQL tylko w `db`”, tylko w skryptach QA).
