# CMP-001: Klient zgłasza reklamację od wyszukania zamówienia do strony statusu

- **ID:** CMP-001
- **Kategoria:** reklamacje / portal klienta
- **Priorytet:** High
- **Typ:** UI
- **Rola:** gość (klient); konto agenta QA tylko do sprzątania
- **Specyfikacja:** [2026-10-25-complaints-and-vendor-claim](../../specs/implemented/2026-10-25-complaints-and-vendor-claim.md)

## Test implementation

- [CMP-001-customer-files-complaint.sh](CMP-001-customer-files-complaint.sh) (agent-browser, POSIX sh)
- [CMP-001-customer-files-complaint.ps1](CMP-001-customer-files-complaint.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Zamówienie z fałszywego źródła: PL-10005 / maria.lewandowska@example.pl, pozycja „Czapka polarowa” (dostarczona 2 dni temu).

## Scenariusz

```gherkin
Given gość zna numer zamówienia PL-10005 i adres e-mail z zamówienia
When wybiera „Zgłoś reklamację produktu”, zaznacza czapkę, opisuje wadę (min. 20 znaków) z datą, wybiera kuriera i naprawę
And potwierdza oświadczenie i wysyła reklamację
Then trafia na stronę statusu nowego zgłoszenia RMA-*
And status to „Zgłoszone” i widać reklamowany produkt
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Wyszukaj zamówienie PL-10005 | Przekierowanie na `/returns`, „Twoje zgłoszenia” |
| 2 | „Zgłoś reklamację produktu”, zaznacz „Czapka polarowa”, „Dalej” | Krok „Opisz wadę” |
| 3 | Opis „Za krótko” + dzisiejsza data (negatywny) | „Opisz wadę w co najmniej 20 znakach.”, brak przejścia dalej |
| 4 | Poprawny opis, kurier, naprawa | Widać wskazówkę prawną („w pierwszej kolejności przysługuje Ci naprawa lub wymiana”), podsumowanie |
| 5 | Wyślij bez potwierdzenia (negatywny) | „Zaznacz potwierdzenie, aby wysłać reklamację.” |
| 6 | Zaznacz „Potwierdzam”, wyślij | Przekierowanie na `/returns/RMA-*`, „Aktualny status: Zgłoszone” |

## Przypadki brzegowe i uwagi

- Pole daty ignoruje zwykłe `fill`: skrypty ustawiają je przez natywny setter wartości i zdarzenie `input` (`fill_date`).
- Zamówienie PL-10003 jest zajęte przez starą reklamację RMA-2026-00001 (dane ręczne), dlatego test używa PL-10005.

## Sprzątanie

Skrypt odrzuca utworzoną reklamację przez `PATCH /api/returns/[id]` (status `submitted`), co zwalnia jednostkę.
