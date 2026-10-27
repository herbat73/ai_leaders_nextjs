# CMP-003: Agent stwierdza brak wady: bez przekazania do dostawcy, reklamację można zamknąć

- **ID:** CMP-003
- **Kategoria:** reklamacje / panel agenta
- **Priorytet:** Medium
- **Typ:** UI (strona agenta) z przygotowaniem danych przez API
- **Rola:** agent (konto QA z `MANAGE_RULES`)
- **Specyfikacja:** [2026-10-25-complaints-and-vendor-claim](../../specs/implemented/2026-10-25-complaints-and-vendor-claim.md)

## Test implementation

- [CMP-003-agent-finds-no-defect.sh](CMP-003-agent-finds-no-defect.sh) (agent-browser, POSIX sh)
- [CMP-003-agent-finds-no-defect.ps1](CMP-003-agent-finds-no-defect.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Reklamacja powstaje przez API na PL-10005, pozycja L1 („Rękawiczki skórzane”).

## Scenariusz

```gherkin
Given reklamacja jest odebrana
When agent wybiera „Odebrane: brak wady”
Then karta pokazuje „Brak wady” i nie oferuje sekcji „Reklamacja do dostawcy”
And agent może zakończyć sprawę („Zakończone”)
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Setup przez API, logowanie, otwarcie karty | Karta zgłoszenia |
| 2 | „Zatwierdź”, „Oznacz jako w drodze” | „Zatwierdzone”, „W drodze” |
| 3 | „Odebrane: brak wady” | „Brak wady” na karcie |
| 4 | Sprawdź sekcję dostawcy (negatywny) | Brak tekstu „Reklamacja do dostawcy” |
| 5 | „Zakończ” | Status „Zakończone” |

## Przypadki brzegowe i uwagi

- Specyfikacja: przy „Brak wady” reklamacja przechodzi do `resolved` bez sekcji dostawcy.

## Sprzątanie

Zgłoszenia po `submitted` nie da się odrzucić przez API, więc sprzątanie zwalnia jego jednostkę bezpośrednio w jednorazowej bazie testowej (`db_release_rma`; zgoda użytkownika na ten wyjątek od zasady „SQL tylko w `db`”, tylko w skryptach QA).
