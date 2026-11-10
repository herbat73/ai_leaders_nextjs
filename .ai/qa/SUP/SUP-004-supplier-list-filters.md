# SUP-004: Lista dostawców dzieli się na strony po 10, filtruje po statusie, nazwie i e-mailu, a „Wyczyść” czyści pola tekstowe

- **ID:** SUP-004
- **Kategoria:** dostawcy / panel agenta
- **Priorytet:** Medium
- **Typ:** UI (strona agenta) z przygotowaniem danych przez API
- **Rola:** agent (konto QA z `MANAGE_RULES`)
- **Specyfikacja:** [2026-11-10-supplier-list-filters](../../specs/2026-11-10-supplier-list-filters.md)

## Test implementation

- [SUP-004-supplier-list-filters.sh](SUP-004-supplier-list-filters.sh) (agent-browser, POSIX sh)
- [SUP-004-supplier-list-filters.ps1](SUP-004-supplier-list-filters.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`); `.ai/qa/test-env.env` zawiera dane agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Skrypt zakłada 12 dostawców z unikalnym prefiksem nazwy i e-maila, dwóch z nich wyłącza; filtruje po prefiksie, więc inni dostawcy w bazie nie wpływają na liczby.

## Scenariusz

```gherkin
Given w bazie jest 12 dostawców QA, z czego 2 nieaktywnych
When agent otwiera /admin/suppliers i filtruje listę
Then widzi 10 wierszy na stronie, numer strony i filtry zapisane w adresie
And „Wyczyść” czyści pola tekstowe
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Pole „Nazwa” = prefiks QA, „Szukaj” | 10 wierszy, „Strona 1 z 2”, `name=` w adresie |
| 2 | „Następna” | `page=2`, 2 wiersze |
| 3 | `?status=inactive` i `?status=active` z prefiksem | 2 wiersze; 10 wierszy bez paginacji |
| 4 | Pole „E-mail” = fragment jednego adresu | Dokładnie 1 wiersz |
| 5 | Nazwa (prefiks) i e-mail, który nie pasuje do żadnego (negatywny) | „Brak dostawców dla wybranych filtrów” |
| 6 | „Wyczyść” | Adres bez `name`/`email`, pola puste |
| 7 | `?status=nie-ma&page=abc` (negatywny) | Wartości zignorowane, strona się wczytuje |
| 8 | Jeden aktywny wiersz w filtrze „Aktywni” i „Wyłącz” | Wiersz znika, „Brak dostawców dla wybranych filtrów” |

## Sprzątanie

Wszyscy dostawcy utworzeni przez skrypt są wyłączani przez API (dostawców się nie usuwa).
