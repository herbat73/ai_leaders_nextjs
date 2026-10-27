# SET-001: `npm run setup` można bezpiecznie uruchamiać ponownie

- **ID:** SET-001
- **Kategoria:** instalator
- **Priorytet:** Low
- **Typ:** CLI (bez przeglądarki)
- **Rola:** programista na przygotowanym checkoucie (zależności zainstalowane, baza osiągalna)
- **Specyfikacja:** [2026-10-14-idempotent-setup-installer](../../specs/implemented/2026-10-14-idempotent-setup-installer.md)

## Test implementation

- [SET-001-setup-is-idempotent.sh](SET-001-setup-is-idempotent.sh) (agent-browser, POSIX sh)
- [SET-001-setup-is-idempotent.ps1](SET-001-setup-is-idempotent.ps1) (agent-browser, PowerShell; nie uruchamiany na maszynie autora, brak `pwsh`)

## Warunki wstępne

- Node i npm; baza PostgreSQL osiągalna na `localhost:5433`.
- Test nie używa środowiska testowego i nie loguje agenta.

## Scenariusz

```gherkin
Given repozytorium jest już przygotowane
When uruchamiam `npm run setup` dwa razy
Then oba przebiegi kończą się kodem 0 i wypisują „Next: npm run dev”
And drugi przebieg pomija instalację zależności, start bazy i migracje („↷ … skipped”)
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Pierwszy przebieg | Kod 0, linia „Next: npm run dev”, brak „✖” |
| 2 | Drugi przebieg | Kod 0, brak „✖” |
| 3 | Kroki w drugim przebiegu (negatywny) | „install dependencies”, „start database”, „run migrations” oznaczone jako skipped |

## Przypadki brzegowe i uwagi

- Ścieżki błędów (brak binariów PostgreSQL, zajęty port) wymagają maszyny bez tych narzędzi i nie są symulowane.

## Sprzątanie

Brak danych do sprzątania.
