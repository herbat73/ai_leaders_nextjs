# RET-001: Klient zgłasza zwrot od wyszukania zamówienia do strony statusu

- **ID:** RET-001 (dawniej TC-RET-001)
- **Kategoria:** zwroty / portal klienta
- **Priorytet:** High
- **Typ:** UI
- **Rola:** gość (klient); konto agenta QA służy tylko do sprzątania

## Test implementation

- [RET-001-customer-return-happy-path.sh](RET-001-customer-return-happy-path.sh) (agent-browser, POSIX sh)
- [RET-001-customer-return-happy-path.ps1](RET-001-customer-return-happy-path.ps1) (agent-browser, PowerShell)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`).
- `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`.
- Zamówienie z fałszywego źródła: PL-10001 / anna.kowalska@example.pl, pozycja „Skarpety”.

## Scenariusz

```gherkin
Given gość zna numer zamówienia PL-10001 i adres e-mail z zamówienia
When wyszukuje zamówienie, wybiera „Skarpety”, podaje powód, sposób wysyłki i formę rozwiązania
And potwierdza oświadczenie i wysyła zgłoszenie
Then trafia na stronę statusu nowego zgłoszenia RMA-*
And status to „Zgłoszone” i widać pozycję „Skarpety”
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Otwórz stronę główną | Widać „Zwrot zamówienia” |
| 2 | Wpisz numer zamówienia i e-mail, „Sprawdź zamówienie” | Przekierowanie na `/returns`, „Twoje zgłoszenia” |
| 3 | „Rozpocznij zwrot”, zaznacz „Skarpety”, „Dalej” | Pytanie o powód |
| 4 | Powód „Nieodpowiedni rozmiar”, wysyłka „Zwrot w sklepie”, rozwiązanie „Zwrot pieniędzy” | Widać „Szacowana kwota zwrotu”, potem „Sprawdź i wyślij zgłoszenie” |
| 5 | Wyślij bez potwierdzenia (negatywny) | Pozostaje na podsumowaniu `/returns/new` |
| 6 | Zaznacz „Potwierdzam”, wyślij | Przekierowanie na `/returns/RMA-*` |
| 7 | Strona statusu | „Aktualny status: Zgłoszone”, „Skarpety” |

## Przypadki brzegowe

- Pozycja nie do wyboru, gdy jej jednostka jest zablokowana otwartym zwrotem (skrypt podpowiada, by go najpierw odrzucić).

## Sprzątanie

Skrypt odrzuca utworzony zwrot przez `PATCH /api/returns/[id]` (notatka 30+ znaków), co zwalnia jednostkę (D14) i pozwala uruchomić scenariusz ponownie.
