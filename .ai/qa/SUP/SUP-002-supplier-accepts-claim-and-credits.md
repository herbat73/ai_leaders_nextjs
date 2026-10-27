# SUP-002: Dostawca uznaje roszczenie z kwotą noty, a nota zostaje zaksięgowana

- **ID:** SUP-002
- **Kategoria:** roszczenia do dostawców
- **Priorytet:** High
- **Typ:** UI (strona agenta) z przygotowaniem danych przez API
- **Rola:** agent (konto QA z `MANAGE_RULES`)
- **Specyfikacja:** [2026-10-25-complaints-and-vendor-claim](../../specs/implemented/2026-10-25-complaints-and-vendor-claim.md)

## Test implementation

- [SUP-002-supplier-accepts-claim-and-credits.sh](SUP-002-supplier-accepts-claim-and-credits.sh) (agent-browser, POSIX sh)
- [SUP-002-supplier-accepts-claim-and-credits.ps1](SUP-002-supplier-accepts-claim-and-credits.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Setup jak w SUP-001, a roszczenie ustawione w bazie testowej na `sent` (`claim_create_sent`): przepływ odpowiedzi zaczyna się od `sent`, a dostarczający SMTP nie należy do wspólnego środowiska.

## Scenariusz

```gherkin
Given roszczenie do dostawcy jest wysłane
When agent zapisuje uznanie z kwotą 20,00 zł, a potem księgowanie noty kredytowej
Then status przechodzi „Uznana, czeka na notę” → „Nota zaksięgowana”
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Otwórz stronę roszczenia | „Wysłano, czekamy na dostawcę” |
| 2 | „Dostawca uznał reklamację”, „Zapisz uznanie” bez kwoty (negatywny) | „Podaj kwotę większą od zera” |
| 3 | Kwota 49,01 (wartość pozycji to 49,00) (negatywny) | „Kwota przekracza wartość reklamowanych produktów.” |
| 4 | Kwota 20,00, „Zapisz uznanie” | „Uznana, czeka na notę”, kwota widoczna |
| 5 | „Nota kredytowa zaksięgowana” | „Nota zaksięgowana”, brak dalszej akcji |

## Przypadki brzegowe i uwagi

- Uznanie wymaga kwoty > 0 i nie większej niż wartość reklamowanych produktów (specyfikacja, API `PATCH /api/supplier-claims/[id]`).

## Sprzątanie

Dostawca dezaktywowany, reklamacja zwolniona w bazie testowej.
