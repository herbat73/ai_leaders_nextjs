# 1. Użytkownicy systemu i ich potrzeby

> Portal zwrotów i reklamacji „TwójSklep” — koncepcja wstępna, wersja 0.1 (13.10.2026)
> Benchmark funkcjonalny i UX: Claimlane (samoobsługowy portal zgłoszeń, reguły automatyzacji, reklamacje do dostawców, obsługa magazynowa). Identyfikacja wizualna, treści i kod są własne.

## 1.1. Kontekst i cel produktu

Sklep internetowy (elektronika, AGD, wyposażenie domu, odzież) obsługuje dziś zwroty i reklamacje mailowo i telefonicznie: klient pisze „coś nie działa”, a dział obsługi kilka razy dopytuje o numer zamówienia, zdjęcia i numer seryjny. Portal ma:

1. dać klientowi **samoobsługowe zgłoszenie w 3 minuty**: zamówienie → produkty → problem → rozwiązanie → sposób odesłania;
2. zebrać **komplet danych za pierwszym razem** (zdjęcia, wideo, numer seryjny — zależnie od produktu i wymagań dostawcy);
3. **automatycznie rozstrzygać proste sprawy** (reguły: wartość, kategoria, powód, czas od dostawy);
4. dać zespołowi **jedną skrzynkę** z pełnym kontekstem, rekomendacją rozwiązania i akcjami (zwrot pieniędzy, zamiennik, etykieta, serwis);
5. **odzyskiwać koszty od dostawców**, przekazując udokumentowane reklamacje producentom;
6. zamknąć pętlę z **magazynem** (skan RMA, inspekcja, ocena stanu A/B/C, dyspozycja towaru).

| Cel biznesowy | KPI | Cel (propozycja) |
|---|---|---|
| Mniej kontaktów „gdzie jest mój zwrot?” | kontakty WISMR na zgłoszenie | −60% |
| Kompletność zgłoszeń | % zgłoszeń bez prośby o uzupełnienie | ≥ 85% |
| Automatyzacja | % zgłoszeń rozstrzygniętych regułą | ≥ 20% |
| Czas obsługi | mediana od zgłoszenia do rozwiązania | ≤ 5 dni (zwroty), ≤ 10 dni (reklamacje) |
| Zgodność z prawem | % reklamacji z odpowiedzią w 14 dni | 100% |
| Retencja przychodu | udział bonów / wymian zamiast zwrotu pieniędzy | ≥ 25% |
| Odzysk od dostawców | % wartości reklamacji uznanych przez dostawców | ≥ 60% |

## 1.2. Kontekst prawny (PL, B2C) — wpływ na produkt

| Instytucja | Reguła | Konsekwencja w portalu |
|---|---|---|
| Odstąpienie od umowy (zwrot) | 14 dni od dostawy bez podania przyczyny; zwrot pieniędzy w 14 dni od oświadczenia (sklep może wstrzymać do otrzymania towaru) | typ „Zwrot”, okno konfigurowalne (min. 14, np. 30 dni), licznik terminu |
| Wyłączenia | m.in. produkty higieniczne po otwarciu, rzeczy na zamówienie | flaga produktu `returnable=false`, komunikat w kreatorze |
| Niezgodność towaru z umową (reklamacja) | 2 lata od dostawy; najpierw naprawa lub wymiana, obniżenie ceny / zwrot gdy niemożliwe lub istotne | typ „Reklamacja”, hierarchia rozwiązań w kroku „Rozwiązanie” |
| Termin odpowiedzi | 14 dni na odpowiedź na reklamację — brak odpowiedzi = uznanie | SLA w skrzynce, licznik „odpowiedz do”, alert eskalacji |
| Gwarancja producenta | odrębna od odpowiedzialności sprzedawcy | sklep może przekazać sprawę do dostawcy (reklamacja do dostawcy) |

## 1.3. Persony i role

### A. Klienci (front-office, portal w barwach sklepu)

#### A1. Klient B2C bez konta — „gość” (rola `CUSTOMER`, zakres: jedno zamówienie)
Kupił jako gość lub nie pamięta hasła. **Identyfikacja:** nr zamówienia + e-mail (lub telefon) z zamówienia.

| Potrzeby | Bóle | Co portal zapewnia |
|---|---|---|
| Szybko zwrócić produkt, który nie pasuje | Szukanie formularza, drukowanie etykiety, brak drukarki | Zwrot w kilku krokach, kod QR do paczkomatu (bez drukowania) |
| Zareklamować wadliwy produkt | Niepewność, jakie dowody są potrzebne | Wskazówki per produkt: zdjęcia, wideo, nr seryjny — tylko gdy potrzebne |
| Wiedzieć, ile i kiedy dostanie pieniądze | Brak informacji, „czarna skrzynka” | Kwota zwrotu przed wysłaniem, status i oś czasu, powiadomienia |
| Wybrać wygodne rozwiązanie | Tylko „zwrot pieniędzy” albo nic | Wymiana rozmiaru, bon +10%, naprawa, część zamienna |

#### A2. Klient z kontem (rola `CUSTOMER`, zakres: wszystkie zamówienia z e-maila)
Loguje się linkiem z e-maila (bez hasła). **Potrzeby:** lista zamówień z przyciskiem „Zgłoś problem”, historia zgłoszeń, korespondencja w jednym miejscu.

#### A3. Klient B2B / partner handlowy (faza 2)
Sklep partnerski lub firma kupująca hurtowo. Zgłoszenia zbiorcze (wiele pozycji i zamówień), inne zasady (brak prawa odstąpienia, reklamacja wg umowy). W MVP poza zakresem — architektura przewiduje osobny formularz i reguły.

