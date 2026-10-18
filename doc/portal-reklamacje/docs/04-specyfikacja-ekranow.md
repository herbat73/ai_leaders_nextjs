# 4. Specyfikacja ekranów

Szablon dla każdego ekranu: **cel · funkcje · komponenty UI · stany (loading / empty / error / success) · walidacje · API**. Endpointy — [katalog API](05-katalog-api.md).

## 4.0. Zasady wspólne

**Komponenty bazowe:** `ShopHeader` (portal), `Sidebar` (panel), `Button` (primary / secondary / ghost / danger), `TextField`, `Select`, `RadioCards`, `Checkbox`, `Stepper` (`Qty` +/−), `Textarea` z licznikiem, `MediaUploader` (zdjęcia / wideo, miniatury, postęp, skan AV), `ProductLine` (miniatura, nazwa, wariant, cena, kwalifikowalność), `OrderSummary`, `StatusBadge`, `StatusTracker` (5 etapów), `Alert`, `ErrorSummary`, `Card`, `Tabs`, `Timeline`, `ChatThread` (wiadomości + notatki wewnętrzne), `QrCode`, `DataTable` z filtrami i zapisanymi widokami, `SlaIndicator`, `KpiTile`, `BarChart`, `RuleBuilder`, `Modal`, `Drawer`, `Toast`, `Skeleton`, `EmptyState`, `ErrorState`, `DemoPanel` (tylko mockup).

| Stan | Wzorzec |
|---|---|
| Loading | Skeleton w kształcie treści; przyciski akcji: spinner + `aria-busy`, blokada podwójnego kliknięcia; po 2 s „To trwa dłużej niż zwykle…” |
| Empty | Ikona + jedno zdanie + jedna akcja (CTA) |
| Error | `ErrorState` (opis, „Spróbuj ponownie”, kod błędu); formularze — `ErrorSummary` + błędy przy polach (`aria-invalid`, `aria-describedby`) |
| Success | Treść; po akcji — `Toast` lub ekran potwierdzenia |

**Słownik walidatorów**

| Kod | Reguła |
|---|---|
| `ORDER_NO` | `TS-` + 5 cyfr (np. `TS-10482`), wielkość liter bez znaczenia |
| `RMA_NO` | `RMA-RRRR-NNNNN` |
| `EMAIL` | RFC 5322 (uproszczony), ≤ 254 znaki |
| `PHONE` | PL: 9 cyfr z opcjonalnym `+48`; inne: E.164 |
| `IBAN_PL` | `PL` + 26 cyfr, mod 97 = 1 (tylko przy płatności za pobraniem) |
| `ZIP_PL` | `NN-NNN` |
| `SERIAL` | 6–20 znaków `A–Z 0–9 -`, wielkie litery |
| `QTY` | 1 … ilość zamówiona − ilość już zgłoszona |
| `PHOTO` | JPG / PNG / HEIC ≤ 15 MB; min. liczba wg wymagań |
| `VIDEO` | MP4 / MOV ≤ 100 MB |
| `DESC` | reklamacja: 20–1500 znaków; zwrot: 0–500 |
| `DATE_DEFECT` | data wykrycia wady: ≥ data dostawy, ≤ dziś |
| `MONEY` | > 0, ≤ wartość zgłoszenia, 2 miejsca po przecinku |

---

## K-01 Start portalu: znajdź zamówienie

- **Cel:** w jednym kroku zidentyfikować zamówienie i wpuścić klienta do kreatora.
- **Funkcje:** formularz nr zamówienia + e-mail (przełącznik: e-mail / telefon); linki „Zaloguj się linkiem e-mail” (K-02) i „Sprawdź status zgłoszenia” (K-04); skrót polityki (zwrot 30 dni, reklamacja 2 lata, darmowy zwrot na bon); „Gdzie znajdę numer zamówienia?” (tooltip z przykładem e-maila potwierdzającego).
- **Komponenty:** `ShopHeader`, `Card` z formularzem, `SegmentedControl`, `TextField` ×2, `Button`, lista zalet (3 ikony), `Accordion` FAQ.
- **Stany:** *loading* — „Szukamy zamówienia…” w przycisku. *empty* — n/d. *error* — 404: neutralny `Alert` „Nie znaleźliśmy zamówienia dla podanych danych. Sprawdź numer w e-mailu potwierdzającym”; po 5 próbach CAPTCHA; 5xx: `Alert` + ponów; zamówienie w drodze: `Alert` info z linkiem do śledzenia przesyłki. *success* — Z-01.
- **Walidacje:** `ORDER_NO` wymagany; `EMAIL` lub `PHONE` wymagany.
- **API:** `GET /portal/config`, `POST /portal/orders/lookup`.

