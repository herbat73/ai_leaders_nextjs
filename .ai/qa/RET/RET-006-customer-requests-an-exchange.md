# RET-006: Klient wybiera wymianę: opis jest wymagany, kwota nie jest liczona

- **ID:** RET-006
- **Kategoria:** zwroty / portal klienta
- **Priorytet:** Medium
- **Typ:** UI
- **Rola:** gość (klient); konto agenta QA tylko do sprzątania
- **Specyfikacja:** [2026-10-22-return-customer-portal](../../specs/implemented/2026-10-22-return-customer-portal.md)

## Test implementation

- [RET-006-customer-requests-an-exchange.sh](RET-006-customer-requests-an-exchange.sh) (agent-browser, POSIX sh)
- [RET-006-customer-requests-an-exchange.ps1](RET-006-customer-requests-an-exchange.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Zamówienie PL-10001, pozycja „Skarpety”.

## Scenariusz

```gherkin
Given klient wybrał produkt, powód i sposób odesłania
When wybiera rozwiązanie „Wymiana”
Then musi opisać, na co wymienia (bez opisu nie przejdzie dalej), a wycena zwrotu nie jest pokazywana
And po wysłaniu strona statusu pokazuje zgłoszenie jako „Zgłoszone”
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Kreator do kroku rozwiązania | Opcje zwrotu, bonu i wymiany |
| 2 | „Wymiana” | Pole „Na co chcesz wymienić?”, brak „Szacowana kwota zwrotu” |
| 3 | „Dalej” bez opisu (negatywny) | „Opisz, na co chcesz wymienić produkt.” |
| 4 | Opis „Skarpety wełniane w rozmiarze L”, „Dalej” | Podsumowanie z opisem wymiany |
| 5 | Potwierdzenie i wysłanie | Strona RMA, „Aktualny status: Zgłoszone” |

## Przypadki brzegowe i uwagi

- W kodzie jest tekst „Przy wymianie nie wyliczamy kwoty.”, ale nie pojawia się na kroku rozwiązania, więc test go nie wymaga.

## Sprzątanie

Zwrot odrzucany przez API.
