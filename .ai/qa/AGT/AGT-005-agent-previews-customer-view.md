# AGT-005: Agent otwiera podgląd widoku klienta (tylko do odczytu)

- **ID:** AGT-005
- **Kategoria:** agenci i role (K-05)
- **Priorytet:** Medium
- **Typ:** UI z przygotowaniem danych przez API
- **Rola:** agent (konto QA z `MANAGE_RULES`)
- **Specyfikacja:** [2026-10-24-agent-login-and-roles](../../specs/implemented/2026-10-24-agent-login-and-roles.md)

## Test implementation

- [AGT-005-agent-previews-customer-view.sh](AGT-005-agent-previews-customer-view.sh) (agent-browser, POSIX sh)
- [AGT-005-agent-previews-customer-view.ps1](AGT-005-agent-previews-customer-view.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Zwrot powstaje przez API na PL-10001, pozycja L2.

## Scenariusz

```gherkin
Given w skrzynce jest zgłoszony zwrot
When agent otwiera „Podgląd widoku klienta”
Then widzi baner „tylko do odczytu”, numer RMA i status jak klient, bez akcji decyzyjnych
And może wrócić do karty zwrotu
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Karta zwrotu, „Podgląd widoku klienta” | Adres kończy się na `/customer-view`, baner „Podgląd widoku klienta — tylko do odczytu”, RMA, „Aktualny status: Zgłoszone” |
| 2 | Szukaj akcji (negatywny) | Brak „Zatwierdź” i „Odrzuć” |
| 3 | „← Wróć do karty zwrotu” | Karta z sekcją „Decyzja” |

## Sprzątanie

Zwrot odrzucany przez `PATCH /api/returns/[id]`.