## K-02 Logowanie linkiem e-mail

- **Cel:** dostęp do wszystkich zamówień bez hasła.
- **Funkcje:** pole e-mail → „Wyślij link”; ekran „Sprawdź skrzynkę” z odliczaniem do ponownej wysyłki (60 s) i „Zmień e-mail”; (mockup: „Otwórz link z e-maila (demo)”).
- **Komponenty:** `TextField`, `Button`, ilustracja koperty, `Alert`.
- **Stany:** *loading* — przycisk busy. *empty* — n/d. *error* — 5xx: `Alert`; link wygasły (15 min): „Link wygasł — wyślij nowy”. *success* — zawsze „Jeśli konto istnieje, wysłaliśmy link” (bez ujawniania), po kliknięciu linku → K-03.
- **Walidacje:** `EMAIL`.
- **API:** `POST /portal/auth/magic-link`, `POST /portal/auth/magic-link/verify`.

## K-03 Moje zamówienia i zgłoszenia

- **Cel:** punkt startowy klienta z kontem.
- **Funkcje:** sekcja „Twoje zgłoszenia” (status, „wymaga działania”); lista zamówień (data, status dostawy, pozycje-miniatury, kwota) z „Zgłoś problem” (aktywny, gdy jakikolwiek typ dostępny; inaczej tooltip z powodem); terminy („Zwrot do 12.11”, „Reklamacja do 08.10.2028”).
- **Komponenty:** `Card` zgłoszeń z `StatusBadge`, `OrderCard`, `Tag` terminu, `Button`.
- **Stany:** *loading* — skeleton 3 kart. *empty* — brak zgłoszeń: sekcja ukryta; brak zamówień: „Nie widzimy zamówień dla tego e-maila. Kupowałeś jako gość na inny adres? Znajdź zamówienie numerem” + link K-01. *error* — `ErrorState` per sekcja. *success* — listy.
- **Walidacje:** n/d.
- **API:** `GET /portal/me/orders`, `GET /portal/me/claims`.

## K-04 Sprawdź status zgłoszenia

- **Cel:** dostęp do statusu bez logowania.
- **Funkcje:** nr RMA + e-mail → przekierowanie do K-05.
- **Komponenty:** `TextField` ×2, `Button`.
- **Stany:** *loading* — przycisk busy. *empty* — 404: „Nie znaleźliśmy zgłoszenia dla podanych danych”. *error* — 5xx: `Alert` + ponów. *success* — K-05.
- **Walidacje:** `RMA_NO`, `EMAIL`.
- **API:** `POST /portal/claims/status`.

## K-05 Szczegóły zgłoszenia

- **Cel:** jasno powiedzieć klientowi, co się dzieje i co ma zrobić — i pozwolić to zrobić od razu.
- **Funkcje:**
  - nagłówek: nr RMA, typ, zamówienie, `StatusTracker` (5 etapów), **„Co teraz?”**;
  - **karta akcji** zależna od statusu: *APPROVED* — kod QR / etykieta, punkt nadania, termin nadania, „Pobierz etykietę PDF”; *AWAITING_CUSTOMER* — prośba sklepu (lista: zdjęcia / wideo / nr seryjny / paragon) + `MediaUploader` + wiadomość → „Wyślij odpowiedź”; propozycja sklepu → „Akceptuję” / „Odrzucam” (z komentarzem); *RESOLVED* — podsumowanie (kwota, metoda, data / nr zamówienia zamiennego); *REJECTED* — uzasadnienie i „Odpowiedz”;
  - pozycje zgłoszenia (miniatura, powód, ilość, załączniki);
  - oś czasu; wiadomości (wątek); „Anuluj zgłoszenie” (do nadania paczki).
