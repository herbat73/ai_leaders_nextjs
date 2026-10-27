# AGT-001: Manager zaprasza agenta, a zaproszony ustawia hasło i się loguje

- **ID:** AGT-001
- **Kategoria:** agenci i role
- **Priorytet:** High
- **Typ:** UI, dwie sesje przeglądarki
- **Rola:** manager (konto QA z `MANAGE_RULES`) i zaproszony agent
- **Specyfikacja:** [2026-10-24-agent-login-and-roles](../../specs/implemented/2026-10-24-agent-login-and-roles.md)

## Test implementation

- [AGT-001-manager-invites-agent.sh](AGT-001-manager-invites-agent.sh) (agent-browser, POSIX sh)
- [AGT-001-manager-invites-agent.ps1](AGT-001-manager-invites-agent.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Adres e-mail zaproszonego jest unikalny dla każdego przebiegu.

## Scenariusz

```gherkin
Given manager jest zalogowany i otwiera „Agenci”
When zaprasza agenta i przekazuje mu jednorazowy link
And zaproszony ustawia hasło (min. 12 znaków) w osobnej sesji
Then zaproszony trafia do skrzynki jako zalogowany, a link nie działa drugi raz
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Strona „Agenci”, „Zaproś agenta”, „Wyślij zaproszenie” bez e-maila (negatywny) | „Podaj adres e-mail.” |
| 2 | E-mail i imię, „Wyślij zaproszenie” | „Zaproszenie gotowe”, „Link widzisz tylko raz”, link `/admin/invite/<token>` |
| 3 | Druga sesja: otwórz link, hasło „krotkie” (negatywny) | „Hasło musi mieć co najmniej …” |
| 4 | Hasło poprawne | Przekierowanie na `/admin/returns`, imię agenta w nagłówku |
| 5 | Użyj tego samego tokenu przez API (negatywny) | 400 `invite_invalid` |
| 6 | Manager odświeża listę agentów | Nowy e-mail widoczny |

## Przypadki brzegowe i uwagi

- Zalogowany agent otwierający link ponownie jest przekierowany, więc „link tylko raz” sprawdza API (`invite/accept`), nie UI.

## Sprzątanie

Konto zaproszonego jest wyłączane (`PATCH /api/agents/[id]`, `disabled`); agentów się nie usuwa.
