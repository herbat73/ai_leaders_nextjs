// Słowniki, dane demonstracyjne i magazyn stanu (localStorage)

const DEMO = { order: 'TS-10482', email: 'anna@example.com', iban: 'PL61109010140000071219812874' };
const SHOP = { name: 'TwójSklep', support: 'zwroty@twojsklep.example', phone: '22 555 10 20' };

const KINDS: Record<ClaimKind, { label: string; short: string; icon: string; hint: string }> = {
  RETURN: { label: 'Zwrot', short: 'Zwrot', icon: '↩️', hint: 'Rozmyśliłeś się albo produkt nie pasuje.' },
  COMPLAINT: { label: 'Reklamacja', short: 'Reklamacja', icon: '🛠️', hint: 'Produkt nie działa lub ma wadę.' },
  TRANSPORT: { label: 'Uszkodzenie w transporcie', short: 'Transport', icon: '📦', hint: 'Paczka lub produkt dotarły uszkodzone.' },
  MISSING: { label: 'Brak elementu lub inny produkt', short: 'Brak elementu', icon: '🧩', hint: 'Czegoś brakuje w paczce albo przyszedł inny produkt.' },
};

const REASONS: Record<ClaimKind, [string, string][]> = {
  RETURN: [['SIZE', 'Nie pasuje rozmiar'], ['NOT_AS_DESCRIBED', 'Produkt wygląda inaczej niż na zdjęciach'], ['CHANGED_MIND', 'Rozmyśliłem/-am się'], ['BETTER_PRICE', 'Znalazłem/-am taniej'], ['MISTAKE', 'Zamówione przez pomyłkę'], ['OTHER', 'Inny powód']],
  COMPLAINT: [['NOT_WORKING', 'Nie działa / nie włącza się'], ['INTERMITTENT', 'Działa nieprawidłowo lub z przerwami'], ['LEAK', 'Przecieka'], ['BROKEN_PART', 'Pęknięty lub złamany element'], ['BATTERY', 'Problem z baterią / ładowaniem'], ['COSMETIC', 'Wada wizualna'], ['OTHER', 'Inna wada']],
  TRANSPORT: [['CRUSHED', 'Zgnieciona paczka i produkt'], ['BROKEN', 'Produkt rozbity / pęknięty'], ['WET', 'Paczka zalana'], ['OTHER', 'Inne uszkodzenie']],
  MISSING: [['MISSING_PART', 'Brak elementu zestawu'], ['MISSING_ITEM', 'Brak produktu w paczce'], ['WRONG_ITEM', 'Otrzymałem/-am inny produkt']],
};

function reasonLabel(kind: ClaimKind, code: string): string { return REASONS[kind].find((r) => r[0] === code)?.[1] ?? code; }

const RESOLUTIONS: Record<Resolution, { label: string; icon: string }> = {
  REFUND: { label: 'Zwrot pieniędzy', icon: '💸' },
  STORE_CREDIT: { label: 'Bon sklepowy', icon: '🎁' },
  EXCHANGE: { label: 'Wymiana na inny wariant', icon: '🔁' },
  REPLACEMENT: { label: 'Wymiana na nowy', icon: '📦' },
  REPAIR: { label: 'Naprawa', icon: '🔧' },
  PRICE_REDUCTION: { label: 'Obniżenie ceny', icon: '🏷️' },
  SPARE_PART: { label: 'Dosłanie brakującej części', icon: '🧩' },
};

const RETURN_METHODS: Record<ReturnMethod, string> = { PARCEL_LOCKER: 'Paczkomat (kod QR)', COURIER: 'Kurier z odbiorem', STORE: 'Sklep stacjonarny', NONE: 'Bez odsyłania' };

const CATEGORIES: Record<Category, string> = { ELECTRONICS: 'Elektronika', APPLIANCES: 'AGD', HOME: 'Dom i kuchnia', APPAREL: 'Odzież', HYGIENE: 'Higiena osobista' };

const TEAMS = ['Zwroty', 'Reklamacje', 'Elektronika', 'Transport', 'Kierownik'];
const AGENTS = ['Marta Wiśniewska', 'Tomasz Zieliński', 'Ewa Lis'];