- **Komponenty:** `StatusTracker`, `Alert` (wymaga działania), `QrCode`, `Card`, `MediaUploader`, `ChatThread`, `Timeline`, `Modal` (anulowanie, odrzucenie propozycji).
- **Stany:** *loading* — skeleton nagłówka i kart. *empty* — brak wiadomości: „Masz pytanie? Napisz do nas”. *error* — 404/403: X-01 neutralny; 5xx: `ErrorState`; błąd wysyłki odpowiedzi — `Alert` w karcie, pliki zachowane. *success* — toast po akcji, odświeżony status.
- **Walidacje:** odpowiedź — min. 1 plik lub wiadomość (gdy żądano plików — wymagane pliki danego typu); nr seryjny `SERIAL`; wiadomość 1–2000 znaków; komentarz odrzucenia propozycji ≤ 500.
- **API:** `GET /portal/claims/{id}`, `GET/POST /portal/claims/{id}/messages`, `POST /portal/claims/{id}/responses`, `POST /portal/claims/{id}/offer/accept|decline`, `GET /portal/claims/{id}/label`, `POST /portal/claims/{id}/cancel`.

## Z-00 Wyszukaj zamówienie klienta (tryb asysty, agent)

- **Cel:** agent tworzy zgłoszenie w imieniu klienta (telefon, sklep stacjonarny).
- **Funkcje:** wyszukiwanie po nr zamówienia, e-mailu lub telefonie; wynik: klient + zamówienia; wybór kanału (telefon / sklep stacjonarny / e-mail); „Rozpocznij zgłoszenie”.
- **Komponenty:** `SearchField`, lista `OrderCard`, `RadioGroup` kanału.
- **Stany:** *loading* — skeleton listy. *empty* — „Brak zamówień dla podanej frazy”. *error* — `ErrorState`. *success* — Z-01 z banerem asysty.
- **Walidacje:** fraza min. 3 znaki; kanał wymagany.
- **API:** `GET /bo/orders?q=`, `POST /bo/claims` (przy wysyłce).

## Z-01 Kreator: rodzaj zgłoszenia

- **Cel:** wybrać ścieżkę (determinuje pytania, rozwiązania i wymagane dowody).
- **Funkcje:** karty: **Zwrot** („Rozmyśliłem się / nie pasuje”), **Reklamacja** („Produkt jest wadliwy”), **Uszkodzenie w transporcie**, **Brak elementu / inny produkt** — każda z terminem i stanem (dostępna / niedostępna z powodem); podsumowanie zamówienia.
- **Komponenty:** `Stepper` kreatora, `RadioCards` z ikonami i `Tag` terminu, `OrderSummary`.
- **Stany:** *loading* — skeleton kart (kwalifikowalność). *empty* — żaden typ niedostępny: `EmptyState` „Termin zgłoszeń dla tego zamówienia minął” + kontakt. *error* — `ErrorState` + ponów. *success* — Z-02, utworzona wersja robocza.
- **Walidacje:** typ wymagany i dostępny.
- **API:** `GET /portal/orders/{id}`, `GET /portal/orders/{id}/eligibility`, `POST /portal/claims/drafts`.

## Z-02 Kreator: produkty

- **Cel:** wskazać, których pozycji dotyczy zgłoszenie.
- **Funkcje:** lista pozycji zamówienia z checkboxem i licznikiem ilości; pozycje niekwalifikowane wyszarzone z powodem („Produkt higieniczny — zwrot niemożliwy, możesz go zareklamować”, „Już zgłoszone: RMA-…”); suma wartości wybranych pozycji.
- **Komponenty:** `ProductLine` + `Checkbox` + `Qty`, `Tag` powodu, suma.
- **Stany:** *loading* — n/d (dane z Z-01). *empty* — wszystkie pozycje niekwalifikowane dla typu: komunikat + „Zmień rodzaj zgłoszenia”. *error* — błąd zapisu wersji roboczej: `Alert`. *success* — Z-03.
- **Walidacje:** min. 1 pozycja; `QTY` w zakresie.
- **API:** `PATCH /portal/claims/drafts/{id}`.

