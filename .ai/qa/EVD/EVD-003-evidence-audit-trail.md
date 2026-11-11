# EVD-003: Ślad audytowy zdjęć dowodowych (T-23)

- **ID:** EVD-003
- **Kategoria:** dowody (zdjęcia) / bezpieczeństwo
- **Priorytet:** High
- **Typ:** API z kontrolą strony karty agenta
- **Rola:** dwóch klientów-gości (PL-10001, PL-10005) i agent QA
- **Specyfikacja:** [2026-11-10-transport-damage-and-missing-items](../../specs/implemented/2026-11-10-transport-damage-and-missing-items.md); model zagrożeń `doc/security/threat-model.md` T-23; zgłoszenie #145

## Test implementation

- [EVD-003-evidence-audit-trail.sh](EVD-003-evidence-audit-trail.sh) (curl, POSIX sh; wersji PowerShell nie ma); pliki testowe: [lib/evidence-fixtures.mjs](../lib/evidence-fixtures.mjs).
- Karta agenta ze śladem w przeglądarce jest sprawdzana w [RET-011](../RET/RET-011-transport-damage-report.md).

## Warunki wstępne

- Środowisko testowe i działający kontener skanera (`docker compose up -d --wait clamav`).

## Scenariusz

```gherkin
Given klient wysyła zdjęcie, zgłasza uszkodzenie, a agent otwiera zdjęcie
Then baza ma wiersze „dodane” (klient), „usunięte” (klient, przed wysyłką) i „otwarte” (agent, raz na 10 minut)
And karta decyzji agenta pokazuje „Historia zdjęć”
And strona śledzenia klienta i podgląd widoku klienta jej nie zawierają
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Wysyłka zdjęcia | jeden wiersz `added`, `guest`, zamówienie PL-10001, bez zgłoszenia |
| 2 | Odrzucony plik (SVG), cudze usunięcie, usunięcie nieznanego id (negatywne) | brak nowych wierszy |
| 3 | Cofnięcie zdjęcia przez klienta | wiersze `added` i `removed`, pliku już nie ma |
| 4 | Zgłoszenie ze zdjęciem | wiersz `added` powiązany ze zgłoszeniem |
| 5 | Klient trzy razy otwiera własne zdjęcie | brak wierszy `downloaded` |
| 6 | Agent trzy razy otwiera zdjęcie | jeden wiersz `downloaded` z agentem i zgłoszeniem |
| 7 | Cudzy klient i nieznane id (negatywne) | brak nowego wiersza |
| 8 | Po 11 minutach (przesunięcie w bazie QA) agent otwiera ponownie | drugi wiersz |
| 9 | Karta agenta | „Historia zdjęć”, „Klient dodał zdjęcie”, „Agent otworzył zdjęcie” |
| 10 | Strona śledzenia i podgląd widoku klienta (negatywne) | brak śladu, miniatura nadal jest |
| 11 | Usunięcie plików zgłoszenia (wyjątek QA na jednorazowej bazie) | wiersze audytu zostają |
