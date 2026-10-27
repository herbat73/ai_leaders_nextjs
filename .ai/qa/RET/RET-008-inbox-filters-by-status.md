# RET-008: Skrzynka filtruje po statusie, nieznany filtr ma komunikat, a nienumeryczne id to 404

- **ID:** RET-008
- **Kategoria:** zwroty / panel agenta
- **Priorytet:** Medium
- **Typ:** UI z przygotowaniem danych przez API
- **Rola:** agent (konto QA z `MANAGE_RULES`)
- **Specyfikacja:** [2026-10-22-return-agent-decision](../../specs/implemented/2026-10-22-return-agent-decision.md)

## Test implementation

- [RET-008-inbox-filters-by-status.sh](RET-008-inbox-filters-by-status.sh) (agent-browser, POSIX sh)
- [RET-008-inbox-filters-by-status.ps1](RET-008-inbox-filters-by-status.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Zwrot powstaje przez API na PL-10001 (L2) i zostaje `submitted`.

## Scenariusz

```gherkin
Given w skrzynce jest zgłoszony zwrot
When agent filtruje po `?status=submitted`, `?status=rejected` i nieznanym statusie
Then zgłoszony zwrot jest tylko w filtrze „submitted”, nieznany filtr pokazuje wszystko z komunikatem
And `/admin/returns/abc` kończy się stroną „nie znaleziono”
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | `?status=submitted` | Nowy RMA na liście |
| 2 | `?status=rejected` (negatywny) | Nowego RMA nie ma |
| 3 | `?status=nie-ma-takiego` (negatywny) | „Nieznany filtr, pokazuję wszystkie zgłoszenia.” i RMA widoczny |
| 4 | `/admin/returns/abc` (negatywny) | Strona 404 |

## Sprzątanie

Zwrot odrzucany przez API.