## Z-03 Kreator: opis problemu / powód

- **Cel:** zebrać komplet informacji za pierwszym razem.
- **Funkcje:** sekcja per wybrana pozycja: powód (słownik zależny od typu); opis (wskazówki, co napisać); dla reklamacji: data wykrycia wady, **nr seryjny** (gdy wymagany — z podpowiedzią, gdzie go znaleźć); **zdjęcia** (aparat na mobile) i **wideo** (gdy wymagane — z oznaczeniem źródła: „wymaga producent CleanAir”); dla transportu: zdjęcie opakowania, „czy spisano protokół z kurierem”; dla braku elementu: który element.
- **Komponenty:** `ProductLine` (nagłówek sekcji), `Select`, `Textarea`, `DateField`, `TextField`, `MediaUploader` (zdjęcia / wideo, demo: zbyt duży plik, zły format, wirus), `Alert` info z wymaganiami.
- **Stany:** *loading* — wymagania (skeleton sekcji); upload — postęp per plik. *empty* — brak plików: dropzone z przykładami dobrych zdjęć. *error* — błąd pliku przy pliku; błąd wymagań: `ErrorState` + ponów. *success* — Z-04.
- **Walidacje:** powód wymagany; `DESC`; `DATE_DEFECT`; `SERIAL` gdy wymagany; zdjęcia min. N gdy wymagane (reklamacja, transport, brak elementu: ≥ 1); wideo gdy wymagane; pliki w trakcie wysyłania blokują „Dalej”.
- **API:** `GET /portal/reasons`, `GET /portal/requirements`, `POST/DELETE /portal/claims/drafts/{id}/attachments`, `PATCH …`.

## Z-04 Kreator: rozwiązanie

- **Cel:** pozwolić wybrać preferowane rozwiązanie z jasną kwotą — i promować opcje zatrzymujące przychód.
- **Funkcje:** opcje zależne od typu:
  - *Zwrot:* zwrot na pierwotną metodę płatności (kwota − koszt odesłania), **bon sklepowy +10% (darmowe odesłanie)**, **wymiana** (wybór wariantu, dostępność);
  - *Reklamacja:* naprawa, wymiana na nowy (pierwszeństwo wg ustawy), obniżenie ceny / zwrot pieniędzy („gdy naprawa lub wymiana nie są możliwe”), część zamienna;
  - *Transport:* wymiana, zwrot pieniędzy; *Brak elementu:* dosłanie części / produktu, zwrot za pozycję.
  - Kwota i dopiski z kalkulacji (`quote`).
- **Komponenty:** `RadioCards` z kwotą i `Tag` („Najszybciej”, „+10%”), `Select` wariantu, `Alert` prawny.
- **Stany:** *loading* — skeleton opcji (kalkulacja). *empty* — wymiana: brak wariantów na stanie → opcja nieaktywna z wyjaśnieniem. *error* — błąd kalkulacji: `ErrorState` + ponów. *success* — Z-05.
- **Walidacje:** opcja wymagana; wariant wymagany przy wymianie; uzasadnienie przy „zwrot pieniędzy” w reklamacji (opcjonalne pole „dlaczego naprawa/wymiana nie wystarczy”, ≤ 500).
- **API:** `POST /portal/claims/drafts/{id}/quote`, `GET /portal/exchange-options`, `PATCH …`.

## Z-05 Kreator: odesłanie i wypłata

- **Cel:** ustalić, jak produkt wróci (jeśli musi) i jak oddać pieniądze.
- **Funkcje:** metoda odesłania: **paczkomat** (wyszukiwarka punktu, kod QR — bez drukowania), **kurier z odbiorem** (adres, data odbioru), **sklep stacjonarny** (lista sklepów); informacja „Możliwe, że nie trzeba będzie odsyłać — powiemy Ci po rozpatrzeniu” (gdy reguła *keep it* może zadziałać); nr rachunku (tylko płatność za pobraniem); adres dostawy zamiennika (domyślnie z zamówienia, edytowalny); kontakt (e-mail, telefon).
- **Komponenty:** `RadioCards`, `SearchField` punktów + lista wyników, `DateField`, `TextField` adresu, `TextField` IBAN z maską, `Alert`.
- **Stany:** *loading* — wyszukiwanie punktów (skeleton listy). *empty* — „Brak punktów dla frazy — spróbuj kod pocztowy”. *error* — błąd wyszukiwarki: `Alert` + ponów (pozostałe metody dostępne). *success* — Z-06.
- **Walidacje:** metoda wymagana (o ile odesłanie potrzebne); punkt wymagany przy paczkomacie; kurier: ulica, `ZIP_PL`, miasto, data odbioru (dzień roboczy, ≥ jutro); sklep wymagany; `IBAN_PL` przy pobraniu; `EMAIL` wymagany, `PHONE` wymagany dla kuriera.
- **API:** `GET /portal/pickup-points`, `GET /portal/stores`, `PATCH …`.

