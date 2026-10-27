# RET-003: Pozycji niezwrotnych nie da się zwrócić, a niedostarczone zamówienie nie ma kreatora

- **ID:** RET-003
- **Kategoria:** zwroty / portal klienta
- **Priorytet:** High
- **Typ:** UI
- **Rola:** gość (klient)
- **Specyfikacja:** [2026-10-22-return-customer-portal](../../specs/implemented/2026-10-22-return-customer-portal.md)

## Test implementation

- [RET-003-ineligible-items-cannot-be-returned.sh](RET-003-ineligible-items-cannot-be-returned.sh) (agent-browser, POSIX sh)
- [RET-003-ineligible-items-cannot-be-returned.ps1](RET-003-ineligible-items-cannot-be-returned.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`, patrz `om-prepare-test-env`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD` agenta z `MANAGE_RULES`. Wspólne funkcje: `.ai/qa/lib/common.sh` i `common.ps1`.
- Dane: PL-10002 (pozycja „Bielizna termoaktywna” niezwrotna) i PL-10004 (niedostarczone, z linkiem do śledzenia). Test nic nie tworzy.

## Scenariusz

```gherkin
Given zamówienie ma pozycję niezwrotną
When klient rozpoczyna zwrot
Then ta pozycja jest wyłączona z powodem „Tego produktu nie można zwrócić”, a zwrotna pozostaje aktywna
And dla zamówienia niedostarczonego klient widzi informację i link „Śledź przesyłkę” zamiast kreatora
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Wyszukaj PL-10002, „Rozpocznij zwrot” | Krok z listą produktów |
| 2 | Pozycja niezwrotna | Pole wyłączone, powód widoczny |
| 3 | Pozycja zwrotna („Kubek”) | Pole aktywne |
| 4 | „Dalej” bez wyboru (negatywny) | Pozostaje na pierwszym kroku |
| 5 | Wyloguj, wyszukaj PL-10004 | „To zamówienie nie zostało jeszcze dostarczone”, „Śledź przesyłkę”, brak „Rozpocznij zwrot” |

## Przypadki brzegowe i uwagi

- Zamówienie PL-10003 (dostarczone 120 dni temu, poza oknem zwrotu) nie jest tu użyte, bo jego pozycja jest zajęta przez starą reklamację.

## Sprzątanie

Brak danych do sprzątania.
