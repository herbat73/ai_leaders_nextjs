# AGT-003: Manager wyłącza agenta; jego kolejne żądanie jest odrzucone, a własnego konta nie da się wyłączyć

- **ID:** AGT-003
- **Kategoria:** agenci i role
- **Priorytet:** High
- **Typ:** UI + API
- **Rola:** manager (konto QA z `MANAGE_RULES`) i tymczasowy agent
- **Specyfikacja:** [2026-10-24-agent-login-and-roles](../../specs/implemented/2026-10-24-agent-login-and-roles.md)

## Test implementation

- [AGT-003-manager-disables-agent.sh](AGT-003-manager-disables-agent.sh) (agent-browser, POSIX sh)
- [AGT-003-manager-disables-agent.ps1](AGT-003-manager-disables-agent.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Setup przez API: zaproszenie unikalnego agenta i przyjęcie zaproszenia (jego ciasteczko sesji trzymane osobno).

## Scenariusz

```gherkin
Given tymczasowy agent ma aktywną sesję
When manager wyłącza go z listy „Agenci”
Then kolejne żądanie tego agenta dostaje 401
And API odmawia wyłączenia własnego konta (409 `self_disable`)
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Setup: zaproszenie i przyjęcie przez API, sprawdzenie sesji (`PATCH` nieistniejącego zgłoszenia daje 404) | Sesja agenta działa |
| 2 | Strona „Agenci” | Wiersz tymczasowego agenta; po wyszukaniu własnego e-maila oznaczenie „to Ty” (lista jest stronicowana po 10, własny wiersz nie musi być na stronie 1) |
| 3 | `PATCH` własnego konta (negatywny) | 409 `self_disable` |
| 4 | „Wyłącz” w wierszu agenta, „Wyłącz agenta” | Status „Wyłączony” |
| 5 | Żądanie wyłączonego agenta | 401 |

## Przypadki brzegowe i uwagi

- `GET /api/returns` nie wymaga agenta, więc sesję sprawdza `PATCH` (kolejność: uwierzytelnienie 401, potem istnienie 404).
- Wyłączenie ostatniego managera (`last_manager`) wymaga drugiego managera i nie jest tu sprawdzane.

## Sprzątanie

Tymczasowy agent jest wyłączany w sprzątaniu.