## Z-06 Kreator: podsumowanie

- **Cel:** świadoma weryfikacja przed wysłaniem.
- **Funkcje:** sekcje z „Edytuj”: rodzaj, produkty (z powodami i miniaturami plików), rozwiązanie i kwota, odesłanie, kontakt; oświadczenie („Dane są zgodne z prawdą”; dla zwrotu: „Oświadczam, że odstępuję od umowy…”); w trybie asysty — „Klient potwierdził dane” + kanał; „Wyślij zgłoszenie”.
- **Komponenty:** `SummaryCard` ×5, `Checkbox`, `ErrorSummary`, `Button`.
- **Stany:** *loading* — nakładka „Wysyłamy zgłoszenie…”. *empty* — n/d. *error* — `422` (np. `WINDOW_EXPIRED`) — `ErrorSummary` z linkiem do kroku; 5xx — `Alert` „Nie udało się wysłać. Twoje dane są zapisane” + „Spróbuj ponownie”. *success* — Z-07.
- **Walidacje:** oświadczenia; pełna walidacja kroków 1–5.
- **API:** `POST /portal/claims/drafts/{id}/submit` (asysta: `POST /bo/claims`).

## Z-07 Potwierdzenie

- **Cel:** pewność, że zgłoszenie dotarło, i jasny następny krok.
- **Funkcje:** nr RMA (kopiuj); wynik reguł: **„Zaakceptowane automatycznie”** + kod QR i instrukcja nadania / **„Nie musisz odsyłać produktu — zwrot X zł zlecony”** / **„Rozpatrzymy w 2 dni robocze (reklamacja: odpowiedź do DD.MM)”**; „Przejdź do zgłoszenia” (K-05); asysta: „Wróć do skrzynki” / „Otwórz kartę zgłoszenia”.
- **Komponenty:** ikona sukcesu, `ClaimNumber`, `QrCode`, lista kroków, `Button`.
- **Stany:** *loading* — n/d. *empty* — wejście bez zgłoszenia: `EmptyState` + link K-01. *error* — błąd pobrania etykiety: toast „Spróbuj ponownie — wysłaliśmy ją też e-mailem”. *success* — warianty jw.
- **Walidacje:** brak.
- **API:** `GET /portal/claims/{id}/label`.

## B-01 Skrzynka zgłoszeń

- **Cel:** agent wie, czym zająć się teraz.
- **Funkcje:** zapisane widoki (zakładki z licznikami): Do decyzji, Czeka na klienta, Odpowiedź klienta, W magazynie (do rozwiązania), Moje, Wszystkie; filtry: typ, priorytet, zespół, SLA; wyszukiwarka (RMA, zamówienie, e-mail, nazwisko); tabela: RMA, klient, typ, produkty (miniatury), wartość, status, SLA („odpowiedź za 3 dni”, czerwony < 2 dni), przypisany, kanał; akcje masowe (przypisz, priorytet); „＋ Nowe zgłoszenie” (Z-00).
- **Komponenty:** `Sidebar`, `Tabs` z licznikami, `FilterBar`, `DataTable` (na mobile: karty), `SlaIndicator`, `StatusBadge`, `Checkbox` zaznaczenia, `Toast`.
- **Stany:** *loading* — skeleton tabeli. *empty* — „Brak zgłoszeń w tym widoku 🎉” / „Brak wyników dla filtrów” + „Wyczyść filtry”. *error* — `ErrorState`. *success* — tabela; po akcji masowej toast.
- **Walidacje:** wyszukiwarka min. 2 znaki; akcja masowa wymaga zaznaczenia.
- **API:** `GET /bo/claims`, `PATCH /bo/claims/{id}`.

