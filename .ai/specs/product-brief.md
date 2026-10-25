# Portal zwrotów i reklamacji (EasyRMS) — product brief

- Date: 2026-10-21 (odświeżony 2026-10-25: kolejny wycinek, D12–D13, Q16–Q19)
- Mode: own (from early concept); Owner: Adam Adamczyk; Pass: concept synthesis (aa-product-brief)
- Evidence basis: wyłącznie koncepcja zespołu (5 dokumentów, v0.1 z 13.10.2026) i klikalny mockup. Koncepcja nie cytuje wywiadów, danych ze zgłoszeń ani pomiarów; KPI mają tylko wartości docelowe („propozycja”) bez punktu wyjścia. Najważniejsze nieprzetestowane przekonanie: że wielokrotne dopytywanie klientów o dane jest głównym kosztem obsługi (A01).
- Coverage: 65 claims — 53 sourced (interview 0, data 0, document 51, product 2, benchmark 0), 0 synthetic, 12 assumed; 3 entries on the collection plan
- Synthetic hypotheses outside Coverage: 0
- Definition of Ready signed by: signed (Adam Adamczyk, 2026-10-23) — decyzje potwierdzone, Q01, Q03, Q04 i Q13 odpowiedziane; brak dowodów problemu (A01) pozostaje otwarty; ready for: research + spec writing and implementation of the first slice (return end to end); 2026-10-25: spec writing dla wycinka reklamacji z roszczeniem do dostawcy (D12, D13), bez gotowości do planowania implementacji do czasu odpowiedzi na Q16–Q19
- Sources: doc/portal-reklamacje/README.md, doc/portal-reklamacje/docs/01…05, doc/portal-reklamacje/mockup/src/

## Decision summary

Koncepcja proponuje samoobsługowy portal zwrotów, reklamacji, szkód transportowych i braków w przesyłce, z panelem obsługi (agent, kierownik, magazyn) i portalem dostawcy — 15 use case'ów MVP, 24 ekrany, wszystkie obecne w mockupie. Właściciel (Adam Adamczyk) potwierdził w sesji 2026-10-23 wszystkie reguły, non-goale i decyzje (R01–R16, N01–N04, D01–D07) jako `active`; R14 i D05 zastąpiły R17 i D08 (limity zamiast CAPTCHA; sesja gościa zamiast linku e-mail), obie z przeglądem security przed publicznym wdrożeniem. Potwierdzenie dotyczy decyzji, nie dowodów: problem i KPI nadal stoją na założeniach. Problem (ręczna obsługa mailowo-telefoniczna z dopytywaniem) i wszystkie KPI są opisane przez zespół, bez danych — Problems i Goals stoją na założeniach A01–A05. Największe rozbieżności to architektura (trzy aplikacje na subdomenach i `/api/v1/*` vs monorepo z jedną aplikacją Next.js, Q03) oraz model danych (istniejąca encja `ReturnRequest` vs model `Claim` z 4 typami i 9 statusami, Q04). Pierwszy wycinek (zwrot end-to-end, Q13) i logowanie agenta są wdrożone. 2026-10-25 właściciel wybrał kolejny wycinek (D12): reklamacje klienta (UC-03), decyzja agenta w reklamacji (UC-10) i roszczenie do dostawcy (UC-12) wysyłane e-mailem z ręcznym zapisem odpowiedzi i noty (D13); portal dostawcy (D-01) trafia do Later. Dla tego wycinka nie ma żadnych danych: A01, A04, A07 pozostają nieprzetestowane, a A05 (portal dostawcy) nie blokuje wycinka, ale pozostaje niezweryfikowane; nieznane są też liczba reklamacji i odsetek trafiających do dostawcy. Następny krok: `om-spec-writing` dla tego wycinka, równolegle rozmowy z dostawcami (E00-T03) i odpowiedzi na Q16–Q19.

## Vision

Klient sklepu zgłasza zwrot lub reklamację samodzielnie w ok. 3 minuty, a zespół rozstrzyga sprawy z kompletem danych w jednej skrzynce — kierunek zamierzony przez zespół. `[DOCUMENT]` docs/01 §1.1

## Target group and stakeholders

- Customer (pays): sklep internetowy (elektronika, AGD, dom, odzież), przykładowo „TwójSklep”. `[DOCUMENT]` docs/01 §1.1
- User (uses): klient-gość identyfikowany numerem zamówienia + e-mailem/telefonem (rola `CUSTOMER`, zakres 1 zamówienia). `[DOCUMENT]` docs/01 §1.3 A1
- User (uses): klient z kontem logujący się linkiem e-mail. `[DOCUMENT]` docs/01 §1.3 A2
- User (uses): agent obsługi (`AGENT`), także zgłaszający w imieniu klienta. `[DOCUMENT]` docs/01 §1.3 B1
- User (uses): kierownik obsługi — reguły, polityka, analityka (sposób modelowania roli otwarty, Q05). `[DOCUMENT]` docs/01 §1.3 B2
- User (uses): pracownik magazynu zwrotów (`WAREHOUSE`), tablet/skaner. `[DOCUMENT]` docs/01 §1.3 B3
- User (uses): dostawca/producent (`SUPPLIER`) rozpatrujący reklamacje i wystawiający noty. `[DOCUMENT]` docs/01 §1.3 C1
- Stakeholders: dział finansów (`FINANCE`, akceptacja zwrotów ponad próg, poza mockupem) i administrator (`ADMIN`, integracje, branding). `[DOCUMENT]` docs/01 §1.3 B4–B5
- Decider for scope decisions: Adam Adamczyk (Q01, 2026-10-22); prawnik dla R01–R05, finanse dla R11

