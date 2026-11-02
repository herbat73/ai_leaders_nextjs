# AGT-007: Macierz uprawnień menedżera na trasach API agentów

- **ID:** AGT-007
- **Kategoria:** agenci i role
- **Priorytet:** High (P1, bezpieczeństwo, zagrożenie T-06, issue #83)
- **Typ:** API
- **Rola:** menedżer QA (`MANAGE_RULES`) oraz tymczasowy agent bez uprawnień (zaproszony i przyjęty przez API)
- **Specyfikacja:** [2026-10-24-agent-login-and-roles](../../specs/implemented/2026-10-24-agent-login-and-roles.md)

## Test implementation

- [AGT-007-manager-permission-matrix.sh](AGT-007-manager-permission-matrix.sh) (curl, POSIX sh; bez przeglądarki)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`); `.ai/qa/test-env.env` zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` menedżera. Wspólne funkcje: `.ai/qa/lib/common.sh`.
- Skrypt nie tworzy danych po stronie menedżera: wysyła puste treści i nieistniejące id, więc „przeszło sprawdzenie uprawnień” oznacza 400/404, a nie 403.
- Ruch „zatwierdź zwrot powyżej limitu” (`PATCH /api/returns/[id]`) nie jest tu pokryty (żaden zwrot z danych testowych nie sięga limitu, jak w AGT-004); pokrywa go `return.service.test.ts`.

## Scenariusz

```gherkin
Given menedżer i agent bez uprawnienia zarządzania są zalogowani przez API
When każdy z nich wywołuje akcje zarezerwowane dla menedżera
Then agent bez uprawnienia dostaje 403, a menedżer nie dostaje 403
And agent bez uprawnienia nadal ma dostęp do tras wspólnych (dostawcy GET, roszczenia, zwroty)
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | `GET`/`POST /api/agents`, `PATCH /api/agents/<id>` | agent: 403; menedżer: 200/400/404 |
| 2 | `POST /api/suppliers`, `PATCH /api/suppliers/<id>` | agent: 403; menedżer: 400/404 |
| 3 | `GET /api/suppliers`, trasy `/api/supplier-claims`, `/api/returns` | agent: ani 401, ani 403 |
| 4 | `GET /api/agents` bez sesji (negatywny) | 401 |

Statyczną stronę tego pokrycia daje `packages/core/src/http/agent-routes.coverage.test.ts` (każda trasa agenta deklaruje `permission` i jest w tabeli `ROUTE_PERMISSIONS`; brak decyzji = `npm test` czerwony).

## Sprzątanie

Tymczasowy agent jest wyłączany w sprzątaniu.