const STATUS: Record<ClaimStatus, { label: string; bo: string; tone: 'info' | 'warn' | 'ok' | 'danger' | 'neutral'; next: string; step: number }> = {
  SUBMITTED: { label: 'Zgłoszone', bo: 'Do decyzji', tone: 'info', next: 'Rozpatrzymy zgłoszenie w ciągu 2 dni roboczych.', step: 0 },
  AWAITING_CUSTOMER: { label: 'Potrzebujemy Twojej odpowiedzi', bo: 'Czeka na klienta', tone: 'warn', next: 'Odpowiedz na wiadomość sklepu poniżej.', step: 1 },
  APPROVED: { label: 'Zaakceptowane', bo: 'Zaakceptowane', tone: 'ok', next: 'Nadaj paczkę z kodem QR.', step: 2 },
  IN_TRANSIT: { label: 'Paczka w drodze', bo: 'W drodze', tone: 'info', next: 'Paczka jest w drodze do naszego magazynu.', step: 2 },
  RECEIVED: { label: 'Sprawdzamy produkt', bo: 'Przyjęte — do rozwiązania', tone: 'info', next: 'Sprawdzamy produkt — zwykle trwa to 1–2 dni.', step: 3 },
  IN_SERVICE: { label: 'W naprawie', bo: 'W serwisie / u dostawcy', tone: 'info', next: 'Produkt jest w serwisie. Poinformujemy Cię o wyniku.', step: 3 },
  RESOLVED: { label: 'Rozwiązane', bo: 'Rozwiązane', tone: 'ok', next: 'Sprawa zakończona.', step: 4 },
  REJECTED: { label: 'Odrzucone', bo: 'Odrzucone', tone: 'danger', next: 'Zapoznaj się z uzasadnieniem. Możesz odpowiedzieć sklepowi.', step: 4 },
  CANCELLED: { label: 'Anulowane', bo: 'Anulowane', tone: 'neutral', next: 'Zgłoszenie zostało anulowane.', step: 4 },
};

const OPEN_STATUSES: ClaimStatus[] = ['SUBMITTED', 'AWAITING_CUSTOMER', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'IN_SERVICE'];

const PICKUP_POINTS = [
  { id: 'WAW01M', name: 'Paczkomat WAW01M', address: 'ul. Puławska 12, 02-566 Warszawa' },
  { id: 'WAW114', name: 'Paczkomat WAW114', address: 'ul. Grójecka 75, 02-094 Warszawa' },
  { id: 'WAW220', name: 'Paczkomat WAW220', address: 'al. Jana Pawła II 43, 01-001 Warszawa' },
  { id: 'KRA08A', name: 'Paczkomat KRA08A', address: 'ul. Karmelicka 30, 31-128 Kraków' },
  { id: 'POZ33N', name: 'Paczkomat POZ33N', address: 'ul. Głogowska 100, 60-263 Poznań' },
];

const STORES = [
  { id: 'st-waw', name: 'TwójSklep Warszawa — Galeria Mokotów' },
  { id: 'st-kra', name: 'TwójSklep Kraków — Bonarka' },
  { id: 'st-poz', name: 'TwójSklep Poznań — Posnania' },
];

const REQUEST_ITEMS: [string, string][] = [['PHOTO', 'Dodatkowe zdjęcia'], ['VIDEO', 'Nagranie wideo pokazujące wadę'], ['SERIAL', 'Numer seryjny'], ['RECEIPT', 'Dowód zakupu / gwarancja']];

function line(lineId: string, sku: string, name: string, variant: string, emoji: string, qty: number, price: number, category: Category, supplierId: string, opts: Partial<OrderLine> = {}): OrderLine {
  return { lineId, sku, name, variant, emoji, qty, price, category, supplierId, serialRequired: false, returnable: true, ...opts };
}

