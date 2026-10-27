# LAB-003: Scenariusz „co jeśli” przelicza dopasowania reguł z innymi progami

- **ID:** LAB-003
- **Kategoria:** laboratorium próby spraw
- **Priorytet:** Medium
- **Typ:** UI
- **Rola:** agent (konto QA)
- **Specyfikacja:** [2026-10-22-case-sample-lab-and-platform-primitives](../../specs/implemented/2026-10-22-case-sample-lab-and-platform-primitives.md)

## Test implementation

- [LAB-003-what-if-recalculates-rule-matches.sh](LAB-003-what-if-recalculates-rule-matches.sh) (agent-browser, POSIX sh)
- [LAB-003-what-if-recalculates-rule-matches.ps1](LAB-003-what-if-recalculates-rule-matches.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Ten sam plik CSV co w LAB-001: przy progu bazowym R08 (150 zł) pasują 3 zwroty (89, 45, 120 zł), przy progu 50 zł tylko ten za 45 zł.

## Scenariusz

```gherkin
Given wyniki próby są pokazane z progami bazowymi
When agent wpisuje próg R08 50,00 zł i klika „Przelicz ponownie”
Then kolumna scenariusza pokazuje 1 dopasowanie R08 obok 3 bazowych
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Wczytaj próbę | R08: 3 dopasowania bazowe |
| 2 | Próg „abc” (negatywny) | „Popraw progi i spróbuj ponownie” |
| 3 | Próg 50,00, „Przelicz ponownie” | „Scenariusz:”, R08: 3 bazowe i 1 w scenariuszu |

## Sprzątanie

Brak danych do sprzątania.
