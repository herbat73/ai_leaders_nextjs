# RET-005: Zły numer zamówienia i zły e-mail dają ten sam neutralny komunikat

- **ID:** RET-005
- **Kategoria:** zwroty / portal klienta
- **Priorytet:** High
- **Typ:** UI + API
- **Rola:** anonimowy użytkownik
- **Specyfikacja:** [2026-10-22-return-customer-portal](../../specs/implemented/2026-10-22-return-customer-portal.md)

## Test implementation

- [RET-005-lookup-answers-neutrally-for-wrong-data.sh](RET-005-lookup-answers-neutrally-for-wrong-data.sh) (agent-browser, POSIX sh)
- [RET-005-lookup-answers-neutrally-for-wrong-data.ps1](RET-005-lookup-answers-neutrally-for-wrong-data.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Limiter wyszukiwania liczy porażki na IP: skrypt wykonuje 3 nieudane wyszukiwania.

## Scenariusz

```gherkin
Given nieznany klient wyszukuje zamówienie
When podaje zły e-mail do istniejącego zamówienia albo nieistniejący numer
Then widzi ten sam komunikat „Nie znaleźliśmy zamówienia pasującego do podanych danych.”
And nie dostaje sesji (brak ciasteczka), a API zwraca ten sam kod
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | PL-10001 + obcy e-mail (UI) | Neutralny komunikat |
| 2 | PL-99999 + poprawny e-mail (UI) | Ten sam komunikat, pozostaje na stronie głównej |
| 3 | API: oba przypadki | Brak ciasteczka sesji, równe kody statusu |

## Sprzątanie

Brak danych do sprzątania.