## B-02 Karta zgłoszenia

- **Cel:** podjąć i wykonać decyzję z pełnym kontekstem, bez przełączania systemów.
- **Funkcje:**
  - nagłówek: RMA, status, typ, priorytet, SLA, przypisanie (zmiana), zespół, kanał, tagi;
  - **Rekomendacja asystenta** (rozwiązanie, pewność, uzasadnienie, sprawdzone warunki: termin, dowody, wytyczne dostawcy) z „Zastosuj”;
  - **Zastosowane reguły**;
  - pozycje: zdjęcia / wideo (galeria — lightbox), powód, opis, nr seryjny, data wykrycia, wynik inspekcji;
  - klient: dane, zamówienie, historia (liczba zwrotów w 12 mies. — sygnał nadużyć);
  - **panel decyzji** (status SUBMITTED / AWAITING): Akceptuj (rozwiązanie, „bez odsyłania”), Poproś o informacje (checkboxy: zdjęcia / wideo / nr seryjny / paragon + szablon), Zaproponuj inne rozwiązanie (typ, kwota, treść), Odrzuć (uzasadnienie);
  - **panel rozwiązania** (APPROVED bez odsyłania / RECEIVED / IN_SERVICE): Zwróć pieniądze (kwota, metoda), Wyślij zamiennik, Wyślij do serwisu, Przekaż do dostawcy, Zamknij;
  - wątek: wiadomości do klienta i **notatki wewnętrzne** (przełącznik), szablony; oś czasu (audyt);
  - (mockup) „Symuluj: paczka nadana” — zdarzenie przewoźnika.
- **Komponenty:** `PageHeader`, `Badge`, `Select` przypisania, `RecommendationCard`, `Gallery` + `Lightbox`, `DescriptionList`, `DecisionPanel` (`Tabs` akcji), `MoneyField`, `ChatThread` z przełącznikiem „wewnętrzna”, `Timeline`, `Modal` potwierdzeń.
- **Stany:** *loading* — skeleton kolumn. *empty* — brak załączników / wiadomości — teksty informacyjne. *error* — 404: X-01; 5xx: `ErrorState`; błąd akcji (np. bramka płatności) — `Alert` w panelu z „Ponów” / „Wydaj bon zamiast”. *success* — toast + odświeżona karta (status, oś czasu).
- **Walidacje:** odrzucenie — uzasadnienie ≥ 30 znaków; prośba — min. 1 element lub treść; propozycja — kwota `MONEY` (dla obniżenia ceny / częściowego zwrotu) i treść; zwrot pieniędzy — `MONEY` ≤ wartość zgłoszenia, powyżej 2000 zł — wymagana akceptacja kierownika (makieta: komunikat); przekazanie do dostawcy — dostępne, gdy pozycja ma dostawcę i wytyczne spełnione (inaczej lista braków).
- **API:** `GET /bo/claims/{id}`, `GET /bo/claims/{id}/recommendation`, `PATCH /bo/claims/{id}`, `POST …/decision`, `POST …/messages`, `POST …/labels`, `POST …/refunds`, `POST …/replacement-orders`, `POST …/service-orders`, `POST /bo/supplier-claims`, `POST …/close`.

## B-03 Przyjęcia magazynowe i inspekcja

