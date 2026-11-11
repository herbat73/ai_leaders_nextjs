# EVD-002: Zdjęcia dołączane do zgłoszenia przy wysyłce

- **ID:** EVD-002
- **Kategoria:** dowody (zdjęcia) / bezpieczeństwo
- **Priorytet:** High
- **Typ:** API
- **Rola:** dwóch klientów-gości (PL-10001, PL-10005) i agent QA
- **Specyfikacja:** [2026-11-10-transport-damage-and-missing-items](../../specs/2026-11-10-transport-damage-and-missing-items.md) (Faza 3)

## Test implementation

- [EVD-002-attach-photos-to-a-report.sh](EVD-002-attach-photos-to-a-report.sh) (curl, POSIX sh; wersji PowerShell nie ma); pliki testowe: [lib/evidence-fixtures.mjs](../lib/evidence-fixtures.mjs).

## Warunki wstępne

- Środowisko testowe i działający kontener skanera (`docker compose up -d --wait clamav`, kontener `easyrms-clamav`).

## Scenariusz

```gherkin
Given klient wysłał zdjęcia przez POST /api/evidence
When zgłasza uszkodzenie w transporcie lub brak elementu z evidenceFileIds
Then zdjęcia są dołączone do zgłoszenia raz, w tej samej transakcji, i tylko z tego samego zamówienia
And zgłoszenie bez zdjęć, z obcym, nieznanym lub już dołączonym id jest odrzucane
And klient i agent widzą miniatury, a przed wysyłką klient może zdjęcie cofnąć
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Zgłoszenie bez `evidenceFileIds` i z pustą listą (negatywne) | 400 z polem `evidenceFileIds` |
| 2 | Siedem id, powtórzone id, tekst zamiast UUID (negatywne) | 400 |
| 3 | Zdjęcie drugiego klienta i nieznane id (negatywne) | identyczne 400, żadne zgłoszenie nie powstaje, cudze zdjęcie nietknięte |
| 4 | Cofnięcie zdjęcia: cudze, bez sesji, własne, powtórnie, odczyt po usunięciu | 404, 401, 200, 404, 404 |
| 5 | Zgłoszenie z dwoma zdjęciami | RMA, oba zdjęcia dołączone |
| 6 | Powtórzenie z tym samym kluczem | 200, ten sam RMA, nic nie dołączone drugi raz |
| 7 | Usunięcie dołączonego zdjęcia, użycie go w drugim zgłoszeniu (negatywne) | 404, 400 |
| 8 | Strona śledzenia, karta agenta, cudzy klient | linki do zdjęć; agent otwiera zdjęcie; cudzy klient 404 |
| 9 | Zgłoszenie braku elementu z jednym zdjęciem | RMA |
