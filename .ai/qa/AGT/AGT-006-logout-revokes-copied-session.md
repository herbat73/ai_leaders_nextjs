# AGT-006: Wylogowanie unieważnia sesję po stronie serwera, skopiowane ciasteczko przestaje działać

- **ID:** AGT-006
- **Kategoria:** agenci i role
- **Priorytet:** High (P0, bezpieczeństwo)
- **Typ:** API + UI
- **Rola:** agent QA z `MANAGE_RULES`
- **Zgłoszenie:** issue #82 (zagrożenie T-05, `docs/security/threat-model.md`)

## Test implementation

- [AGT-006-logout-revokes-copied-session.sh](AGT-006-logout-revokes-copied-session.sh) (agent-browser + curl, POSIX sh). Wersji PowerShell nie ma: nie ma `pwsh` na maszynie autora.

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh`.
- Skrypt robi 3 logowania w minutę (limit: 10 na IP). Wylogowanie kończy **wszystkie** sesje konta QA, więc nie uruchamiaj go równolegle z innym scenariuszem.

## Scenariusz

```gherkin
Given agent jest zalogowany na dwóch urządzeniach, a jedno ciasteczko zostało skopiowane
When agent się wylogowuje
Then skopiowane ciasteczko dostaje 401 (odczyt i ponowne wylogowanie)
And drugie urządzenie też jest wylogowane
And świeże logowanie działa
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Logowanie przez API z dwóch słoików ciasteczek, kopia jednego | `GET /api/agents` 200 dla wszystkich trzech |
| 2 | `POST /api/agents/logout` z pierwszym ciasteczkiem | 200, ciasteczko czyszczone |
| 3 | Kopia ciasteczka: `GET /api/agents` i `POST /api/agents/logout` (negatywny) | 401 i 401 |
| 4 | Drugie urządzenie: `GET /api/agents` | 401 (wylogowanie kończy wszystkie sesje agenta) |
| 5 | UI: logowanie, „Wyloguj”, otwarcie `/admin/returns`, ponowne logowanie | Strona logowania po wylogowaniu, skrzynka po nowym logowaniu |

## Przypadki brzegowe i uwagi

- Wylogowanie na wszystkich urządzeniach jest zamierzone: epoka sesji (`session_epoch`) rośnie, a każdy wcześniej wydany token jest odrzucany.
- Powtórne wylogowanie starym ciasteczkiem to 401, a nie „idempotentne 200”: sesja już nie istnieje.

## Sprzątanie

Brak danych do sprzątania (nic nie powstaje).
