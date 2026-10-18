# Portal zwrotów i reklamacji e-commerce — wstępna koncepcja

Koncepcja portalu sklepu internetowego do obsługi **zwrotów, reklamacji, uszkodzeń w transporcie i braków w przesyłce**. Obejmuje portal klienta, panel obsługi (agent, kierownik, magazyn) i portal dostawcy.

Funkcje i przepływy wzorowano na Claimlane (benchmark funkcjonalny i UX). Wykorzystane wzorce:
- samoobsługowe zgłoszenie po numerze zamówienia;
- wymagane dowody zależne od produktu i dostawcy;
- reguły automatyzacji bez kodu, w tym akceptacja automatyczna i zasada „zatrzymaj produkt”;
- reklamacje do dostawców z kontrolą ich wytycznych;
- skan i ocena zwrotów w magazynie;
- rekomendacja rozwiązania.

Identyfikacja wizualna, treści i kod są własne. „TwójSklep” to nazwa przykładowa, a wszystkie dane są fikcyjne.

## Zawartość

| # | Rezultat | Plik |
|---|---|---|
| 1 | Użytkownicy, potrzeby, kontekst prawny (PL), macierz uprawnień | [docs/01-uzytkownicy-i-potrzeby.md](docs/01-uzytkownicy-i-potrzeby.md) |
| 2 | 16 use case'ów, przepływy (główne, alternatywne, wyjątki), model statusów, reguły | [docs/02-use-case-i-przeplywy.md](docs/02-use-case-i-przeplywy.md) |
| 3 | Mapa ekranów (24 ekrany, 3 aplikacje) i nawigacji | [docs/03-mapa-ekranow-i-nawigacja.md](docs/03-mapa-ekranow-i-nawigacja.md) |
| 4 | Specyfikacja ekranów: cel, funkcje, komponenty, stany, walidacje, API | [docs/04-specyfikacja-ekranow.md](docs/04-specyfikacja-ekranow.md) |
| 4a | Katalog API: konwencje, błędy, ok. 60 endpointów, webhooki, model danych | [docs/05-katalog-api.md](docs/05-katalog-api.md) |
| 5 | Klikalne mockupy HTML/CSS/TypeScript | [mockup/](mockup/) |

Diagramy w dokumentacji są zapisane w **Mermaid**. Wyświetlają się w GitHub/GitLab, VS Code i Obsidianie.

## Uruchomienie

**Otwórz `mockup/index.html` w przeglądarce.** Kod jest już skompilowany do `mockup/dist/app.js`, więc nie potrzeba serwera ani internetu.

Opcjonalnie, z lokalnym serwerem:

```bash
cd mockup && python3 -m http.server 8080
```

Przebudowa po zmianach w TypeScripcie (wymaga Node.js):

```bash
cd mockup && npm install && npm run build
```

## Dane demo

| Co | Wartość |
|---|---|
| Zamówienie (gość) | `TS-10482` + `anna@example.com` (dostarczone 5 dni temu) |
| Inne zamówienia | `TS-10391` (40 dni: zwrot niemożliwy, reklamacja tak), `TS-09877` (400 dni, płatność przy odbiorze), `TS-10510` (w drodze) |
| Logowanie linkiem e-mail | `anna@example.com` → „Otwórz link z e-maila (demo)” |
| Status zgłoszenia | `RMA-2026-00871` / `RMA-2026-00880` + `anna@example.com` |
| Pracownik / dostawca | przyciski SSO na `#/panel-logowanie` albo przełącznik ról w panelu demo |
| Magazyn — kody do skanu | `RMA-2026-00874`, `RMA-2026-00893`, `6620 1145 9921` |

## Panel demo (lewy dolny róg; w panelu obsługi prawy)

- **Scenariusz API.** *Normalny*, *Wolne API* (stany ładowania), *Puste dane* (stany pustych list), *Błąd serwera* (stany błędów z „Spróbuj ponownie”).
- **Role.** Klient (konto), Agent, Magazyn, Dostawca, Wyloguj.
- **Mapa ekranów** z identyfikatorami ze specyfikacji. Kliknięcie sam przełącza rolę, jeśli ekran jej wymaga.
- **Log wywołań API.** Widać, które endpointy z katalogu wywołuje każdy ekran.
- **Symulacja wygaśnięcia sesji** i **reset danych demo**.

