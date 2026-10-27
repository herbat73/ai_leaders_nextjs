# RET-002: Agent odrzuca zgłoszony zwrot z uzasadnieniem

- **ID:** RET-002 (dawniej TC-RET-002)
- **Kategoria:** zwroty / panel agenta
- **Priorytet:** High
- **Typ:** UI (strona agenta) z przygotowaniem danych przez API
- **Rola:** agent (konto QA z `MANAGE_RULES`)

## Test implementation

- [RET-002-agent-rejects-return.sh](RET-002-agent-rejects-return.sh) (agent-browser, POSIX sh)
- [RET-002-agent-rejects-return.ps1](RET-002-agent-rejects-return.ps1) (agent-browser, PowerShell)

## Warunki wstępne

- Jak w [RET-001](RET-001-customer-return-happy-path.md): działa środowisko testowe, `.ai/qa/test-env.env` ma dane agenta.
- Dane klienta powstają przez API (wyszukanie gościa, potem `POST /api/returns`) na zamówieniu PL-10001.

## Scenariusz

```gherkin
Given w skrzynce agenta jest zgłoszony zwrot (utworzony przez API)
And agent jest zalogowany
When otwiera kartę decyzji i podaje uzasadnienie odrzucenia o wymaganej długości
Then zwrot otrzymuje status „Odrzucone” z podaną notatką
And przyciski decyzji znikają, a skrzynka pokazuje zwrot jako „Odrzucone”
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Setup: klient zgłasza zwrot przez API | Powstaje RMA-* |
| 2 | Logowanie agenta na `/admin/login` | Przekierowanie na `/admin/returns` |
| 3 | Skrzynka | RMA widoczne na liście, link do `/admin/returns/*` |
| 4 | Otwórz kartę decyzji, „Odrzuć” | Karta dotyczy tego RMA |
| 5 | Wpisz za krótkie uzasadnienie (negatywny) | Przycisk „Odrzuć zgłoszenie” jest nieaktywny |
| 6 | Wpisz poprawne uzasadnienie, „Odrzuć zgłoszenie” | Status „Odrzucone”, notatka widoczna, brak przycisków decyzji |
| 7 | Wróć do skrzynki | Komórka statusu wiersza to „Odrzucone” |

## Sprzątanie

Odrzucenie zwalnia zablokowaną jednostkę (D14), więc udany przebieg niczego nie zostawia. Gdy test padnie przed odrzuceniem, sprzątanie odrzuca zwrot przez API.