function seedDb(): Db {
  const t = todayISO();
  const at = (days: number, time = '10:15') => addDays(t, days) + 'T' + time + ':00';
  const photo = (name: string, size = 2_100_000): FileMeta => ({ id: uid('f'), name, size, mime: name.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg', status: 'ready', progress: 100 });

  const orders: Order[] = [
    {
      id: 'o10482', number: 'TS-10482', email: DEMO.email, phone: '+48 600 700 789', customerName: 'Anna Kowalska', placedAt: at(-8), deliveredAt: addDays(t, -5), paymentMethod: 'CARD',
      address: { street: 'ul. Lipowa 5/3', zip: '02-512', city: 'Warszawa' },
      lines: [
        line('l1', 'SP-X2-BLK', 'Słuchawki bezprzewodowe SoundPro X2', 'Czarne', '🎧', 1, 349, 'ELECTRONICS', 'sup-sound', { serialRequired: true, exchangeVariants: [{ label: 'Białe', inStock: true }, { label: 'Granatowe', inStock: false }] }),
        line('l2', 'LN-SH-M-BEI', 'Koszula lniana', 'Rozmiar M · beżowa', '👕', 1, 89, 'APPAREL', 'sup-textil', { exchangeVariants: [{ label: 'Rozmiar S', inStock: true }, { label: 'Rozmiar L', inStock: true }, { label: 'Rozmiar XL', inStock: false }] }),
        line('l3', 'KB-350-GRF', 'Kubek ceramiczny 350 ml', 'Grafitowy', '🍵', 2, 39, 'HOME', 'sup-home'),
        line('l4', 'SM-ONE-WHT', 'Szczoteczka soniczna SmileOne', 'Biała', '🪥', 1, 199, 'HYGIENE', 'sup-sound', { serialRequired: true, returnable: false }),
      ],
    },
    {
      id: 'o10391', number: 'TS-10391', email: DEMO.email, phone: '+48 600 700 789', customerName: 'Anna Kowalska', placedAt: at(-44), deliveredAt: addDays(t, -40), paymentMethod: 'BLIK',
      address: { street: 'ul. Lipowa 5/3', zip: '02-512', city: 'Warszawa' },
      lines: [
        line('l1', 'KF-B500-INX', 'Ekspres ciśnieniowy Barista 500', 'Inox', '☕', 1, 1299, 'APPLIANCES', 'sup-kaffeo', { serialRequired: true }),
        line('l2', 'KF-FLT-3', 'Filtry do wody (3 szt.)', '', '💧', 2, 59, 'HOME', 'sup-kaffeo'),
      ],
    },
    {
      id: 'o09877', number: 'TS-09877', email: DEMO.email, phone: '+48 600 700 789', customerName: 'Anna Kowalska', placedAt: at(-405), deliveredAt: addDays(t, -400), paymentMethod: 'COD',
      address: { street: 'ul. Lipowa 5/3', zip: '02-512', city: 'Warszawa' },
      lines: [line('l1', 'CA-V8', 'Odkurzacz pionowy CleanAir V8', 'Szary', '🧹', 1, 899, 'APPLIANCES', 'sup-cleanair', { serialRequired: true })],
    },
    {
      id: 'o10510', number: 'TS-10510', email: DEMO.email, phone: '+48 600 700 789', customerName: 'Anna Kowalska', placedAt: at(-1), deliveredAt: null, paymentMethod: 'CARD',
      address: { street: 'ul. Lipowa 5/3', zip: '02-512', city: 'Warszawa' },
      lines: [line('l1', 'LM-ARC', 'Lampa podłogowa Arco', 'Mosiądz', '💡', 1, 459, 'HOME', 'sup-lumo')],
    },
    // zamówienia innych klientów (widoczne w panelu)
    { id: 'o10455', number: 'TS-10455', email: 'piotr.nowak@example.com', phone: '+48 601 100 200', customerName: 'Piotr Nowak', placedAt: at(-4), deliveredAt: addDays(t, -1), paymentMethod: 'CARD', address: { street: 'ul. Długa 1', zip: '31-147', city: 'Kraków' },
      lines: [line('l1', 'LU-GLS', 'Lampa stojąca Lumo Glass', 'Szkło mleczne', '💡', 1, 529, 'HOME', 'sup-lumo')] },
    { id: 'o10470', number: 'TS-10470', email: 'kasia.w@example.com', phone: '+48 602 200 300', customerName: 'Katarzyna Wiśniewska', placedAt: at(-9), deliveredAt: addDays(t, -6), paymentMethod: 'BLIK', address: { street: 'ul. Polna 8', zip: '60-101', city: 'Poznań' },
      lines: [line('l1', 'JK-DOWN-L', 'Kurtka puchowa Nordic', 'Rozmiar L · czarna', '🧥', 1, 399, 'APPAREL', 'sup-textil', { exchangeVariants: [{ label: 'Rozmiar M', inStock: true }] })] },
    { id: 'o10333', number: 'TS-10333', email: 'marek.l@example.com', phone: '+48 603 300 400', customerName: 'Marek Lewandowski', placedAt: at(-60), deliveredAt: addDays(t, -55), paymentMethod: 'CARD', address: { street: 'ul. Słoneczna 3', zip: '80-001', city: 'Gdańsk' },
      lines: [line('l1', 'KF-MIX', 'Blender kielichowy ProMix', 'Czarny', '🥤', 1, 279, 'APPLIANCES', 'sup-kaffeo', { serialRequired: true })] },
    { id: 'o10401', number: 'TS-10401', email: 'ewa.z@example.com', phone: '+48 604 400 500', customerName: 'Ewa Zielińska', placedAt: at(-12), deliveredAt: addDays(t, -9), paymentMethod: 'CARD', address: { street: 'ul. Lipowa 9', zip: '00-001', city: 'Warszawa' },
      lines: [line('l1', 'BD-SAT-160', 'Pościel satynowa 160×200', 'Szałwia', '🛏️', 1, 189, 'HOME', 'sup-home')] },
    { id: 'o10350', number: 'TS-10350', email: 't.kaminski@example.com', phone: '+48 605 500 600', customerName: 'Tomasz Kamiński', placedAt: at(-20), deliveredAt: addDays(t, -16), paymentMethod: 'CARD', address: { street: 'ul. Klonowa 2', zip: '50-001', city: 'Wrocław' },
      lines: [line('l1', 'SP-MINI', 'Głośnik Bluetooth SoundPro Mini', 'Czerwony', '🔊', 1, 159, 'ELECTRONICS', 'sup-sound', { serialRequired: true })] },
    { id: 'o10420', number: 'TS-10420', email: 'marta.d@example.com', phone: '+48 606 600 700', customerName: 'Marta Dąbrowska', placedAt: at(-15), deliveredAt: addDays(t, -11), paymentMethod: 'CARD', address: { street: 'ul. Leśna 4', zip: '20-001', city: 'Lublin' },
      lines: [line('l1', 'TR-HIKE-39', 'Buty trekkingowe Alpina', 'Rozmiar 39', '🥾', 1, 349, 'APPAREL', 'sup-textil')] },
  ];

  const item = (o: Order, lineId: string, qty: number, extra: Partial<ClaimItem>): ClaimItem => {
    const l = o.lines.find((x) => x.lineId === lineId)!;
    return { lineId, sku: l.sku, name: l.name, variant: l.variant, emoji: l.emoji, qty, price: l.price, category: l.category, supplierId: l.supplierId, reason: '', description: '', detectedAt: '', serial: '', missingPart: '', files: [], ...extra };
  };
  const o = (id: string) => orders.find((x) => x.id === id)!;
  const base = (id: string, number: string, kind: ClaimKind, status: ClaimStatus, ord: Order, items: ClaimItem[], extra: Partial<Claim>): Claim => {
    const value = items.reduce((s, i) => s + i.qty * i.price, 0);
    return {
      id, number, kind, status, channel: 'PORTAL', orderId: ord.id, orderNumber: ord.number, customerName: ord.customerName, email: ord.email, phone: ord.phone,
      createdAt: at(-2), responseDueAt: addDays(t, 12), items, resolution: 'REFUND', returnMethod: 'PARCEL_LOCKER', value, refundAmount: value,
      priority: 'NORMAL', team: 'Zwroty', tags: [], appliedRules: [], keepItem: false, timeline: [], messages: [], ...extra,
    };
  };

  const claims: Claim[] = [
    base('c1', 'RMA-2026-00871', 'COMPLAINT', 'AWAITING_CUSTOMER', o('o10391'), [item(o('o10391'), 'l1', 1, { reason: 'LEAK', description: 'Po zaparzeniu kawy spod ekspresu wycieka woda, kałuża pojawia się po każdym użyciu.', detectedAt: addDays(t, -6), files: [photo('ekspres_wyciek.jpg'), photo('ekspres_spod.jpg')] })], {
      createdAt: at(-5, '19:22'), responseDueAt: addDays(t, 9), resolution: 'REPAIR', returnMethod: 'COURIER', courier: { street: 'ul. Lipowa 5/3', zip: '02-512', city: 'Warszawa', date: addDays(t, 2) },
      team: 'Elektronika', assignee: 'Marta Wiśniewska', appliedRules: ['R4'], requestedInfo: ['VIDEO', 'SERIAL'],
      timeline: [
        { at: at(-5, '19:22'), status: 'SUBMITTED', title: 'Zgłoszenie przyjęte', actor: 'Klient' },
        { at: at(-4, '09:40'), status: 'AWAITING_CUSTOMER', title: 'Prośba o dodatkowe informacje', description: 'Nagranie wideo, numer seryjny.', actor: 'Marta Wiśniewska' },
      ],
      messages: [{ id: 'm1', from: 'AGENT', author: 'Marta Wiśniewska', at: at(-4, '09:40'), body: 'Dzień dobry, aby przekazać ekspres do serwisu producenta, potrzebujemy krótkiego nagrania wideo pokazującego wyciek oraz numeru seryjnego (naklejka na spodzie urządzenia). Dziękuję!' }],
    }),
    base('c2', 'RMA-2026-00880', 'RETURN', 'APPROVED', o('o10482'), [item(o('o10482'), 'l2', 1, { reason: 'SIZE', description: 'Za mała w ramionach.' })], {
      createdAt: at(-1, '20:05'), resolution: 'EXCHANGE', exchangeVariant: 'Rozmiar L', refundAmount: 0, pickupPoint: 'WAW01M', appliedRules: ['R1'],
      label: { carrier: 'Paczkomat', code: '6620 1145 9921', expiresAt: addDays(t, 13) },
      timeline: [
        { at: at(-1, '20:05'), status: 'SUBMITTED', title: 'Zgłoszenie przyjęte', actor: 'Klient' },
        { at: at(-1, '20:05'), status: 'APPROVED', title: 'Zaakceptowane automatycznie', description: 'Reguła: Szybki zwrot drobnych produktów. Wygenerowano kod QR.', actor: 'System' },
      ],
    }),
    base('c3', 'RMA-2026-00655', 'COMPLAINT', 'IN_SERVICE', o('o09877'), [item(o('o09877'), 'l1', 1, { reason: 'BATTERY', description: 'Akumulator trzyma 4 minuty, po pełnym naładowaniu.', detectedAt: addDays(t, -25), serial: 'CAV8-2291-0045', files: [photo('odkurzacz.jpg'), photo('wada.mp4', 24_000_000)] })], {
      createdAt: at(-24, '12:00'), responseDueAt: addDays(t, -10), resolution: 'REPAIR', returnMethod: 'COURIER', team: 'Elektronika', assignee: 'Tomasz Zieliński', supplierClaimId: 'sc1', refundAccount: DEMO.iban,
      inspection: { at: at(-18), by: 'Magazyn Błonie', condition: 'USED', complete: true, grade: 'C', defectConfirmed: 'yes', disposition: 'SUPPLIER', qtyReceived: 1, notes: 'Wada akumulatora potwierdzona testem.' },
      timeline: [
        { at: at(-24, '12:00'), status: 'SUBMITTED', title: 'Zgłoszenie przyjęte', actor: 'Klient' },
        { at: at(-23, '10:00'), status: 'APPROVED', title: 'Reklamacja uznana — naprawa', description: 'Kurier odbierze urządzenie.', actor: 'Tomasz Zieliński' },
        { at: at(-21, '15:00'), status: 'IN_TRANSIT', title: 'Paczka nadana', actor: 'Przewoźnik' },
        { at: at(-18, '09:30'), status: 'RECEIVED', title: 'Produkt przyjęty w magazynie', description: 'Wada potwierdzona.', actor: 'Magazyn' },
        { at: at(-17, '11:00'), status: 'IN_SERVICE', title: 'Przekazano do serwisu producenta CleanAir', actor: 'Tomasz Zieliński' },
      ],
    }),
    base('c4', 'RMA-2026-00512', 'RETURN', 'RESOLVED', o('o10391'), [item(o('o10391'), 'l2', 1, { reason: 'MISTAKE' })], {
      createdAt: at(-38), resolution: 'REFUND', refundAmount: 59 - 12.99, value: 59, outcome: { type: 'REFUND', amount: 46.01, at: at(-30) },
      timeline: [
        { at: at(-38), status: 'SUBMITTED', title: 'Zgłoszenie przyjęte', actor: 'Klient' },
        { at: at(-38), status: 'APPROVED', title: 'Zaakceptowane automatycznie', actor: 'System' },
        { at: at(-35), status: 'IN_TRANSIT', title: 'Paczka nadana', actor: 'Przewoźnik' },
        { at: at(-32), status: 'RECEIVED', title: 'Produkt przyjęty w magazynie', actor: 'Magazyn' },
        { at: at(-30), status: 'RESOLVED', title: 'Zwrot pieniędzy zlecony', description: '46,01 zł na BLIK.', actor: 'Ewa Lis' },
      ],
    }),
    base('c5', 'RMA-2026-00905', 'TRANSPORT', 'SUBMITTED', o('o10455'), [item(o('o10455'), 'l1', 1, { reason: 'BROKEN', description: 'Klosz roztrzaskany, karton wgnieciony z jednej strony.', files: [photo('lampa_klosz.jpg'), photo('karton.jpg')] })], {
      createdAt: at(0, '08:12'), responseDueAt: addDays(t, 14), resolution: 'REPLACEMENT', returnMethod: 'COURIER', priority: 'HIGH', team: 'Transport', appliedRules: ['R3'],
      timeline: [{ at: at(0, '08:12'), status: 'SUBMITTED', title: 'Zgłoszenie przyjęte', actor: 'Klient' }],
    }),
    base('c6', 'RMA-2026-00899', 'RETURN', 'SUBMITTED', o('o10470'), [item(o('o10470'), 'l1', 1, { reason: 'NOT_AS_DESCRIBED', description: 'Kolor bardziej grafitowy niż czarny.' })], {
      createdAt: at(-1, '17:40'), responseDueAt: addDays(t, 13), resolution: 'STORE_CREDIT', refundAmount: 438.9, team: 'Zwroty',
      timeline: [{ at: at(-1, '17:40'), status: 'SUBMITTED', title: 'Zgłoszenie przyjęte', actor: 'Klient' }],
    }),
    base('c7', 'RMA-2026-00874', 'COMPLAINT', 'IN_TRANSIT', o('o10333'), [item(o('o10333'), 'l1', 1, { reason: 'NOT_WORKING', description: 'Silnik nie startuje, czuć zapach spalenizny.', detectedAt: addDays(t, -7), serial: 'PMX-77812', files: [photo('blender.jpg'), photo('blender_test.mp4', 18_000_000)] })], {
      createdAt: at(-6), responseDueAt: addDays(t, 8), resolution: 'REPLACEMENT', returnMethod: 'PARCEL_LOCKER', pickupPoint: 'POZ33N', team: 'Elektronika', assignee: 'Marta Wiśniewska', appliedRules: ['R4'],
      label: { carrier: 'Paczkomat', code: '6620 2210 7781', expiresAt: addDays(t, 8) },
      timeline: [
        { at: at(-6), status: 'SUBMITTED', title: 'Zgłoszenie przyjęte', actor: 'Klient' },
        { at: at(-5), status: 'APPROVED', title: 'Reklamacja zaakceptowana — wymiana', actor: 'Marta Wiśniewska' },
        { at: at(-2), status: 'IN_TRANSIT', title: 'Paczka nadana', actor: 'Przewoźnik' },
      ],
    }),
    base('c8', 'RMA-2026-00893', 'RETURN', 'APPROVED', o('o10401'), [item(o('o10401'), 'l1', 1, { reason: 'CHANGED_MIND' })], {
      createdAt: at(-3), resolution: 'REFUND', refundAmount: 189 - 12.99, pickupPoint: 'WAW114', appliedRules: ['R1'],
      label: { carrier: 'Paczkomat', code: '6620 3390 1204', expiresAt: addDays(t, 11) },
      timeline: [{ at: at(-3), status: 'SUBMITTED', title: 'Zgłoszenie przyjęte', actor: 'Klient' }, { at: at(-3), status: 'APPROVED', title: 'Zaakceptowane automatycznie', actor: 'System' }],
    }),
    base('c9', 'RMA-2026-00860', 'MISSING', 'RESOLVED', o('o10350'), [item(o('o10350'), 'l1', 1, { reason: 'MISSING_PART', missingPart: 'Kabel USB-C', files: [photo('zawartosc.jpg')] })], {
      createdAt: at(-14), resolution: 'SPARE_PART', returnMethod: 'NONE', refundAmount: 0, team: 'Reklamacje', assignee: 'Ewa Lis', outcome: { type: 'SPARE_PART', ref: 'TS-10398', at: at(-13) },
      timeline: [{ at: at(-14), status: 'SUBMITTED', title: 'Zgłoszenie przyjęte', actor: 'Klient' }, { at: at(-13), status: 'RESOLVED', title: 'Wysłano brakującą część', description: 'Zamówienie TS-10398.', actor: 'Ewa Lis' }],
    }),
    base('c10', 'RMA-2026-00868', 'RETURN', 'RECEIVED', o('o10420'), [item(o('o10420'), 'l1', 1, { reason: 'SIZE', description: 'Za ciasne w palcach.' })], {
      createdAt: at(-8), resolution: 'REFUND', refundAmount: 349 - 12.99, pickupPoint: 'WAW220', team: 'Zwroty',
      label: { carrier: 'Paczkomat', code: '6620 1980 4410', expiresAt: addDays(t, 6) },
      inspection: { at: at(0, '09:05'), by: 'Magazyn Błonie', condition: 'NEW', complete: true, grade: 'A', defectConfirmed: 'na', disposition: 'RESTOCK', qtyReceived: 1, notes: 'Bez śladów użytkowania.' },
      timeline: [
        { at: at(-8), status: 'SUBMITTED', title: 'Zgłoszenie przyjęte', actor: 'Klient' },
        { at: at(-7), status: 'APPROVED', title: 'Zgłoszenie zaakceptowane', actor: 'Ewa Lis' },
        { at: at(-4), status: 'IN_TRANSIT', title: 'Paczka nadana', actor: 'Przewoźnik' },
        { at: at(0, '09:05'), status: 'RECEIVED', title: 'Produkt przyjęty w magazynie', description: 'Ocena A — na stan.', actor: 'Magazyn' },
      ],
    }),
  ];

  return {
    version: 1,
    session: null,
    orders,
    claims,
    suppliers: [
      { id: 'sup-sound', name: 'SoundPro Polska', warrantyMonths: 24, requires: ['PHOTO', 'SERIAL'], contact: 'reklamacje@soundpro.example' },
      { id: 'sup-kaffeo', name: 'Kaffeo Sp. z o.o.', warrantyMonths: 24, requires: ['PHOTO', 'SERIAL', 'VIDEO', 'INSPECTION'], contact: 'serwis@kaffeo.example' },
      { id: 'sup-cleanair', name: 'CleanAir Europe', warrantyMonths: 24, requires: ['PHOTO', 'SERIAL', 'VIDEO'], contact: 'rma@cleanair.example' },
      { id: 'sup-home', name: 'Domowe Inspiracje', warrantyMonths: 12, requires: ['PHOTO'], contact: 'jakosc@dominspiracje.example' },
      { id: 'sup-textil', name: 'Len&Co', warrantyMonths: 12, requires: ['PHOTO'], contact: 'qa@lenco.example' },
      { id: 'sup-lumo', name: 'Lumo Design', warrantyMonths: 24, requires: ['PHOTO', 'INSPECTION'], contact: 'claims@lumo.example' },
    ],
    supplierClaims: [
      { id: 'sc1', number: 'SC-2026-0031', supplierId: 'sup-cleanair', status: 'SENT', claimIds: ['c3'], amount: 899, createdAt: at(-17), sentAt: at(-16) },
      { id: 'sc0', number: 'SC-2026-0024', supplierId: 'sup-kaffeo', status: 'CREDITED', claimIds: [], amount: 2860, createdAt: at(-60), sentAt: at(-58), response: { decision: 'ACCEPT', creditAmount: 2420, creditNoteNo: 'KOR/2026/118', at: at(-45) } },
    ],
    rules: [
      { id: 'R1', name: 'Szybki zwrot drobnych produktów', enabled: true, order: 1, conditions: { kinds: ['RETURN'], categories: [], reasons: [], minValue: null, maxValue: 150, maxDays: null }, action: 'AUTO_APPROVE', param: '', hits: 214 },
      { id: 'R2', name: 'Zatrzymaj tani produkt (bez odsyłania)', enabled: true, order: 2, conditions: { kinds: ['COMPLAINT', 'TRANSPORT'], categories: [], reasons: [], minValue: null, maxValue: 60, maxDays: null }, action: 'KEEP_ITEM', param: '', hits: 57 },
      { id: 'R3', name: 'Uszkodzenia transportowe — priorytet', enabled: true, order: 3, conditions: { kinds: ['TRANSPORT'], categories: [], reasons: [], minValue: null, maxValue: null, maxDays: null }, action: 'HIGH_PRIORITY', param: '', hits: 41 },
      { id: 'R4', name: 'Elektronika i AGD — wymagaj nagrania wideo', enabled: true, order: 4, conditions: { kinds: ['COMPLAINT'], categories: ['ELECTRONICS', 'APPLIANCES'], reasons: [], minValue: null, maxValue: null, maxDays: null }, action: 'REQUIRE_VIDEO', param: '', hits: 96 },
      { id: 'R5', name: 'Wysoka wartość — do kierownika', enabled: false, order: 5, conditions: { kinds: [], categories: [], reasons: [], minValue: 2000, maxValue: null, maxDays: null }, action: 'ASSIGN_TEAM', param: 'Kierownik', hits: 0 },
    ],
    templates: [
      { id: 't1', name: 'Prośba o nagranie wideo', body: 'Dzień dobry {imie}, aby szybko rozpatrzyć zgłoszenie {rma}, prosimy o krótkie nagranie wideo pokazujące wadę oraz numer seryjny produktu. Dziękujemy!' },
      { id: 't2', name: 'Zgłoszenie zaakceptowane', body: 'Dzień dobry {imie}, zgłoszenie {rma} zostało zaakceptowane. Kod QR do nadania paczki znajdziesz w portalu.' },
      { id: 't3', name: 'Propozycja obniżenia ceny', body: 'Dzień dobry {imie}, w ramach zgłoszenia {rma} proponujemy obniżenie ceny produktu. Szczegóły i decyzja — w portalu.' },
      { id: 't4', name: 'Odmowa — uszkodzenie mechaniczne', body: 'Dzień dobry {imie}, po analizie zgłoszenia {rma} stwierdziliśmy uszkodzenie mechaniczne powstałe w trakcie użytkowania, które nie jest objęte reklamacją.' },
    ],
    policy: { returnDays: 30, returnFee: 12.99, freeReturnForCredit: true, creditBonus: 10, excludedCategories: ['HYGIENE'], transportDays: 14 },
    draft: null,
    lastClaimId: null,
    seq: 912,
  };
}

const DB_KEY = 'portal-reklamacje-demo-db';

const Store = {
  db: null as unknown as Db,
  load(): void {
    const raw = storage.get(DB_KEY);
    if (raw) {
      try { const p = JSON.parse(raw) as Db; if (p.version === 1) { this.db = p; return; } } catch { /* seed */ }
    }
    this.db = seedDb();
    this.save();
  },
  save(): void { storage.set(DB_KEY, JSON.stringify(this.db)); },
  reset(): void { this.db = seedDb(); this.save(); },
  claim(id: string): Claim | undefined { return this.db.claims.find((c) => c.id === id); },
  order(id: string): Order | undefined { return this.db.orders.find((o) => o.id === id); },
  supplier(id: string): Supplier | undefined { return this.db.suppliers.find((s) => s.id === id); },
};
