# RET-013: Retencja i usuwanie danych klienta (T-21)

- **ID:** RET-013
- **Kategoria:** retencja i anonimizacja / panel agenta i polecenia operatora
- **Priorytet:** High
- **Typ:** UI + CLI (przygotowanie przez API i SQL)
- **Rola:** dwóch klientów-gości (PL-10001, PL-10005) i agent (konto QA z `MANAGE_RULES`)
- **Specyfikacja:** [2026-11-11-evidence-retention-and-erasure](../../specs/2026-11-11-evidence-retention-and-erasure.md); model zagrożeń `doc/security/threat-model.md` (T-21); procedura `doc/security/erasure-runbook.md`

## Test implementation

- [RET-013-retention-and-erasure.sh](RET-013-retention-and-erasure.sh) (agent-browser, curl i `npm run retention:run` / `retention:erase`, POSIX sh; wersji PowerShell nie ma)

## Warunki wstępne

- Działa środowisko testowe (`sh .ai/scripts/test-env-up.sh`); `.ai/qa/test-env.env` (gitignorowany) zawiera `TEST_AGENT_EMAIL` / `TEST_AGENT_PASSWORD`.
- Potrzebny działający kontener skanera (`docker compose up -d --wait clamav`) i Postgres z migracją `anonymized_at`.
- Dane: PL-10001 / anna.kowalska@example.pl i PL-10005 / maria.lewandowska@example.pl, pozycja L1 każdego zamówienia.
- Skrypt cofa daty zdarzeń zgłoszeń o 400 dni zapytaniem SQL na jednorazowej bazie testowej (`qa_init` zaczyna od świeżej bazy) i uruchamia polecenia retencji z korzenia repozytorium na tej bazie.

## Scenariusz

```gherkin
Given zgłoszenie A (uszkodzenie w transporcie ze zdjęciem) zakończone ponad rok temu i zgłoszenie B (brak w przesyłce ze zdjęciem) nadal otwarte
When operator uruchamia retention:run z domyślnym okresem 365 dni
Then A traci zdjęcie, wpisy audytu, e-mail i teksty, ale zachowuje numer zamówienia i status
And B zostaje bez zmian, a panel agenta pokazuje „Zanonimizowano” przy A
```

| Krok | Akcja | Oczekiwany rezultat |
|---|---|---|
| 1 | Dwa zgłoszenia ze zdjęciami (klient A i B), agent zatwierdza i kończy A | A „Zakończone”, B „Zgłoszone” |
| 2 | Karta A i lista przed retencją | e-mail, opis uszkodzenia i link do zdjęcia |
| 3 | Zdarzenia A i B cofnięte o 400 dni; `retention:run --dry-run` | wypisuje tylko A, nic nie zmienia |
| 4 | `EASYRMS_RETENTION_DAYS=7` (negatywny) | odmowa z komunikatem o zakresie 30–3650, nic nie usunięte |
| 5 | `EASYRMS_RETENTION_DAYS=500` (negatywny) | „anonymized 0”, zgłoszenia 400-dniowe zostają |
| 6 | `retention:run` | A zanonimizowane: e-mail `erased-<RMA>@anonymized.invalid`, brak tekstów, zdjęcia i wpisów audytu; zachowane zamówienie i status; B bez zmian |
| 7 | Drugie `retention:run` | „anonymized 0” |
| 8 | `retention:erase` dla otwartego B, nieznanego RMA i już usuniętego A (negatywne) | odmowa, odmowa, „already erased”; B bez zmian |
| 9 | Karta A po retencji | „Zanonimizowano <data>” zamiast e-maila, brak opisu i zdjęcia, adres zdjęcia daje 404 |
| 10 | Lista po retencji | A: „Zanonimizowano”, B: jego e-mail |
| 11 | Karta B po retencji | bez zmian, zdjęcie otwiera się (200) |
| 12 | Strona śledzenia A w sesji gościa | 200, bez opisu i bez linku do zdjęcia |

Nie objęte: `retention:erase --force` dla otwartego zgłoszenia, czyszczenie osieroconych zdjęć przez aplikację (pokrywa je test bazy `npm run test:db`), harmonogram uruchamiania.

## Sprzątanie

Jak w RET-007: skrypt zwalnia jednostki zgłoszeń w jednorazowej bazie testowej (`qa_init` zaczyna od świeżej bazy).

## Stan wykonania

Zaliczony 2026-11-11 na PR #148, zrzuty w `doc/previdences/pr-148/`.
