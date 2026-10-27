# RET-004: Powtórzone zgłoszenie z tym samym kluczem idempotencji daje jeden zwrot

- **ID:** RET-004
- **Kategoria:** zwroty / API klienta
- **Priorytet:** High
- **Typ:** API (sesja klienta)
- **Rola:** gość (klient)
- **Specyfikacja:** [2026-10-22-return-customer-portal](../../specs/implemented/2026-10-22-return-customer-portal.md)

## Test implementation

- [RET-004-repeated-submit-creates-one-return.sh](RET-004-repeated-submit-creates-one-return.sh) (agent-browser, POSIX sh)
- [RET-004-repeated-submit-creates-one-return.ps1](RET-004-repeated-submit-creates-one-return.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Zwrot powstaje na PL-10001, pozycja L2.

## Scenariusz

```gherkin
Given klient wysłał zgłoszenie z kluczem idempotencji
When wysyła dokładnie to samo zgłoszenie jeszcze raz
Then dostaje 200 z tym samym RMA (pierwsze było 201)
And skrzynka agenta ma ten RMA dokładnie raz
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Zgłoszenie ze świeżym kluczem | 201, RMA |
| 2 | To samo zgłoszenie | 200, ten sam RMA |
| 3 | Nowy klucz dla tej samej, zajętej już pozycji (negatywny) | 409 lub 400, brak drugiego RMA |
| 4 | Lista agenta | RMA występuje raz |

## Przypadki brzegowe i uwagi

- Dwa równoległe zgłoszenia na tę samą pozycję (zamek doradczy) nie są sprawdzane: wymagają prawdziwej współbieżności.

## Sprzątanie

Zwrot odrzucany przez API.
