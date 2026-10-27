# LAB-001: Agent wczytuje próbę CSV i odczytuje wyniki

- **ID:** LAB-001
- **Kategoria:** laboratorium próby spraw
- **Priorytet:** Medium
- **Typ:** UI
- **Rola:** agent (konto QA)
- **Specyfikacja:** [2026-10-22-case-sample-lab-and-platform-primitives](../../specs/implemented/2026-10-22-case-sample-lab-and-platform-primitives.md)

## Test implementation

- [LAB-001-agent-imports-a-sample-and-reads-results.sh](LAB-001-agent-imports-a-sample-and-reads-results.sh) (agent-browser, POSIX sh)
- [LAB-001-agent-imports-a-sample-and-reads-results.ps1](LAB-001-agent-imports-a-sample-and-reads-results.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Plik CSV z 10 sprawami powstaje w pliku tymczasowym ze stałymi wartościami, więc oczekiwane liczby są stałe.

## Scenariusz

```gherkin
Given agent otwiera stronę „Próba przypadków”
When wczytuje plik CSV z 10 sprawami
Then widzi 10 spraw, 70% z dopytaniem, medianę 4 wiadomości i 30% rozstrzygniętych regułą
And rozbicia i tabela reguł zgadzają się z danymi (R08: 3 dopasowania, R09: 0)
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Strona laboratorium | Opis, „Pobierz szablon CSV”, „Nic nie jest zapisywane.” |
| 2 | Wczytanie pliku | Kafelki wyników |
| 3 | Kafelki | Liczba spraw 10, dopytania 70%, mediana 4, rozstrzygnięte 30% |
| 4 | Rozbicia i reguły | Zwrot 5 (50%), Reklamacja 3 (30%), E-mail 7 (70%), R08 3, R09 0 |
| 5 | Identyfikatory (negatywny) | Widać C01, C06, C10; numerów źródłowych S06, S10 nie ma |

## Przypadki brzegowe i uwagi

- Strona anonimizuje numery spraw (C01…): to część wymagania prywatności.

## Sprzątanie

Brak danych do sprzątania (strona niczego nie zapisuje).