- **Cel:** szybkie, bezbłędne przyjęcie zwrotu i ocena towaru.
- **Funkcje:** pole skanu (autofokus, Enter); listy „Oczekiwane przesyłki” i „Przyjęte dziś”; po skanie — formularz inspekcji per pozycja: ilość przyjęta, stan, kompletność, ocena A/B/C, wada potwierdzona (reklamacje), dyspozycja, notatka, zdjęcia; „Zatwierdź przyjęcie”.
- **Komponenty:** `ScanField` (duży), `DataTable`, `InspectionForm` (`SegmentedControl` dla stanu i oceny — duże pola dotyku), `MediaUploader`, `Alert` rozbieżności.
- **Stany:** *loading* — skeleton list; skan — spinner w polu. *empty* — brak oczekiwanych: „Brak przesyłek w drodze”; skan bez wyniku: „Nie znaleziono przesyłki o kodzie …”. *error* — `ErrorState`; błąd zapisu inspekcji — `Alert` (dane formularza zachowane). *success* — toast „Przyjęto RMA-…”, wyczyszczone pole skanu (gotowe na kolejny).
- **Walidacje:** kod `RMA_NO` lub nr etykiety; ilość 0…oczekiwana; stan, ocena i dyspozycja wymagane; ilość < oczekiwanej → wymagana notatka (rozbieżność).
- **API:** `GET /bo/warehouse/inbound`, `GET /bo/warehouse/lookup`, `POST /bo/claims/{id}/inspection`.

## B-04 Reklamacje do dostawców

- **Cel:** odzyskać koszty wadliwych produktów od dostawców.
- **Funkcje:** lista reklamacji do dostawców (dostawca, liczba pozycji, wartość, status, data wysłania, kwota uznana); szczegóły (drawer): pozycje z dowodami, warunki gwarancji dostawcy i wytyczne (checklista spełniona / brakuje), historia; akcje: „Wyślij do dostawcy”, „Oznacz notę jako zaksięgowaną”; podsumowanie: odzyskano / w toku.
- **Komponenty:** `KpiTile` ×3, `DataTable`, `Drawer`, `Checklist`, `Button`.
- **Stany:** *loading* — skeleton. *empty* — „Brak reklamacji do dostawców. Przekaż zgłoszenie z karty zgłoszenia”. *error* — `ErrorState`; błąd wysyłki — `Alert` w drawerze. *success* — toast + status.
- **Walidacje:** wysyłka tylko gdy checklista wytycznych spełniona (inaczej przycisk nieaktywny z listą braków).
- **API:** `GET /bo/suppliers`, `GET /bo/supplier-claims`, `POST /bo/supplier-claims/{id}/send`.

## B-05 Reguły automatyzacji

- **Cel:** automatycznie rozstrzygać proste sprawy i kierować złożone — bez programisty.
- **Funkcje:** lista reguł (nazwa, opis „JEŚLI … TO …”, włącz/wyłącz, kolejność ↑↓, liczba trafień w 30 dni); edytor (drawer): nazwa, warunki (typ zgłoszenia, kategoria produktu, powód, wartość od/do, dni od dostawy), akcja (auto-akceptacja, zatrzymaj produkt, priorytet wysoki, przypisz zespół, wymagaj wideo), parametr; „Symuluj” (ile zgłoszeń z historii by pasowało + przykłady); usuń.
- **Komponenty:** `RuleCard` z `Toggle`, `Drawer` z `RuleBuilder` (multi-select chips, `MoneyField`, `Select`), `Alert` wyniku symulacji, `Modal` usunięcia.
- **Stany:** *loading* — skeleton listy; symulacja — spinner. *empty* — „Nie masz jeszcze reguł. Zacznij od szablonu: «Szybki zwrot tanich produktów»”. *error* — `ErrorState`; błąd zapisu — `Alert` w edytorze. *success* — toast; reguła na liście.
- **Walidacje:** nazwa 3–60 znaków, unikalna; min. 1 warunek; wartość od ≤ do; parametr wymagany dla „przypisz zespół”; ostrzeżenie (nie blokuje), gdy reguła auto-akceptacji nie ma limitu wartości.
- **API:** `GET/POST/PATCH/DELETE /bo/rules`, `POST /bo/rules/simulate`.

## B-06 Analityka

- **Cel:** zrozumieć, dlaczego klienci zwracają i reklamują, i co to kosztuje.
- **Funkcje:** filtr okresu (30 / 90 dni) i typu zgłoszenia; KPI: liczba zgłoszeń, wskaźnik zwrotów (% zamówień), % automatyzacji, średni czas rozwiązania, odzysk od dostawców; wykresy: top powody, top produkty, zgłoszenia tygodniowo, struktura rozwiązań; tooltip po najechaniu; „Pokaż jako tabelę”.
- **Komponenty:** `FilterBar`, `KpiTile` ×5, `BarChart` (poziomy / pionowy, jedna seria), `Tooltip`, `DataTable` (widok tabelaryczny).
- **Stany:** *loading* — skeleton kafli i wykresów. *empty* — „Brak danych dla wybranego okresu”. *error* — `ErrorState` per wykres. *success* — wykresy.
- **Walidacje:** n/d.
- **API:** `GET /bo/analytics/summary`, `GET /bo/analytics/breakdown`.

