# AGT-002: Każdy błąd logowania wygląda tak samo, nadmiar prób daje 429, `next` nie wyprowadza poza serwis

- **ID:** AGT-002
- **Kategoria:** agenci i role
- **Priorytet:** High
- **Typ:** UI + API
- **Rola:** anonimowy użytkownik, potem agent QA do sprawdzenia przekierowania
- **Specyfikacja:** [2026-10-24-agent-login-and-roles](../../specs/implemented/2026-10-24-agent-login-and-roles.md)

## Test implementation

- [AGT-002-login-rejects-bad-credentials-and-throttles.sh](AGT-002-login-rejects-bad-credentials-and-throttles.sh) (agent-browser, POSIX sh)
- [AGT-002-login-rejects-bad-credentials-and-throttles.ps1](AGT-002-login-rejects-bad-credentials-and-throttles.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Limity: 10 prób/min na IP i 5 porażek na 10 min na (e-mail, IP). Test używa unikalnego nieistniejącego e-maila do limitu, więc nie blokuje konta QA; wykonuje 9 prób, więc między uruchomieniami trzeba odczekać minutę.

## Scenariusz

```gherkin
Given nieautoryzowany użytkownik próbuje się logować
When podaje złe hasło albo nieistniejący e-mail
Then widzi ten sam komunikat „Nieprawidłowy e-mail lub hasło” (API: 401 `invalid_credentials`)
And po kolejnych porażkach dostaje 429, a `next=//…` nie przekierowuje poza `/admin`
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Złe hasło konta QA, potem nieistniejący e-mail (UI) | Ten sam komunikat, pozostaje na logowaniu |
| 2 | API: nieistniejący e-mail | 401 `invalid_credentials` |
| 3 | Cztery kolejne porażki, potem kolejna | 429 `rate_limited` |
| 4 | Logowanie z `?next=//evil.example.test` | Pozostaje pod `/admin`, brak przekierowania poza serwis |

## Przypadki brzegowe i uwagi

- Porażka na koncie QA liczy się do limitu 5 na 10 minut: nie uruchamiaj skryptu więcej niż 4 razy w 10 minut.

## Sprzątanie

Brak danych do sprzątania (nic nie powstaje).