## Problems, with evidence

- Sklep obsługuje dziś zwroty i reklamacje mailowo i telefonicznie, a obsługa kilkukrotnie dopytuje o numer zamówienia, zdjęcia i numer seryjny. `[DOCUMENT]` docs/01 §1.1
- Że to dopytywanie jest częste i kosztowne (i że portal je usunie) — brak danych. `[ASSUMPTION]` → A01
- Klient nie wie, jakie dowody są potrzebne, ani ile i kiedy dostanie pieniądze („czarna skrzynka”). `[DOCUMENT]` docs/01 §1.3 A1
- Agent przepisuje dane z maila, ręcznie generuje etykiety i nie zna warunków gwarancji dostawców. `[DOCUMENT]` docs/01 §1.3 B1
- Że klienci zgłaszają głównie z telefonu (podstawa decyzji mobile-first). `[ASSUMPTION]` → A02

## Product and how it stands out

- What it is: portal klienta (white-label) + panel obsługi + portal dostawcy dla 4 typów zgłoszeń; szczegóły w Scope i Concept surface. `[DOCUMENT]` README.md
- What makes it different: wymagane dowody zależne od produktu, dostawcy i reguły; reguły bez kodu z auto-akceptacją i „zatrzymaj produkt”; reklamacje do dostawców z kontrolą wytycznych. `[DOCUMENT]` README.md
- Wzorce zaczerpnięto z Claimlane; porównania nie sprawdzono (brak linku i daty), więc to wybór projektowy, nie benchmark. `[DOCUMENT]` docs/01 nagłówek

| reference | what it does well | where it falls short for our users | checked on | link |
|---|---|---|---|---|

Benchmark odłożony: Claimlane wskazano jako wzorzec, ale nie sprawdzono go na potrzeby tego briefu.

## Goals and success criteria

- Business goal: −60% kontaktów „gdzie jest mój zwrot?” na zgłoszenie; cel zaproponowany, punkt wyjścia nieznany. `[ASSUMPTION]` docs/01 §1.1 → A07
- Business goal: ≥ 35% zgłoszeń rozstrzygniętych regułą; punkt wyjścia nieznany. `[ASSUMPTION]` docs/01 §1.1 → A04
- Business goal: ≥ 25% bonów/wymian zamiast zwrotu pieniędzy; ≥ 60% wartości reklamacji uznanej przez dostawców. `[ASSUMPTION]` docs/01 §1.1 → A03, A05
- User outcome: ≥ 85% zgłoszeń bez prośby o uzupełnienie; mediana do rozwiązania ≤ 5 dni (zwroty) / ≤ 10 dni (reklamacje). `[DOCUMENT]` docs/01 §1.1 (cele, bez baseline)
- Primary metric, baseline today, threshold, date: metryka główna niewybrana; baseline nieznany dla wszystkich 7 KPI; brak daty → Q02
- What must not get worse: 100% reklamacji z odpowiedzią w 14 dni (wymóg prawny, R04). `[DOCUMENT]` docs/01 §1.2
- Wartości KPI w mockupie (B-06) są na sztywno wpisanymi danymi demo i nie są punktem wyjścia. `[PRODUCT]` mockup/src/api.ts `buildAnalytics`

## Scope