## Ścieżki do przeklikania

1. **Zwrot (UC-02).** Start → `TS-10482` → Zwrot → słuchawki → powód → bon +10% / zwrot pieniędzy / wymiana koloru → paczkomat → wyślij. Przy wartości powyżej 150 zł zgłoszenie trafia do decyzji agenta.
2. **Automatyczna akceptacja (UC-09).** Zwrot jednego kubka (39 zł) uruchamia regułę R1. Od razu dostajesz kod QR.
3. **Zatrzymaj produkt.** Uszkodzenie w transporcie kubka (≤ 60 zł) uruchamia regułę R2. Zwrot pieniędzy następuje bez odsyłania produktu.
4. **Reklamacja z dowodami (UC-03).** Słuchawki → wymagane zdjęcie, **wideo** (reguła R4) i **numer seryjny** (produkt i dostawca). Do testów walidacji służą pliki demo: zbyt duży, `.exe`, z wirusem.
5. **Prośba o informacje (UC-07).** Klient → `RMA-2026-00871` → dodaj wideo i numer seryjny → wyślij.
6. **Obsługa agenta (UC-10).** Skrzynka → karta zgłoszenia → rekomendacja → Akceptuj / Poproś / Zaproponuj / Odrzuć. Następnie „Symuluj: paczka nadana”.
7. **Magazyn (UC-11).** Magazyn → skan RMA → inspekcja (stan, ocena A/B/C, wada, dyspozycja) → karta zgłoszenia → „Wykonaj rozwiązanie”.
8. **Dostawca (UC-12).** Karta zgłoszenia → „Przekaż do dostawcy” (kontrola wytycznych) → Dostawcy → wyślij. Potem rola Dostawca → uznaj i wystaw notę.
9. **Propozycja (UC-07).** Agent → „Zaproponuj inne” (np. bon) → klient przez „Sprawdź status” → Akceptuję / Odrzucam.
10. **Zgłoszenie w imieniu klienta (UC-13).** „＋ Nowe zgłoszenie” → wyszukaj „Kowalska” → kreator z banerem asysty.
11. **Reguły, analityka i ustawienia (UC-14/15).** Nowa reguła z symulacją, wykresy z tooltipem i widokiem tabeli, walidacja polityki zwrotów.

## Struktura mockupu

```
mockup/
├── index.html, styles.css      # punkt wejścia, design system (tokeny, komponenty, responsywność)
├── dist/app.js                 # skompilowany TypeScript
├── src/
│   ├── types.ts                # model domenowy (zgodny z katalogiem API)
│   ├── data.ts                 # słowniki, dane demo, magazyn stanu (localStorage)
│   ├── logic.ts                # kwalifikowalność, wymagane dowody, kalkulacja, silnik reguł, rekomendacja
│   ├── api.ts                  # symulowane API (opóźnienia, scenariusze, kody błędów, log)
│   ├── validation.ts, ui.ts, router.ts, layout.ts, util.ts
│   └── screens/                # portal.ts (K-xx), wizard.ts (Z-xx), bo.ts (B-01/02), ops.ts (B-03/04, D-01), admin.ts (B-05/06/07)
├── package.json, tsconfig.json
```

## Ograniczenia mockupu

- Backend jest symulowany, a stan zapisuje się w `localStorage` przeglądarki. Przycisk „Reset danych demo” przywraca stan początkowy.
- Pliki nie są nigdzie wysyłane, a kod QR to wzór poglądowy, nie prawdziwy kod.
- PDF-y nie są generowane, a SSO i CAPTCHA to atrapy.
- Rekomendacja „asystenta AI” to heurystyka. Pokazuje miejsce i format rekomendacji w interfejsie, a nie realny model.
- Analityka łączy stałe dane historyczne z bieżącymi zgłoszeniami utworzonymi w demo.