## B-07 Ustawienia: polityka zwrotów i szablony

- **Cel:** zarządzać zasadami bez wdrożeń.
- **Funkcje:** polityka: okno zwrotu (dni), koszt odesłania (zł), darmowe odesłanie przy bonie, bonus bonu (%), kategorie wyłączone ze zwrotu, okno zgłoszeń transportowych (dni); informacja o terminach ustawowych (tylko odczyt); szablony odpowiedzi (lista, edycja treści ze zmiennymi `{imie}`, `{rma}`).
- **Komponenty:** `Card`, `TextField` liczbowe, `Toggle`, `CheckboxGroup`, lista szablonów + `Textarea`, `Button`.
- **Stany:** *loading* — skeleton. *empty* — brak szablonów: „Dodaj pierwszy szablon”. *error* — `ErrorState`; błąd zapisu — `Alert`. *success* — toast „Zapisano — zmiany obowiązują dla nowych zgłoszeń”.
- **Walidacje:** okno zwrotu 14–365 dni (min. ustawowe 14); koszt 0–100 zł; bonus 0–50%; okno transportowe 1–30 dni; szablon: nazwa 3–60, treść 10–2000.
- **API:** `GET/PUT /bo/settings/return-policy`, `GET/PUT /bo/templates/{id}`.

## D-01 Portal dostawcy

- **Cel:** dostawca szybko rozpatruje udokumentowane reklamacje.
- **Funkcje:** lista reklamacji (nr, data, pozycje, wartość, status, termin odpowiedzi); szczegóły: pozycje z dowodami (zdjęcia, wideo, nr seryjny, opis, wynik inspekcji sklepu, dowód zakupu); odpowiedź: Uznaj (kwota noty, nr noty) / Odrzuć (uzasadnienie).
- **Komponenty:** prosty nagłówek, `DataTable`, panel szczegółów, `Gallery`, formularz odpowiedzi.
- **Stany:** *loading* — skeleton. *empty* — „Brak reklamacji do rozpatrzenia”. *error* — `ErrorState`; błąd zapisu — `Alert`. *success* — toast + status „Uznana / Odrzucona”.
- **Walidacje:** uznanie — kwota `MONEY` ≤ wartość pozycji, nr noty 3–30 znaków; odrzucenie — uzasadnienie ≥ 30 znaków.
- **API:** `GET /supplier/claims`, `GET /supplier/claims/{id}`, `POST /supplier/claims/{id}/response`.

## X-01 Nie znaleziono / brak dostępu

`EmptyState` + przycisk powrotu do strony startowej właściwej dla roli. Bez ujawniania, czy zasób istnieje.

## X-02 Sesja wygasła

`Modal` (bez zamknięcia): „Ze względów bezpieczeństwa sesja wygasła. Twoje dane w kreatorze zostały zapisane.” → „Zaloguj ponownie / Znajdź zamówienie”. API: `POST /portal/auth/logout`.

## X-03 Logowanie pracownika / dostawcy

- **Cel:** wejście do panelu obsługi i portalu dostawcy.
- **Funkcje:** „Zaloguj przez SSO” (pracownicy, OIDC), logowanie kontem organizacji (dostawcy); powrót do `returnUrl`. W mockupie trzy przyciski demo (agent, magazyn, dostawca).
- **Komponenty:** `Card`, `Button` ×3.
- **Stany:** *loading* — przycisk busy (przekierowanie do IdP). *empty* — n/d. *error* — błąd IdP / brak uprawnień: `Alert` „Twoje konto nie ma dostępu do panelu — skontaktuj się z administratorem”. *success* — przekierowanie na stronę startową roli.
- **Walidacje:** po stronie IdP. **API:** `GET /auth/sso/authorize`, `GET /auth/sso/callback`.