- **Now:** reklamacje z roszczeniem do dostawcy (D12, D13): UC-03 (zgłoszenie reklamacji przez klienta), UC-10 rozszerzone o reklamacje, UC-12 (roszczenie do dostawcy wysyłane e-mailem, agent zapisuje odpowiedź i notę kredytową). Powiązane reguły: R02, R04 (z eskalacją po 10 dniach, Q07), R05, R07. `[DOCUMENT]` decyzja właściciela 2026-10-25, `.ai/specs/research/decisions/2026-10-25-next-slice-complaints-vendor-claim.md`.
- **Done:** pierwszy wycinek, zwrot end-to-end (UC-01, 02, 06, 10, Q13; PR #23, #27) oraz logowanie i role agenta (D10, D11; PR #33). Pozostała część D06 (UC-01…UC-15) nie jest w Now.
- **Later:** UC-16 B2B, serwis zewnętrzny (C2), rozwiązanie per pozycja, język EN, rola FINANCE w UI; portal dostawcy (D-01, wyjęty z wycinka przez D13), inspekcja magazynowa (B-03), silnik reguł, szkody transportowe i braki w przesyłce. `[DOCUMENT]` docs/01 §1.3, §1.5, decyzja właściciela 2026-10-25
- **Not doing:** see Non-goals

## Concept surface

| App / shell | Users | Screens (ids) | In mockup |
|---|---|---|---|
| Portal klienta (`zwroty.*`) | gość, klient z kontem | K-01…K-05, Z-01…Z-07 | 12/12 |
| Panel obsługi (`panel.*`) | agent, kierownik, magazyn | B-01…B-07, Z-00 | 8/8 |
| Portal dostawcy (`dostawcy.*`) | dostawca | D-01 | 1/1 |
| Wspólne | wszyscy | X-01, X-02 (modal), X-03 | 3/3 |

- Use cases: 16 (UC-01…UC-15 MVP, UC-16 faza 2); statusy: SUBMITTED → AWAITING_CUSTOMER → APPROVED → IN_TRANSIT → RECEIVED → IN_SERVICE → RESOLVED, plus REJECTED, CANCELLED (docs/02 §2.7, mockup/src/types.ts).
- Symulowane w mockupie: backend i API (localStorage), upload/skan AV, kod QR, PDF, SSO, CAPTCHA, analityka, „asystent AI” (heurystyka). README §Ograniczenia

## Traceability

- Covered end-to-end (UC → screen → mockup route): 15/15 use case'ów MVP; 24/24 ekranów z mapy ma trasę lub modal w mockupie.
- Gaps (najważniejsze najpierw):
  - Brak ekranu i use case'u dla administratora (`ADMIN`: integracje, użytkownicy, branding), choć rola jest w personach. `[DOCUMENT]` docs/01 §1.3 B5
  - Mockup nie ma roli kierownika: B-05 i B-07 są dostępne dla każdego `AGENT`, a docs ograniczają edycję do kierownika. `[PRODUCT]` mockup/src/screens/admin.ts:30,178 → Q05
  - K-05 jest w mapie dostępny dla agenta, a w mockupie tylko dla `CUSTOMER`. `[PRODUCT]` mockup/src/screens/portal.ts:270 → Q06
  - Eskalacja reklamacji po 10 dniach (UC-03) nie jest zaimplementowana; SLA w skrzynce liczy tylko dni do terminu. `[PRODUCT]` mockup/src/screens/bo.ts:3 → Q07
  - Automatyczny zwrot pieniędzy po inspekcji z oceną A/B (UC-11 krok 4) nie jest zaimplementowany. `[PRODUCT]` mockup/src/api.ts `inspect` → Q08
  - KPI bez źródła danych/ekranu: kontakty WISMR, % bez uzupełnień, % odpowiedzi w 14 dni (B-06 ich nie pokazuje). `[DOCUMENT]` docs/04 B-06 → Q02
- Rozbieżności docs ↔ mockup:
  - Rekomendacja w mockupie używa nieudokumentowanych progów (wartość ≥ 500 zł → naprawa; ≥ 6 zgłoszeń → sygnał nadużyć). `[PRODUCT]` mockup/src/logic.ts `recommend` → Q12
  - Szkoda transportowa: mockup wymaga 2 zdjęć, walidator w docs — ≥ 1. `[PRODUCT]` mockup/src/logic.ts `itemRequirements` → Q14
  - R5 (≥ 2000 zł → kierownik) w mockupie jest wyłączona. `[PRODUCT]` mockup/src/data.ts:236

## Domain glossary

| Term | Meaning | Owned by | Visible to |
|---|---|---|---|
| Zgłoszenie (Claim) | jedno zgłoszenie = jeden typ, jedno zamówienie, wiele pozycji | obsługa | klient, obsługa |
| Typ (kind) | Zwrot (RETURN), Reklamacja (COMPLAINT), Uszkodzenie w transporcie (TRANSPORT), Brak elementu (MISSING) | polityka | wszyscy |
| RMA | numer zgłoszenia `RMA-RRRR-NNNNN` | system | klient, obsługa, magazyn |
| Rozwiązanie | REFUND, STORE_CREDIT, EXCHANGE, REPLACEMENT, REPAIR, PRICE_REDUCTION, SPARE_PART | agent / reguła | klient, obsługa |
| Zatrzymaj produkt (keep it) | akceptacja bez odsyłania towaru | reguła / agent | klient, obsługa |
| Reklamacja do dostawcy | zbiorcza reklamacja DRAFT → SENT → ACCEPTED/REJECTED → CREDITED | agent | agent, dostawca |
| Ocena A/B/C, dyspozycja | stan towaru po inspekcji; na stan / outlet / do dostawcy / utylizacja | magazyn | obsługa |
| WISMR | kontakt „where is my return?” | — | KPI |

## Key flows

- Current state: obsługa mailowo-telefoniczna z wielokrotnym dopytywaniem; kroki i czasy nieopisane. `[DOCUMENT]` docs/01 §1.1
- Future state (UC-02, przepływ referencyjny): K-01 identyfikacja → Z-01 typ → Z-02 pozycje → Z-03 powód → Z-04 rozwiązanie z kwotą → Z-05 odesłanie → Z-06 podsumowanie → Z-07 RMA (auto-akceptacja R08 albo decyzja agenta) → nadanie → B-03 inspekcja → rozwiązanie. `[DOCUMENT]` docs/02 §2.4
- Future state (UC-10): B-01 skrzynka → B-02 karta z rekomendacją → Akceptuj / Poproś o informacje / Zaproponuj / Odrzuć. `[DOCUMENT]` docs/02 §2.9
- Future state (UC-12): B-02 „Przekaż do dostawcy” z kontrolą wytycznych → B-04 wysyłka → D-01 uznanie z notą. `[DOCUMENT]` docs/02 §2.11

## Business rules

| Id | Rule | Applies to | Source | Status | Review by | Required path to change | Owner | Supersedes |
|---|---|---|---|---|---|---|---|---|
| R01 | Okno zwrotu od dostawy: domyślnie 30 dni, konfigurowalne 14–365, nigdy < 14 (ustawa) | Zwrot | `[DOCUMENT]` docs/01 §1.2, docs/04 B-07 | active | unknown | owner + legal | Adam Adamczyk | none |
| R02 | Reklamacja do 24 mies. od dostawy | Reklamacja | `[DOCUMENT]` docs/02 §2.2 | active | unknown | owner + legal | Adam Adamczyk | none |
| R03 | Szkoda transportowa i brak elementu do 14 dni od dostawy (konfig. 1–30) | Transport, Brak | `[DOCUMENT]` docs/02 §2.2, docs/04 B-07 | active | unknown | owner | Adam Adamczyk | none |
| R04 | Odpowiedź na reklamację w 14 dni (brak = uznanie); eskalacja po 10 dniach | Reklamacja | `[DOCUMENT]` docs/01 §1.2, docs/02 §2.5 | active | unknown | owner + legal | Adam Adamczyk | none |
| R05 | W reklamacji najpierw naprawa/wymiana; obniżenie ceny/zwrot, gdy niemożliwe | Reklamacja | `[DOCUMENT]` docs/02 §2.5 | active | unknown | owner + legal | Adam Adamczyk | none |
| R06 | Produkty `returnable=false` (higieniczne po otwarciu, na zamówienie) wyłączone ze zwrotu, nadal reklamowalne | Zwrot | `[DOCUMENT]` docs/01 §1.2 | active | unknown | owner | Adam Adamczyk | none |
| R07 | Wymagane dowody łączą wymagania produktu, dostawcy i reguł (zdjęcia, wideo, nr seryjny). **Odroczone w wycinku reklamacji (potwierdzone przez właściciela 2026-10-25):** dowody tylko tekstowe, bez przesyłania plików (Q2 spec complaints-and-vendor-claim) | Reklamacja, Transport, Brak | `[DOCUMENT]` docs/02 §2.5, docs/05 §5.2 | active | unknown | owner | Adam Adamczyk | none |
| R08 | Reguła koncepcji R1: zwrot ≤ 150 zł → auto-akceptacja + etykieta. **Odroczone:** nie wdrożona w wycinku portalu klienta (Q6, każdy zwrot trafia do agenta) | Zwrot | `[DOCUMENT]` docs/02 §2.8 | active | unknown | kierownik (B-05) | Adam Adamczyk | none |
| R09 | Reguła koncepcji R2: reklamacja/transport ≤ 60 zł → auto-akceptacja bez odsyłania | Reklamacja, Transport | `[DOCUMENT]` docs/02 §2.8 | active | unknown | kierownik (B-05) | Adam Adamczyk | none |
| R10 | Reguły koncepcji R3–R5: transport → priorytet wysoki; elektronika/AGD → wideo; ≥ 2000 zł → kierownik | wg reguły | `[DOCUMENT]` docs/02 §2.8 | active | unknown | kierownik (B-05) | Adam Adamczyk | none |
| R11 | Agent zwraca pieniądze do 2000 zł; wyżej akceptacja kierownika/finansów; kwota ≤ wartość zgłoszenia | Zwrot pieniędzy | `[DOCUMENT]` docs/04 B-02, docs/05 §5.9 | active | unknown | owner + finance | Adam Adamczyk | none |
| R12 | Bon +10% z darmowym odesłaniem; zwrot pieniędzy pomniejszony o koszt odesłania | Zwrot | `[DOCUMENT]` docs/02 §2.4 | active | unknown | owner | Adam Adamczyk | none |
| R13 | Jedno zgłoszenie = jeden typ + jedno zamówienie, wiele pozycji; rozwiązanie na całe zgłoszenie | wszystkie | `[DOCUMENT]` docs/01 §1.5 | active | unknown | owner | Adam Adamczyk | none |
| R14 | Wyszukanie zamówienia/statusu: neutralny komunikat błędu, CAPTCHA po 5 próbach, 10/min/IP | K-01, K-04 | `[DOCUMENT]` docs/02 §2.3, docs/05 §5.1 | superseded | unknown | security | Adam Adamczyk | none |
| R15 | Odrzucenie wymaga uzasadnienia ≥ 30 znaków; anulowanie przez klienta do nadania paczki | B-02, K-05 | `[DOCUMENT]` docs/02 §2.7, §2.9 | active | unknown | owner | Adam Adamczyk | none |
| R16 | Retencja zdjęć i danych 3 lata, potem anonimizacja; WCAG 2.1 AA. **Odroczone:** retencja i anonimizacja nie są wdrożone w wycinku portalu klienta (e-mail i komentarze pozycji są przechowywane bez limitu do czasu decyzji prawnej); WCAG jest celem | wszystkie | `[DOCUMENT]` docs/01 §1.5, docs/05 §5.9 | active | unknown | owner + legal | Adam Adamczyk | none |
| R17 | Wyszukanie zamówienia/statusu: neutralny komunikat błędu; zamiast CAPTCHA dwa twarde limity: 10/min/IP oraz 5 nieudanych prób na 10 min dla pary (zamówienie, IP) | K-01, K-04 | decyzja w sesji 2026-10-23, spec return-customer-portal | active | security (przegląd przed publicznym wdrożeniem) | owner + security | Adam Adamczyk | R14 |

Wartości R01, R03, R08–R10 i R12 są zaimplementowane w mockupie tak samo jak w docs. `[PRODUCT]` mockup/src/data.ts:231–244

## Non-goals

| Id | We are not building | Why | Owner | Status | Review by | Required path to change | Source | Supersedes |
|---|---|---|---|---|---|---|---|---|
| N01 | Zgłoszenia B2B / zbiorcze (UC-16) w MVP | inne zasady prawne, faza 2 | Adam Adamczyk | active | unknown | owner | `[DOCUMENT]` docs/01 §1.3 A3 | none |
| N02 | Portal serwisu zewnętrznego | faza 2 | Adam Adamczyk | active | unknown | owner | `[DOCUMENT]` docs/01 §1.3 C2 | none |
| N03 | Rozwiązanie wybierane per pozycja | faza 2 | Adam Adamczyk | active | unknown | owner | `[DOCUMENT]` docs/01 §1.5 | none |
| N04 | Wersja językowa EN | faza 2 | Adam Adamczyk | active | unknown | owner | `[DOCUMENT]` docs/01 §1.5 | none |

## Decisions

| Id | Date | Decision | Why | Owner | Status | Review by | Required path to change | Source | Supersedes |
|---|---|---|---|---|---|---|---|---|---|
| D01 | 2026-10-13 | Claimlane jako wzorzec funkcji i UX; identyfikacja, treści i kod własne | gotowe wzorce samoobsługi i automatyzacji | Adam Adamczyk | active | unknown | owner | `[DOCUMENT]` README.md | none |
| D02 | 2026-10-13 | Portal klienta white-label, mobile-first | osadzenie w sklepie; założenie o telefonach (A02) | Adam Adamczyk | active | unknown | owner | `[DOCUMENT]` docs/01 §1.5 | none |
| D03 | 2026-10-13 | Platforma sklepu jest źródłem prawdy o zamówieniach; portal przechowuje zgłoszenia i załączniki | brak duplikacji danych zamówień | Adam Adamczyk | active | unknown | owner | `[DOCUMENT]` docs/01 §1.5 | none |
| D04 | 2026-10-13 | Trzy aplikacje z osobnymi powłokami i subdomenami | różni użytkownicy i urządzenia | Adam Adamczyk | superseded | unknown | owner + architektura | `[DOCUMENT]` docs/03 | none |
| D05 | 2026-10-13 | Klient loguje się linkiem e-mail (bez hasła); pracownicy przez SSO/OIDC | mniej tarcia, bez haseł | Adam Adamczyk | superseded | unknown | owner + security | `[DOCUMENT]` docs/05 §5.1 | none |
| D06 | 2026-10-13 | MVP = UC-01…UC-15 | zakres koncepcji | Adam Adamczyk | active | unknown | owner | `[DOCUMENT]` docs/02 §2.1 | none |
| D07 | 2026-10-23 | Cała aplikacja (portal klienta, `/admin`, Storybook, komunikaty walidacji, szablony e-mail) jest tylko po polsku; wartości przechowywane (statusy, rozwiązania) pozostają neutralne językowo | rynek docelowy jest polski; jedna wersja językowa upraszcza MVP, a wersja EN to N04 | Adam Adamczyk | confirmed | unknown | owner | decyzja w sesji 2026-10-23 | none |
| D08 | 2026-10-23 | Pierwszy wycinek: klient identyfikuje się numerem zamówienia + e-mailem i dostaje sesję gościa (2 h, zakres 1 zamówienia); logowanie linkiem e-mail odroczone | MVP bez wysyłki e-maili i bez kont klientów | Adam Adamczyk | active | security (przegląd przed publicznym wdrożeniem) | owner + security | decyzja w sesji 2026-10-23, spec return-customer-portal (Q5) | D05 |
| D09 | 2026-10-23 | Jedna aplikacja Next.js z powłokami jako trasy (portal klienta `/` i `/returns`, panel `/admin`, API `/api/<concept>`); subdomeny ewentualnie później przez rewrite | zgodność z monorepo i AGENTS.md; prostszy pierwszy wycinek (Q03) | Adam Adamczyk | active | architektura | owner + architektura | decyzja w sesji 2026-10-23; odpowiedź na Q03 z 2026-10-22 | D04 |
| D10 | 2026-10-24 | Agenci logują się e-mailem i hasłem przechowywanym w naszej bazie (hash scrypt, sesja 8 h w podpisanym ciasteczku); konta zakłada się zaproszeniem, pierwszego agenta komenda `npm run agent:create` | brak zewnętrznego dostawcy tożsamości w pierwszym wycinku; tożsamość agenta na każdym zdarzeniu | Adam Adamczyk | active | security (przegląd przed publicznym wdrożeniem) | owner + security | spec agent-login-and-roles (Q1, Q2, Q4, Q5, Q12), zatwierdzona przez właściciela 2026-10-24; wdrożona w PR #33 | none |
| D11 | 2026-10-24 | Uprawnienie `MANAGE_RULES` (jedyne uprawnienie na roli `AGENT`) daje też zarządzanie agentami (zaproszenie, wyłączenie) oraz zatwierdzanie zwrotów pieniędzy powyżej 2000 zł (`EASYRMS_REFUND_APPROVAL_LIMIT`) | R11 wymaga akceptacji powyżej limitu; jedno uprawnienie zamiast osobnej roli `MANAGER` (Q05) | Adam Adamczyk | active | finance (R11) | owner + finance | spec agent-login-and-roles (Q10, Q11), zatwierdzona przez właściciela 2026-10-24; wdrożona w PR #33 | none |
| D12 | 2026-10-25 | Kolejny wycinek po zwrotach: reklamacje klienta (UC-03), decyzja agenta w reklamacji (UC-10) i roszczenie do dostawcy (UC-12) w jednym wycinku | właściciel wybrał kierunek; brak danych wspierających wybór (A01, A04 nieprzetestowane) | Adam Adamczyk | active | unknown | owner | decyzja w sesji 2026-10-25, `.ai/specs/research/decisions/2026-10-25-next-slice-complaints-vendor-claim.md` | none |
| D13 | 2026-10-25 | Roszczenie do dostawcy wysyłane e-mailem; agent zapisuje odpowiedź dostawcy i notę kredytową w systemie; bez logowania dostawcy, portal D-01 poza wycinkiem | najtańszy pierwszy krok, nie zależy od A05 | Adam Adamczyk | active | unknown | owner | decyzja w sesji 2026-10-25, `.ai/specs/research/decisions/2026-10-25-next-slice-complaints-vendor-claim.md` | none |
| D14 | 2026-10-25 | W wycinku reklamacji: wspólna pula ilości dla zwrotów i reklamacji (jednostka objęta otwartym zgłoszeniem nie może być zgłoszona ponownie); brak potrącenia kosztu odesłania od zwrotu pieniędzy w reklamacji; odrzucenie roszczenia przez dostawcę wymaga uzasadnienia min. 20 znaków | zapobiega podwójnemu zwrotowi; koszt odesłania wadliwego produktu ponosi sklep (R12 dotyczy zwrotów; do sprawdzenia przez prawnika); prosta reguła audytu | Adam Adamczyk | active | legal (koszt odesłania) | owner | potwierdzone w sesji 2026-10-25, spec complaints-and-vendor-claim | none |

## Riskiest assumptions

| Id | Assumption | Importance | Evidence today | If false | Smallest test | Owner | By when | Result |
|---|---|---|---|---|---|---|---|---|
| A01 | Wielokrotne dopytywanie o dane to główny koszt obsługi i portal go usunie `[ASSUMPTION]` docs/01 §1.1 | high | opis zespołu, brak danych | wartość produktu i priorytet „kompletnych danych” spada | próbka 50 ostatnich spraw z maila/telefonu: ile wymagało dopytania, ile wymian wiadomości | pending | unknown | untested |
| A02 | Większość klientów zgłasza z telefonu `[ASSUMPTION]` docs/01 §1.5 | medium | brak | inne priorytety UX (D02) | udział mobile w ruchu sklepu / na stronie kontaktu | pending | unknown | untested |
| A03 | Bon +10% przesunie ≥ 25% zwrotów na bon/wymianę `[ASSUMPTION]` docs/01 §1.1 | medium | brak | R12 i retencja przychodu do rewizji | dzisiejszy udział bonów/wymian; test A/B w portalu | pending | unknown | untested |
| A04 | ≥ 35% zgłoszeń da się rozstrzygnąć prostymi regułami `[ASSUMPTION]` docs/01 §1.1 | high | liczniki trafień reguł w mockupie to dane demo | silnik reguł (UC-09, UC-14) mniej wart w MVP | przepuścić historyczne zgłoszenia przez R08–R10 (jak „Symuluj” w B-05) | pending | unknown | untested |
| A05 | Dostawcy przyjmą reklamacje przez portal i uznają ≥ 60% wartości `[ASSUMPTION]` docs/01 §1.1 | medium | brak | portal dostawcy (D-01) do późniejszej fazy; wycinek reklamacji z e-mailem (D13) nie zależy od A05 | rozmowa z 2–3 kluczowymi dostawcami o formacie i kanale | pending | unknown | untested |
| A06 | Magazyn przyjmie pracę skan + tablet `[ASSUMPTION]` docs/01 §1.3 B3 | low | brak | inny układ B-03 | obserwacja przyjęcia zwrotów w magazynie | pending | unknown | untested |
| A07 | Cele KPI są osiągalne i mierzalne `[ASSUMPTION]` docs/01 §1.1 | high | brak punktu wyjścia | brak kryterium sukcesu | zebrać baseline (Collection plan) | pending | unknown | untested |

## Kill criteria

Nie ustalono. Do decyzji właściciela (Q01): np. jeśli próbka z A01 pokaże, że mniej niż ~20% spraw wymaga dopytania, ograniczyć zakres do statusu i etykiet.

## Hypotheses to test

none

## Open questions

| Id | Question | Blocking | Who can answer | Status | Answer |
|---|---|---|---|---|---|
| Q01 | Kto jest właścicielem produktu i decyduje o zakresie? Kto potwierdza D01–D06 i R01–R16? | yes — wszystkie decyzje pozostają `proposal` | sponsor projektu | answered 2026-10-22 | Adam Adamczyk decyduje o zakresie i potwierdza D01–D06 oraz R06–R16; prawnik potwierdza R01–R05, finanse R11 (2026-10-22). |
| Q02 | Jaki jest dziś punkt wyjścia każdego KPI i skąd brać dane (helpdesk dla WISMR, % uzupełnień, % odpowiedzi w 14 dni)? | yes — kryteria sukcesu | obsługa klienta / BI | answered 2026-10-22 | Zebrać punkty wyjścia KPI wg Collection plan przed specyfikacją; spec idzie równolegle i niesie KPI jako cele bez baseline; metrykę główną wybrać po zebraniu danych. |
| Q03 | Koncepcja zakłada 3 aplikacje na subdomenach i `/api/v1/{portal,bo,supplier}`; repo ma jedną aplikację Next.js (`/`, `/admin`, `/api/<concept>`, AGENTS.md). Czy mapujemy powłoki na trasy jednej aplikacji? | yes — spec i implementacja | architekt / owner | answered 2026-10-22 | Jedna aplikacja Next.js, powłoki jako trasy: portal klienta `/`, panel `/admin`, dostawca `/supplier`; API `/api/<concept>`. Subdomeny ewentualnie później przez rewrite. |
| Q04 | Rozszerzyć istniejącą encję `ReturnRequest` (orderNumber, email, reason, status `requested`) do modelu `Claim` (4 typy, 9 statusów), czy zastąpić ją? | yes — migracja danych | tech lead | answered 2026-10-22 | Rozszerzyć `ReturnRequest` migracją MikroORM: dodać `kind` (domyślnie RETURN) i nowe statusy, `requested` → SUBMITTED; pozycje i dowody później. |
| Q05 | Kierownik to `AGENT` + `MANAGE_RULES` (docs/01) czy osobna rola `MANAGER` (docs/05)? Mockup nie rozróżnia. | yes — uprawnienia B-05/B-07 | owner | answered 2026-10-22 | Uprawnienie `MANAGE_RULES` na roli `AGENT`, bez osobnej roli `MANAGER`. |
| Q06 | Czy agent ma widzieć K-05 (widok klienta)? Mapa: tak, mockup: nie. | no | owner / UX | answered 2026-10-22 | Tak — agent widzi K-05 tylko do odczytu (podgląd widoku klienta), bez akcji. |
| Q07 | Eskalacja reklamacji po 10 dniach: kto ją dostaje i jak wygląda w B-01? | no — tylko UC-03 | owner | answered 2026-10-22 | Eskalacja po 10 dniach trafia do użytkowników z `MANAGE_RULES`; w B-01 czerwona plakietka SLA i wyższa pozycja na liście. Realizacja w wycinku reklamacji. Wdrożone jako plakietka i kolejność widoczne dla wszystkich agentów, bez kierowania do `MANAGE_RULES` (brak przypisań; potwierdzone przez właściciela 2026-10-25). |
| Q08 | Automatyczny zwrot pieniędzy po inspekcji A/B dla zwrotów — robimy w MVP? | no | owner + finance | answered 2026-10-22 | Nie w MVP — zwrot pieniędzy ręcznie przez agenta po inspekcji; automatyzacja po integracji płatności i akceptacji finansów. |
| Q09 | Jak 9 statusów mapuje się na 5 etapów trackera klienta (gdzie AWAITING_CUSTOMER, REJECTED, CANCELLED)? | no | UX | answered 2026-10-22 | 5 etapów na ścieżce podstawowej (IN_SERVICE pod „Odebrano”); AWAITING_CUSTOMER jako baner „wymagane działanie”; REJECTED/CANCELLED zastępują tracker stanem zamkniętym z powodem. |
| Q10 | Komunikat „odpowiemy w 2 dni robocze” to wewnętrzny cel dla wszystkich typów, obok ustawowych 14 dni dla reklamacji? | no | owner | answered 2026-10-22 | Tak — „odpowiemy w 2 dni robocze” to wewnętrzny cel dla wszystkich typów; ustawowe 14 dni dla reklamacji śledzone osobno (R04) i nie obiecywane klientowi. Sformułowanie do sprawdzenia przez prawnika. |
| Q11 | Które integracje w MVP: platforma sklepu, przewoźnik, bramka płatności, bony, e-mail/SMS? | yes — implementacja UC-01, UC-02 | owner / IT | answered 2026-10-22 | MVP: platforma sklepu (wyszukanie zamówienia) + e-mail transakcyjny. Etykiety, zwroty pieniędzy i bony ręcznie/atrapy za interfejsami serwisów w Awilix. |
| Q12 | Rekomendacja w MVP: reguły czy model AI? Progi z mockupu (≥ 500 zł → naprawa, ≥ 6 zgłoszeń → nadużycie) do zatwierdzenia lub odrzucenia. | no | owner | answered 2026-10-22 | Tylko reguły, bez AI; progi z mockupu (≥ 500 zł, ≥ 6 zgłoszeń) poza pierwszym wycinkiem, wrócą jako konfigurowalne reguły po próbce (A04). |
| Q13 | Pierwszy wycinek zakresu: czy zwrot end-to-end (UC-01, 02, 06, 10) zamiast całego D06? | yes — spec | owner | answered 2026-10-22 | Zwrot end-to-end: UC-01, UC-02, UC-06, UC-10. Reklamacje, szkody transportowe, silnik reguł, magazyn i dostawcy w kolejnych specyfikacjach. |
| Q14 | Szkoda transportowa: 1 czy 2 zdjęcia minimum (produkt + opakowanie)? | no | owner | answered 2026-10-22 | Minimum 1 zdjęcie (zgodnie z walidatorem w docs); mockup (2 zdjęcia) do dostosowania. Dotyczy wycinka szkód transportowych. |
| Q15 | Logowanie agenta: panel `/admin` i `PATCH /api/returns/[id]` nie mają dziś uwierzytelniania (AD-A2), więc każdy z dostępem do aplikacji może zatwierdzać i odrzucać, a zdarzenia nie wskazują agenta. Potrzebna osobna specyfikacja logowania i ról agenta. | yes — blokuje publiczne wdrożenie (portal klienta jest w tej samej aplikacji) | właściciel produktu (Adam Adamczyk) | answered 2026-10-24 | Tak — spec `agent-login-and-roles` (D10, D11): logowanie e-mailem i hasłem, sesja 8 h, tożsamość agenta na zdarzeniach, ekran zarządzania agentami, limit zwrotu 2000 zł dla `MANAGE_RULES`, podgląd K-05 (Q06). Wdrożone w PR #33; przegląd security i akceptacja finansów dla R11 pozostają przed publicznym wdrożeniem. |
| Q16 | Co musi zawierać roszczenie do dostawcy i jak działa kontrola wytycznych dostawcy z UC-12 (jakie wytyczne, skąd je brać)? | yes — spec roszczenia | owner / zakupy | open | |
| Q17 | Kto wysyła e-mail do dostawcy i z jakiego adresu (dziś `MailPort` ma tylko adapter logujący)? | yes — implementacja UC-12 | owner / IT | open | |
| Q18 | Jak zapisujemy notę kredytową dostawcy i kto odpowiada za przepływ pieniędzy (finanse)? | no — tylko zapis w systemie, bez księgowania | owner + finance | open | |
| Q19 | Jak system śledzi R04 („brak odpowiedzi w 14 dni = uznanie”) i co oznacza dla klienta; czy sformułowanie sprawdzi prawnik? | yes — spec reklamacji | owner + legal | open | |

## Definition of Ready addendum (own)

Problems i Target group opierają się tylko na opisie zespołu — brak wywiadów i danych (A01, A02), więc pełna implementacja poza pierwszym wycinkiem nie jest uzasadniona dowodami. Właściciel podpisał gotowość 2026-10-23 (Q01, Q03, Q04 i Q13 odpowiedziane): można pisać i implementować pierwszy wycinek, a research (A01, A04, Q02) trwa równolegle. Reguły R01–R05 wynikają z prawa konsumenckiego i wymagają tylko potwierdzenia przez osobę od spraw prawnych.

## Collection plan

1. Próbka ok. 50 ostatnich spraw zwrotów/reklamacji (mail/telefon): liczba dopytań, czas do rozwiązania, typ, wartość → A01, A04, Q02. Właściciel: kierownik obsługi; termin: do ustalenia.
2. Punkt wyjścia KPI: kontakty WISMR, udział bonów/wymian, % odpowiedzi w 14 dni, udział mobile → A02, A03, A07. Właściciel: BI/e-commerce; termin: do ustalenia.
3. Rozmowa z 2–3 kluczowymi dostawcami o formacie reklamacji i kanale (portal / e-mail / EDI) → A05, Q16. Właściciel: zakupy; termin: do ustalenia. Od 2026-10-25 idzie równolegle z pisaniem specyfikacji wycinka reklamacji (D12, D13), nie jest jej warunkiem wstępnym; wynik zdecyduje o ewentualnym portalu dostawcy.

Odświeżenie 2026-10-25: właściciel wybrał kolejny wycinek (D12, D13) bez nowych danych; gotowość obejmuje spec writing dla tego wycinka. Pytania Q16–Q19 trzeba rozstrzygnąć przed planowaniem implementacji. Liczba reklamacji i odsetek trafiających do dostawcy są nieznane, a dowody problemu (A01) nadal brakują.
