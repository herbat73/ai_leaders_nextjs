# EVD-001: Przesyłanie i pobieranie zdjęć dowodowych (API)

- **ID:** EVD-001
- **Kategoria:** dowody (zdjęcia) / bezpieczeństwo
- **Priorytet:** High
- **Typ:** API
- **Rola:** dwóch klientów-gości (PL-10001, PL-10005) i agent QA
- **Specyfikacja:** [2026-11-10-transport-damage-and-missing-items](../../specs/implemented/2026-11-10-transport-damage-and-missing-items.md) (Faza 2); model zagrożeń `doc/security/threat-model.md` sekcja 5

## Test implementation

- [EVD-001-evidence-upload-and-download.sh](EVD-001-evidence-upload-and-download.sh) (curl, POSIX sh; wersji PowerShell nie ma)
- Pliki testowe generuje [lib/evidence-fixtures.mjs](../lib/evidence-fixtures.mjs) (JPEG z GPS EXIF, PNG, WebP, SVG pod nazwą .png, HTML, nagłówek PNG 100000x100000, plik 6 MB, napis EICAR).

## Warunki wstępne

- Środowisko testowe jak w pozostałych scenariuszach oraz działający kontener skanera: `docker compose up -d --wait clamav` (nazwa kontenera `easyrms-clamav`; pierwszy start pobiera definicje wirusów). Skrypt zatrzymuje kontener na chwilę i uruchamia go ponownie.
- Test nic nie zgłasza ani nie zmienia w zgłoszeniach.

## Scenariusz

```gherkin
Given klient z sesją zamówienia
When wysyła zdjęcie
Then plik jest sprawdzany co do zawartości, skanowany i zapisywany ponownie zakodowany, bez metadanych
And pobrać go może tylko ten klient i agent, a inne przypadki dają identyczne 404
And przy zatrzymanym skanerze wysyłka kończy się 503 i nic się nie zapisuje
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Wysyłka bez sesji (negatywny) | 401 |
| 2 | JPEG z GPS EXIF, nazwa `../../etc/passwd.jpg` | 201; etykieta `passwd.jpg`; pobranie: `nosniff`, CSP `sandbox`, nazwa z id, `private, no-store`, brak EXIF i ICC |
| 3 | PNG, WebP | 201 |
| 4 | SVG pod nazwą .png, HTML, tekst EICAR (negatywne) | 400 `not_an_image` |
| 5 | Nagłówek 100000x100000, plik 6 MB, zadeklarowane 99 MB (negatywne) | 422 `rejected`; 413 `too_large` |
| 6 | Treść nie multipart, dwa pliki naraz (negatywne) | 400 |
| 7 | Siódme zdjęcie jednego zamówienia (negatywny) | 409 `quota_exceeded` |
| 8 | Odczyt: drugi klient, brak cookie, nieznane i błędne id (negatywne) | identyczne 404; agent: 200 |
| 9 | 25 wysyłek z jednego zamówienia i IP (negatywny) | w końcu 429 |
| 10 | Skaner zatrzymany (negatywny) | 503 `scanner_unavailable`, brak nowego wiersza; po starcie skanera 201 |

## Uwagi

- Napis EICAR nie jest obrazem, więc przez trasę nie dociera do skanera (400). Że prawdziwy skaner zgłasza go jako zainfekowany, sprawdza test `CLAMD_LIVE=1 npm test -w @easyrms/app` (`clamd-scanner.live.test.ts`).
- Użycie zdjęć przez klienta i agenta (kreator, miniatury) to Faza 3; tu sprawdzane jest tylko zaplecze.
