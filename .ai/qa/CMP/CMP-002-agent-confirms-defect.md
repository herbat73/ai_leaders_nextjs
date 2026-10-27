# CMP-002: Agent prowadzi reklamację do „odebrane” i potwierdza wadę

- **ID:** CMP-002
- **Kategoria:** reklamacje / panel agenta
- **Priorytet:** High
- **Typ:** UI (strona agenta) z przygotowaniem danych przez API
- **Rola:** agent (konto QA z `MANAGE_RULES`)
- **Specyfikacja:** [2026-10-25-complaints-and-vendor-claim](../../specs/implemented/2026-10-25-complaints-and-vendor-claim.md)

## Test implementation

- [CMP-002-agent-confirms-defect.sh](CMP-002-agent-confirms-defect.sh) (agent-browser, POSIX sh)
- [CMP-002-agent-confirms-defect.ps1](CMP-002-agent-confirms-defect.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Reklamacja powstaje przez API na PL-10005, pozycja L2 („Czapka polarowa”).

## Scenariusz

```gherkin
Given w skrzynce agenta jest zgłoszona reklamacja (utworzona przez API)
When agent zatwierdza ją, oznacza jako w drodze, a po odebraniu wybiera „Wada potwierdzona”
Then karta pokazuje ocenę wady „Wada potwierdzona”
And pojawia się sekcja „Reklamacja do dostawcy”
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Setup: klient składa reklamację przez API | Powstaje RMA-* |
| 2 | Logowanie agenta, otwarcie karty z listy | Widać „Opis wady” i „Jeszcze nie oceniono” |
| 3 | Sprawdź przyciski przed odebraniem (negatywny) | Brak przycisku „Odebrane: wada potwierdzona” |
| 4 | „Zatwierdź”, „Oznacz jako w drodze” | Statusy „Zatwierdzone”, „W drodze” |
| 5 | „Odebrane: wada potwierdzona” | „Wada potwierdzona” i sekcja „Reklamacja do dostawcy” |

## Przypadki brzegowe i uwagi

- Maszyna stanów reklamacji: `received` → `in_service` lub `resolved`; odrzucenia po `received` nie ma.

## Sprzątanie

Zgłoszenia po `submitted` nie da się odrzucić przez API, więc sprzątanie zwalnia jego jednostkę bezpośrednio w jednorazowej bazie testowej (`db_release_rma`; zgoda użytkownika na ten wyjątek od zasady „SQL tylko w `db`”, tylko w skryptach QA).
