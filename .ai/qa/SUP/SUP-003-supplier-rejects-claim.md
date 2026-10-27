# SUP-003: Dostawca odrzuca roszczenie: wymagane uzasadnienie

- **ID:** SUP-003
- **Kategoria:** roszczenia do dostawców
- **Priorytet:** Medium
- **Typ:** UI (strona agenta) z przygotowaniem danych przez API
- **Rola:** agent (konto QA z `MANAGE_RULES`)
- **Specyfikacja:** [2026-10-25-complaints-and-vendor-claim](../../specs/implemented/2026-10-25-complaints-and-vendor-claim.md)

## Test implementation

- [SUP-003-supplier-rejects-claim.sh](SUP-003-supplier-rejects-claim.sh) (agent-browser, POSIX sh)
- [SUP-003-supplier-rejects-claim.ps1](SUP-003-supplier-rejects-claim.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Setup jak w SUP-002 (roszczenie `sent`).

## Scenariusz

```gherkin
Given roszczenie do dostawcy jest wysłane
When agent zapisuje odrzucenie z uzasadnieniem o wymaganej długości
Then status to „Odrzucona przez dostawcę”, a uzasadnienie jest widoczne
And nie ma już akcji księgowania noty
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Otwórz stronę roszczenia | „Wysłano, czekamy na dostawcę” |
| 2 | „Dostawca odrzucił reklamację”, uzasadnienie „Za krótko” (negatywny) | „Podaj uzasadnienie (co najmniej …”, status bez zmian |
| 3 | Poprawne uzasadnienie, „Zapisz odrzucenie” | „Odrzucona przez dostawcę”, uzasadnienie widoczne, brak „Nota kredytowa zaksięgowana” |

## Przypadki brzegowe i uwagi

- Minimalna długość uzasadnienia to „proponowane 20 znaków” w specyfikacji; test nie zakłada dokładnej liczby, tylko komunikat.

## Sprzątanie

Dostawca dezaktywowany, reklamacja zwolniona w bazie testowej.
