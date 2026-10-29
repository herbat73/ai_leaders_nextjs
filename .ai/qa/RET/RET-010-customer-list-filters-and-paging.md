# RET-010: Lista klienta dzieli zgłoszenia na strony po 10, filtruje po statusie, RMA i dacie, a „Wyczyść” wraca do pełnej listy

- **ID:** RET-010
- **Kategoria:** zwroty / portal klienta
- **Priorytet:** Medium
- **Typ:** UI z przygotowaniem danych przez API
- **Rola:** klient (gość z sesją zamówienia PL-10001); konto QA agenta służy tylko do sprzątania
- **Specyfikacja:** [2026-10-28-customer-returns-list-filters](../../specs/implemented/2026-10-28-customer-returns-list-filters.md)

## Test implementation

- [RET-010-customer-list-filters-and-paging.sh](RET-010-customer-list-filters-and-paging.sh) (agent-browser, POSIX sh)
- [RET-010-customer-list-filters-and-paging.ps1](RET-010-customer-list-filters-and-paging.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera dane agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Zamówienie PL-10001 ma w bazie więcej niż 10 zgłoszeń (zostają po wcześniejszych przebiegach QA); skrypt dodaje jeszcze jeden zwrot na pozycji L2, który jest najnowszy i ma status `submitted`.

## Scenariusz

```gherkin
Given klient zamówienia PL-10001 ma więcej niż 10 zgłoszeń
When otwiera /returns, przechodzi na kolejną stronę i filtruje listę
Then widzi 10 wierszy na stronie, numer strony i filtry zapisane w adresie
And „Wyczyść” przywraca pełną listę
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Logowanie numerem zamówienia i e-mailem | 10 wierszy, „Strona 1 z N”, nowy RMA na pierwszej stronie |
| 2 | „Następna” | `?page=2`, „Strona 2 z N”, nowego RMA nie ma |
| 3 | Fragment RMA (małymi literami) w polu „Numer RMA” i „Szukaj” | Dokładnie 1 wiersz, brak paginacji |
| 4 | `?status=submitted` oraz `?status=resolved` z tym RMA | W pierwszym jest, w drugim „Brak zgłoszeń dla wybranych filtrów” (negatywny) |
| 5 | Zakres dat: dziś; rok 2000; „Od” późniejsze niż „Do” | Dziś: jest; pozostałe: „Brak zgłoszeń dla wybranych filtrów” (negatywny) |
| 6 | „Wyczyść” | Adres `/returns`, znów 10 wierszy i „Strona 1 z N” |
| 7 | `?status=nie-ma&from=xx&page=abc` (negatywny) | Wartości zignorowane, pełna lista |

## Sprzątanie

Zwrot odrzucany przez API.
