# AGT-004: Agent bez `MANAGE_RULES` obsługuje skrzynkę, ale nie ma dostępu do zarządzania agentami

- **ID:** AGT-004
- **Kategoria:** agenci i role
- **Priorytet:** High
- **Typ:** UI + API
- **Rola:** tymczasowy agent bez uprawnień (zaproszony i przyjęty przez API)
- **Specyfikacja:** [2026-10-24-agent-login-and-roles](../../specs/implemented/2026-10-24-agent-login-and-roles.md)

## Test implementation

- [AGT-004-agent-without-manage-rules-is-restricted.sh](AGT-004-agent-without-manage-rules-is-restricted.sh) (agent-browser, POSIX sh)
- [AGT-004-agent-without-manage-rules-is-restricted.ps1](AGT-004-agent-without-manage-rules-is-restricted.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Limit zwrotu (R11) nie jest tu pokryty: wymaga zwrotu powyżej `EASYRMS_REFUND_APPROVAL_LIMIT` (domyślnie 2000 zł), a zamówienia testowe tego nie osiągają (najwyższe ma ok. 550 zł). Pokrycie wymagałoby obniżenia limitu i restartu aplikacji.

## Scenariusz

```gherkin
Given agent bez uprawnienia zarządzania jest zalogowany
When wchodzi do skrzynki oraz na stronę „Agenci”
Then skrzynka działa, a „Agenci” pokazuje „Brak uprawnień” bez akcji zaproszenia
And `GET /api/agents` zwraca 403
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Logowanie agenta w przeglądarce | Skrzynka „Zwroty i reklamacje” |
| 2 | Nawigacja (negatywny) | Brak linku „Agenci” |
| 3 | Strona `/admin/agents` (negatywny) | „Brak uprawnień”, brak „Zaproś agenta” |
| 4 | `GET /api/agents` (negatywny) | 403 |

## Przypadki brzegowe i uwagi

- Przyciski „Akceptuj” wyszarzone przy zwrocie ponad limit: poza zakresem (patrz warunki wstępne).

## Sprzątanie

Tymczasowy agent jest wyłączany w sprzątaniu.
