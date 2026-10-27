# LAB-002: Laboratorium odrzuca zły wiersz, dane osobowe i plik w złym kodowaniu

- **ID:** LAB-002
- **Kategoria:** laboratorium próby spraw
- **Priorytet:** Medium
- **Typ:** UI
- **Rola:** agent (konto QA)
- **Specyfikacja:** [2026-10-22-case-sample-lab-and-platform-primitives](../../specs/implemented/2026-10-22-case-sample-lab-and-platform-primitives.md)

## Test implementation

- [LAB-002-import-rejects-bad-files.sh](LAB-002-import-rejects-bad-files.sh) (agent-browser, POSIX sh)
- [LAB-002-import-rejects-bad-files.ps1](LAB-002-import-rejects-bad-files.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Trzy pliki tymczasowe: z niepoprawną kategorią, z adresem e-mail w komórce i z bajtami spoza UTF-8.

## Scenariusz

```gherkin
Given agent otwiera stronę „Próba przypadków”
When wczytuje plik z błędnym wierszem, plik z danymi osobowymi i plik nie w UTF-8
Then każdy jest odrzucony właściwym komunikatem, a wyniki nie są pokazywane
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Plik z kategorią „nie-ma-takiej” (negatywny) | „Plik zawiera błędy…”, błąd w wierszu 3, kolumnie category |
| 2 | Plik z e-mailem w komórce (negatywny) | „Wiersz wygląda na dane osobowe…”, adres nie jest powtórzony na stronie |
| 3 | Plik z bajtami 0xFF 0xFE (negatywny) | „Zapisz plik jako CSV UTF-8 i spróbuj ponownie”, bez wywołania API |

## Przypadki brzegowe i uwagi

- Komunikaty błędów nigdy nie zawierają wartości komórek (specyfikacja: log nie może nosić danych osobowych).

## Sprzątanie

Brak danych do sprzątania.
