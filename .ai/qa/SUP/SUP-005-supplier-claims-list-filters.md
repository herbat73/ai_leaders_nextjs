# SUP-005: Lista reklamacji do dostawców dzieli się na strony po 10, filtruje po statusie, numerze, dostawcy i dacie, a „Wyczyść” czyści pola

- **ID:** SUP-005
- **Kategoria:** reklamacje do dostawców / panel agenta
- **Priorytet:** Medium
- **Typ:** UI (strona agenta) z przygotowaniem danych przez API i bazę testową
- **Rola:** agent (konto QA z `MANAGE_RULES`)
- **Specyfikacja:** [2026-11-10-supplier-claims-list-filters](../../specs/implemented/2026-11-10-supplier-claims-list-filters.md)

## Test implementation

- [SUP-005-supplier-claims-list-filters.sh](SUP-005-supplier-claims-list-filters.sh) (agent-browser, POSIX sh)
- [SUP-005-supplier-claims-list-filters.ps1](SUP-005-supplier-claims-list-filters.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`); `.ai/qa/test-env.env` zawiera dane agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Skrypt tworzy dwóch dostawców QA (A i B, wspólny prefiks nazwy), jedną prawdziwą reklamację (zgłoszenie na PL-10005 L2, ustawioną na `sent`) oraz 11 kolejnych reklamacji wpisanych wprost do testowej bazy na odrzuconych zgłoszeniach historycznych (PL-10001 L2): po jednej na każdy z ostatnich 11 dni, 9 w statusie `sent` i 2 `draft`, na przemian dla dostawców A i B. Liczby są sprawdzane po prefiksie nazwy dostawcy.

## Scenariusz

```gherkin
Given w bazie jest 12 reklamacji do dostawców QA (7 dla dostawcy A, 5 dla B), z czego 2 w statusie szkic
When agent otwiera /admin/supplier-claims i filtruje listę
Then widzi 10 wierszy na stronie, numer strony i filtry zapisane w adresie
And „Wyczyść” czyści pola tekstowe i daty
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Pole „Dostawca” = prefiks QA, „Szukaj” | 10 wierszy, „Strona 1 z 2”, `supplier=` w adresie |
| 2 | „Następna” | `page=2`, 2 wiersze |
| 3 | `?supplier=` nazwa dostawcy B | 5 wierszy, bez paginacji |
| 4 | `?status=draft` i `?status=sent` z prefiksem | 2 wiersze; 10 wierszy |
| 5 | Pole „Numer” = fragment numeru reklamacji, potem RMA małymi literami | Po 1 wierszu (numer reklamacji albo zgłoszenia) |
| 6 | `from=to=` dzień jednej reklamacji; `from` późniejsze niż `to` (negatywny) | 1 wiersz; „Brak reklamacji dla wybranych filtrów” |
| 7 | „Wyczyść” | Adres bez `q`/`supplier`/`from`, pola puste |
| 8 | `?status=nie-ma&from=20.10.2026&page=abc` (negatywny) | „Nieznany status w filtrze”, lista się wczytuje |

## Sprzątanie

Dostawcy A i B są wyłączani przez API (dostawców się nie usuwa); zgłoszenie testowe jest zwalniane jak w pozostałych scenariuszach SUP. Baza QA jest odtwarzana przy następnym scenariuszu.