### B. Zespół sklepu (back-office)

#### B1. Agent obsługi zwrotów i reklamacji (rola `AGENT`)
- **Potrzeby:** jedna skrzynka ze wszystkimi kanałami (portal, sklep stacjonarny, telefon); priorytety i SLA; pełny kontekst (zamówienie, zdjęcia, historia klienta); rekomendacja decyzji; akcje jednym kliknięciem (akceptuj, poproś o informacje, zaproponuj inne rozwiązanie, odrzuć, zwróć pieniądze, wyślij zamiennik, przekaż do dostawcy); szablony odpowiedzi; notatki wewnętrzne.
- **Bóle:** przepisywanie danych z maila, ręczne generowanie etykiet, brak wiedzy o warunkach gwarancji dostawców.
- **Dodatkowo:** zgłoszenie **w imieniu klienta** (telefon, sklep stacjonarny) tym samym kreatorem.

#### B2. Kierownik obsługi / właściciel procesu (rola `AGENT` + uprawnienie `MANAGE_RULES`)
- **Potrzeby:** konfiguracja reguł automatyzacji bez programisty (no-code), polityka zwrotów, szablony, analityka (powody, produkty problemowe, koszty, czas obsługi, odzysk od dostawców).

#### B3. Pracownik magazynu zwrotów (rola `WAREHOUSE`)
- **Potrzeby:** zeskanować przesyłkę (kod RMA / etykieta), od razu zobaczyć, czego się spodziewać; szybka inspekcja (stan, kompletność, ocena A/B/C, zdjęcia), dyspozycja (na stan / outlet / do dostawcy / utylizacja); praca na tablecie lub skanerze w hali.

#### B4. Dział finansów (rola `FINANCE`, poza mockupem)
Zatwierdzanie zwrotów pieniędzy powyżej progu, uzgadnianie not kredytowych od dostawców.

#### B5. Administrator (rola `ADMIN`)
Integracje (platforma sklepu, ERP, przewoźnicy, płatności), użytkownicy, branding portalu, retencja danych.

### C. Partnerzy zewnętrzni

#### C1. Dostawca / producent (rola `SUPPLIER`)
- **Potrzeby:** otrzymać kompletne, udokumentowane reklamacje (zdjęcia, opis wady, nr seryjny, dowód zakupu) w jednym formacie; uznać / odrzucić; wystawić notę kredytową.
- **Portal dostawcy:** lista przekazanych reklamacji, szczegóły z dowodami, odpowiedź.
- **Wymagania dostawcy** (np. „zawsze nagranie wideo i nr seryjny”) są konfigurowane w systemie i **automatycznie wymuszane w formularzu klienta**.

#### C2. Serwis zewnętrzny (faza 2)
Odbiera urządzenia do naprawy, aktualizuje status naprawy.

### D. Systemy (aktorzy integracyjni)

| System | Rola |
|---|---|
| Platforma e-commerce (np. Shopify / Magento / WooCommerce / własna) | źródło zamówień, klientów, produktów; tworzenie zamówień zamiennych |
| ERP / WMS | stany magazynowe, przyjęcie zwrotu, korekty faktur |
| Przewoźnicy (np. paczkomaty, kurier) | etykiety zwrotne, kody QR, tracking (webhooki: nadano / dostarczono) |
| Bramka płatności | zwrot środków na pierwotną metodę płatności |
| System bonów / kart podarunkowych | kredyt sklepowy |
| E-mail / SMS | magic link, powiadomienia o statusie |
| Usługa AI (opcjonalnie) | analiza zdjęć i opisu, rekomendacja rozwiązania |

## 1.4. Macierz uprawnień (skrót)

| Funkcja | Gość | Klient z kontem | Agent | Kierownik | Magazyn | Dostawca |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Zgłoszenie zwrotu / reklamacji | ✔ (1 zamówienie) | ✔ | ✔ (w imieniu) | ✔ | – | – |
| Status, wiadomości, etykieta | ✔ (swoje) | ✔ (swoje) | ✔ | ✔ | odczyt | – |
| Decyzje, zwrot pieniędzy, zamiennik | – | – | ✔ (do progu) | ✔ | – | – |
| Inspekcja i dyspozycja towaru | – | – | odczyt | odczyt | ✔ | – |
| Reklamacje do dostawców | – | – | ✔ tworzenie | ✔ | – | ✔ odpowiedź (swoje) |
| Reguły, polityka, szablony | – | – | odczyt | ✔ | – | – |
| Analityka | – | – | ✔ | ✔ | – | – |

## 1.5. Założenia koncepcji

1. Portal klienta jest **white-label** (logo, kolory, domena sklepu), osadzany pod `zwroty.twojsklep.pl` lub w koncie klienta.
2. Źródłem prawdy o zamówieniach jest platforma sklepu; portal przechowuje zgłoszenia, załączniki i historię.
3. **Mobile-first** — większość klientów zgłasza z telefonu, robiąc zdjęcia aparatem.
4. Jedno zgłoszenie = jeden typ (zwrot / reklamacja / uszkodzenie w transporcie / brak elementu) i jedno zamówienie, wiele pozycji. Rozwiązanie wybierane dla zgłoszenia (per pozycja — faza 2).
5. WCAG 2.1 AA, RODO (minimalizacja danych, retencja zdjęć 3 lata), język PL (EN w fazie 2).
