# SUP-001: Reklamacja do dostawcy zostaje szkicem, gdy poczta nie dostarcza

- **ID:** SUP-001
- **Kategoria:** roszczenia do dostawców
- **Priorytet:** High
- **Typ:** UI (strona agenta) z przygotowaniem danych przez API
- **Rola:** agent (konto QA z `MANAGE_RULES`)
- **Specyfikacja:** [2026-10-25-complaints-and-vendor-claim](../../specs/implemented/2026-10-25-complaints-and-vendor-claim.md)

## Test implementation

- [SUP-001-claim-stays-draft-without-delivering-mail.sh](SUP-001-claim-stays-draft-without-delivering-mail.sh) (agent-browser, POSIX sh)
- [SUP-001-claim-stays-draft-without-delivering-mail.ps1](SUP-001-claim-stays-draft-without-delivering-mail.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Środowisko działa z domyślnym transportem poczty `log` (nie dostarcza). Setup: dostawca o unikalnej nazwie i reklamacja na PL-10005 L2 doprowadzona do `received` z potwierdzoną wadą.

## Scenariusz

```gherkin
Given reklamacja ma potwierdzoną wadę, a transport poczty nie dostarcza wiadomości
When agent wybiera dostawcę i wysyła reklamację do dostawcy
Then roszczenie zostaje zapisane jako „Szkic, nie wysłano”, nigdy jako wysłane
And ponowna wysyłka jest odrzucona komunikatem o braku konfiguracji poczty
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Otwórz kartę, sekcja „Reklamacja do dostawcy” | Widać formularz |
| 2 | Wyślij bez dostawcy (negatywny) | „Wybierz dostawcę.” |
| 3 | Wybierz dostawcę | Ostrzeżenie „Poczta nie dostarcza wiadomości…”, wytyczne dostawcy |
| 4 | „Wyślij reklamację do dostawcy” | Odznaka „Szkic, nie wysłano”, link „Otwórz reklamację” |
| 5 | Strona roszczenia, „Wyślij ponownie” (negatywny) | „Poczta nie jest skonfigurowana do wysyłki”, brak „Wysłano, czekamy na dostawcę” |
| 6 | Lista roszczeń | Wiersz ze szkicem |

## Przypadki brzegowe i uwagi

- Wybór z listy rozwijanej wymaga poczekania, aż popup się zamknie (`wait_listbox_closed`), bo na chwilę ukrywa resztę strony przed drzewem dostępności.
- Po wysłaniu strona się odświeża, więc test sprawdza trwały stan (odznaka, link), a nie chwilowy komunikat.

## Sprzątanie

Dostawca jest dezaktywowany przez `PATCH /api/suppliers/[id]` (`active: false`), a reklamacja zwolniona w bazie testowej.
