"use strict";
// Model domenowy mockupu — odpowiada docs/05-katalog-api.md
// Narzędzia ogólne
function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function $(sel, root = document) {
    return root.querySelector(sel);
}
function $$(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
}
function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}
function uid(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 8);
}
function pad(n) { return n < 10 ? '0' + n : String(n); }
function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function nowTime() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function addDays(iso, days) {
    const d = new Date(iso.slice(0, 10) + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtDate(iso) {
    if (!iso)
        return '—';
    const [y, m, d] = iso.slice(0, 10).split('-');
    return `${d}.${m}.${y}`;
}
function fmtDateTime(iso) {
    if (!iso)
        return '—';
    const d = new Date(iso);
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fmtMoney(n) {
    return n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' zł';
}
function fmtSize(bytes) {
    if (bytes < 1024)
        return bytes + ' B';
    if (bytes < 1024 * 1024)
        return Math.round(bytes / 1024) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
}
function fmtIban(v) {
    return v.replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
}
function maskIban(v) {
    const c = v.replace(/\s+/g, '');
    return c ? '•••• ' + c.slice(-4) : '—';
}
function daysBetween(a, b) {
    return Math.round((new Date(b.slice(0, 10)).getTime() - new Date(a.slice(0, 10)).getTime()) / 86400000);
}
// Bezpieczny dostęp do localStorage (tryb prywatny / zablokowane dane)
const storage = {
    get(key) {
        try {
            return window.localStorage.getItem(key);
        }
        catch {
            return null;
        }
    },
    set(key, value) {
        try {
            window.localStorage.setItem(key, value);
        }
        catch { /* ignorujemy */ }
    },
    remove(key) {
        try {
            window.localStorage.removeItem(key);
        }
        catch { /* ignorujemy */ }
    },
};
function clone(v) { return JSON.parse(JSON.stringify(v)); }
// Walidatory — kody odpowiadają słownikowi w docs/04-specyfikacja-ekranow.md (4.0)
const V = {
    required(v) { return v.trim().length > 0; },
    orderNo(v) { return /^TS-\d{5}$/i.test(v.trim()); },
    rmaNo(v) { return /^RMA-\d{4}-\d{5}$/i.test(v.trim()); },
    email(v) { return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
    phone(v) {
        const c = v.replace(/[\s-]/g, '');
        return /^(\+48)?\d{9}$/.test(c) || /^\+[1-9]\d{7,14}$/.test(c);
    },
    ibanPL(v) {
        let c = v.replace(/\s+/g, '').toUpperCase();
        if (/^\d{26}$/.test(c))
            c = 'PL' + c;
        if (!/^PL\d{26}$/.test(c))
            return false;
        const numeric = (c.slice(4) + c.slice(0, 4)).replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
        let rem = 0;
        for (const ch of numeric)
            rem = (rem * 10 + Number(ch)) % 97;
        return rem === 1;
    },
    zip(v) { return /^\d{2}-\d{3}$/.test(v.trim()); },
    serial(v) { return /^[A-Z0-9-]{6,20}$/.test(v.trim().toUpperCase()); },
    name(v) { return /^[A-Za-zÀ-žĄĆĘŁŃÓŚŹŻąćęłńóśźż' -]{2,50}$/.test(v.trim()); },
    money(v) {
        const n = Number(v.replace(',', '.'));
        return /^\d+([.,]\d{1,2})?$/.test(v.trim()) && n > 0 && n <= 1000000;
    },
    notFuture(iso) { return !!iso && iso <= todayISO(); },
};
const FILE_RULES = {
    maxPhoto: 15 * 1024 * 1024,
    maxVideo: 100 * 1024 * 1024,
    maxFiles: 10,
    photoExt: ['.jpg', '.jpeg', '.png', '.heic'],
    videoExt: ['.mp4', '.mov'],
    docExt: ['.pdf'],
};
function isVideo(name, mime) {
    return mime.startsWith('video/') || FILE_RULES.videoExt.includes(name.toLowerCase().slice(name.lastIndexOf('.')));
}
function validateFile(name, size, mime) {
    const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
    const all = [...FILE_RULES.photoExt, ...FILE_RULES.videoExt, ...FILE_RULES.docExt];
    if (!all.includes(ext) && !/^(image\/(jpeg|png|heic|heif)|video\/(mp4|quicktime)|application\/pdf)$/.test(mime)) {
        return 'Nieobsługiwany format. Dodaj zdjęcie (JPG, PNG, HEIC), wideo (MP4, MOV) lub PDF.';
    }
    if (size === 0)
        return 'Plik jest pusty.';
    if (isVideo(name, mime)) {
        if (size > FILE_RULES.maxVideo)
            return `Wideo ma ${fmtSize(size)} — maksymalnie 100 MB. Skróć nagranie.`;
    }
    else if (size > FILE_RULES.maxPhoto)
        return `Plik ma ${fmtSize(size)} — maksymalnie 15 MB.`;
    return null;
}
// Słowniki, dane demonstracyjne i magazyn stanu (localStorage)
const DEMO = { order: 'TS-10482', email: 'anna@example.com', iban: 'PL61109010140000071219812874' };
const SHOP = { name: 'TwójSklep', support: 'zwroty@twojsklep.example', phone: '22 555 10 20' };
const KINDS = {
    RETURN: { label: 'Zwrot', short: 'Zwrot', icon: '↩️', hint: 'Rozmyśliłeś się albo produkt nie pasuje.' },
    COMPLAINT: { label: 'Reklamacja', short: 'Reklamacja', icon: '🛠️', hint: 'Produkt nie działa lub ma wadę.' },
    TRANSPORT: { label: 'Uszkodzenie w transporcie', short: 'Transport', icon: '📦', hint: 'Paczka lub produkt dotarły uszkodzone.' },
    MISSING: { label: 'Brak elementu lub inny produkt', short: 'Brak elementu', icon: '🧩', hint: 'Czegoś brakuje w paczce albo przyszedł inny produkt.' },
};
const REASONS = {
    RETURN: [['SIZE', 'Nie pasuje rozmiar'], ['NOT_AS_DESCRIBED', 'Produkt wygląda inaczej niż na zdjęciach'], ['CHANGED_MIND', 'Rozmyśliłem/-am się'], ['BETTER_PRICE', 'Znalazłem/-am taniej'], ['MISTAKE', 'Zamówione przez pomyłkę'], ['OTHER', 'Inny powód']],
    COMPLAINT: [['NOT_WORKING', 'Nie działa / nie włącza się'], ['INTERMITTENT', 'Działa nieprawidłowo lub z przerwami'], ['LEAK', 'Przecieka'], ['BROKEN_PART', 'Pęknięty lub złamany element'], ['BATTERY', 'Problem z baterią / ładowaniem'], ['COSMETIC', 'Wada wizualna'], ['OTHER', 'Inna wada']],
    TRANSPORT: [['CRUSHED', 'Zgnieciona paczka i produkt'], ['BROKEN', 'Produkt rozbity / pęknięty'], ['WET', 'Paczka zalana'], ['OTHER', 'Inne uszkodzenie']],
    MISSING: [['MISSING_PART', 'Brak elementu zestawu'], ['MISSING_ITEM', 'Brak produktu w paczce'], ['WRONG_ITEM', 'Otrzymałem/-am inny produkt']],
};
function reasonLabel(kind, code) { return REASONS[kind].find((r) => r[0] === code)?.[1] ?? code; }
const RESOLUTIONS = {
    REFUND: { label: 'Zwrot pieniędzy', icon: '💸' },
    STORE_CREDIT: { label: 'Bon sklepowy', icon: '🎁' },
    EXCHANGE: { label: 'Wymiana na inny wariant', icon: '🔁' },
    REPLACEMENT: { label: 'Wymiana na nowy', icon: '📦' },
    REPAIR: { label: 'Naprawa', icon: '🔧' },
    PRICE_REDUCTION: { label: 'Obniżenie ceny', icon: '🏷️' },
    SPARE_PART: { label: 'Dosłanie brakującej części', icon: '🧩' },
};
const RETURN_METHODS = { PARCEL_LOCKER: 'Paczkomat (kod QR)', COURIER: 'Kurier z odbiorem', STORE: 'Sklep stacjonarny', NONE: 'Bez odsyłania' };
const CATEGORIES = { ELECTRONICS: 'Elektronika', APPLIANCES: 'AGD', HOME: 'Dom i kuchnia', APPAREL: 'Odzież', HYGIENE: 'Higiena osobista' };
const TEAMS = ['Zwroty', 'Reklamacje', 'Elektronika', 'Transport', 'Kierownik'];
const AGENTS = ['Marta Wiśniewska', 'Tomasz Zieliński', 'Ewa Lis'];
const STATUS = {
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
const OPEN_STATUSES = ['SUBMITTED', 'AWAITING_CUSTOMER', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'IN_SERVICE'];
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
const REQUEST_ITEMS = [['PHOTO', 'Dodatkowe zdjęcia'], ['VIDEO', 'Nagranie wideo pokazujące wadę'], ['SERIAL', 'Numer seryjny'], ['RECEIPT', 'Dowód zakupu / gwarancja']];
function line(lineId, sku, name, variant, emoji, qty, price, category, supplierId, opts = {}) {
    return { lineId, sku, name, variant, emoji, qty, price, category, supplierId, serialRequired: false, returnable: true, ...opts };
}
function seedDb() {
    const t = todayISO();
    const at = (days, time = '10:15') => addDays(t, days) + 'T' + time + ':00';
    const photo = (name, size = 2100000) => ({ id: uid('f'), name, size, mime: name.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg', status: 'ready', progress: 100 });
    const orders = [
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
    const item = (o, lineId, qty, extra) => {
        const l = o.lines.find((x) => x.lineId === lineId);
        return { lineId, sku: l.sku, name: l.name, variant: l.variant, emoji: l.emoji, qty, price: l.price, category: l.category, supplierId: l.supplierId, reason: '', description: '', detectedAt: '', serial: '', missingPart: '', files: [], ...extra };
    };
    const o = (id) => orders.find((x) => x.id === id);
    const base = (id, number, kind, status, ord, items, extra) => {
        const value = items.reduce((s, i) => s + i.qty * i.price, 0);
        return {
            id, number, kind, status, channel: 'PORTAL', orderId: ord.id, orderNumber: ord.number, customerName: ord.customerName, email: ord.email, phone: ord.phone,
            createdAt: at(-2), responseDueAt: addDays(t, 12), items, resolution: 'REFUND', returnMethod: 'PARCEL_LOCKER', value, refundAmount: value,
            priority: 'NORMAL', team: 'Zwroty', tags: [], appliedRules: [], keepItem: false, timeline: [], messages: [], ...extra,
        };
    };
    const claims = [
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
        base('c3', 'RMA-2026-00655', 'COMPLAINT', 'IN_SERVICE', o('o09877'), [item(o('o09877'), 'l1', 1, { reason: 'BATTERY', description: 'Akumulator trzyma 4 minuty, po pełnym naładowaniu.', detectedAt: addDays(t, -25), serial: 'CAV8-2291-0045', files: [photo('odkurzacz.jpg'), photo('wada.mp4', 24000000)] })], {
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
        base('c7', 'RMA-2026-00874', 'COMPLAINT', 'IN_TRANSIT', o('o10333'), [item(o('o10333'), 'l1', 1, { reason: 'NOT_WORKING', description: 'Silnik nie startuje, czuć zapach spalenizny.', detectedAt: addDays(t, -7), serial: 'PMX-77812', files: [photo('blender.jpg'), photo('blender_test.mp4', 18000000)] })], {
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
    db: null,
    load() {
        const raw = storage.get(DB_KEY);
        if (raw) {
            try {
                const p = JSON.parse(raw);
                if (p.version === 1) {
                    this.db = p;
                    return;
                }
            }
            catch { /* seed */ }
        }
        this.db = seedDb();
        this.save();
    },
    save() { storage.set(DB_KEY, JSON.stringify(this.db)); },
    reset() { this.db = seedDb(); this.save(); },
    claim(id) { return this.db.claims.find((c) => c.id === id); },
    order(id) { return this.db.orders.find((o) => o.id === id); },
    supplier(id) { return this.db.suppliers.find((s) => s.id === id); },
};
// Reguły biznesowe: kwalifikowalność, wymagane dowody, kalkulacja, silnik reguł, rekomendacja.
// W docelowym systemie działają po stronie serwera (BFF) — tu symulowane.
function kindWindowDays(kind, p) {
    return kind === 'RETURN' ? p.returnDays : kind === 'COMPLAINT' ? 730 : p.transportDays;
}
function kindAvailability(order, kind, p = Store.db.policy) {
    if (!order.deliveredAt)
        return { available: false, deadline: '', reason: 'Zamówienie nie zostało jeszcze dostarczone.' };
    const deadline = addDays(order.deliveredAt, kindWindowDays(kind, p));
    if (todayISO() > deadline) {
        const msg = kind === 'RETURN' ? `Termin na zwrot minął ${fmtDate(deadline)}. Jeśli produkt jest wadliwy — złóż reklamację.`
            : kind === 'COMPLAINT' ? `Minęły 2 lata od dostawy (${fmtDate(deadline)}).`
                : `Takie zgłoszenia przyjmujemy do ${kindWindowDays(kind, p)} dni od dostawy (minęło ${fmtDate(deadline)}).`;
        return { available: false, deadline, reason: msg };
    }
    return { available: true, deadline, reason: '' };
}
function claimedQty(orderId, lineId) {
    const cs = Store.db.claims.filter((c) => c.orderId === orderId && !['CANCELLED', 'REJECTED'].includes(c.status));
    let qty = 0;
    let number = '';
    cs.forEach((c) => c.items.forEach((i) => { if (i.lineId === lineId) {
        qty += i.qty;
        number = c.number;
    } }));
    return { qty, number };
}
function lineEligibility(order, l, kind, p = Store.db.policy) {
    const { qty, number } = claimedQty(order.id, l.lineId);
    const remaining = l.qty - qty;
    if (remaining <= 0)
        return { eligible: false, remaining: 0, reason: `Już zgłoszone (${number}).` };
    if (kind === 'RETURN' && (!l.returnable || p.excludedCategories.includes(l.category))) {
        return { eligible: false, remaining, reason: `${CATEGORIES[l.category]} — produktu nie można zwrócić po otwarciu. Jeśli jest wadliwy, złóż reklamację.` };
    }
    return { eligible: true, remaining, reason: '' };
}
function daysSinceDelivery(order) { return order.deliveredAt ? daysBetween(order.deliveredAt, todayISO()) : 0; }
function matchRule(r, kind, items, value, days) {
    const c = r.conditions;
    if (c.kinds.length && !c.kinds.includes(kind))
        return false;
    if (c.categories.length && !items.some((i) => c.categories.includes(i.category)))
        return false;
    if (c.reasons.length && !items.some((i) => c.reasons.includes(i.reason)))
        return false;
    if (c.minValue !== null && value < c.minValue)
        return false;
    if (c.maxValue !== null && value > c.maxValue)
        return false;
    if (c.maxDays !== null && days > c.maxDays)
        return false;
    return true;
}
function activeRules() { return Store.db.rules.filter((r) => r.enabled).sort((a, b) => a.order - b.order); }
function itemRequirements(kind, it, lineDef, allItems, value, days) {
    const out = { photos: 0, serial: false, video: false, sources: [] };
    if (kind === 'RETURN')
        return out;
    out.photos = kind === 'TRANSPORT' ? 2 : 1;
    if (kind !== 'COMPLAINT')
        return out;
    const sup = Store.supplier(it.supplierId);
    if (lineDef?.serialRequired) {
        out.serial = true;
        out.sources.push('produkt ma numer seryjny');
    }
    if (sup?.requires.includes('SERIAL')) {
        out.serial = true;
        out.sources.push(`dostawca ${sup.name} wymaga numeru seryjnego`);
    }
    if (sup?.requires.includes('VIDEO')) {
        out.video = true;
        out.sources.push(`dostawca ${sup.name} wymaga wideo`);
    }
    const r = activeRules().find((x) => x.action === 'REQUIRE_VIDEO' && matchRule(x, kind, [it], value, days));
    if (r) {
        out.video = true;
        out.sources.push(`reguła sklepu „${r.name}”`);
    }
    out.sources = Array.from(new Set(out.sources));
    return out;
}
function draftValue(d) { return d.items.reduce((s, i) => s + i.qty * i.price, 0); }
function quoteOptions(d, order, p = Store.db.policy) {
    const v = draftValue(d);
    const round = (n) => Math.round(n * 100) / 100;
    const variants = d.items.length === 1 ? (order.lines.find((l) => l.lineId === d.items[0].lineId)?.exchangeVariants ?? []) : [];
    switch (d.kind) {
        case 'RETURN': return [
            { resolution: 'STORE_CREDIT', available: true, amount: round(v * (1 + p.creditBonus / 100)), note: `Bon o ${p.creditBonus}% wyższej wartości${p.freeReturnForCredit ? ', odesłanie gratis' : ''}. Dostępny od razu po przyjęciu zwrotu.`, tag: `+${p.creditBonus}%` },
            { resolution: 'REFUND', available: true, amount: round(v - p.returnFee), note: `Na pierwotną metodę płatności. Potrącamy koszt odesłania ${fmtMoney(p.returnFee)}.` },
            { resolution: 'EXCHANGE', available: variants.some((x) => x.inStock), amount: 0, note: variants.length ? 'Wyślemy nowy wariant, gdy tylko nadasz paczkę. Bez dopłat.' : d.items.length > 1 ? 'Wymiana dostępna dla zgłoszenia z jednym produktem.' : 'Ten produkt nie ma innych wariantów.', tag: variants.some((x) => x.inStock) ? 'Najszybciej' : undefined },
        ];
        case 'COMPLAINT': return [
            { resolution: 'REPLACEMENT', available: true, amount: null, note: 'Wyślemy nowy, sprawny produkt.', tag: 'Najczęściej wybierane' },
            { resolution: 'REPAIR', available: true, amount: null, note: 'Naprawa w autoryzowanym serwisie, zwykle 7–14 dni.' },
            { resolution: 'PRICE_REDUCTION', available: true, amount: null, note: 'Zatrzymujesz produkt, a my zwracamy część ceny. Kwotę zaproponujemy po analizie.' },
            { resolution: 'REFUND', available: true, amount: round(v), note: 'Zgodnie z prawem — gdy naprawa lub wymiana nie są możliwe albo wada jest istotna.' },
        ];
        case 'TRANSPORT': return [
            { resolution: 'REPLACEMENT', available: true, amount: null, note: 'Wyślemy nowy produkt priorytetowo.', tag: 'Najszybciej' },
            { resolution: 'REFUND', available: true, amount: round(v), note: 'Pełny zwrot kosztu pozycji.' },
        ];
        case 'MISSING': return [
            { resolution: 'SPARE_PART', available: true, amount: null, note: 'Doślemy brakujący element lub właściwy produkt.', tag: 'Najszybciej' },
            { resolution: 'REFUND', available: true, amount: round(v), note: 'Zwrot pieniędzy za zgłoszone pozycje.' },
        ];
        default: return [];
    }
}
function returnNeeded(d) {
    if (d.kind === 'MISSING')
        return false;
    if (d.resolution === 'PRICE_REDUCTION')
        return false;
    return true;
}
function keepItemPreview(d, order) {
    if (!d.kind)
        return undefined;
    return activeRules().find((r) => r.action === 'KEEP_ITEM' && matchRule(r, d.kind, d.items, draftValue(d), daysSinceDelivery(order)));
}
function defaultTeam(kind, items) {
    if (kind === 'RETURN')
        return 'Zwroty';
    if (kind === 'TRANSPORT')
        return 'Transport';
    if (kind === 'COMPLAINT' && items.some((i) => i.category === 'ELECTRONICS' || i.category === 'APPLIANCES'))
        return 'Elektronika';
    return 'Reklamacje';
}
function recommend(c) {
    const order = Store.order(c.orderId);
    const days = daysSinceDelivery(order);
    const checks = [];
    const win = kindWindowDays(c.kind, Store.db.policy);
    checks.push({ ok: days <= win, text: `Zgłoszono ${days} dni od dostawy (limit: ${win} dni)` });
    let missing = [];
    c.items.forEach((it) => {
        const req = itemRequirements(c.kind, it, order.lines.find((l) => l.lineId === it.lineId), c.items, c.value, days);
        const photos = it.files.filter((f) => !f.mime.startsWith('video')).length;
        const videos = it.files.filter((f) => f.mime.startsWith('video')).length;
        if (req.photos)
            checks.push({ ok: photos >= req.photos, text: `${it.name}: zdjęcia ${photos}/${req.photos}` });
        if (req.serial) {
            checks.push({ ok: !!it.serial, text: `${it.name}: numer seryjny ${it.serial ? 'podany' : 'brak'}` });
            if (!it.serial)
                missing.push('numer seryjny');
        }
        if (req.video) {
            checks.push({ ok: videos > 0, text: `${it.name}: wideo ${videos ? 'dołączone' : 'brak'}` });
            if (!videos)
                missing.push('nagranie wideo');
        }
        if (photos < req.photos)
            missing.push('zdjęcia');
    });
    const history = Store.db.claims.filter((x) => x.email === c.email && x.id !== c.id).length;
    checks.push({ ok: history < 6, text: `Historia klienta: ${history} inne zgłoszenia` });
    missing = Array.from(new Set(missing));
    if (missing.length) {
        return { action: 'REQUEST_INFO', resolution: c.resolution, confidence: 0.9, rationale: `Brakuje dowodów wymaganych przez wytyczne: ${missing.join(', ')}. Poproś klienta o uzupełnienie przed decyzją.`, checks };
    }
    const sup = Store.supplier(c.items[0].supplierId);
    if (c.kind === 'RETURN')
        return { action: 'APPROVE', resolution: c.resolution, confidence: 0.96, rationale: 'Zwrot w terminie, produkt podlega zwrotowi. Zaakceptuj zgodnie z wyborem klienta.', checks };
    if (c.kind === 'MISSING')
        return { action: 'APPROVE', resolution: 'SPARE_PART', confidence: 0.88, rationale: 'Zdjęcie zawartości potwierdza brak. Najtańsze rozwiązanie: dosłanie elementu.', checks };
    if (c.kind === 'TRANSPORT')
        return { action: 'APPROVE', resolution: 'REPLACEMENT', confidence: 0.84, rationale: 'Zdjęcia pokazują uszkodzenie opakowania i produktu — typowa szkoda transportowa. Wyślij zamiennik i zgłoś szkodę przewoźnikowi.', checks };
    const res = c.value >= 500 ? 'REPAIR' : 'REPLACEMENT';
    return { action: 'APPROVE', resolution: res, confidence: 0.81, rationale: `Opis i dowody wskazują na wadę fabryczną (${reasonLabel(c.kind, c.items[0].reason).toLowerCase()}).${sup ? ` Produkt objęty ${sup.warrantyMonths}-mies. gwarancją dostawcy ${sup.name} — po inspekcji przekaż reklamację do dostawcy.` : ''}`, checks };
}
function nextRma() { return `RMA-${todayISO().slice(0, 4)}-${String(++Store.db.seq).padStart(5, '0')}`; }
function newLabel() {
    const n = () => String(Math.floor(1000 + Math.random() * 9000));
    return { carrier: 'Paczkomat', code: `6620 ${n()} ${n()}`, expiresAt: addDays(todayISO(), 14) };
}
// Symulowane API. Ścieżki i kody odpowiadają docs/05-katalog-api.md.
// Panel demo wymusza scenariusz: normal / slow (loading) / empty / error.
class ApiError extends Error {
    constructor(status, code, message, fields = [], extra = {}) {
        super(message);
        this.status = status;
        this.code = code;
        this.fields = fields;
        this.extra = extra;
    }
}
const Demo = {
    scenario: 'normal',
    log: [],
    listeners: [],
    setScenario(s) { this.scenario = s; storage.set('portal-reklamacje-scenario', s); this.emit(); },
    emit() { this.listeners.forEach((l) => l()); },
};
async function apiCall(method, path, fn, opts = {}) {
    const t0 = performance.now();
    await sleep(Demo.scenario === 'slow' ? 2500 + Math.random() * 1000 : 220 + Math.random() * 330);
    const record = (status) => {
        Demo.log.unshift({ at: nowTime(), method, path, status, ms: Math.round(performance.now() - t0) });
        Demo.log = Demo.log.slice(0, 40);
        Demo.emit();
    };
    try {
        if (Demo.scenario === 'error' && !opts.noFail)
            throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Usługa jest chwilowo niedostępna.', [], { traceId: Math.random().toString(16).slice(2, 10) });
        if (Demo.scenario === 'empty' && opts.empty) {
            const r = opts.empty();
            record(200);
            return clone(r);
        }
        const r = fn();
        Store.save();
        record(method === 'POST' && /submit|claims$|labels|refunds|inspection|messages|rules$/.test(path) ? 201 : method === 'DELETE' ? 204 : 200);
        return r === undefined ? r : clone(r);
    }
    catch (e) {
        record(e instanceof ApiError ? e.status : 500);
        throw e;
    }
}
function sess(...roles) {
    const s = Store.db.session;
    if (!s || (roles.length && !roles.includes(s.role)))
        throw new ApiError(401, 'UNAUTHENTICATED', 'Sesja wygasła.');
    return s;
}
function canSeeClaim(c) {
    const s = Store.db.session;
    if (!s)
        return false;
    if (s.role === 'AGENT' || s.role === 'WAREHOUSE')
        return true;
    if (s.role === 'CUSTOMER')
        return (!!s.email && !s.orderId && s.email === c.email) || s.orderId === c.orderId || s.claimId === c.id;
    return false;
}
function getClaim(id) {
    const c = Store.claim(id);
    if (!c || !canSeeClaim(c))
        throw new ApiError(404, 'NOT_FOUND', 'Nie znaleziono zgłoszenia.');
    return c;
}
function push(c, status, title, actor, description) {
    c.status = status;
    c.timeline.push({ at: new Date().toISOString(), status, title, description, actor });
}
function sysMsg(c, body) { c.messages.push({ id: uid('m'), from: 'SYSTEM', author: SHOP.name, body, at: new Date().toISOString() }); }
const api = {
    // ---------- Portal: identyfikacja ----------
    config() { return apiCall('GET', '/portal/config', () => ({ policy: Store.db.policy }), { noFail: true }); },
    lookupOrder(orderNo, contact) {
        return apiCall('POST', '/portal/orders/lookup', () => {
            const n = orderNo.trim().toUpperCase();
            const c = contact.trim().toLowerCase().replace(/[\s-]/g, '');
            const o = Store.db.orders.find((x) => x.number === n && (x.email.toLowerCase() === c || x.phone.replace(/[\s-]/g, '').endsWith(c.replace(/^\+48/, ''))));
            if (!o)
                throw new ApiError(404, 'ORDER_NOT_FOUND', 'Nie znaleźliśmy zamówienia dla podanych danych.');
            if (!o.deliveredAt)
                throw new ApiError(409, 'NOT_DELIVERED', 'Zamówienie jest jeszcze w drodze.', [], { orderNumber: o.number });
            Store.db.session = { role: 'CUSTOMER', name: o.customerName.split(' ')[0], email: o.email, orderId: o.id };
            return { orderId: o.id };
        });
    },
    magicLink(email) { return apiCall('POST', '/portal/auth/magic-link', () => ({ sent: true })); },
    magicVerify(email) {
        return apiCall('POST', '/portal/auth/magic-link/verify', () => {
            const o = Store.db.orders.find((x) => x.email.toLowerCase() === email.toLowerCase());
            Store.db.session = { role: 'CUSTOMER', name: o ? o.customerName.split(' ')[0] : email.split('@')[0], email: email.toLowerCase() };
            return { ok: true };
        });
    },
    logout() { return apiCall('POST', '/portal/auth/logout', () => { Store.db.session = null; Store.db.draft = null; }, { noFail: true }); },
    myOrders() {
        return apiCall('GET', '/portal/me/orders', () => {
            const s = sess('CUSTOMER');
            return Store.db.orders.filter((o) => (s.orderId ? o.id === s.orderId : o.email === s.email)).sort((a, b) => b.placedAt.localeCompare(a.placedAt));
        }, { empty: () => [] });
    },
    myClaims() {
        return apiCall('GET', '/portal/me/claims', () => {
            sess('CUSTOMER');
            return Store.db.claims.filter(canSeeClaim).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        }, { empty: () => [] });
    },
    order(id) {
        return apiCall('GET', `/portal/orders/${id}`, () => {
            const s = sess('CUSTOMER', 'AGENT');
            const o = Store.order(id);
            if (!o || (s.role === 'CUSTOMER' && (s.orderId ? s.orderId !== id : s.email !== o.email)))
                throw new ApiError(404, 'NOT_FOUND', 'Nie znaleziono zamówienia.');
            return o;
        });
    },
    eligibility(orderId) {
        return apiCall('GET', `/portal/orders/${orderId}/eligibility`, () => {
            const o = Store.order(orderId);
            return Object.keys(KINDS).map((k) => ({ kind: k, ...kindAvailability(o, k) }));
        });
    },
    // ---------- Portal: kreator ----------
    createDraft(orderId, kind) {
        return apiCall('POST', '/portal/claims/drafts', () => {
            const o = Store.order(orderId);
            const s = Store.db.session;
            const d = {
                id: uid('drf'), step: 1, updatedAt: new Date().toISOString(),
                data: {
                    orderId, kind, items: [], resolution: '', exchangeVariant: '', refundJustification: '', returnMethod: '', pickupPoint: '', store: '',
                    courier: { street: o.address.street, zip: o.address.zip, city: o.address.city, date: '' }, refundAccount: '',
                    contact: { email: o.email, phone: o.phone }, consents: { truthful: false, withdrawal: false, confirmedByCustomer: false },
                },
            };
            void s;
            Store.db.draft = d;
            return d;
        });
    },
    patchDraft(data, step) {
        return apiCall('PATCH', `/portal/claims/drafts/${Store.db.draft?.id ?? 'new'}`, () => {
            const d = Store.db.draft;
            if (!d)
                throw new ApiError(404, 'NOT_FOUND', 'Wersja robocza wygasła.');
            d.data = data;
            d.step = Math.max(d.step, step);
            d.updatedAt = new Date().toISOString();
            return d;
        });
    },
    reasons(kind) { return apiCall('GET', `/portal/reasons?kind=${kind}`, () => REASONS[kind]); },
    requirements(d) {
        return apiCall('GET', `/portal/requirements?orderId=${d.orderId}&kind=${d.kind}`, () => {
            const o = Store.order(d.orderId);
            return d.items.map((it) => ({ lineId: it.lineId, ...itemRequirements(d.kind, it, o.lines.find((l) => l.lineId === it.lineId), d.items, draftValue(d), daysSinceDelivery(o)) }));
        });
    },
    quote(d) {
        return apiCall('POST', `/portal/claims/drafts/${Store.db.draft?.id}/quote`, () => {
            const o = Store.order(d.orderId);
            return { options: quoteOptions(d, o), keepItemRule: keepItemPreview(d, o)?.name ?? null };
        });
    },
    pickupPoints(q) {
        return apiCall('GET', `/portal/pickup-points?query=${encodeURIComponent(q)}`, () => {
            const ql = q.trim().toLowerCase();
            return PICKUP_POINTS.filter((p) => !ql || p.id.toLowerCase().includes(ql) || p.address.toLowerCase().includes(ql));
        }, { empty: () => [] });
    },
    registerAttachment(meta) { return apiCall('POST', `/portal/claims/drafts/${Store.db.draft?.id ?? '-'}/attachments`, () => ({ ...meta, status: 'scanning' })); },
    scanStatus(meta) {
        return apiCall('GET', `/portal/claims/drafts/${Store.db.draft?.id ?? '-'}/attachments/${meta.id}`, () => ({ scanStatus: /virus|wirus|eicar/i.test(meta.name) ? 'INFECTED' : 'CLEAN' }), { noFail: true });
    },
    submitDraft() {
        const s0 = Store.db.session;
        const path = s0?.role === 'AGENT' ? '/bo/claims' : `/portal/claims/drafts/${Store.db.draft?.id}/submit`;
        return apiCall('POST', path, () => {
            const s = sess('CUSTOMER', 'AGENT');
            const d = Store.db.draft;
            if (!d)
                throw new ApiError(404, 'NOT_FOUND', 'Wersja robocza wygasła.');
            const data = d.data;
            const o = Store.order(data.orderId);
            const kind = data.kind;
            const avail = kindAvailability(o, kind);
            if (!avail.available)
                throw new ApiError(422, 'WINDOW_EXPIRED', avail.reason, [{ field: 'step-1', message: avail.reason }]);
            const value = draftValue(data);
            const q = quoteOptions(data, o).find((x) => x.resolution === data.resolution);
            const now = new Date().toISOString();
            const c = {
                id: uid('c'), number: nextRma(), kind, status: 'SUBMITTED', channel: s.assisted?.channel ?? 'PORTAL',
                orderId: o.id, orderNumber: o.number, customerName: o.customerName, email: data.contact.email || o.email, phone: data.contact.phone || o.phone,
                createdAt: now, responseDueAt: addDays(todayISO(), 14), items: clone(data.items).map((i) => ({ ...i, files: i.files.filter((f) => f.status === 'ready') })),
                resolution: data.resolution, exchangeVariant: data.exchangeVariant || undefined, resolutionNote: data.refundJustification || undefined,
                returnMethod: returnNeeded(data) ? (data.returnMethod || 'PARCEL_LOCKER') : 'NONE',
                pickupPoint: data.pickupPoint || undefined, store: data.store || undefined, courier: data.returnMethod === 'COURIER' ? clone(data.courier) : undefined,
                refundAccount: data.refundAccount || undefined, value, refundAmount: q?.amount ?? 0,
                priority: 'NORMAL', team: defaultTeam(kind, data.items), tags: [], appliedRules: [], keepItem: false,
                timeline: [{ at: now, status: 'SUBMITTED', title: 'Zgłoszenie przyjęte', description: s.assisted ? `Utworzone przez ${s.name} (${s.assisted.channel === 'PHONE' ? 'telefon' : s.assisted.channel === 'STORE' ? 'sklep stacjonarny' : 'e-mail'}).` : 'Zgłoszone przez portal.', actor: s.role === 'AGENT' ? s.name : 'Klient' }],
                messages: [],
            };
            // Silnik reguł
            const days = daysSinceDelivery(o);
            activeRules().forEach((r) => {
                if (!matchRule(r, kind, c.items, value, days))
                    return;
                r.hits += 1;
                if (r.action === 'REQUIRE_VIDEO') {
                    c.appliedRules.push(r.id);
                    return;
                }
                c.appliedRules.push(r.id);
                if (r.action === 'HIGH_PRIORITY')
                    c.priority = 'HIGH';
                if (r.action === 'ASSIGN_TEAM')
                    c.team = r.param || c.team;
                if (r.action === 'AUTO_APPROVE' && c.status === 'SUBMITTED') {
                    if (c.returnMethod !== 'NONE')
                        c.label = newLabel();
                    push(c, 'APPROVED', 'Zaakceptowane automatycznie', 'System', `Reguła: ${r.name}.${c.label ? ' Wygenerowano kod QR do nadania.' : ''}`);
                }
                if (r.action === 'KEEP_ITEM' && c.status === 'SUBMITTED') {
                    c.keepItem = true;
                    c.returnMethod = 'NONE';
                    const amount = c.resolution === 'REFUND' ? c.value : undefined;
                    c.outcome = { type: c.resolution === 'REFUND' ? 'REFUND' : 'REPLACEMENT', amount, ref: c.resolution === 'REFUND' ? undefined : 'TS-' + (10600 + Math.floor(Math.random() * 300)), at: now };
                    push(c, 'RESOLVED', c.resolution === 'REFUND' ? 'Zwrot pieniędzy zlecony automatycznie' : 'Zamiennik wysłany automatycznie', 'System', `Reguła: ${r.name}. Nie musisz odsyłać produktu.`);
                }
            });
            Store.db.claims.unshift(c);
            Store.db.draft = null;
            Store.db.lastClaimId = c.id;
            if (s.role === 'CUSTOMER' && s.orderId && s.orderId !== c.orderId)
                s.claimId = c.id;
            return c;
        });
    },
    // ---------- Portal: zgłoszenie ----------
    claimStatus(number, email) {
        return apiCall('POST', '/portal/claims/status', () => {
            const c = Store.db.claims.find((x) => x.number === number.trim().toUpperCase() && x.email.toLowerCase() === email.trim().toLowerCase());
            if (!c)
                throw new ApiError(404, 'NOT_FOUND', 'Nie znaleźliśmy zgłoszenia dla podanych danych.');
            const s = Store.db.session;
            if (!s || s.role !== 'CUSTOMER')
                Store.db.session = { role: 'CUSTOMER', name: c.customerName.split(' ')[0], claimId: c.id, email: undefined };
            else
                s.claimId = c.id;
            return { claimId: c.id };
        });
    },
    claim(id) { return apiCall('GET', `/portal/claims/${id}`, () => getClaim(id)); },
    sendMessage(id, body, internal = false) {
        const s0 = Store.db.session;
        return apiCall('POST', `${s0?.role === 'AGENT' ? '/bo' : '/portal'}/claims/${id}/messages`, () => {
            const s = sess();
            const c = getClaim(id);
            const m = { id: uid('m'), from: s.role === 'AGENT' ? 'AGENT' : 'CUSTOMER', author: s.role === 'AGENT' ? s.name : c.customerName, body, at: new Date().toISOString(), internal: internal || undefined };
            c.messages.push(m);
            if (s.role === 'CUSTOMER')
                c.customerReplied = true;
            return m;
        });
    },
    respond(id, files, serial, message) {
        return apiCall('POST', `/portal/claims/${id}/responses`, () => {
            const c = getClaim(id);
            if (serial)
                c.items.forEach((i) => { if (!i.serial)
                    i.serial = serial.toUpperCase(); });
            c.items[0].files.push(...files.filter((f) => f.status === 'ready'));
            if (message)
                c.messages.push({ id: uid('m'), from: 'CUSTOMER', author: c.customerName, body: message, at: new Date().toISOString() });
            c.requestedInfo = undefined;
            c.customerReplied = true;
            push(c, 'SUBMITTED', 'Klient uzupełnił informacje', 'Klient', `${files.length} plik(i)${serial ? ', numer seryjny' : ''}.`);
        });
    },
    offerDecision(id, accept, comment) {
        return apiCall('POST', `/portal/claims/${id}/offer/${accept ? 'accept' : 'decline'}`, () => {
            const c = getClaim(id);
            if (!c.offer || c.offer.status !== 'PENDING')
                throw new ApiError(409, 'STATE_CONFLICT', 'Propozycja nie jest już aktualna.');
            c.offer.status = accept ? 'ACCEPTED' : 'DECLINED';
            if (comment)
                c.messages.push({ id: uid('m'), from: 'CUSTOMER', author: c.customerName, body: comment, at: new Date().toISOString() });
            c.customerReplied = true;
            if (accept) {
                c.resolution = c.offer.resolution;
                c.refundAmount = c.offer.amount;
                if (c.offer.resolution === 'PRICE_REDUCTION') {
                    c.returnMethod = 'NONE';
                    c.outcome = { type: 'PRICE_REDUCTION', amount: c.offer.amount, at: new Date().toISOString() };
                    push(c, 'RESOLVED', 'Propozycja zaakceptowana — obniżenie ceny', 'Klient', `Zwrot ${fmtMoney(c.offer.amount)} zlecony.`);
                }
                else {
                    if (c.returnMethod !== 'NONE' && !c.label)
                        c.label = newLabel();
                    push(c, 'APPROVED', 'Propozycja zaakceptowana', 'Klient');
                }
            }
            else
                push(c, 'SUBMITTED', 'Propozycja odrzucona przez klienta', 'Klient');
        });
    },
    cancelClaim(id) {
        return apiCall('POST', `/portal/claims/${id}/cancel`, () => {
            const c = getClaim(id);
            if (!['SUBMITTED', 'AWAITING_CUSTOMER', 'APPROVED'].includes(c.status))
                throw new ApiError(409, 'STATE_CONFLICT', 'Paczka została już nadana — nie można anulować.');
            push(c, 'CANCELLED', 'Zgłoszenie anulowane przez klienta', 'Klient');
        });
    },
    download(path) { return apiCall('GET', path, () => ({ url: '#' })); },
    // ---------- Back-office ----------
    boClaims(f) {
        const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
        return apiCall('GET', `/bo/claims?${qs}`, () => {
            const s = sess('AGENT');
            const ql = f.q.trim().toLowerCase();
            return Store.db.claims
                .filter((c) => viewFilter(f.view, c, s.name))
                .filter((c) => !f.kind || c.kind === f.kind)
                .filter((c) => !f.priority || c.priority === f.priority)
                .filter((c) => !f.team || c.team === f.team)
                .filter((c) => !ql || [c.number, c.orderNumber, c.email, c.customerName].some((x) => x.toLowerCase().includes(ql)))
                .sort((a, b) => (b.priority === 'HIGH' ? 1 : 0) - (a.priority === 'HIGH' ? 1 : 0) || a.responseDueAt.localeCompare(b.responseDueAt));
        }, { empty: () => [] });
    },
    boClaim(id) { return apiCall('GET', `/bo/claims/${id}`, () => { sess('AGENT', 'WAREHOUSE'); return getClaim(id); }); },
    boRecommendation(id) { return apiCall('GET', `/bo/claims/${id}/recommendation`, () => recommend(getClaim(id))); },
    boPatch(id, patch) {
        return apiCall('PATCH', `/bo/claims/${id}`, () => { const c = getClaim(id); Object.assign(c, patch); return c; });
    },
    boBulk(ids, patch) {
        return apiCall('PATCH', `/bo/claims (${ids.length})`, () => { ids.forEach((id) => Object.assign(getClaim(id), patch)); });
    },
    boDecision(id, p) {
        return apiCall('POST', `/bo/claims/${id}/decision`, () => {
            const s = sess('AGENT');
            const c = getClaim(id);
            if (!['SUBMITTED', 'AWAITING_CUSTOMER'].includes(c.status))
                throw new ApiError(409, 'STATE_CONFLICT', 'Zgłoszenie zmieniło status — odśwież kartę.');
            if (!c.assignee)
                c.assignee = s.name;
            c.customerReplied = false;
            if (p.message)
                c.messages.push({ id: uid('m'), from: 'AGENT', author: s.name, body: p.message, at: new Date().toISOString() });
            if (p.action === 'APPROVE') {
                c.resolution = p.resolution ?? c.resolution;
                if (p.keepItem) {
                    c.keepItem = true;
                    c.returnMethod = 'NONE';
                }
                if (c.returnMethod !== 'NONE')
                    c.label = c.label ?? newLabel();
                push(c, 'APPROVED', `Zaakceptowane — ${RESOLUTIONS[c.resolution].label.toLowerCase()}`, s.name, c.keepItem ? 'Bez odsyłania produktu.' : 'Wygenerowano kod QR do nadania.');
            }
            else if (p.action === 'REQUEST_INFO') {
                c.requestedInfo = p.requested;
                push(c, 'AWAITING_CUSTOMER', 'Prośba o dodatkowe informacje', s.name, (p.requested ?? []).map((r) => REQUEST_ITEMS.find((x) => x[0] === r)?.[1]).join(', '));
            }
            else if (p.action === 'OFFER') {
                c.offer = { ...p.offer, status: 'PENDING' };
                push(c, 'AWAITING_CUSTOMER', 'Propozycja rozwiązania wysłana', s.name, `${RESOLUTIONS[p.offer.resolution].label}${p.offer.amount ? ': ' + fmtMoney(p.offer.amount) : ''}`);
            }
            else {
                c.rejectReason = p.message;
                push(c, 'REJECTED', 'Zgłoszenie odrzucone', s.name);
            }
        });
    },
    boResolve(id, action, amount) {
        const path = action === 'REFUND' || action === 'STORE_CREDIT' ? 'refunds' : action === 'REPAIR' ? 'service-orders' : 'replacement-orders';
        return apiCall('POST', `/bo/claims/${id}/${path}`, () => {
            const s = sess('AGENT');
            const c = getClaim(id);
            const now = new Date().toISOString();
            if (action === 'REPAIR') {
                push(c, 'IN_SERVICE', 'Przekazano do serwisu', s.name);
                return;
            }
            if ((action === 'REFUND' || action === 'STORE_CREDIT') && (amount ?? 0) > c.value * 1.5)
                throw new ApiError(422, 'AMOUNT_TOO_HIGH', 'Kwota przekracza wartość zgłoszenia.');
            const ref = action === 'REPLACEMENT' || action === 'SPARE_PART' ? 'TS-' + (10600 + Math.floor(Math.random() * 300)) : undefined;
            c.outcome = { type: action, amount, ref, at: now };
            const title = action === 'REFUND' ? `Zwrot pieniędzy zlecony: ${fmtMoney(amount ?? 0)}` : action === 'STORE_CREDIT' ? `Wydano bon: ${fmtMoney(amount ?? 0)}` : action === 'SPARE_PART' ? `Wysłano brakującą część (${ref})` : `Wysłano zamiennik (${ref})`;
            push(c, 'RESOLVED', title, s.name);
            sysMsg(c, `${title}. Dziękujemy za cierpliwość!`);
        });
    },
    boForwardSupplier(id) {
        return apiCall('POST', '/bo/supplier-claims', () => {
            const c = getClaim(id);
            const supId = c.items[0].supplierId;
            let sc = Store.db.supplierClaims.find((x) => x.supplierId === supId && x.status === 'DRAFT');
            if (!sc) {
                sc = { id: uid('sc'), number: `SC-${todayISO().slice(0, 4)}-${String(Store.db.supplierClaims.length + 30).padStart(4, '0')}`, supplierId: supId, status: 'DRAFT', claimIds: [], amount: 0, createdAt: new Date().toISOString() };
                Store.db.supplierClaims.unshift(sc);
            }
            if (!sc.claimIds.includes(c.id)) {
                sc.claimIds.push(c.id);
                sc.amount += c.value;
            }
            c.supplierClaimId = sc.id;
            c.timeline.push({ at: new Date().toISOString(), status: c.status, title: `Dodano do reklamacji dostawcy ${sc.number}`, actor: sess().name });
            return sc;
        });
    },
    boCarrierEvent(id) {
        return apiCall('POST', '/hooks/carrier', () => { const c = getClaim(id); push(c, 'IN_TRANSIT', 'Paczka nadana', 'Przewoźnik', c.label ? `Kod ${c.label.code}.` : ''); }, { noFail: true });
    },
    boSearchOrders(q) {
        return apiCall('GET', `/bo/orders?q=${encodeURIComponent(q)}`, () => {
            const ql = q.trim().toLowerCase();
            return Store.db.orders.filter((o) => [o.number, o.email, o.phone.replace(/\s/g, ''), o.customerName].some((x) => x.toLowerCase().includes(ql.replace(/\s/g, ''))));
        }, { empty: () => [] });
    },
    // ---------- Magazyn ----------
    inbound() {
        return apiCall('GET', '/bo/warehouse/inbound', () => {
            sess('AGENT', 'WAREHOUSE');
            const t = todayISO();
            return {
                expected: Store.db.claims.filter((c) => (c.status === 'IN_TRANSIT' || c.status === 'APPROVED') && c.returnMethod !== 'NONE'),
                today: Store.db.claims.filter((c) => c.inspection && c.inspection.at.slice(0, 10) === t),
            };
        }, { empty: () => ({ expected: [], today: [] }) });
    },
    warehouseLookup(code) {
        return apiCall('GET', `/bo/warehouse/lookup?code=${encodeURIComponent(code)}`, () => {
            const k = code.replace(/\s+/g, '').toUpperCase();
            const c = Store.db.claims.find((x) => x.number === k || x.label?.code.replace(/\s+/g, '') === k);
            if (!c)
                throw new ApiError(404, 'NOT_FOUND', `Nie znaleziono przesyłki o kodzie ${code}.`);
            if (!['IN_TRANSIT', 'APPROVED'].includes(c.status))
                throw new ApiError(409, 'STATE_CONFLICT', `Zgłoszenie ${c.number} ma status „${STATUS[c.status].bo}” — nie oczekuje na przyjęcie.`);
            return c;
        });
    },
    inspect(id, ins) {
        return apiCall('POST', `/bo/claims/${id}/inspection`, () => {
            const s = sess('AGENT', 'WAREHOUSE');
            const c = getClaim(id);
            c.inspection = { ...ins, at: new Date().toISOString(), by: s.name };
            const g = { A: 'A — jak nowy', B: 'B — ślady użytkowania', C: 'C — uszkodzony' }[ins.grade];
            push(c, 'RECEIVED', 'Produkt przyjęty w magazynie', 'Magazyn', `Ocena ${g}. ${ins.defectConfirmed === 'yes' ? 'Wada potwierdzona. ' : ins.defectConfirmed === 'no' ? 'Wada niepotwierdzona. ' : ''}${ins.notes}`);
        });
    },
    // ---------- Dostawcy ----------
    supplierClaims() { return apiCall('GET', '/bo/supplier-claims', () => { sess('AGENT'); return Store.db.supplierClaims; }, { empty: () => [] }); },
    sendSupplierClaim(id) {
        return apiCall('POST', `/bo/supplier-claims/${id}/send`, () => {
            const sc = Store.db.supplierClaims.find((x) => x.id === id);
            sc.status = 'SENT';
            sc.sentAt = new Date().toISOString();
            sc.claimIds.forEach((cid) => { const c = Store.claim(cid); c?.timeline.push({ at: sc.sentAt, status: c.status, title: `Reklamacja ${sc.number} wysłana do dostawcy`, actor: sess().name }); });
        });
    },
    markCredited(id) {
        return apiCall('PATCH', `/bo/supplier-claims/${id}`, () => { const sc = Store.db.supplierClaims.find((x) => x.id === id); sc.status = 'CREDITED'; });
    },
    supPortalClaims() {
        return apiCall('GET', '/supplier/claims', () => {
            const s = sess('SUPPLIER');
            return Store.db.supplierClaims.filter((x) => x.supplierId === s.supplierId && x.status !== 'DRAFT');
        }, { empty: () => [] });
    },
    supRespond(id, r) {
        return apiCall('POST', `/supplier/claims/${id}/response`, () => {
            const sc = Store.db.supplierClaims.find((x) => x.id === id);
            if (sc.status !== 'SENT')
                throw new ApiError(409, 'STATE_CONFLICT', 'Reklamacja została już rozpatrzona.');
            sc.response = { ...r, at: new Date().toISOString() };
            sc.status = r.decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
        });
    },
    // ---------- Reguły, analityka, ustawienia ----------
    rules() { return apiCall('GET', '/bo/rules', () => Store.db.rules.slice().sort((a, b) => a.order - b.order), { empty: () => [] }); },
    saveRule(r) {
        const isNew = !Store.db.rules.some((x) => x.id === r.id);
        return apiCall(isNew ? 'POST' : 'PATCH', isNew ? '/bo/rules' : `/bo/rules/${r.id}`, () => {
            if (Store.db.rules.some((x) => x.id !== r.id && x.name.trim().toLowerCase() === r.name.trim().toLowerCase()))
                throw new ApiError(422, 'VALIDATION_FAILED', 'Reguła o tej nazwie już istnieje.', [{ field: 'name', message: 'Reguła o tej nazwie już istnieje.' }]);
            const i = Store.db.rules.findIndex((x) => x.id === r.id);
            if (i >= 0)
                Store.db.rules[i] = r;
            else
                Store.db.rules.push({ ...r, order: Store.db.rules.length + 1 });
            return r;
        });
    },
    toggleRule(id, enabled) { return apiCall('PATCH', `/bo/rules/${id}`, () => { Store.db.rules.find((r) => r.id === id).enabled = enabled; }); },
    moveRule(id, dir) {
        return apiCall('PATCH', `/bo/rules/${id}`, () => {
            const rs = Store.db.rules.sort((a, b) => a.order - b.order);
            const i = rs.findIndex((r) => r.id === id);
            const j = i + dir;
            if (j < 0 || j >= rs.length)
                return;
            [rs[i].order, rs[j].order] = [rs[j].order, rs[i].order];
        });
    },
    deleteRule(id) { return apiCall('DELETE', `/bo/rules/${id}`, () => { Store.db.rules = Store.db.rules.filter((r) => r.id !== id); }); },
    simulateRule(r) {
        return apiCall('POST', '/bo/rules/simulate', () => {
            const matched = Store.db.claims.filter((c) => matchRule(r, c.kind, c.items, c.value, Store.order(c.orderId) ? daysSinceDelivery(Store.order(c.orderId)) : 0));
            // dane historyczne (90 dni) — szacunek proporcjonalny
            return { matched: matched.length, estimated90d: Math.round(matched.length / Math.max(1, Store.db.claims.length) * 790), sample: matched.slice(0, 4).map((c) => `${c.number} · ${KINDS[c.kind].short} · ${fmtMoney(c.value)}`) };
        });
    },
    analytics(period, kind) {
        return apiCall('GET', `/bo/analytics/summary?period=${period}d${kind ? '&kind=' + kind : ''}`, () => buildAnalytics(period, kind), { empty: () => null });
    },
    policy() { return apiCall('GET', '/bo/settings/return-policy', () => Store.db.policy); },
    savePolicy(p) { return apiCall('PUT', '/bo/settings/return-policy', () => { Store.db.policy = p; return p; }); },
    templates() { return apiCall('GET', '/bo/templates', () => Store.db.templates, { empty: () => [] }); },
    saveTemplate(t) {
        return apiCall('PUT', `/bo/templates/${t.id}`, () => { const i = Store.db.templates.findIndex((x) => x.id === t.id); if (i >= 0)
            Store.db.templates[i] = t;
        else
            Store.db.templates.push(t); return t; });
    },
};
function viewFilter(view, c, me) {
    switch (view) {
        case 'decide': return c.status === 'SUBMITTED';
        case 'waiting': return c.status === 'AWAITING_CUSTOMER';
        case 'warehouse': return c.status === 'RECEIVED' || (c.status === 'APPROVED' && c.returnMethod === 'NONE');
        case 'mine': return c.assignee === me && OPEN_STATUSES.includes(c.status);
        case 'open': return OPEN_STATUSES.includes(c.status);
        default: return true;
    }
}
// Dane historyczne do analityki (symulacja hurtowni danych) + bieżące zgłoszenia
function buildAnalytics(period, kind) {
    const m = period === 90 ? 2.95 : 1;
    const share = { '': 1, RETURN: 0.62, COMPLAINT: 0.24, TRANSPORT: 0.09, MISSING: 0.05 };
    const k = share[kind] ?? 1;
    const live = Store.db.claims.filter((c) => !kind || c.kind === kind);
    const total = Math.round(268 * m * k) + live.length;
    const auto = live.filter((c) => c.appliedRules.some((r) => ['R1', 'R2'].includes(r)) || c.timeline.some((t) => t.actor === 'System')).length;
    const recovered = Store.db.supplierClaims.reduce((s, x) => s + (x.response?.decision === 'ACCEPT' ? x.response.creditAmount ?? 0 : 0), 0);
    const reasonsBase = kind === 'COMPLAINT' ? [['Nie działa / nie włącza się', 21], ['Działa z przerwami', 14], ['Problem z baterią', 9], ['Przecieka', 6], ['Wada wizualna', 5]]
        : kind === 'TRANSPORT' ? [['Produkt rozbity', 12], ['Zgnieciona paczka', 9], ['Paczka zalana', 3]]
            : kind === 'MISSING' ? [['Brak elementu zestawu', 8], ['Inny produkt', 4], ['Brak produktu', 2]]
                : [['Nie pasuje rozmiar', 74], ['Wygląda inaczej niż na zdjęciach', 38], ['Rozmyśliłem/-am się', 29], ['Nie działa / nie włącza się', 21], ['Znalazłem/-am taniej', 12], ['Produkt rozbity (transport)', 12]];
    const kindLabelToReason = (c) => reasonLabel(c.kind, c.items[0].reason);
    const reasons = reasonsBase.map(([l, v]) => [l, Math.round(v * m) + live.filter((c) => kindLabelToReason(c).startsWith(l.slice(0, 12))).length]);
    const products = [['Koszula lniana', 31], ['Kurtka puchowa Nordic', 24], ['Słuchawki SoundPro X2', 17], ['Buty trekkingowe Alpina', 15], ['Ekspres Barista 500', 9], ['Lampa Lumo Glass', 7]].map(([l, v]) => [l, Math.round(v * m * (kind ? k * 1.6 : 1))]);
    const weeksN = period === 90 ? 12 : 6;
    const baseWeek = [52, 61, 58, 70, 66, 59, 74, 63, 68, 71, 60, 66];
    const weeks = Array.from({ length: weeksN }, (_, i) => {
        const d = addDays(todayISO(), -7 * (weeksN - 1 - i));
        return [`${fmtDate(d).slice(0, 5)}`, Math.round(baseWeek[(i + 12 - weeksN) % 12] * k) + (i === weeksN - 1 ? live.filter((c) => daysBetween(c.createdAt, todayISO()) <= 7).length : 0)];
    });
    const resolutions = (kind === 'COMPLAINT' ? [['Wymiana na nowy', 38], ['Naprawa', 27], ['Zwrot pieniędzy', 18], ['Obniżenie ceny', 9]]
        : [['Zwrot pieniędzy', 56], ['Bon sklepowy', 21], ['Wymiana wariantu', 14], ['Wymiana na nowy', 7], ['Dosłanie części', 2]]).map(([l, v]) => [l, v]);
    return {
        kpi: {
            total, returnRate: kind && kind !== 'RETURN' ? 1.1 * k : 8.6 * (kind ? k : 1),
            automation: Math.min(99, Math.round(36 + (auto / Math.max(1, live.length)) * 6)),
            avgDays: kind === 'COMPLAINT' ? 8.9 : kind === 'TRANSPORT' ? 3.1 : 4.6,
            recovered: Math.round(recovered * (period === 90 ? 1 : 0.6)),
        },
        reasons, products, weeks, resolutions,
    };
}
// Komponenty UI (design system mockupu) — nazwy jak w docs/04-specyfikacja-ekranow.md (4.0)
// ---------- Drobne komponenty ----------
function statusBadge(s) {
    const st = STATUS[s];
    // w panelu obsługi etykiety pisane są z perspektywy pracownika
    const r = Store.db.session?.role;
    const label = r === 'AGENT' || r === 'WAREHOUSE' || r === 'SUPPLIER' ? st.bo : st.label;
    return `<span class="badge badge-${st.tone}">${esc(label)}</span>`;
}
function alertBox(tone, title, body = '', extra = '') {
    const icon = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '⛔' }[tone];
    const role = tone === 'error' ? 'alert' : 'status';
    return `<div class="alert alert-${tone}" role="${role}"><span class="alert-icon" aria-hidden="true">${icon}</span><div class="alert-body"><strong>${esc(title)}</strong>${body ? `<div>${body}</div>` : ''}${extra}</div></div>`;
}
function emptyState(icon, title, text, action = '') {
    return `<div class="state state-empty"><div class="state-icon" aria-hidden="true">${icon}</div><h3>${esc(title)}</h3><p>${text}</p>${action}</div>`;
}
function errorState(e, compact = false) {
    const err = e instanceof ApiError ? e : new ApiError(0, 'NETWORK', 'Brak połączenia z internetem.');
    const trace = err.extra.traceId || '';
    const title = err.status === 404 ? 'Nie znaleziono' : 'Nie udało się wczytać danych';
    const text = err.status === 404 ? esc(err.message) : `${esc(err.message)} Spróbuj ponownie za chwilę.`;
    return `<div class="state state-error ${compact ? 'compact' : ''}" role="alert"><div class="state-icon" aria-hidden="true">⚠️</div><h3>${title}</h3><p>${text}</p>
    ${err.status !== 404 ? '<button class="btn btn-secondary" data-retry>Spróbuj ponownie</button>' : ''}
    ${trace ? `<p class="muted small">Kod błędu dla infolinii: <code>${esc(trace)}</code></p>` : ''}</div>`;
}
function skelLines(n = 3) {
    return `<div class="skel-group" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<div class="skel skel-line" style="width:${90 - (i % 3) * 18}%"></div>`).join('')}</div>`;
}
function skelCards(n = 3) {
    return `<div class="skel-cards" aria-busy="true" aria-label="Wczytywanie">${Array.from({ length: n }, () => `<div class="card skel-card"><div class="skel skel-title"></div>${skelLines(2)}</div>`).join('')}</div>`;
}
function skelTable(rows = 5) {
    return `<div class="card" aria-busy="true" aria-label="Wczytywanie">${Array.from({ length: rows }, () => `<div class="skel-row"><div class="skel skel-line" style="width:18%"></div><div class="skel skel-line" style="width:30%"></div><div class="skel skel-line" style="width:20%"></div><div class="skel skel-line" style="width:14%"></div></div>`).join('')}</div>`;
}
function spinner() { return '<span class="spinner" aria-hidden="true"></span>'; }
function busy(btn, label) {
    if (!btn)
        return () => { };
    const html = btn.innerHTML;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = `${spinner()} ${esc(label)}`;
    return () => { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.innerHTML = html; };
}
// ---------- Ładowanie danych ze stanami ----------
async function loadInto(el, o) {
    el.innerHTML = o.skeleton;
    const slowTimer = setTimeout(() => {
        if (el.isConnected && el.querySelector('[aria-busy]'))
            el.insertAdjacentHTML('beforeend', '<p class="muted small slow-note">To trwa dłużej niż zwykle…</p>');
    }, 2000);
    try {
        const data = await o.load();
        clearTimeout(slowTimer);
        if (!el.isConnected)
            return;
        if (o.isEmpty && o.isEmpty(data) && o.empty) {
            el.innerHTML = o.empty();
            return;
        }
        o.render(data);
    }
    catch (e) {
        clearTimeout(slowTimer);
        if (!el.isConnected)
            return;
        if (e instanceof ApiError && e.status === 401) {
            showSessionExpired();
            return;
        }
        el.innerHTML = errorState(e, o.compactError);
        $('[data-retry]', el)?.addEventListener('click', () => loadInto(el, o));
    }
}
// ---------- Toast ----------
function toast(msg, tone = 'success') {
    const box = $('#toasts');
    if (!box)
        return;
    const t = document.createElement('div');
    t.className = `toast toast-${tone}`;
    t.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    t.innerHTML = `<span>${tone === 'success' ? '✅' : tone === 'error' ? '⛔' : 'ℹ️'}</span><span>${esc(msg)}</span>`;
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 5000);
}
function openModal(o) {
    const prev = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    const titleId = uid('mt');
    wrap.innerHTML = `<div class="modal ${o.wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
    <div class="modal-head"><h2 id="${titleId}">${esc(o.title)}</h2>${o.dismissible !== false ? '<button class="icon-btn" data-close aria-label="Zamknij">✕</button>' : ''}</div>
    <div class="modal-body">${o.body}</div>
    <div class="modal-foot">${o.actions.map((a, i) => `<button class="btn btn-${a.kind ?? 'secondary'}" data-act="${i}">${esc(a.label)}</button>`).join('')}</div></div>`;
    document.body.appendChild(wrap);
    document.body.classList.add('no-scroll');
    const el = wrap.querySelector('.modal');
    const close = () => {
        wrap.remove();
        if (!$('.modal-backdrop'))
            document.body.classList.remove('no-scroll');
        prev?.focus?.();
    };
    o.actions.forEach((a, i) => {
        const btn = el.querySelector(`[data-act="${i}"]`);
        btn.addEventListener('click', () => a.onClick({ close, el, btn }));
    });
    $('[data-close]', el)?.addEventListener('click', close);
    wrap.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && o.dismissible !== false)
            close();
        if (ev.key === 'Tab') {
            const f = $$('button, input, select, textarea, a[href]', el).filter((x) => !x.disabled);
            if (!f.length)
                return;
            if (ev.shiftKey && document.activeElement === f[0]) {
                ev.preventDefault();
                f[f.length - 1].focus();
            }
            else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) {
                ev.preventDefault();
                f[0].focus();
            }
        }
    });
    o.onOpen?.(el);
    ($('input, textarea, select', el) ?? el.querySelector('[data-act]'))?.focus();
    return { close, el };
}
function confirmModal(title, text, confirmLabel, danger = false) {
    return new Promise((resolve) => {
        openModal({
            title, body: `<p>${text}</p>`,
            actions: [
                { label: 'Anuluj', kind: 'secondary', onClick: ({ close }) => { close(); resolve(false); } },
                { label: confirmLabel, kind: danger ? 'danger' : 'primary', onClick: ({ close }) => { close(); resolve(true); } },
            ],
        });
    });
}
let sessionModalOpen = false;
function showSessionExpired() {
    if (sessionModalOpen)
        return;
    sessionModalOpen = true;
    const returnUrl = location.hash.slice(1) || '/';
    openModal({
        title: 'Sesja wygasła', dismissible: false,
        body: `<p>Ze względów bezpieczeństwa wylogowaliśmy Cię po 15 minutach bezczynności.</p><p class="muted">Dane wprowadzone w kreatorze zgłoszenia zostały zapisane.</p>`,
        actions: [{
                label: 'Zaloguj się ponownie', kind: 'primary', onClick: ({ close }) => {
                    close();
                    sessionModalOpen = false;
                    Router.leaveGuard = null;
                    Router.dirty = false; // wersja robocza jest zapisana — nie pytamy o opuszczenie
                    const wasStaff = Store.db.session?.role !== 'CUSTOMER';
                    Store.db.session = null;
                    Store.save();
                    navigate(wasStaff ? '/' : '/logowanie?returnUrl=' + encodeURIComponent(returnUrl));
                },
            }],
    });
}
function fid(name) { return 'f-' + name.replace(/[^a-zA-Z0-9]/g, '-'); }
function fieldWrap(o, control) {
    const id = fid(o.name);
    return `<div class="field ${o.cls ?? ''}" data-field="${esc(o.name)}">
    <label for="${id}">${esc(o.label)}${o.required ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="opt">(opcjonalnie)</span>'}</label>
    ${o.hint ? `<div class="hint" id="${id}-hint">${o.hint}</div>` : ''}
    ${control}
    <div class="field-error" id="${id}-err" hidden></div></div>`;
}
function describedBy(o) {
    const id = fid(o.name);
    return `aria-describedby="${o.hint ? id + '-hint ' : ''}${id}-err"`;
}
function textField(o) {
    const id = fid(o.name);
    return fieldWrap(o, `<input id="${id}" name="${esc(o.name)}" type="${o.type ?? 'text'}" value="${esc(o.value ?? '')}"
    ${o.placeholder ? `placeholder="${esc(o.placeholder)}"` : ''} ${o.inputmode ? `inputmode="${o.inputmode}"` : ''}
    ${o.autocomplete ? `autocomplete="${o.autocomplete}"` : ''} ${o.maxlength ? `maxlength="${o.maxlength}"` : ''}
    ${o.required ? 'aria-required="true"' : ''} ${describedBy(o)} ${o.attrs ?? ''}>`);
}
function textareaField(o) {
    const id = fid(o.name);
    const len = (o.value ?? '').length;
    return fieldWrap(o, `<textarea id="${id}" name="${esc(o.name)}" rows="${o.rows ?? 5}" maxlength="${o.max}" ${o.placeholder ? `placeholder="${esc(o.placeholder)}"` : ''}
    ${o.required ? 'aria-required="true"' : ''} ${describedBy(o)} data-counter>${esc(o.value ?? '')}</textarea>
    <div class="counter" aria-live="polite"><span data-count>${len}</span> / ${o.max}${o.min ? ` · min. ${o.min}` : ''}</div>`);
}
function selectField(o) {
    const id = fid(o.name);
    return fieldWrap(o, `<select id="${id}" name="${esc(o.name)}" ${o.required ? 'aria-required="true"' : ''} ${describedBy(o)} ${o.attrs ?? ''}>
    <option value="">${esc(o.placeholder ?? 'Wybierz…')}</option>
    ${o.options.map(([v, l]) => `<option value="${esc(v)}" ${v === o.value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`);
}
function radioGroup(o) {
    const id = fid(o.name);
    return `<fieldset class="field" data-field="${esc(o.name)}" id="${id}" tabindex="-1">
    <legend>${esc(o.label)}${o.required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</legend>
    ${o.hint ? `<div class="hint">${o.hint}</div>` : ''}
    <div class="radios ${o.inline ? 'inline' : ''}">${o.options.map(([v, l]) => `<label class="radio"><input type="radio" name="${esc(o.name)}" value="${esc(v)}" ${v === o.value ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>
    <div class="field-error" id="${id}-err" hidden></div></fieldset>`;
}
function radioCards(o) {
    const id = fid(o.name);
    return `<fieldset class="field" data-field="${esc(o.name)}" id="${id}" tabindex="-1">
    <legend>${esc(o.label)}${o.required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</legend>
    <div class="radio-cards">${o.options.map((op) => `<label class="radio-card ${op.disabled ? 'disabled' : ''}">
      <input type="radio" name="${esc(o.name)}" value="${esc(op.value)}" ${op.value === o.value ? 'checked' : ''} ${op.disabled ? 'disabled' : ''}>
      ${op.icon ? `<span class="rc-icon" aria-hidden="true">${op.icon}</span>` : ''}
      <span class="rc-text"><strong>${esc(op.title)}</strong>${op.text ? `<span>${op.text}</span>` : ''}</span></label>`).join('')}</div>
    <div class="field-error" id="${id}-err" hidden></div></fieldset>`;
}
function checkboxField(o) {
    const id = fid(o.name);
    return `<div class="field field-check" data-field="${esc(o.name)}"><label class="check"><input type="checkbox" id="${id}" name="${esc(o.name)}" ${o.checked ? 'checked' : ''} aria-describedby="${id}-err">
    <span>${o.label}${o.required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</span></label>${o.hint ? `<div class="hint">${o.hint}</div>` : ''}<div class="field-error" id="${id}-err" hidden></div></div>`;
}
function bindCounters(root) {
    $$('textarea[data-counter]', root).forEach((ta) => {
        const c = ta.parentElement?.querySelector('[data-count]');
        ta.addEventListener('input', () => { if (c)
            c.textContent = String(ta.value.length); });
    });
}
function formValues(form) {
    const out = {};
    $$('input, select, textarea', form).forEach((el) => {
        const i = el;
        if (!i.name)
            return;
        if (i.type === 'radio') {
            if (i.checked)
                out[i.name] = i.value;
            else if (!(i.name in out))
                out[i.name] = '';
            return;
        }
        if (i.type === 'checkbox') {
            out[i.name] = i.checked ? 'on' : '';
            return;
        }
        if (i.type === 'file')
            return;
        out[i.name] = i.value.trim();
    });
    return out;
}
function clearErrors(form) {
    $$('.field-error', form).forEach((e) => { e.hidden = true; e.textContent = ''; });
    $$('[aria-invalid]', form).forEach((e) => e.removeAttribute('aria-invalid'));
    $$('.field.has-error', form).forEach((e) => e.classList.remove('has-error'));
    $('.error-summary', form)?.remove();
}
function setFieldError(form, name, message) {
    const wrap = form.querySelector(`[data-field="${CSS.escape(name)}"]`);
    if (!wrap)
        return;
    const err = wrap.querySelector('.field-error');
    const inputs = $$('input, select, textarea', wrap);
    if (message) {
        wrap.classList.add('has-error');
        if (err) {
            err.hidden = false;
            err.textContent = message;
        }
        inputs.forEach((i) => i.setAttribute('aria-invalid', 'true'));
    }
    else {
        wrap.classList.remove('has-error');
        if (err) {
            err.hidden = true;
            err.textContent = '';
        }
        inputs.forEach((i) => i.removeAttribute('aria-invalid'));
    }
}
function showErrors(form, errors, title = 'Popraw dane, aby przejść dalej') {
    clearErrors(form);
    if (!errors.length)
        return;
    errors.forEach((e) => setFieldError(form, e.field, e.message));
    const sum = document.createElement('div');
    sum.className = 'error-summary';
    sum.setAttribute('role', 'alert');
    sum.tabIndex = -1;
    sum.innerHTML = `<strong>${esc(title)}</strong><ul>${errors.map((e) => `<li><a href="#" data-goto="${esc(e.field)}">${esc(e.message)}</a></li>`).join('')}</ul>`;
    form.prepend(sum);
    sum.querySelectorAll('[data-goto]').forEach((a) => a.addEventListener('click', (ev) => {
        ev.preventDefault();
        const wrap = form.querySelector(`[data-field="${CSS.escape(a.dataset.goto)}"]`);
        const target = (wrap?.querySelector('input:not([type=hidden]), select, textarea') ?? wrap);
        target?.focus();
        target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }));
    sum.focus();
    sum.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
// Walidacja przy opuszczeniu pola (blur) — pokazuje tylko błąd tego pola
function bindBlurValidation(form, validate) {
    form.addEventListener('focusout', (ev) => {
        const t = ev.target;
        if (!t.name || t.type === 'radio' || t.type === 'checkbox' || !t.value)
            return;
        // nie przesuwaj układu, gdy użytkownik właśnie klika przycisk wysyłki — walidacja i tak nastąpi
        const next = ev.relatedTarget;
        if (next?.matches?.('button[type=submit], [data-next]'))
            return;
        const err = validate().find((e) => e.field === t.name);
        setFieldError(form, t.name, err ? err.message : null);
    });
}
// ---------- Upload plików ----------
let demoFileCounter = 1;
function fileIcon(f) { return f.mime === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf') ? '📄' : isVideo(f.name, f.mime) ? '🎬' : '🖼️'; }
function renderFileList(files) {
    if (!files.length)
        return '';
    return `<ul class="file-list">${files.map((f) => `<li class="file-item file-${f.status}">
    <span class="file-icon" aria-hidden="true">${fileIcon(f)}</span>
    <span class="file-main"><span class="file-name">${esc(f.name)}</span>
      <span class="file-meta">${fmtSize(f.size)} · ${f.status === 'uploading' ? `Wysyłanie ${f.progress}%` : f.status === 'scanning' ? 'Skanowanie antywirusowe…' : f.status === 'ready' ? '<span class="ok">Gotowy</span>' : `<span class="err">${esc(f.error ?? 'Błąd')}</span>`}</span>
      ${f.status === 'uploading' ? `<span class="progress"><span style="width:${f.progress}%"></span></span>` : ''}
    </span>
    ${f.status === 'error' && f.error?.includes('Ponów') ? `<button type="button" class="btn btn-ghost btn-sm" data-file-retry="${f.id}">Ponów</button>` : ''}
    <button type="button" class="icon-btn" data-file-remove="${f.id}" aria-label="Usuń plik ${esc(f.name)}">🗑</button></li>`).join('')}</ul>`;
}
function uploaderHtml(key, files, compact = false) {
    const id = 'up-' + key.replace(/[^a-zA-Z0-9]/g, '-');
    return `<div class="uploader ${compact ? 'compact' : ''}" data-uploader="${esc(key)}">
    <label class="dropzone" for="${id}">
      <input type="file" id="${id}" multiple accept="${[...FILE_RULES.photoExt, ...FILE_RULES.videoExt, ...FILE_RULES.docExt].join(',')},image/*,video/*" class="sr-only">
      <span class="dz-icon" aria-hidden="true">⬆️</span>
      <span><strong>Dodaj pliki</strong> <span class="muted">lub przeciągnij je tutaj</span><br><span class="small muted">Zdjęcia do 15 MB · wideo MP4/MOV do 100 MB · PDF</span></span>
    </label>
    <div class="demo-files small"><span class="demo-tag">demo</span>
      <button type="button" class="link" data-demo-file="ok">+ przykładowe zdjęcie</button>
      <button type="button" class="link" data-demo-file="video">+ nagranie wideo</button>
      <button type="button" class="link" data-demo-file="big">+ zbyt duży plik</button>
      <button type="button" class="link" data-demo-file="type">+ plik .exe</button>
      <button type="button" class="link" data-demo-file="virus">+ plik z wirusem</button></div>
    <div data-file-list>${renderFileList(files)}</div></div>`;
}
function bindUploader(root, key, files, draftId, onChange) {
    const box = root.querySelector(`[data-uploader="${CSS.escape(key)}"]`);
    if (!box)
        return;
    const list = $('[data-file-list]', box);
    const rerender = () => { list.innerHTML = renderFileList(files); onChange(); };
    const process = async (f) => {
        f.status = 'uploading';
        f.progress = 0;
        f.error = undefined;
        rerender();
        const stepMs = Demo.scenario === 'slow' ? 250 : 90;
        while (f.progress < 100) {
            await sleep(stepMs);
            f.progress = Math.min(100, f.progress + 20);
            if (!box.isConnected)
                return;
            rerender();
        }
        try {
            await api.registerAttachment(f);
            f.status = 'scanning';
            rerender();
            const scan = await api.scanStatus(f);
            if (scan.scanStatus === 'INFECTED') {
                f.status = 'error';
                f.error = 'Wykryto zagrożenie — plik odrzucony.';
            }
            else
                f.status = 'ready';
        }
        catch {
            f.status = 'error';
            f.error = 'Nie udało się wysłać · Ponów';
        }
        if (box.isConnected)
            rerender();
    };
    const add = (name, size, mime) => {
        if (files.length >= FILE_RULES.maxFiles) {
            toast('Możesz dodać maksymalnie 10 plików.', 'error');
            return;
        }
        const err = validateFile(name, size, mime);
        const meta = { id: uid('f'), name, size, mime, status: err ? 'error' : 'uploading', error: err ?? undefined, progress: 0 };
        files.push(meta);
        if (err)
            rerender();
        else
            process(meta);
    };
    const input = $('input[type=file]', box);
    input.addEventListener('change', () => { Array.from(input.files ?? []).forEach((f) => add(f.name, f.size, f.type)); input.value = ''; });
    const dz = $('.dropzone', box);
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.classList.remove('drag');
        Array.from(e.dataTransfer?.files ?? []).forEach((f) => add(f.name, f.size, f.type));
    });
    $$('[data-demo-file]', box).forEach((b) => b.addEventListener('click', () => {
        const kind = b.dataset.demoFile;
        const n = demoFileCounter++;
        if (kind === 'ok')
            add(`zdjecie_${n}.jpg`, 1200000 + Math.round(Math.random() * 2500000), 'image/jpeg');
        if (kind === 'video')
            add(`nagranie_${n}.mp4`, 18000000 + Math.round(Math.random() * 20000000), 'video/mp4');
        if (kind === 'big')
            add(`zdjecie_raw_${n}.jpg`, 48000000, 'image/jpeg');
        if (kind === 'type')
            add(`program_${n}.exe`, 300000, 'application/x-msdownload');
        if (kind === 'virus')
            add(`wirus_${n}.pdf`, 220000, 'application/pdf');
    }));
    box.addEventListener('click', (e) => {
        const t = e.target;
        const rm = t.closest('[data-file-remove]');
        if (rm) {
            const i = files.findIndex((f) => f.id === rm.dataset.fileRemove);
            if (i >= 0)
                files.splice(i, 1);
            rerender();
        }
        const rt = t.closest('[data-file-retry]');
        if (rt) {
            const f = files.find((x) => x.id === rt.dataset.fileRetry);
            if (f)
                process(f);
        }
    });
}
// ---------- Inne ----------
function screenTag(id, name) {
    return `<div class="screen-tag" title="Identyfikator ekranu w specyfikacji (docs/04)"><span>${esc(id)}</span> ${esc(name)}</div>`;
}
function timelineHtml(entries) {
    return `<ol class="timeline">${entries.slice().reverse().map((t, i) => `<li class="tl-item ${i === 0 ? 'current' : ''}">
    <span class="tl-dot tone-${STATUS[t.status].tone}" aria-hidden="true"></span>
    <div><div class="tl-title">${esc(t.title)}</div><div class="tl-meta">${fmtDateTime(t.at)} · ${esc(t.actor)}</div>${t.description ? `<div class="tl-desc">${esc(t.description)}</div>` : ''}</div></li>`).join('')}</ol>`;
}
function statusTracker(status, returnNone = false) {
    const steps = returnNone ? ['Zgłoszone', 'Rozpatrywane', 'Rozwiązane'] : ['Zgłoszone', 'Rozpatrywane', 'Odesłanie', 'W magazynie', 'Rozwiązane'];
    let idx = STATUS[status].step;
    if (returnNone)
        idx = idx >= 4 ? 2 : Math.min(idx, 1);
    const stop = status === 'REJECTED' || status === 'CANCELLED';
    return `<ol class="mini-progress ${stop ? 'stopped' : ''}" aria-label="Etap: ${esc(stop ? STATUS[status].label : steps[idx])}">${steps.map((s, i) => `<li class="${i < idx || (i === idx && status === 'RESOLVED') ? 'done' : i === idx ? 'current' : ''}">${i === steps.length - 1 && stop ? esc(STATUS[status].label) : s}</li>`).join('')}</ol>`;
}
// Pseudo-kod QR (deterministyczny wzór z treści) — makieta, nie prawdziwy QR
function qrCode(text, size = 168) {
    const n = 21;
    let h = 2166136261;
    for (const ch of text) {
        h ^= ch.charCodeAt(0);
        h = Math.imul(h, 16777619);
    }
    const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
    const finder = (x, y) => {
        const inBox = (ox, oy) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7;
        for (const [ox, oy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
            if (inBox(ox, oy)) {
                const dx = x - ox, dy = y - oy;
                return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) ? 1 : 0;
            }
        }
        return -1;
    };
    const cell = size / n;
    let rects = '';
    for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
            const f = finder(x, y);
            const on = f === -1 ? rnd() > 0.5 : f === 1;
            if (on)
                rects += `<rect x="${(x * cell).toFixed(2)}" y="${(y * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`;
        }
    return `<svg class="qr" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Kod QR do nadania paczki: ${esc(text)}"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#111">${rects}</g></svg>`;
}
// Prosty router oparty o hash (#/sciezka?param=wartosc)
const Router = {
    routes: [],
    current: null,
    prevHash: '',
    skipNext: false,
    leaveGuard: null,
    dirty: false,
};
function route(r) { Router.routes.push(r); }
function navigate(path) {
    const target = '#' + path;
    if (location.hash === target)
        renderRoute();
    else
        location.hash = target;
}
function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [p, qs] = raw.split('?');
    return { path: p.replace(/\/+$/, '') || '/', query: new URLSearchParams(qs ?? '') };
}
function matchRoute(pattern, path) {
    const a = pattern.split('/').filter(Boolean);
    const b = path.split('/').filter(Boolean);
    if (a.length !== b.length)
        return null;
    const params = {};
    for (let i = 0; i < a.length; i++) {
        if (a[i].startsWith(':'))
            params[a[i].slice(1)] = decodeURIComponent(b[i]);
        else if (a[i] !== b[i])
            return null;
    }
    return params;
}
async function onHashChange() {
    if (Router.skipNext) {
        Router.skipNext = false;
        return;
    }
    if (Router.leaveGuard) {
        const ok = await Router.leaveGuard();
        if (!ok) {
            Router.skipNext = true;
            location.hash = Router.prevHash;
            return;
        }
    }
    renderRoute();
}
function renderRoute() {
    const { path, query } = parseHash();
    Router.prevHash = location.hash || '#/';
    Router.leaveGuard = null;
    Router.dirty = false;
    let found = null;
    let params = {};
    for (const r of Router.routes) {
        const m = matchRoute(r.pattern, path);
        if (m) {
            found = r;
            params = m;
            break;
        }
    }
    const session = Store.db.session;
    if (found?.roles) {
        if (!session) {
            const staff = /^\/(obsluga|magazyn|dostawca)/.test(path);
            navigate((staff ? '/panel-logowanie' : '/logowanie') + '?returnUrl=' + encodeURIComponent(path + (query.toString() ? '?' + query.toString() : '')));
            return;
        }
        if (!found.roles.includes(session.role))
            found = null;
    }
    const r = found ?? notFoundRoute;
    Router.current = r;
    document.title = `${r.title} · TwójSklep — zwroty i reklamacje`;
    renderShell();
    const main = $('#main');
    main.innerHTML = '';
    window.scrollTo(0, 0);
    Promise.resolve(r.render(main, params, query)).then(() => {
        const h = $('h1', main);
        if (h) {
            h.tabIndex = -1;
            h.focus({ preventScroll: true });
        }
    });
    updateDemoPanel();
}
const notFoundRoute = {
    pattern: '*', id: 'X-01', title: 'Nie znaleziono strony',
    render(root) {
        root.innerHTML = `${screenTag('X-01', 'Nie znaleziono')}<div class="container narrow section">
      ${emptyState('🧭', 'Nie znaleziono strony', 'Strona nie istnieje lub nie masz do niej dostępu.', `<a class="btn btn-primary" href="#${homeFor(Store.db.session?.role)}">Wróć na stronę główną</a>`)}
      <h1 class="sr-only">Nie znaleziono strony</h1></div>`;
    },
};
// Powłoki aplikacji (portal klienta / panel obsługi / portal dostawcy) i panel demo
const DEMO_SESSIONS = {
    CUSTOMER: { role: 'CUSTOMER', name: 'Anna', email: DEMO.email },
    AGENT: { role: 'AGENT', name: 'Marta Wiśniewska' },
    WAREHOUSE: { role: 'WAREHOUSE', name: 'Jan Kowal (magazyn Błonie)' },
    SUPPLIER: { role: 'SUPPLIER', name: 'CleanAir Europe', supplierId: 'sup-cleanair' },
};
function homeFor(role) {
    if (role === 'AGENT')
        return '/obsluga';
    if (role === 'WAREHOUSE')
        return '/magazyn';
    if (role === 'SUPPLIER')
        return '/dostawca';
    if (role === 'CUSTOMER')
        return Store.db.session?.email && !Store.db.session.orderId ? '/konto' : '/';
    return '/';
}
function shellFor(path) {
    if (/^\/(obsluga|magazyn)/.test(path))
        return 'bo';
    if (path.startsWith('/dostawca'))
        return 'supplier';
    if (path.startsWith('/zgloszenie') && Store.db.session?.role === 'AGENT')
        return 'bo';
    if (path.startsWith('/panel-logowanie'))
        return 'supplier';
    return 'shop';
}
function renderShell() {
    const { path } = parseHash();
    const shell = shellFor(path);
    document.body.classList.toggle('shell-bo', shell === 'bo');
    document.body.classList.toggle('shell-supplier', shell === 'supplier');
    document.body.classList.toggle('shell-shop', shell === 'shop');
    const header = $('#header');
    header.className = shell === 'bo' ? 'sidebar' : 'app-header';
    if (shell === 'bo')
        renderSidebar(header, path);
    else if (shell === 'supplier')
        renderSupplierHeader(header);
    else
        renderShopHeader(header, path);
    $('[data-logout]', header)?.addEventListener('click', async () => {
        await api.logout();
        toast('Wylogowano.', 'info');
        navigate(shell === 'shop' ? '/' : '/panel-logowanie');
    });
    const toggle = $('.nav-toggle', header);
    toggle?.addEventListener('click', () => {
        const open = header.classList.toggle('nav-open');
        toggle.setAttribute('aria-expanded', String(open));
    });
    $('#footer').hidden = shell === 'bo';
}
function renderShopHeader(header, path) {
    const s = Store.db.session;
    const customer = s?.role === 'CUSTOMER';
    const items = [['/', 'Zwroty i reklamacje'], ['/status', 'Sprawdź status']];
    if (customer && s?.email && !s.orderId)
        items.push(['/konto', 'Moje zamówienia']);
    header.innerHTML = `<div class="container header-inner">
    <a class="logo" href="#/" aria-label="${SHOP.name} — zwroty i reklamacje"><span class="logo-mark" aria-hidden="true">T</span><span><strong>${SHOP.name}</strong><small>Zwroty i reklamacje</small></span></a>
    <button class="icon-btn nav-toggle" aria-expanded="false" aria-controls="main-nav" aria-label="Menu">☰</button>
    <nav id="main-nav" class="main-nav" aria-label="Menu główne">
      <ul>${items.map(([h, l]) => `<li><a href="#${h}" ${path === h ? 'aria-current="page"' : ''}>${l}</a></li>`).join('')}</ul>
      <div class="nav-actions">
        ${customer ? `<span class="user-chip" aria-hidden="true">${esc(s.name.charAt(0))}</span><span class="user-name">${esc(s.email ?? s.name)}</span><button class="btn btn-ghost btn-sm" data-logout>Wyloguj</button>`
        : s ? `<a class="btn btn-secondary btn-sm" href="#${homeFor(s.role)}">Wróć do panelu</a>` : `<a class="btn btn-secondary btn-sm" href="#/logowanie">Zaloguj się</a>`}
      </div></nav></div>`;
}
function renderSupplierHeader(header) {
    const s = Store.db.session;
    header.innerHTML = `<div class="container header-inner">
    <a class="logo" href="#${homeFor(s?.role)}"><span class="logo-mark dark" aria-hidden="true">T</span><span><strong>${SHOP.name}</strong><small>${s?.role === 'SUPPLIER' ? 'Portal dostawcy' : 'Panel obsługi'}</small></span></a>
    <div class="nav-actions push">${s ? `<span class="user-name">${esc(s.name)}</span><button class="btn btn-ghost btn-sm" data-logout>Wyloguj</button>` : ''}</div></div>`;
}
function renderSidebar(header, path) {
    const s = Store.db.session;
    const role = s?.role;
    const toDecide = Store.db.claims.filter((c) => c.status === 'SUBMITTED').length;
    const overdue = Store.db.claims.filter((c) => OPEN_STATUSES.includes(c.status) && daysBetween(todayISO(), c.responseDueAt) < 2).length;
    const inbound = Store.db.claims.filter((c) => c.status === 'IN_TRANSIT').length;
    const supDraft = Store.db.supplierClaims.filter((x) => x.status === 'DRAFT').length;
    const items = role === 'WAREHOUSE' ? [['/magazyn', '📥', 'Magazyn', inbound ? String(inbound) : '']] : [
        ['/obsluga', '📨', 'Skrzynka', toDecide ? String(toDecide) : ''],
        ['/magazyn', '📥', 'Magazyn', inbound ? String(inbound) : ''],
        ['/obsluga/dostawcy', '🏭', 'Dostawcy', supDraft ? String(supDraft) : ''],
        ['/obsluga/reguly', '⚙️', 'Reguły', ''],
        ['/obsluga/analityka', '📊', 'Analityka', ''],
        ['/obsluga/ustawienia', '🛠️', 'Ustawienia', ''],
    ];
    const active = (h) => h === '/obsluga' ? (path === '/obsluga' || path.startsWith('/obsluga/zgloszenia') || path.startsWith('/zgloszenie') || path === '/obsluga/nowe') : path.startsWith(h);
    header.innerHTML = `<div class="sb-top">
      <a class="logo" href="#${homeFor(role)}"><span class="logo-mark dark" aria-hidden="true">T</span><span><strong>${SHOP.name}</strong><small>Panel obsługi</small></span></a>
      <button class="icon-btn nav-toggle" aria-expanded="false" aria-controls="sb-nav" aria-label="Menu">☰</button></div>
    <nav id="sb-nav" class="sb-nav" aria-label="Menu panelu">
      ${role === 'AGENT' ? '<a class="btn btn-primary btn-block sb-new" href="#/obsluga/nowe">＋ Nowe zgłoszenie</a>' : ''}
      <ul>${items.map(([h, ic, l, n]) => `<li><a href="#${h}" ${active(h) ? 'aria-current="page"' : ''}><span aria-hidden="true">${ic}</span><span>${l}</span>${n ? `<span class="sb-count">${n}</span>` : ''}</a></li>`).join('')}</ul>
      ${role === 'AGENT' && overdue ? `<div class="sb-alert">⏰ ${overdue} zgł. z terminem &lt; 2 dni</div>` : ''}
      <div class="sb-user"><span class="user-chip" aria-hidden="true">${esc((s?.name ?? '?').charAt(0))}</span><span><strong>${esc(s?.name ?? '')}</strong><small>${role === 'WAREHOUSE' ? 'Magazyn zwrotów' : 'Agent · Kierownik'}</small></span><button class="icon-btn" data-logout aria-label="Wyloguj">⎋</button></div>
    </nav>`;
}
function renderFooter() {
    $('#footer').innerHTML = `<div class="container footer-inner">
    <div><strong>Pomoc</strong><br><a href="mailto:${SHOP.support}">${SHOP.support}</a> · ${SHOP.phone}</div>
    <div class="small muted">Mockup koncepcyjny · dane fikcyjne · „${SHOP.name}” to nazwa przykładowa</div>
    <div class="small"><a href="#/">Polityka zwrotów</a> · <a href="#/status">Sprawdź status</a></div></div>`;
}
// ---------- Panel demo ----------
const SCREEN_MAP = [
    ['K-01', 'Start: znajdź zamówienie', '/', ''],
    ['K-02', 'Logowanie linkiem', '/logowanie', ''],
    ['K-03', 'Moje zamówienia', '/konto', 'CUSTOMER'],
    ['K-04', 'Sprawdź status', '/status', ''],
    ['K-05', 'Zgłoszenie: prośba o info', '/zgloszenia/c1', 'CUSTOMER'],
    ['K-05', 'Zgłoszenie: kod QR', '/zgloszenia/c2', 'CUSTOMER'],
    ['Z-01', 'Kreator (TS-10482)', '/zgloszenie/1?zamowienie=o10482', 'CUSTOMER'],
    ['B-01', 'Skrzynka', '/obsluga', 'AGENT'],
    ['B-02', 'Karta zgłoszenia', '/obsluga/zgloszenia/c5', 'AGENT'],
    ['Z-00', 'Zgłoszenie w imieniu klienta', '/obsluga/nowe', 'AGENT'],
    ['B-03', 'Magazyn', '/magazyn', 'WAREHOUSE'],
    ['B-04', 'Reklamacje do dostawców', '/obsluga/dostawcy', 'AGENT'],
    ['B-05', 'Reguły automatyzacji', '/obsluga/reguly', 'AGENT'],
    ['B-06', 'Analityka', '/obsluga/analityka', 'AGENT'],
    ['B-07', 'Ustawienia', '/obsluga/ustawienia', 'AGENT'],
    ['D-01', 'Portal dostawcy', '/dostawca', 'SUPPLIER'],
    ['X-03', 'Logowanie pracownika', '/panel-logowanie', ''],
    ['X-01', 'Strona 404', '/nie-ma-takiej-strony', ''],
];
function switchRole(role) {
    Store.db.session = role ? clone(DEMO_SESSIONS[role]) : null;
    Store.db.draft = null;
    Store.save();
}
function renderDemoPanel() {
    const el = $('#demo');
    el.innerHTML = `<button class="demo-toggle" aria-expanded="false" aria-controls="demo-body">🛠 Panel demo</button>
    <div class="demo-body" id="demo-body" hidden>
      <div class="demo-head"><strong>Panel demo</strong><span class="demo-screen" data-cur-screen></span></div>
      <p class="muted small">Nie jest częścią produktu — służy do pokazania stanów, ról i ścieżek.</p>
      <section><h4>Scenariusz API</h4>
        <div class="demo-scen">${[['normal', 'Normalny'], ['slow', 'Wolne API (loading)'], ['empty', 'Puste dane (empty)'], ['error', 'Błąd serwera (error)']]
        .map(([v, l]) => `<label><input type="radio" name="scenario" value="${v}" ${Demo.scenario === v ? 'checked' : ''}> ${l}</label>`).join('')}</div></section>
      <section><h4>Rola</h4>
        <div class="demo-btns">
          <button class="btn btn-sm btn-secondary" data-role="CUSTOMER">Klient (konto)</button>
          <button class="btn btn-sm btn-secondary" data-role="AGENT">Agent</button>
          <button class="btn btn-sm btn-secondary" data-role="WAREHOUSE">Magazyn</button>
          <button class="btn btn-sm btn-secondary" data-role="SUPPLIER">Dostawca</button>
          <button class="btn btn-sm btn-ghost" data-role="">Wyloguj</button></div>
        <div class="demo-btns"><button class="btn btn-sm btn-ghost" data-demo="expire">Symuluj wygaśnięcie sesji</button><button class="btn btn-sm btn-ghost" data-demo="reset">Reset danych demo</button></div>
        <p class="small muted">Gość: zamówienie <code>${DEMO.order}</code> + <code>${DEMO.email}</code></p></section>
      <section><h4>Mapa ekranów</h4><ul class="demo-map">${SCREEN_MAP.map(([id, n, p, r], i) => `<li><a href="#${p}" data-map="${i}"><code>${id}</code> ${n}</a></li>`).join('')}</ul>
        <p class="small muted">Kliknięcie przełącza rolę, jeśli ekran jej wymaga.</p></section>
      <section><h4>Wywołania API (ostatnie)</h4><ul class="demo-log" data-log></ul></section>
    </div>`;
    const toggle = $('.demo-toggle', el);
    const body = $('#demo-body', el);
    toggle.addEventListener('click', () => {
        body.hidden = !body.hidden;
        toggle.setAttribute('aria-expanded', String(!body.hidden));
        storage.set('portal-reklamacje-demo-open', body.hidden ? '' : '1');
    });
    if (storage.get('portal-reklamacje-demo-open') === '1') {
        body.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
    }
    $$('input[name=scenario]', el).forEach((r) => r.addEventListener('change', () => { Demo.setScenario(r.value); renderRoute(); }));
    $$('[data-role]', el).forEach((b) => b.addEventListener('click', () => {
        const r = b.dataset.role;
        Router.leaveGuard = null;
        switchRole(r);
        navigate(r ? homeFor(r) : '/');
    }));
    $$('[data-map]', el).forEach((a) => a.addEventListener('click', (e) => {
        const [, , p, r] = SCREEN_MAP[Number(a.dataset.map)];
        const cur = Store.db.session?.role ?? '';
        if (r && cur !== r) {
            e.preventDefault();
            Router.leaveGuard = null;
            switchRole(r);
            navigate(p);
        }
    }));
    $$('[data-demo]', el).forEach((b) => b.addEventListener('click', async () => {
        if (b.dataset.demo === 'expire') {
            if (Store.db.session)
                showSessionExpired();
            else
                toast('Najpierw zaloguj się (np. przyciskiem roli).', 'info');
        }
        if (b.dataset.demo === 'reset' && await confirmModal('Reset danych demo', 'Przywrócić dane początkowe? Zgłoszenia utworzone w trakcie demo zostaną usunięte.', 'Przywróć', true)) {
            Store.reset();
            toast('Przywrócono dane demo.', 'info');
            navigate('/');
        }
    }));
    Demo.listeners.push(updateDemoLog);
}
function updateDemoLog() {
    const ul = $('[data-log]');
    if (!ul)
        return;
    ul.innerHTML = Demo.log.length
        ? Demo.log.slice(0, 12).map((l) => `<li><span class="m m-${l.method.toLowerCase()}">${l.method}</span> <code>${esc(l.path)}</code> <span class="st ${l.status >= 400 ? 'bad' : ''}">${l.status}</span> <span class="muted">${l.ms} ms</span></li>`).join('')
        : '<li class="muted">Brak wywołań</li>';
}
function updateDemoPanel() {
    $$('#demo input[name=scenario]').forEach((r) => { r.checked = r.value === Demo.scenario; });
    const cur = $('[data-cur-screen]');
    if (cur && Router.current)
        cur.textContent = 'Ekran ' + (Router.current.id === 'Z-0x' ? 'Z-0' + (parseHash().path.split('/').pop() ?? '') : Router.current.id);
    $('.demo-toggle')?.classList.toggle('alert-on', Demo.scenario !== 'normal');
    updateDemoLog();
}
// Portal klienta: K-01 … K-05 oraz logowanie pracownika (X-03)
let lookupFailures = 0;
function kindTag(k) { return `<span class="tag tag-kind">${KINDS[k].icon} ${esc(KINDS[k].short)}</span>`; }
function claimCard(c, href) {
    const action = c.status === 'AWAITING_CUSTOMER' || (c.status === 'APPROVED' && c.returnMethod !== 'NONE');
    return `<a class="claim-row" href="#${href}">
    <span class="cr-icon" aria-hidden="true">${c.items[0].emoji}</span>
    <span class="cr-main"><span class="cr-title"><span class="mono">${esc(c.number)}</span> · ${esc(KINDS[c.kind].short)}</span>
      <span class="cr-sub">${c.items.map((i) => esc(i.name)).join(', ')} · ${fmtDate(c.createdAt)}</span>
      ${action ? `<span class="cr-flags"><span class="tag tag-warn">${c.status === 'AWAITING_CUSTOMER' ? 'Wymaga Twojej odpowiedzi' : 'Nadaj paczkę'}</span></span>` : ''}</span>
    <span class="cr-status">${statusBadge(c.status)}</span><span class="chev" aria-hidden="true">›</span></a>`;
}
// ---------- K-01 Start ----------
route({
    pattern: '/', id: 'K-01', title: 'Zwroty i reklamacje',
    render(root) {
        const s = Store.db.session;
        const p = Store.db.policy;
        let mode = 'email';
        root.innerHTML = `${screenTag('K-01', 'Start: znajdź zamówienie')}
      <section class="hero"><div class="container hero-grid">
        <div>
          <p class="eyebrow light">${SHOP.name} · centrum zwrotów</p>
          <h1>Zwróć lub zareklamuj produkt w kilka minut</h1>
          <p class="lead">Bez drukowania etykiet i bez pisania maili. Od razu zobaczysz, ile i kiedy otrzymasz pieniądze.</p>
          <ul class="policy-tiles">
            <li><strong>${p.returnDays} dni</strong><span>na zwrot bez podania przyczyny</span></li>
            <li><strong>2 lata</strong><span>na reklamację wadliwego produktu</span></li>
            <li><strong>+${p.creditBonus}%</strong><span>wartości, gdy wybierzesz bon${p.freeReturnForCredit ? ' — odesłanie gratis' : ''}</span></li>
          </ul>
        </div>
        <div class="card form-card lookup-card">
          ${s?.role === 'CUSTOMER' && s.email && !s.orderId ? alertBox('info', `Jesteś zalogowany/-a jako ${esc(s.email)}`, '<a href="#/konto">Przejdź do swoich zamówień ›</a>') : ''}
          <h2>Znajdź zamówienie</h2>
          <form novalidate data-form>
            ${textField({ name: 'orderNo', label: 'Numer zamówienia', required: true, placeholder: 'np. TS-10482', hint: 'Znajdziesz go w e-mailu z potwierdzeniem zamówienia.', attrs: 'style="text-transform:uppercase" autocapitalize="characters"' })}
            <div class="segmented" role="radiogroup" aria-label="Dane kontaktowe z zamówienia">
              <button type="button" role="radio" aria-checked="true" data-mode="email">E-mail</button>
              <button type="button" role="radio" aria-checked="false" data-mode="phone">Telefon</button>
            </div>
            <div data-contact></div>
            <div data-captcha></div>
            <div data-form-alert></div>
            <button class="btn btn-primary btn-block btn-lg" type="submit">Dalej</button>
          </form>
          <div class="row-between small links-row"><a href="#/logowanie">Zaloguj się linkiem e-mail</a><a href="#/status">Mam numer zgłoszenia</a></div>
          <p class="demo-hint">Demo: <code>${DEMO.order}</code> + <code>${DEMO.email}</code> · inne: <code>TS-10391</code> (40 dni temu), <code>TS-09877</code> (400 dni), <code>TS-10510</code> (w drodze)</p>
        </div></div></section>
      <section class="container section">
        <h2>Jak to działa</h2>
        <ol class="how">
          <li><strong>Wskaż produkty</strong><span>Wybierz, co chcesz zwrócić lub zareklamować.</span></li>
          <li><strong>Opisz problem</strong><span>Przy reklamacji dodaj zdjęcia — zrobisz je telefonem.</span></li>
          <li><strong>Wybierz rozwiązanie</strong><span>Zwrot pieniędzy, bon, wymiana, naprawa — z kwotą od razu.</span></li>
          <li><strong>Nadaj paczkę kodem QR</strong><span>W paczkomacie, przez kuriera lub w sklepie. Bez drukarki.</span></li>
        </ol></section>
      <section class="container section grid-2">
        <div class="card"><h2>Zwrot czy reklamacja?</h2>
          <dl class="dl"><dt>${KINDS.RETURN.icon} Zwrot</dt><dd>Produkt jest sprawny, ale nie pasuje lub zmieniłeś/-aś zdanie. Masz ${p.returnDays} dni od dostawy.</dd>
          <dt>${KINDS.COMPLAINT.icon} Reklamacja</dt><dd>Produkt nie działa lub ma wadę. Masz 2 lata od dostawy, odpowiemy w 14 dni.</dd>
          <dt>${KINDS.TRANSPORT.icon} Uszkodzenie</dt><dd>Paczka dotarła uszkodzona — zgłoś w ciągu ${p.transportDays} dni.</dd>
          <dt>${KINDS.MISSING.icon} Brak elementu</dt><dd>Czegoś brakuje lub przyszedł inny produkt — doślemy brakujące elementy.</dd></dl></div>
        <div class="card"><h2>Najczęstsze pytania</h2>
          <details><summary>Czy muszę drukować etykietę?</summary><p>Nie. Przy paczkomacie wystarczy kod QR na telefonie.</p></details>
          <details><summary>Kiedy dostanę pieniądze?</summary><p>Do 14 dni od zgłoszenia zwrotu — zwykle 1–2 dni po dotarciu paczki do magazynu.</p></details>
          <details><summary>Nie mam wszystkich elementów opakowania.</summary><p>Zwrot jest możliwy — opakowanie nie jest warunkiem odstąpienia od umowy.</p></details>
          <details><summary>Produkt kupiłem/-am w sklepie stacjonarnym.</summary><p>Podaj numer z paragonu (TS-…) i e-mail lub telefon podany przy zakupie.</p></details>
        </div></section>`;
        const form = $('[data-form]', root);
        const contact = $('[data-contact]', root);
        const drawContact = () => {
            contact.innerHTML = mode === 'email'
                ? textField({ name: 'contact', label: 'E-mail z zamówienia', type: 'email', required: true, autocomplete: 'email' })
                : textField({ name: 'contact', label: 'Telefon z zamówienia', type: 'tel', required: true, autocomplete: 'tel' });
        };
        drawContact();
        $$('[data-mode]', root).forEach((b) => b.addEventListener('click', () => {
            mode = b.dataset.mode;
            $$('[data-mode]', root).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
            drawContact();
        }));
        const drawCaptcha = () => { $('[data-captcha]', form).innerHTML = lookupFailures >= 5 ? `<div class="captcha">${checkboxField({ name: 'captcha', label: 'Nie jestem robotem (CAPTCHA — makieta)', checked: false, required: true })}</div>` : ''; };
        drawCaptcha();
        const validate = () => {
            const v = formValues(form);
            const e = [];
            if (!V.required(v.orderNo))
                e.push({ field: 'orderNo', message: 'Wpisz numer zamówienia.' });
            else if (!V.orderNo(v.orderNo))
                e.push({ field: 'orderNo', message: 'Numer zamówienia ma format TS-12345.' });
            if (!V.required(v.contact))
                e.push({ field: 'contact', message: mode === 'email' ? 'Wpisz e-mail podany w zamówieniu.' : 'Wpisz telefon podany w zamówieniu.' });
            else if (mode === 'email' ? !V.email(v.contact) : !V.phone(v.contact))
                e.push({ field: 'contact', message: mode === 'email' ? 'Wpisz poprawny e-mail, np. jan@example.com.' : 'Wpisz 9 cyfr numeru telefonu.' });
            if (lookupFailures >= 5 && v.captcha !== 'on')
                e.push({ field: 'captcha', message: 'Potwierdź, że nie jesteś robotem.' });
            return e;
        };
        bindBlurValidation(form, validate);
        form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const errs = validate();
            showErrors(form, errs, 'Popraw dane');
            if (errs.length)
                return;
            const v = formValues(form);
            const alertEl = $('[data-form-alert]', form);
            alertEl.innerHTML = '';
            const done = busy($('button[type=submit]', form), 'Szukamy zamówienia…');
            try {
                const r = await api.lookupOrder(v.orderNo, v.contact);
                lookupFailures = 0;
                navigate('/zgloszenie/1?zamowienie=' + r.orderId);
            }
            catch (e) {
                done();
                if (e instanceof ApiError && e.code === 'ORDER_NOT_FOUND') {
                    lookupFailures++;
                    drawCaptcha();
                    alertEl.innerHTML = alertBox('error', 'Nie znaleźliśmy zamówienia', 'Sprawdź numer w e-mailu potwierdzającym zamówienie oraz e-mail lub telefon podany przy zakupie.');
                }
                else if (e instanceof ApiError && e.code === 'NOT_DELIVERED') {
                    alertEl.innerHTML = alertBox('info', `Zamówienie ${esc(String(e.extra.orderNumber))} jest jeszcze w drodze`, 'Zwrot lub reklamację zgłosisz po dostarczeniu paczki.', '<button type="button" class="btn btn-secondary btn-sm" data-track>Śledź przesyłkę</button>');
                    $('[data-track]', alertEl)?.addEventListener('click', () => toast('Otwieramy stronę przewoźnika (demo).', 'info'));
                }
                else
                    alertEl.innerHTML = alertBox('error', 'Nie udało się wyszukać zamówienia', esc(e.message) + ' Spróbuj ponownie za chwilę.');
            }
        });
    },
});
// ---------- K-02 Logowanie linkiem ----------
route({
    pattern: '/logowanie', id: 'K-02', title: 'Logowanie',
    render(root, _p, q) {
        const returnUrl = q.get('returnUrl') || '/konto';
        const drawForm = () => {
            root.innerHTML = `${screenTag('K-02', 'Logowanie linkiem e-mail')}<div class="container narrow section"><div class="card form-card">
        <h1>Zaloguj się bez hasła</h1>
        <p class="muted">Wyślemy Ci link do logowania. Zobaczysz wszystkie zamówienia i zgłoszenia.</p>
        <form novalidate data-form>${textField({ name: 'email', label: 'E-mail', type: 'email', required: true, autocomplete: 'email' })}<div data-form-alert></div>
        <button class="btn btn-primary btn-block" type="submit">Wyślij link</button></form>
        <p class="small center"><a href="#/">Nie mam konta — znajdę zamówienie po numerze</a></p></div>
        <p class="demo-hint">Demo: <code>${DEMO.email}</code></p></div>`;
            const form = $('[data-form]', root);
            const validate = () => { const v = formValues(form); return V.email(v.email) ? [] : [{ field: 'email', message: v.email ? 'Wpisz poprawny e-mail, np. jan@example.com.' : 'Wpisz e-mail.' }]; };
            bindBlurValidation(form, validate);
            form.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                const errs = validate();
                showErrors(form, errs, 'Popraw e-mail');
                if (errs.length)
                    return;
                const email = formValues(form).email;
                const done = busy($('button[type=submit]', form), 'Wysyłanie…');
                try {
                    await api.magicLink(email);
                    drawSent(email);
                }
                catch (e) {
                    done();
                    $('[data-form-alert]', form).innerHTML = alertBox('error', 'Nie udało się wysłać linku', esc(e.message));
                }
            });
        };
        const drawSent = (email) => {
            let left = 60;
            root.innerHTML = `${screenTag('K-02', 'Logowanie linkiem e-mail')}<div class="container narrow section"><div class="card form-card center">
        <div class="big-icon" aria-hidden="true">✉️</div><h1>Sprawdź skrzynkę</h1>
        <p>Jeśli konto <strong>${esc(email)}</strong> istnieje, wysłaliśmy na nie link do logowania. Link jest ważny 15 minut.</p>
        <div class="row-wrap center-row"><button class="btn btn-ghost" data-change>Zmień e-mail</button><button class="btn btn-secondary" data-resend disabled>Wyślij ponownie (60 s)</button></div>
        <hr><button class="btn btn-primary" data-open>📬 Otwórz link z e-maila (demo)</button></div></div>`;
            const resend = $('[data-resend]', root);
            const iv = setInterval(() => {
                if (!resend.isConnected) {
                    clearInterval(iv);
                    return;
                }
                left--;
                resend.disabled = left > 0;
                resend.textContent = left > 0 ? `Wyślij ponownie (${left} s)` : 'Wyślij ponownie';
            }, 1000);
            $('[data-change]', root).addEventListener('click', () => { clearInterval(iv); drawForm(); });
            resend.addEventListener('click', async () => { const d = busy(resend, 'Wysyłanie…'); await api.magicLink(email).catch(() => { }); d(); left = 60; toast('Wysłaliśmy nowy link.', 'info'); });
            $('[data-open]', root).addEventListener('click', async (e) => {
                const d = busy(e.currentTarget, 'Logowanie…');
                try {
                    await api.magicVerify(email);
                    clearInterval(iv);
                    toast('Zalogowano.');
                    navigate(returnUrl);
                }
                catch (err) {
                    d();
                    toast(err.message, 'error');
                }
            });
        };
        drawForm();
    },
});
// ---------- K-03 Moje zamówienia i zgłoszenia ----------
route({
    pattern: '/konto', id: 'K-03', title: 'Moje zamówienia', roles: ['CUSTOMER'],
    render(root) {
        root.innerHTML = `${screenTag('K-03', 'Moje zamówienia i zgłoszenia')}<div class="container section">
      <div class="page-head"><div><h1>Moje zamówienia i zgłoszenia</h1><p class="muted">${esc(Store.db.session?.email ?? '')}</p></div></div>
      <section data-claims-wrap><h2>Twoje zgłoszenia</h2><div data-claims></div></section>
      <section><h2>Zamówienia</h2><div data-orders></div></section></div>`;
        const wrap = $('[data-claims-wrap]', root);
        loadInto($('[data-claims]', root), {
            skeleton: skelCards(1), compactError: true,
            load: () => api.myClaims(),
            isEmpty: (cs) => cs.length === 0,
            empty: () => { wrap.hidden = true; return ''; },
            render: (cs) => { $('[data-claims]', root).innerHTML = `<div class="card list-card">${cs.map((c) => claimCard(c, '/zgloszenia/' + c.id)).join('')}</div>`; },
        });
        loadInto($('[data-orders]', root), {
            skeleton: skelCards(3),
            load: () => api.myOrders(),
            isEmpty: (os) => os.length === 0,
            empty: () => `<div class="card">${emptyState('🛍️', 'Nie widzimy zamówień dla tego e-maila', 'Kupowałeś/-aś jako gość na inny adres? Znajdź zamówienie po numerze.', '<a class="btn btn-secondary" href="#/">Znajdź zamówienie</a>')}</div>`,
            render: (os) => {
                $('[data-orders]', root).innerHTML = `<div class="orders">${os.map((o) => {
                    const ret = kindAvailability(o, 'RETURN');
                    const com = kindAvailability(o, 'COMPLAINT');
                    const any = Object.keys(KINDS).some((k) => kindAvailability(o, k).available);
                    return `<article class="card order-card">
            <div class="row-between"><div><strong class="mono">${esc(o.number)}</strong> <span class="muted small">· ${fmtDate(o.placedAt)}</span></div>
              ${o.deliveredAt ? `<span class="badge badge-ok">Dostarczone ${fmtDate(o.deliveredAt)}</span>` : '<span class="badge badge-info">W drodze</span>'}</div>
            <ul class="order-lines">${o.lines.map((l) => `<li><span class="thumb" aria-hidden="true">${l.emoji}</span><span>${esc(l.name)}${l.variant ? ` <span class="muted small">· ${esc(l.variant)}</span>` : ''}</span><span class="muted small">${l.qty} × ${fmtMoney(l.price)}</span></li>`).join('')}</ul>
            <div class="row-between"><div class="tags">${o.deliveredAt ? `${ret.available ? `<span class="tag tag-ok">Zwrot do ${fmtDate(ret.deadline)}</span>` : '<span class="tag">Termin zwrotu minął</span>'}${com.available ? `<span class="tag">Reklamacja do ${fmtDate(com.deadline)}</span>` : ''}` : ''}</div>
            ${any ? `<a class="btn btn-secondary btn-sm" href="#/zgloszenie/1?zamowienie=${o.id}">Zgłoś problem</a>` : `<span class="small muted" title="${esc(o.deliveredAt ? 'Minęły terminy zgłoszeń' : 'Zgłosisz po dostarczeniu')}">${o.deliveredAt ? 'Terminy minęły' : 'Zgłosisz po dostawie'}</span>`}</div></article>`;
                }).join('')}</div>`;
            },
        });
    },
});
// ---------- K-04 Sprawdź status ----------
route({
    pattern: '/status', id: 'K-04', title: 'Sprawdź status zgłoszenia',
    render(root, _p, q) {
        root.innerHTML = `${screenTag('K-04', 'Sprawdź status')}<div class="container narrow section">
      <h1>Sprawdź status zgłoszenia</h1><p class="muted">Numer zgłoszenia (RMA) znajdziesz w e-mailu potwierdzającym.</p>
      <form class="card form-card" novalidate data-form>
        ${textField({ name: 'rma', label: 'Numer zgłoszenia', required: true, value: q.get('nr') ?? '', placeholder: 'RMA-2026-00871', attrs: 'style="text-transform:uppercase"' })}
        ${textField({ name: 'email', label: 'E-mail', type: 'email', required: true, autocomplete: 'email' })}
        <div data-form-alert></div>
        <button class="btn btn-primary" type="submit">Pokaż zgłoszenie</button></form>
      <p class="demo-hint">Demo: <code>RMA-2026-00871</code> lub <code>RMA-2026-00880</code> + <code>${DEMO.email}</code></p></div>`;
        const form = $('[data-form]', root);
        const validate = () => {
            const v = formValues(form);
            const e = [];
            if (!V.rmaNo(v.rma))
                e.push({ field: 'rma', message: v.rma ? 'Numer ma format RMA-2026-00871.' : 'Wpisz numer zgłoszenia.' });
            if (!V.email(v.email))
                e.push({ field: 'email', message: v.email ? 'Wpisz poprawny e-mail.' : 'Wpisz e-mail.' });
            return e;
        };
        bindBlurValidation(form, validate);
        form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const errs = validate();
            showErrors(form, errs, 'Popraw dane');
            if (errs.length)
                return;
            const v = formValues(form);
            const done = busy($('button[type=submit]', form), 'Szukamy…');
            try {
                const r = await api.claimStatus(v.rma, v.email);
                navigate('/zgloszenia/' + r.claimId);
            }
            catch (e) {
                done();
                $('[data-form-alert]', form).innerHTML = e instanceof ApiError && e.status === 404
                    ? alertBox('error', 'Nie znaleźliśmy zgłoszenia', 'Sprawdź numer RMA i e-mail podany w zgłoszeniu.')
                    : alertBox('error', 'Nie udało się sprawdzić statusu', esc(e.message) + ' Spróbuj ponownie.');
            }
        });
    },
});
// ---------- K-05 Szczegóły zgłoszenia ----------
function whatNow(c) {
    if (c.status === 'APPROVED') {
        if (c.returnMethod === 'NONE')
            return 'Nie musisz odsyłać produktu. Realizujemy rozwiązanie.';
        if (c.returnMethod === 'COURIER')
            return `Kurier odbierze paczkę ${c.courier?.date ? fmtDate(c.courier.date) : 'w najbliższy dzień roboczy'} spod adresu ${esc(c.courier?.street ?? '')}. Zapakuj produkt.`;
        if (c.returnMethod === 'STORE')
            return `Zanieś produkt do sklepu: ${esc(STORES.find((s) => s.id === c.store)?.name ?? '')}. Pokaż kod QR przy kasie.`;
        return `Nadaj paczkę w paczkomacie do ${fmtDate(c.label?.expiresAt ?? '')} — zeskanuj kod QR na ekranie paczkomatu.`;
    }
    if (c.status === 'RESOLVED' && c.outcome) {
        const o = c.outcome;
        return o.type === 'REFUND' ? `Zwrot ${fmtMoney(o.amount ?? 0)} został zlecony — środki pojawią się na koncie w ciągu 1–3 dni roboczych.`
            : o.type === 'STORE_CREDIT' ? `Bon o wartości ${fmtMoney(o.amount ?? 0)} wysłaliśmy e-mailem.`
                : o.type === 'PRICE_REDUCTION' ? `Zwrot różnicy ${fmtMoney(o.amount ?? 0)} został zlecony.`
                    : `Wysłaliśmy ${o.type === 'SPARE_PART' ? 'brakujący element' : 'nowy produkt'} — zamówienie ${esc(o.ref ?? '')}.`;
    }
    if (c.status === 'AWAITING_CUSTOMER')
        return c.offer?.status === 'PENDING' ? 'Sklep zaproponował rozwiązanie — zaakceptuj je lub odrzuć poniżej.' : 'Uzupełnij informacje, o które prosi sklep — formularz poniżej.';
    if (c.status === 'SUBMITTED' && c.kind === 'COMPLAINT')
        return `Odpowiemy najpóźniej do ${fmtDate(c.responseDueAt)} (14 dni), zwykle szybciej.`;
    return STATUS[c.status].next;
}
route({
    pattern: '/zgloszenia/:id', id: 'K-05', title: 'Twoje zgłoszenie', roles: ['CUSTOMER'],
    render(root, p) {
        root.innerHTML = `${screenTag('K-05', 'Szczegóły zgłoszenia')}<div class="container section" data-body></div>`;
        const body = $('[data-body]', root);
        const load = () => loadInto(body, {
            skeleton: `<div aria-busy="true"><div class="skel skel-title" style="width:40%"></div>${skelCards(3)}</div>`,
            load: () => api.claim(p.id),
            render: (c) => renderCustomerClaim(body, c, load),
        });
        load();
    },
});
function renderCustomerClaim(body, c, reload) {
    const s = Store.db.session;
    const account = s?.email && !s.orderId;
    const canCancel = ['SUBMITTED', 'AWAITING_CUSTOMER', 'APPROVED'].includes(c.status);
    const msgs = c.messages.filter((m) => !m.internal);
    body.innerHTML = `
    <nav class="breadcrumbs" aria-label="Okruszki">${account ? '<a href="#/konto">Moje zamówienia</a> › ' : ''}<span>${esc(c.number)}</span></nav>
    <div class="card claim-head">
      <div class="ch-main"><div><p class="eyebrow">${KINDS[c.kind].icon} ${esc(KINDS[c.kind].label)} · zamówienie ${esc(c.orderNumber)}</p>
        <h1 class="h2 mono">${esc(c.number)}</h1><p class="small muted">Zgłoszono ${fmtDateTime(c.createdAt)}</p></div>${statusBadge(c.status)}</div>
      ${statusTracker(c.status, c.returnMethod === 'NONE')}
      <div class="ch-next" role="status"><strong>Co teraz?</strong> ${whatNow(c)}</div>
    </div>
    <div data-action></div>
    <div class="grid-2-1">
      <div class="stack">
        <section class="card"><h2 class="h3">Produkty</h2>${c.items.map((i) => `<div class="item-row">
          <span class="thumb lg" aria-hidden="true">${i.emoji}</span><div class="item-main"><strong>${esc(i.name)}</strong><div class="small muted">${esc(i.variant)} · ${i.qty} × ${fmtMoney(i.price)}</div>
          <div class="small"><strong>${esc(reasonLabel(c.kind, i.reason))}</strong>${i.description ? ` — ${esc(i.description)}` : ''}</div>
          ${i.serial ? `<div class="small muted">Nr seryjny: <span class="mono">${esc(i.serial)}</span></div>` : ''}${i.missingPart ? `<div class="small muted">Brakujący element: ${esc(i.missingPart)}</div>` : ''}
          ${i.files.length ? `<div class="file-chips">${i.files.map((f) => `<span class="chip">${fileIcon(f)} ${esc(f.name)}</span>`).join('')}</div>` : ''}</div></div>`).join('')}
          <dl class="dl top-gap"><dt>Wybrane rozwiązanie</dt><dd>${RESOLUTIONS[c.resolution].icon} ${esc(RESOLUTIONS[c.resolution].label)}${c.exchangeVariant ? ` — ${esc(c.exchangeVariant)}` : ''}${c.refundAmount ? ` · ${fmtMoney(c.refundAmount)}` : ''}</dd>
          <dt>Odesłanie</dt><dd>${esc(RETURN_METHODS[c.returnMethod])}${c.pickupPoint ? ` · ${esc(c.pickupPoint)}` : ''}</dd></dl></section>
        <section class="card"><h2 class="h3">Wiadomości</h2>
          <div class="thread" data-thread>${threadHtml(msgs, 'CUSTOMER')}</div>
          <form class="composer" novalidate data-msg>${textareaField({ name: 'body', label: 'Napisz do nas', max: 2000, rows: 3, placeholder: 'Masz pytanie? Napisz…' })}
            <div class="row-end"><button class="btn btn-secondary" type="submit">Wyślij</button></div></form></section>
      </div>
      <div class="stack">
        <section class="card"><h2 class="h3">Historia</h2>${timelineHtml(c.timeline)}</section>
        ${canCancel ? '<button class="btn btn-ghost btn-block" data-cancel>Anuluj zgłoszenie</button>' : ''}
      </div></div>`;
    renderActionCard($('[data-action]', body), c, reload);
    bindCounters(body);
    const mf = $('[data-msg]', body);
    mf.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const v = formValues(mf);
        if (!v.body) {
            showErrors(mf, [{ field: 'body', message: 'Wpisz treść wiadomości.' }], 'Nie można wysłać');
            return;
        }
        clearErrors(mf);
        const done = busy($('button[type=submit]', mf), 'Wysyłanie…');
        try {
            const m = await api.sendMessage(c.id, v.body);
            msgs.push(m);
            $('[data-thread]', body).innerHTML = threadHtml(msgs, 'CUSTOMER');
            $('textarea', mf).value = '';
            toast('Wiadomość wysłana.');
        }
        catch {
            showErrors(mf, [{ field: 'body', message: 'Nie udało się wysłać — spróbuj ponownie. Treść została zachowana.' }], 'Błąd wysyłki');
        }
        done();
    });
    $('[data-cancel]', body)?.addEventListener('click', async () => {
        if (!(await confirmModal('Anulować zgłoszenie?', 'Zgłoszenie zostanie zamknięte. Jeśli zmienisz zdanie, możesz utworzyć nowe — w terminie zwrotu lub reklamacji.', 'Anuluj zgłoszenie', true)))
            return;
        try {
            await api.cancelClaim(c.id);
            toast('Zgłoszenie anulowane.', 'info');
            reload();
        }
        catch (e) {
            toast(e.message, 'error');
        }
    });
}
function threadHtml(msgs, me) {
    if (!msgs.length)
        return emptyState('💬', 'Brak wiadomości', me === 'CUSTOMER' ? 'Masz pytanie? Napisz do nas — odpowiadamy zwykle w ciągu kilku godzin.' : 'Brak korespondencji w tej sprawie.');
    return msgs.map((m) => `<div class="msg ${m.from === me ? 'msg-me' : m.from === 'SYSTEM' ? 'msg-sys' : 'msg-them'} ${m.internal ? 'msg-internal' : ''}"><div class="msg-meta">${m.internal ? '🔒 Notatka wewnętrzna · ' : ''}${esc(m.author)} · ${fmtDateTime(m.at)}</div><div class="msg-body">${esc(m.body)}</div></div>`).join('');
}
function renderActionCard(box, c, reload) {
    // Propozycja sklepu
    if (c.status === 'AWAITING_CUSTOMER' && c.offer?.status === 'PENDING') {
        const o = c.offer;
        box.innerHTML = `<section class="card action-card warn"><h2 class="h3">Propozycja sklepu</h2>
      <div class="offer"><span class="offer-icon" aria-hidden="true">${RESOLUTIONS[o.resolution].icon}</span><div><strong>${esc(RESOLUTIONS[o.resolution].label)}${o.amount ? `: ${fmtMoney(o.amount)}` : ''}</strong><p>${esc(o.text)}</p></div></div>
      <div class="row-wrap"><button class="btn btn-primary" data-accept>Akceptuję</button><button class="btn btn-secondary" data-decline>Odrzucam</button></div></section>`;
        $('[data-accept]', box).addEventListener('click', async (e) => {
            const d = busy(e.currentTarget, 'Zapisywanie…');
            try {
                await api.offerDecision(c.id, true, '');
                toast('Dziękujemy — propozycja zaakceptowana.');
                reload();
            }
            catch (err) {
                d();
                toast(err.message, 'error');
            }
        });
        $('[data-decline]', box).addEventListener('click', () => {
            openModal({
                title: 'Odrzucić propozycję?', body: `<form novalidate data-form>${textareaField({ name: 'comment', label: 'Dlaczego? (pomoże nam znaleźć inne rozwiązanie)', max: 500, rows: 3 })}</form>`,
                onOpen: (el) => bindCounters(el),
                actions: [{ label: 'Wróć', onClick: ({ close }) => close() }, {
                        label: 'Odrzuć propozycję', kind: 'danger', onClick: async ({ el, close, btn }) => {
                            const d = busy(btn, 'Zapisywanie…');
                            try {
                                await api.offerDecision(c.id, false, formValues($('[data-form]', el)).comment);
                                close();
                                toast('Przekazaliśmy Twoją decyzję do sklepu.', 'info');
                                reload();
                            }
                            catch (err) {
                                d();
                                toast(err.message, 'error');
                            }
                        },
                    }],
            });
        });
        return;
    }
    // Prośba o informacje
    if (c.status === 'AWAITING_CUSTOMER' && c.requestedInfo?.length) {
        const req = c.requestedInfo;
        const files = [];
        box.innerHTML = `<section class="card action-card warn"><h2 class="h3">Sklep prosi o uzupełnienie</h2>
      <ul class="checklist">${req.map((r) => `<li>${esc(REQUEST_ITEMS.find((x) => x[0] === r)?.[1] ?? r)}</li>`).join('')}</ul>
      <form novalidate data-form>
        ${req.includes('PHOTO') || req.includes('VIDEO') || req.includes('RECEIPT') ? `<div class="field" data-field="files" tabindex="-1"><label>Pliki <span class="req">*</span></label>${req.includes('VIDEO') ? '<div class="hint">Nagraj 10–30 s pokazujące wadę. Wideo do 100 MB.</div>' : ''}${uploaderHtml('resp', [])}<div class="field-error" hidden></div></div>` : ''}
        ${req.includes('SERIAL') ? textField({ name: 'serial', label: 'Numer seryjny', required: true, hint: 'Na naklejce na spodzie lub z tyłu urządzenia (S/N).', attrs: 'style="text-transform:uppercase"', cls: 'w-md' }) : ''}
        ${textareaField({ name: 'message', label: 'Wiadomość', max: 2000, rows: 2 })}
        <div data-form-alert></div>
        <button class="btn btn-primary" type="submit">Wyślij odpowiedź</button></form>
      <p class="demo-hint">Demo: numer seryjny np. <code>KF-B500-11823</code>; użyj „+ nagranie wideo”.</p></section>`;
        const form = $('[data-form]', box);
        bindCounters(form);
        bindUploader(form, 'resp', files, c.id, () => { });
        const validate = () => {
            const v = formValues(form);
            const e = [];
            const ready = files.filter((f) => f.status === 'ready');
            if (files.some((f) => f.status === 'uploading' || f.status === 'scanning'))
                e.push({ field: 'files', message: 'Poczekaj na zakończenie wysyłania plików.' });
            if (req.includes('VIDEO') && !ready.some((f) => isVideo(f.name, f.mime)))
                e.push({ field: 'files', message: 'Dodaj nagranie wideo (MP4 lub MOV).' });
            if (req.includes('PHOTO') && !ready.some((f) => !isVideo(f.name, f.mime)))
                e.push({ field: 'files', message: 'Dodaj co najmniej jedno zdjęcie.' });
            if (req.includes('RECEIPT') && !ready.length)
                e.push({ field: 'files', message: 'Dodaj dowód zakupu (zdjęcie lub PDF).' });
            if (req.includes('SERIAL')) {
                if (!v.serial)
                    e.push({ field: 'serial', message: 'Wpisz numer seryjny.' });
                else if (!V.serial(v.serial))
                    e.push({ field: 'serial', message: 'Numer seryjny ma 6–20 znaków: litery, cyfry i myślniki.' });
            }
            return e;
        };
        form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const errs = validate();
            showErrors(form, errs, 'Uzupełnij odpowiedź');
            if (errs.length)
                return;
            const v = formValues(form);
            const d = busy($('button[type=submit]', form), 'Wysyłanie…');
            try {
                await api.respond(c.id, files, v.serial ?? '', v.message);
                toast('Dziękujemy! Przekazaliśmy informacje do sklepu.');
                reload();
            }
            catch (e) {
                d();
                $('[data-form-alert]', form).innerHTML = alertBox('error', 'Nie udało się wysłać', esc(e.message) + ' Pliki zostały zachowane — spróbuj ponownie.');
            }
        });
        return;
    }
    // Etykieta / kod QR
    if (c.status === 'APPROVED' && c.returnMethod !== 'NONE' && c.label) {
        box.innerHTML = `<section class="card action-card ok"><div class="label-box">
      <div class="qr-wrap">${qrCode(c.label.code)}</div>
      <div><h2 class="h3">${c.returnMethod === 'PARCEL_LOCKER' ? 'Twój kod nadania' : c.returnMethod === 'STORE' ? 'Kod zwrotu do pokazania w sklepie' : 'Etykieta dla kuriera'}</h2>
        <p class="code mono">${esc(c.label.code)}</p>
        <ol class="next-steps"><li>Zapakuj produkt${c.kind === 'RETURN' ? ' (najlepiej w oryginalne opakowanie)' : ''}.</li>
          <li>${c.returnMethod === 'PARCEL_LOCKER' ? `Podejdź do paczkomatu ${esc(c.pickupPoint ?? '')}, wybierz „Nadaj paczkę” i zeskanuj kod.` : c.returnMethod === 'STORE' ? 'Pokaż kod przy kasie.' : 'Przyklej etykietę lub podaj kod kurierowi.'}</li>
          <li>Kod ważny do <strong>${fmtDate(c.label.expiresAt)}</strong>.</li></ol>
        <button class="btn btn-secondary btn-sm" data-pdf>📄 Pobierz etykietę PDF</button></div></div></section>`;
        $('[data-pdf]', box).addEventListener('click', async (e) => {
            const d = busy(e.currentTarget, 'Pobieranie…');
            try {
                await api.download(`/portal/claims/${c.id}/label`);
                toast('Pobieranie rozpoczęte (demo).', 'info');
            }
            catch {
                toast('Nie udało się pobrać — wysłaliśmy etykietę także e-mailem.', 'error');
            }
            d();
        });
        return;
    }
    if (c.status === 'REJECTED') {
        box.innerHTML = alertBox('error', 'Uzasadnienie decyzji', esc(c.rejectReason ?? ''), '<div class="small">Nie zgadzasz się? Napisz do nas w wiadomościach poniżej — sprawę rozpatrzy kierownik zespołu.</div>');
        return;
    }
    box.innerHTML = '';
}
// ---------- X-03 Logowanie pracownika (SSO — makieta) ----------
route({
    pattern: '/panel-logowanie', id: 'X-03', title: 'Logowanie pracownika',
    render(root, _p, q) {
        root.innerHTML = `${screenTag('X-03', 'Logowanie pracownika')}<div class="container narrow section"><div class="card form-card center">
      <h1>Panel obsługi ${SHOP.name}</h1><p class="muted">Pracownicy logują się kontem firmowym (SSO). Dostawcy — kontem organizacji.</p>
      <div class="stack"><button class="btn btn-primary" data-r="AGENT">Zaloguj przez SSO — agent / kierownik (demo)</button>
      <button class="btn btn-secondary" data-r="WAREHOUSE">Zaloguj przez SSO — magazyn (demo)</button>
      <button class="btn btn-secondary" data-r="SUPPLIER">Zaloguj jako dostawca CleanAir (demo)</button></div></div></div>`;
        $$('[data-r]', root).forEach((b) => b.addEventListener('click', async () => {
            const d = busy(b, 'Logowanie…');
            try {
                await apiCall('POST', '/auth/sso/callback', () => { Store.db.session = clone(DEMO_SESSIONS[b.dataset.r]); });
                const ret = q.get('returnUrl');
                navigate(ret && shellFor(ret) !== 'shop' ? ret : homeFor(b.dataset.r));
            }
            catch (e) {
                d();
                toast(e.message, 'error');
            }
        }));
    },
});
// Kreator zgłoszenia: Z-00 (asysta), Z-01 … Z-06, Z-07
const WIZ_STEPS = ['Rodzaj', 'Produkty', 'Opis', 'Rozwiązanie', 'Odesłanie', 'Podsumowanie'];
function applyConditions(form) {
    const v = formValues(form);
    $$('[data-show-if]', form).forEach((el) => {
        const [k, val] = el.dataset.showIf.split('=');
        el.hidden = !val.split('|').includes(v[k] ?? '');
    });
}
function orderLine(order, lineId) { return order.lines.find((l) => l.lineId === lineId); }
const STEP_DEFS = [
    // Z-01 Rodzaj
    {
        id: 'Z-01', title: 'Co chcesz zgłosić?', intro: () => 'Wybierz rodzaj zgłoszenia — dopasujemy pytania i dostępne rozwiązania.',
        render: () => '<div data-kinds></div>',
        bind(d, ctx) {
            const box = $('[data-kinds]', ctx.form);
            loadInto(box, {
                skeleton: skelCards(4), compactError: true,
                load: () => api.eligibility(ctx.order.id),
                isEmpty: (ks) => !ks.some((k) => k.available),
                empty: () => emptyState('⌛', 'Terminy zgłoszeń minęły', `Dla zamówienia ${esc(ctx.order.number)} minęły terminy zwrotu i reklamacji. Jeśli masz pytania — napisz: ${SHOP.support}.`),
                render: (ks) => {
                    box.innerHTML = radioCards({
                        name: 'kind', label: 'Rodzaj zgłoszenia', required: true, value: d.kind,
                        options: ks.map((k) => ({
                            value: k.kind, icon: KINDS[k.kind].icon, title: KINDS[k.kind].label, disabled: !k.available,
                            text: `${esc(KINDS[k.kind].hint)}<br>${k.available ? `<span class="tag tag-ok">do ${fmtDate(k.deadline)}</span>` : `<span class="tag">${esc(k.reason)}</span>`}`,
                        })),
                    });
                },
            });
        },
        collect(form, d) {
            const v = formValues(form);
            if (v.kind !== undefined && v.kind !== d.kind) {
                d.kind = v.kind;
                d.items = [];
                d.resolution = '';
                d.exchangeVariant = '';
                d.returnMethod = '';
            }
        },
        validate(d) { return d.kind ? [] : [{ field: 'kind', message: 'Wybierz rodzaj zgłoszenia.' }]; },
    },
    // Z-02 Produkty
    {
        id: 'Z-02', title: 'Których produktów dotyczy?', intro: (d) => d.kind === 'RETURN' ? 'Zaznacz produkty, które chcesz zwrócić, i ich liczbę.' : 'Zaznacz produkty, których dotyczy problem.',
        render(d, ctx) {
            const lines = ctx.order.lines.map((l) => ({ l, el: lineEligibility(ctx.order, l, d.kind) }));
            if (!lines.some((x) => x.el.eligible)) {
                return emptyState('🚫', 'Żaden produkt nie kwalifikuje się do tego zgłoszenia', lines.map((x) => `${esc(x.l.name)}: ${esc(x.el.reason)}`).join('<br>'), '<a class="btn btn-secondary" href="#/zgloszenie/1">Zmień rodzaj zgłoszenia</a>');
            }
            return `<fieldset class="field" data-field="items" tabindex="-1"><legend class="sr-only">Produkty</legend>
        <ul class="pick-lines">${lines.map(({ l, el }) => {
                const sel = d.items.find((i) => i.lineId === l.lineId);
                return `<li class="pick ${el.eligible ? '' : 'disabled'}">
            <label class="pick-main"><input type="checkbox" name="pick-${l.lineId}" ${sel ? 'checked' : ''} ${el.eligible ? '' : 'disabled'}>
              <span class="thumb lg" aria-hidden="true">${l.emoji}</span>
              <span class="pick-text"><strong>${esc(l.name)}</strong><span class="small muted">${esc(l.variant)}${l.variant ? ' · ' : ''}${fmtMoney(l.price)} / szt.</span>
              ${el.eligible ? '' : `<span class="small reason-off">${esc(el.reason)}</span>`}</span></label>
            ${el.eligible && el.remaining > 1 ? `<label class="qty">Ilość <select name="qty-${l.lineId}">${Array.from({ length: el.remaining }, (_, i) => `<option value="${i + 1}" ${(sel?.qty ?? el.remaining) === i + 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select> z ${el.remaining}</label>` : ''}
          </li>`;
            }).join('')}</ul><div class="field-error" hidden></div></fieldset>
        <div class="sum-line" data-sum aria-live="polite"></div>`;
        },
        bind(d, ctx) {
            const upd = () => {
                const t = clone(d);
                STEP_DEFS[1].collect(ctx.form, t, ctx);
                const el = $('[data-sum]', ctx.form);
                if (el)
                    el.innerHTML = t.items.length ? `Wybrano: <strong>${t.items.reduce((s, i) => s + i.qty, 0)} szt.</strong> o wartości <strong>${fmtMoney(draftValue(t))}</strong>` : '<span class="muted">Nie wybrano produktów</span>';
            };
            ctx.form.addEventListener('change', upd);
            upd();
        },
        collect(form, d, ctx) {
            const v = formValues(form);
            const items = [];
            ctx.order.lines.forEach((l) => {
                if (v['pick-' + l.lineId] !== 'on')
                    return;
                const prev = d.items.find((i) => i.lineId === l.lineId);
                const qty = Number(v['qty-' + l.lineId] || 1);
                items.push(prev ? { ...prev, qty } : { lineId: l.lineId, sku: l.sku, name: l.name, variant: l.variant, emoji: l.emoji, qty, price: l.price, category: l.category, supplierId: l.supplierId, reason: '', description: '', detectedAt: '', serial: '', missingPart: '', files: [] });
            });
            if ($('[name^="pick-"]', form))
                d.items = items;
        },
        validate(d) { return d.items.length ? [] : [{ field: 'items', message: 'Zaznacz co najmniej jeden produkt.' }]; },
    },
    // Z-03 Opis
    {
        id: 'Z-03', title: 'Opisz problem', intro: (d) => d.kind === 'RETURN' ? 'Powiedz nam, dlaczego zwracasz — to pomaga ulepszać ofertę.' : 'Im dokładniejszy opis i zdjęcia, tym szybciej rozwiążemy sprawę.',
        render: () => '<div data-items></div>',
        bind(d, ctx) {
            const box = $('[data-items]', ctx.form);
            loadInto(box, {
                skeleton: skelCards(d.items.length || 1), compactError: true,
                load: () => api.requirements(d),
                render: (reqs) => {
                    ctx.reqs = reqs;
                    const kind = d.kind;
                    box.innerHTML = d.items.map((it) => {
                        const r = reqs.find((x) => x.lineId === it.lineId);
                        const id = it.lineId;
                        return `<section class="card item-card">
              <div class="item-row"><span class="thumb lg" aria-hidden="true">${it.emoji}</span><div><strong>${esc(it.name)}</strong><div class="small muted">${esc(it.variant)} · ${it.qty} szt.</div></div></div>
              ${selectField({ name: 'r-' + id, label: kind === 'RETURN' ? 'Powód zwrotu' : kind === 'COMPLAINT' ? 'Na czym polega wada?' : 'Co się stało?', required: true, value: it.reason, options: REASONS[kind] })}
              ${kind === 'MISSING' ? `<div class="cond" data-show-if="r-${id}=MISSING_PART|WRONG_ITEM">${textField({ name: 'mp-' + id, label: 'Którego elementu brakuje / co otrzymałeś/-aś?', required: true, value: it.missingPart, placeholder: 'np. kabel USB-C, instrukcja, śruby montażowe' })}</div>` : ''}
              ${textareaField({ name: 'd-' + id, label: kind === 'RETURN' ? 'Komentarz' : 'Opis problemu', required: kind === 'COMPLAINT', value: it.description, max: kind === 'RETURN' ? 500 : 1500, min: kind === 'COMPLAINT' ? 20 : undefined, rows: kind === 'RETURN' ? 2 : 4,
                            hint: kind === 'COMPLAINT' ? 'Kiedy i w jakiej sytuacji pojawia się problem? Czy występuje zawsze?' : kind === 'TRANSPORT' ? 'Opisz uszkodzenie. Jeśli kurier spisał protokół szkody — napisz to.' : '' })}
              ${kind === 'COMPLAINT' ? `<div class="grid-2">${textField({ name: 'dt-' + id, label: 'Kiedy zauważyłeś/-aś wadę?', type: 'date', required: true, value: it.detectedAt, attrs: `min="${ctx.order.deliveredAt}" max="${todayISO()}"` })}
                ${r.serial ? textField({ name: 's-' + id, label: 'Numer seryjny (S/N)', required: true, value: it.serial, hint: 'Naklejka na spodzie lub z tyłu urządzenia.', attrs: 'style="text-transform:uppercase"' }) : '<div></div>'}</div>` : ''}
              ${r.photos || r.video || kind !== 'RETURN' ? `<div class="field" data-field="f-${id}" tabindex="-1">
                <label>${r.video ? 'Zdjęcia i nagranie wideo' : 'Zdjęcia'} ${r.photos ? '<span class="req" aria-hidden="true">*</span>' : '<span class="opt">(opcjonalnie)</span>'}</label>
                <div class="hint">${r.photos ? `Min. ${r.photos} ${r.photos > 1 ? 'zdjęcia' : 'zdjęcie'}${kind === 'TRANSPORT' ? ' — produktu i opakowania' : kind === 'MISSING' ? ' — zawartości paczki' : ' pokazujące wadę'}.` : ''}${r.video ? ' <strong>Wymagane nagranie wideo</strong> pokazujące problem (10–30 s).' : ''}</div>
                ${r.sources.length ? `<div class="req-source">ℹ️ Wymagane, bo: ${r.sources.map(esc).join('; ')}</div>` : ''}
                ${uploaderHtml('it-' + id, it.files)}<div class="field-error" hidden></div></div>` : ''}
            </section>`;
                    }).join('');
                    d.items.forEach((it) => bindUploader(box, 'it-' + it.lineId, it.files, Store.db.draft?.id ?? '-', ctx.dirty));
                    bindCounters(box);
                    applyConditions(ctx.form);
                },
            });
        },
        collect(form, d) {
            const v = formValues(form);
            d.items.forEach((it) => {
                const id = it.lineId;
                if ('r-' + id in v)
                    it.reason = v['r-' + id];
                if ('d-' + id in v)
                    it.description = v['d-' + id];
                if ('dt-' + id in v)
                    it.detectedAt = v['dt-' + id];
                if ('s-' + id in v)
                    it.serial = v['s-' + id].toUpperCase();
                if ('mp-' + id in v)
                    it.missingPart = v['mp-' + id];
            });
        },
        validate(d, ctx) {
            const e = [];
            const kind = d.kind;
            const reqs = ctx.reqs
                ?? d.items.map((it) => ({ lineId: it.lineId, ...itemRequirements(kind, it, orderLine(ctx.order, it.lineId), d.items, draftValue(d), daysSinceDelivery(ctx.order)) }));
            d.items.forEach((it) => {
                const id = it.lineId;
                const r = reqs.find((x) => x.lineId === id);
                const n = it.name;
                if (!it.reason)
                    e.push({ field: 'r-' + id, message: `${n}: wybierz powód.` });
                if (kind === 'COMPLAINT' && it.description.trim().length < 20)
                    e.push({ field: 'd-' + id, message: `${n}: opisz problem (min. 20 znaków, teraz ${it.description.trim().length}).` });
                if (kind === 'MISSING' && ['MISSING_PART', 'WRONG_ITEM'].includes(it.reason) && !it.missingPart.trim())
                    e.push({ field: 'mp-' + id, message: `${n}: napisz, którego elementu brakuje lub co otrzymałeś/-aś.` });
                if (kind === 'COMPLAINT') {
                    if (!it.detectedAt)
                        e.push({ field: 'dt-' + id, message: `${n}: podaj datę wykrycia wady.` });
                    else if (it.detectedAt > todayISO() || (ctx.order.deliveredAt && it.detectedAt < ctx.order.deliveredAt))
                        e.push({ field: 'dt-' + id, message: `${n}: data musi być między dostawą (${fmtDate(ctx.order.deliveredAt ?? '')}) a dziś.` });
                    if (r?.serial) {
                        if (!it.serial)
                            e.push({ field: 's-' + id, message: `${n}: wpisz numer seryjny.` });
                        else if (!V.serial(it.serial))
                            e.push({ field: 's-' + id, message: `${n}: numer seryjny ma 6–20 znaków (litery, cyfry, myślniki).` });
                    }
                }
                if (it.files.some((f) => f.status === 'uploading' || f.status === 'scanning'))
                    e.push({ field: 'f-' + id, message: `${n}: poczekaj na zakończenie wysyłania plików.` });
                const ready = it.files.filter((f) => f.status === 'ready');
                const photos = ready.filter((f) => !isVideo(f.name, f.mime)).length;
                if (r && photos < r.photos)
                    e.push({ field: 'f-' + id, message: `${n}: dodaj min. ${r.photos} ${r.photos > 1 ? 'zdjęcia' : 'zdjęcie'} (teraz: ${photos}).` });
                if (r?.video && !ready.some((f) => isVideo(f.name, f.mime)))
                    e.push({ field: 'f-' + id, message: `${n}: dodaj nagranie wideo pokazujące problem.` });
            });
            return e;
        },
    },
    // Z-04 Rozwiązanie
    {
        id: 'Z-04', title: 'Jak mamy to rozwiązać?', intro: (d) => d.kind === 'COMPLAINT' ? 'Wybierz preferowane rozwiązanie. Ostateczną decyzję podejmiemy po analizie zgłoszenia.' : 'Wybierz, co chcesz otrzymać.',
        render: () => '<div data-options></div>',
        bind(d, ctx) {
            const box = $('[data-options]', ctx.form);
            loadInto(box, {
                skeleton: skelCards(3), compactError: true,
                load: () => api.quote(d),
                render: (q) => {
                    const variants = d.items.length === 1 ? (orderLine(ctx.order, d.items[0].lineId)?.exchangeVariants ?? []) : [];
                    box.innerHTML = `${d.kind === 'COMPLAINT' ? alertBox('info', 'Twoje prawa', 'Zgodnie z ustawą w pierwszej kolejności naprawiamy lub wymieniamy produkt. Zwrot pieniędzy lub obniżenie ceny — gdy naprawa i wymiana nie są możliwe albo wada jest istotna.') : ''}
            ${radioCards({
                        name: 'resolution', label: 'Rozwiązanie', required: true, value: d.resolution,
                        options: q.options.map((o) => ({
                            value: o.resolution, icon: RESOLUTIONS[o.resolution].icon, disabled: !o.available,
                            title: `${RESOLUTIONS[o.resolution].label}${o.amount ? ` — ${fmtMoney(o.amount)}` : ''}`,
                            text: `${o.tag ? `<span class="tag tag-ok">${esc(o.tag)}</span> ` : ''}${esc(o.note)}`,
                        })),
                    })}
            ${variants.length ? `<div class="cond" data-show-if="resolution=EXCHANGE">${selectField({ name: 'variant', label: 'Na jaki wariant wymienić?', required: true, value: d.exchangeVariant, options: variants.map((x) => [x.label, x.label + (x.inStock ? '' : ' — brak w magazynie')]) })}</div>` : ''}
            ${d.kind === 'COMPLAINT' ? `<div class="cond" data-show-if="resolution=REFUND|PRICE_REDUCTION">${textareaField({ name: 'justification', label: 'Dlaczego naprawa lub wymiana nie wystarczą?', value: d.refundJustification, max: 500, rows: 2 })}</div>` : ''}`;
                    bindCounters(box);
                    applyConditions(ctx.form);
                    if (variants.length)
                        $$('#f-variant option', box).forEach((o) => { if (variants.find((x) => x.label === o.value && !x.inStock))
                            o.disabled = true; });
                },
            });
        },
        collect(form, d) {
            const v = formValues(form);
            if (v.resolution !== undefined)
                d.resolution = v.resolution;
            d.exchangeVariant = d.resolution === 'EXCHANGE' ? (v.variant ?? '') : '';
            if ('justification' in v)
                d.refundJustification = v.justification;
        },
        validate(d, ctx) {
            const e = [];
            if (!d.resolution)
                e.push({ field: 'resolution', message: 'Wybierz rozwiązanie.' });
            else if (d.resolution === 'EXCHANGE') {
                const variants = d.items.length === 1 ? (orderLine(ctx.order, d.items[0].lineId)?.exchangeVariants ?? []) : [];
                if (!variants.some((x) => x.inStock))
                    e.push({ field: 'resolution', message: 'Wymiana nie jest dostępna dla tego produktu — wybierz inne rozwiązanie.' });
                else if (!d.exchangeVariant)
                    e.push({ field: 'variant', message: 'Wybierz wariant, na który chcesz wymienić produkt.' });
            }
            return e;
        },
    },
    // Z-05 Odesłanie
    {
        id: 'Z-05', title: 'Odesłanie i kontakt', intro: () => 'Wybierz, jak oddasz produkt, i potwierdź dane kontaktowe.',
        render(d, ctx) {
            const keep = keepItemPreview(d, ctx.order);
            const need = returnNeeded(d) && !keep;
            const p = Store.db.policy;
            const fee = d.kind === 'RETURN' && d.resolution === 'REFUND' ? fmtMoney(p.returnFee) : 'bezpłatnie';
            const cod = ctx.order.paymentMethod === 'COD' && ['REFUND', 'PRICE_REDUCTION'].includes(d.resolution);
            return `${!need ? alertBox('success', 'Nie musisz odsyłać produktu', keep ? `Na podstawie zasad sklepu (${esc(keep.name)}) zatrzymujesz produkt — potwierdzimy to od razu po wysłaniu zgłoszenia.` : d.kind === 'MISSING' ? 'Doślemy brakujący element lub produkt.' : 'Przy obniżeniu ceny produkt zostaje u Ciebie.') : `
        ${radioCards({ name: 'returnMethod', label: 'Jak odeślesz produkt?', required: true, value: d.returnMethod, options: [
                    { value: 'PARCEL_LOCKER', icon: '📮', title: `Paczkomat — ${fee}`, text: 'Kod QR na telefonie, bez drukowania. Nadasz 24/7.' },
                    { value: 'COURIER', icon: '🚚', title: `Kurier z odbiorem — ${fee}`, text: 'Odbierzemy paczkę spod Twojego adresu w wybrany dzień.' },
                    { value: 'STORE', icon: '🏬', title: 'Sklep stacjonarny — bezpłatnie', text: 'Oddaj produkt w jednym z naszych sklepów.' },
                ] })}
        <div class="cond" data-show-if="returnMethod=PARCEL_LOCKER"><div class="field" data-field="pickupPoint" tabindex="-1"><label for="pp-q">Wybierz paczkomat <span class="req">*</span></label>
          <div class="search-row"><input id="pp-q" type="search" placeholder="Miasto, ulica lub kod paczkomatu" value="${esc(ctx.order.address.city)}"><button type="button" class="btn btn-secondary" data-pp-search>Szukaj</button></div>
          <div data-pp-list aria-live="polite"></div><input type="hidden" name="pickupPoint" value="${esc(d.pickupPoint)}"><div class="field-error" hidden></div></div></div>
        <div class="cond" data-show-if="returnMethod=COURIER">
          ${textField({ name: 'c.street', label: 'Ulica i numer', required: true, value: d.courier.street, autocomplete: 'street-address' })}
          <div class="grid-3">${textField({ name: 'c.zip', label: 'Kod pocztowy', required: true, value: d.courier.zip, placeholder: '00-000', inputmode: 'numeric' })}${textField({ name: 'c.city', label: 'Miasto', required: true, value: d.courier.city })}${textField({ name: 'c.date', label: 'Dzień odbioru', type: 'date', required: true, value: d.courier.date, attrs: `min="${addDays(todayISO(), 1)}"` })}</div></div>
        <div class="cond" data-show-if="returnMethod=STORE">${selectField({ name: 'store', label: 'Sklep', required: true, value: d.store, options: STORES.map((s) => [s.id, s.name]) })}</div>`}
        ${cod ? `<h2 class="h3">Zwrot pieniędzy</h2>${alertBox('info', 'Zamówienie opłacone przy odbiorze', 'Podaj numer rachunku, na który zwrócimy pieniądze.')}${textField({ name: 'iban', label: 'Numer rachunku (IBAN)', required: true, value: d.refundAccount ? fmtIban(d.refundAccount) : '', inputmode: 'numeric', placeholder: 'PL00 0000 0000 0000 0000 0000 0000' })}` : ''}
        <h2 class="h3">Kontakt w sprawie zgłoszenia</h2>
        <div class="grid-2">${textField({ name: 'email', label: 'E-mail', type: 'email', required: true, value: d.contact.email, autocomplete: 'email' })}${textField({ name: 'phone', label: 'Telefon', type: 'tel', required: d.returnMethod === 'COURIER', value: d.contact.phone, autocomplete: 'tel', hint: 'Wymagany przy odbiorze kurierem.' })}</div>`;
        },
        bind(d, ctx) {
            const list = $('[data-pp-list]', ctx.form);
            if (!list)
                return;
            const hidden = $('input[name=pickupPoint]', ctx.form);
            const search = () => {
                const q = $('#pp-q', ctx.form).value;
                loadInto(list, {
                    skeleton: skelLines(3), compactError: true,
                    load: () => api.pickupPoints(q),
                    isEmpty: (ps) => ps.length === 0,
                    empty: () => `<p class="muted small">Brak paczkomatów dla „${esc(q)}”. Spróbuj kodu pocztowego lub nazwy miasta.</p>`,
                    render: (ps) => {
                        list.innerHTML = `<div class="radios pp">${ps.map((p) => `<label class="radio"><input type="radio" name="pp" value="${p.id}" ${hidden.value === p.id ? 'checked' : ''}><span><strong>${esc(p.name)}</strong><br><span class="small muted">${esc(p.address)}</span></span></label>`).join('')}</div>`;
                        $$('input[name=pp]', list).forEach((r) => r.addEventListener('change', () => { hidden.value = r.value; setFieldError(ctx.form, 'pickupPoint', null); }));
                    },
                });
            };
            $('[data-pp-search]', ctx.form).addEventListener('click', search);
            $('#pp-q', ctx.form).addEventListener('keydown', (e) => { if (e.key === 'Enter') {
                e.preventDefault();
                search();
            } });
            ctx.form.addEventListener('change', (e) => { if (e.target.name === 'returnMethod' && e.target.value === 'PARCEL_LOCKER' && !list.innerHTML)
                search(); });
            if (d.returnMethod === 'PARCEL_LOCKER')
                search();
            const iban = $('#f-iban', ctx.form);
            iban?.addEventListener('blur', () => { if (iban.value)
                iban.value = fmtIban(iban.value); });
        },
        collect(form, d) {
            const v = formValues(form);
            if ('returnMethod' in v)
                d.returnMethod = v.returnMethod;
            if (!$('[name=returnMethod]', form))
                d.returnMethod = 'NONE';
            d.pickupPoint = v.pickupPoint ?? d.pickupPoint;
            if ('c.street' in v)
                d.courier = { street: v['c.street'], zip: v['c.zip'], city: v['c.city'], date: v['c.date'] };
            if ('store' in v)
                d.store = v.store;
            if ('iban' in v)
                d.refundAccount = v.iban.replace(/\s+/g, '').toUpperCase();
            d.contact = { email: v.email, phone: v.phone };
        },
        validate(d, ctx) {
            const e = [];
            if (d.returnMethod === '')
                e.push({ field: 'returnMethod', message: 'Wybierz sposób odesłania.' });
            if (d.returnMethod === 'PARCEL_LOCKER' && !d.pickupPoint)
                e.push({ field: 'pickupPoint', message: 'Wyszukaj i wybierz paczkomat.' });
            if (d.returnMethod === 'COURIER') {
                if (!V.required(d.courier.street))
                    e.push({ field: 'c.street', message: 'Podaj ulicę i numer.' });
                if (!V.zip(d.courier.zip))
                    e.push({ field: 'c.zip', message: 'Kod pocztowy ma format 00-000.' });
                if (!V.required(d.courier.city))
                    e.push({ field: 'c.city', message: 'Podaj miasto.' });
                if (!d.courier.date)
                    e.push({ field: 'c.date', message: 'Wybierz dzień odbioru.' });
                else if (d.courier.date <= todayISO())
                    e.push({ field: 'c.date', message: 'Najwcześniej jutro.' });
                else if ([0, 6].includes(new Date(d.courier.date + 'T12:00:00').getDay()))
                    e.push({ field: 'c.date', message: 'Kurier odbiera paczki w dni robocze — wybierz poniedziałek–piątek.' });
                if (!V.phone(d.contact.phone))
                    e.push({ field: 'phone', message: 'Podaj telefon — kurier zadzwoni przed odbiorem.' });
            }
            if (d.returnMethod === 'STORE' && !d.store)
                e.push({ field: 'store', message: 'Wybierz sklep.' });
            const cod = ctx.order.paymentMethod === 'COD' && ['REFUND', 'PRICE_REDUCTION'].includes(d.resolution);
            if (cod && !V.ibanPL(d.refundAccount))
                e.push({ field: 'iban', message: d.refundAccount ? 'Numer rachunku jest niepoprawny — sprawdź 26 cyfr.' : 'Podaj numer rachunku do zwrotu.' });
            if (!V.email(d.contact.email))
                e.push({ field: 'email', message: d.contact.email ? 'Wpisz poprawny e-mail.' : 'Podaj e-mail — wyślemy na niego potwierdzenie.' });
            if (d.contact.phone && !V.phone(d.contact.phone))
                e.push({ field: 'phone', message: 'Wpisz 9 cyfr numeru telefonu.' });
            return e.filter((x, i, a) => a.findIndex((y) => y.field === x.field) === i);
        },
    },
    // Z-06 Podsumowanie
    {
        id: 'Z-06', title: 'Sprawdź i wyślij', intro: () => 'Upewnij się, że wszystko się zgadza.',
        render(d, ctx) {
            const s = Store.db.session;
            const q = quoteOptions(d, ctx.order).find((o) => o.resolution === d.resolution);
            const keep = keepItemPreview(d, ctx.order);
            const sec = (step, title, html) => `<section class="card summary"><div class="row-between"><h2 class="h3">${title}</h2><a href="#/zgloszenie/${step}?powrot=6">Edytuj</a></div>${html}</section>`;
            const method = !returnNeeded(d) || keep ? 'Bez odsyłania' : d.returnMethod === 'PARCEL_LOCKER' ? `Paczkomat ${esc(d.pickupPoint)}` : d.returnMethod === 'COURIER' ? `Kurier: ${esc(d.courier.street)}, ${esc(d.courier.zip)} ${esc(d.courier.city)} — ${fmtDate(d.courier.date)}` : d.returnMethod === 'STORE' ? esc(STORES.find((x) => x.id === d.store)?.name ?? '') : '—';
            return `${sec(1, 'Rodzaj', `<p>${KINDS[d.kind].icon} ${esc(KINDS[d.kind].label)} · zamówienie ${esc(ctx.order.number)}</p>`)}
        ${sec(2, 'Produkty i opis', d.items.map((i) => `<div class="item-row"><span class="thumb" aria-hidden="true">${i.emoji}</span><div><strong>${esc(i.name)}</strong> × ${i.qty}<div class="small">${esc(reasonLabel(d.kind, i.reason))}${i.description ? ' — ' + esc(i.description) : ''}</div>
          ${i.serial ? `<div class="small muted">S/N ${esc(i.serial)}</div>` : ''}${i.files.filter((f) => f.status === 'ready').length ? `<div class="file-chips">${i.files.filter((f) => f.status === 'ready').map((f) => `<span class="chip">${fileIcon(f)} ${esc(f.name)}</span>`).join('')}</div>` : ''}</div></div>`).join(''))}
        ${sec(4, 'Rozwiązanie', `<p>${RESOLUTIONS[d.resolution].icon} <strong>${esc(RESOLUTIONS[d.resolution].label)}</strong>${d.exchangeVariant ? ' — ' + esc(d.exchangeVariant) : ''}${q?.amount ? ` · <strong>${fmtMoney(q.amount)}</strong>` : ''}</p><p class="small muted">${esc(q?.note ?? '')}</p>`)}
        ${sec(5, 'Odesłanie i kontakt', `<dl class="dl"><dt>Odesłanie</dt><dd>${method}</dd><dt>Kontakt</dt><dd>${esc(d.contact.email)}${d.contact.phone ? ' · ' + esc(d.contact.phone) : ''}</dd>${d.refundAccount ? `<dt>Rachunek</dt><dd>${esc(fmtIban(d.refundAccount))}</dd>` : ''}</dl>`)}
        <section class="card">
          ${s.role === 'AGENT' ? checkboxField({ name: 'confirmed', label: `Klient potwierdził dane zgłoszenia (${s.assisted?.channel === 'STORE' ? 'w sklepie' : s.assisted?.channel === 'PHONE' ? 'telefonicznie' : 'e-mailem'}).`, checked: d.consents.confirmedByCustomer, required: true })
                : `${checkboxField({ name: 'truthful', label: 'Potwierdzam, że informacje w zgłoszeniu są prawdziwe.', checked: d.consents.truthful, required: true })}
            ${d.kind === 'RETURN' ? checkboxField({ name: 'withdrawal', label: `Oświadczam, że odstępuję od umowy sprzedaży wskazanych produktów (zamówienie ${esc(ctx.order.number)}).`, checked: d.consents.withdrawal, required: true }) : ''}`}
        </section><div data-submit-alert></div>`;
        },
        collect(form, d) {
            const v = formValues(form);
            d.consents = { truthful: v.truthful === 'on', withdrawal: v.withdrawal === 'on', confirmedByCustomer: v.confirmed === 'on' };
        },
        validate(d) {
            const e = [];
            if (Store.db.session?.role === 'AGENT') {
                if (!d.consents.confirmedByCustomer)
                    e.push({ field: 'confirmed', message: 'Potwierdź, że klient zweryfikował dane.' });
                return e;
            }
            if (!d.consents.truthful)
                e.push({ field: 'truthful', message: 'Potwierdź prawdziwość informacji.' });
            if (d.kind === 'RETURN' && !d.consents.withdrawal)
                e.push({ field: 'withdrawal', message: 'Zaznacz oświadczenie o odstąpieniu od umowy — bez niego nie możemy przyjąć zwrotu.' });
            return e;
        },
    },
];
function orderAside(order, d) {
    const v = draftValue(d);
    return `<aside class="order-aside"><details open><summary><strong>Zamówienie ${esc(order.number)}</strong></summary>
    <p class="small muted">Złożone ${fmtDate(order.placedAt)} · dostarczone ${fmtDate(order.deliveredAt ?? '')}</p>
    <ul class="aside-lines">${order.lines.map((l) => { const sel = d.items.find((i) => i.lineId === l.lineId); return `<li class="${sel ? 'sel' : ''}"><span class="thumb" aria-hidden="true">${l.emoji}</span><span>${esc(l.name)}<br><span class="small muted">${sel ? `zgłaszasz: ${sel.qty} szt.` : `${l.qty} × ${fmtMoney(l.price)}`}</span></span></li>`; }).join('')}</ul>
    ${d.items.length ? `<p class="aside-sum">Wartość zgłoszenia: <strong>${fmtMoney(v)}</strong></p>` : ''}
    ${d.kind ? `<p class="small muted">${KINDS[d.kind].icon} ${esc(KINDS[d.kind].label)} · termin do ${fmtDate(kindAvailability(order, d.kind).deadline)}</p>` : ''}</details></aside>`;
}
async function renderWizardStep(root, stepNo, q) {
    const s = Store.db.session;
    const orderParam = q.get('zamowienie');
    let draft = Store.db.draft;
    if (orderParam && draft && draft.data.orderId !== orderParam)
        draft = null;
    const orderId = orderParam ?? draft?.data.orderId ?? (s.role === 'AGENT' ? s.assisted?.orderId : s.orderId);
    if (!orderId) {
        navigate(s.role === 'AGENT' ? '/obsluga/nowe' : homeFor(s.role));
        return;
    }
    const furthest = draft ? draft.step : 1;
    if (stepNo > furthest) {
        navigate('/zgloszenie/' + furthest);
        return;
    }
    root.innerHTML = `<div class="container section">${skelCards(2)}</div>`;
    let order;
    try {
        order = await api.order(orderId);
    }
    catch (e) {
        if (!root.isConnected)
            return;
        if (e instanceof ApiError && e.status === 401) {
            showSessionExpired();
            return;
        }
        root.innerHTML = `<div class="container narrow section"><h1 class="sr-only">Błąd</h1>${errorState(e)}</div>`;
        $('[data-retry]', root)?.addEventListener('click', () => renderWizardStep(root, stepNo, q));
        return;
    }
    if (!root.isConnected)
        return;
    const d = draft ? clone(draft.data) : {
        orderId, kind: '', items: [], resolution: '', exchangeVariant: '', refundJustification: '', returnMethod: '', pickupPoint: '', store: '',
        courier: { street: order.address.street, zip: order.address.zip, city: order.address.city, date: '' }, refundAccount: '',
        contact: { email: order.email, phone: order.phone }, consents: { truthful: false, withdrawal: false, confirmedByCustomer: false },
    };
    const step = STEP_DEFS[stepNo - 1];
    const returnTo = q.get('powrot');
    let dirty = false;
    const assisted = s.role === 'AGENT' && s.assisted;
    root.innerHTML = `${screenTag(step.id, 'Kreator: ' + WIZ_STEPS[stepNo - 1])}
    <div class="wizard">
      ${assisted ? `<div class="assist-banner"><div class="container">🎧 Zgłoszenie w imieniu klienta: <strong>${esc(assisted.customerName)}</strong> · kanał: ${assisted.channel === 'PHONE' ? 'telefon' : assisted.channel === 'STORE' ? 'sklep stacjonarny' : 'e-mail'} · <a href="#/obsluga">Przerwij</a></div></div>` : ''}
      <div class="wiz-top"><div class="container">
        <div class="row-between"><p class="wiz-count">Krok ${stepNo} z ${WIZ_STEPS.length}</p><span class="small muted" data-saved aria-live="polite">${draft ? 'Zapisano ' + fmtDateTime(draft.updatedAt).split(', ')[1] : ''}</span></div>
        <ol class="stepper" aria-label="Kroki zgłoszenia">${WIZ_STEPS.map((t, i) => {
        const n = i + 1;
        const cls = n === stepNo ? 'current' : n <= furthest ? 'done' : '';
        const inner = `<span class="st-num">${cls === 'done' ? '✓' : n}</span><span class="st-label">${t}</span>`;
        return `<li class="${cls}" ${n === stepNo ? 'aria-current="step"' : ''}>${cls === 'done' ? `<a class="st" href="#/zgloszenie/${n}">${inner}</a>` : `<span class="st">${inner}</span>`}</li>`;
    }).join('')}</ol></div></div>
      <div class="container section wiz-grid">
        <form novalidate data-form class="wiz-form"><h1>${step.title}</h1><p class="muted">${step.intro(d)}</p>${step.render(d, { order, form: root, root, dirty: () => { } })}</form>
        ${orderAside(order, d)}
      </div>
      <div class="wiz-actions"><div class="container row-between">
        ${stepNo > 1 ? '<button type="button" class="btn btn-secondary" data-back>‹ Wstecz</button>' : `<a class="btn btn-ghost" href="#${s.role === 'AGENT' ? '/obsluga' : homeFor(s.role)}">Anuluj</a>`}
        <button type="button" class="btn btn-primary" data-next>${stepNo === 6 ? 'Wyślij zgłoszenie' : returnTo ? 'Zapisz i wróć do podsumowania' : 'Dalej ›'}</button></div></div>
    </div>`;
    const form = $('[data-form]', root);
    const markDirty = () => { dirty = true; Router.dirty = true; };
    const ctx = { order, form, root, dirty: markDirty };
    step.bind?.(d, ctx);
    bindCounters(form);
    applyConditions(form);
    form.addEventListener('change', () => { applyConditions(form); markDirty(); });
    form.addEventListener('input', markDirty);
    bindBlurValidation(form, () => { const t = clone(d); step.collect(form, t, ctx); return step.validate(t, ctx); });
    form.addEventListener('submit', (e) => e.preventDefault());
    Router.leaveGuard = async () => !dirty || confirmModal('Opuścić zgłoszenie?', 'Zmiany na tym kroku nie zostały zapisane. Dane z poprzednich kroków są bezpieczne.', 'Opuść bez zapisu', true);
    const savedLbl = $('[data-saved]', root);
    const save = async (nextStep) => {
        savedLbl.textContent = 'Zapisywanie…';
        try {
            if (!Store.db.draft || Store.db.draft.data.orderId !== order.id)
                await api.createDraft(order.id, d.kind);
            const r = await api.patchDraft(d, nextStep);
            savedLbl.textContent = 'Zapisano ' + fmtDateTime(r.updatedAt).split(', ')[1];
            dirty = false;
            Router.dirty = false;
            return true;
        }
        catch {
            savedLbl.textContent = 'Nie zapisano';
            $('.save-error', form)?.remove();
            form.insertAdjacentHTML('afterbegin', `<div class="save-error">${alertBox('error', 'Nie udało się zapisać', 'Sprawdź połączenie i spróbuj ponownie. Wprowadzone dane nie zostały utracone.')}</div>`);
            return false;
        }
    };
    $('[data-back]', root)?.addEventListener('click', () => {
        step.collect(form, d, ctx);
        if (Store.db.draft) {
            Store.db.draft.data = d;
            Store.save();
        }
        Router.leaveGuard = null;
        Router.dirty = false;
        navigate('/zgloszenie/' + (stepNo - 1));
    });
    $('[data-next]', root).addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        step.collect(form, d, ctx);
        $('.save-error', form)?.remove();
        const errs = step.validate(d, ctx);
        if (errs.length) {
            showErrors(form, errs);
            return;
        }
        clearErrors(form);
        if (stepNo === 6) {
            await submitClaim(btn, form, d, ctx, save);
            return;
        }
        const done = busy(btn, 'Zapisywanie…');
        const next = returnTo && stepNo !== 1 ? Number(returnTo) : stepNo + 1;
        const ok = await save(Math.max(next, stepNo + 1));
        done();
        if (!ok)
            return;
        Router.leaveGuard = null;
        navigate('/zgloszenie/' + next);
    });
}
async function submitClaim(btn, form, d, ctx, save) {
    const all = [];
    STEP_DEFS.slice(0, 5).forEach((s, i) => s.validate(d, ctx).forEach((e) => all.push({ field: `step-${i + 1}`, message: `Krok ${i + 1} (${WIZ_STEPS[i]}): ${e.message}` })));
    if (all.length) {
        showErrors(form, [], '');
        form.insertAdjacentHTML('afterbegin', `<div class="error-summary" role="alert" tabindex="-1"><strong>Uzupełnij brakujące dane</strong><ul>${all.map((e) => `<li><a href="#/zgloszenie/${e.field.split('-')[1]}?powrot=6">${esc(e.message)}</a></li>`).join('')}</ul></div>`);
        $('.error-summary', form).focus();
        return;
    }
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.innerHTML = `<div class="overlay-box" role="status">${spinner()}<strong>Wysyłamy zgłoszenie…</strong><span class="small muted">Nie zamykaj okna.</span></div>`;
    document.body.appendChild(overlay);
    const done = busy(btn, 'Wysyłanie…');
    const alertEl = $('[data-submit-alert]', form);
    alertEl.innerHTML = '';
    try {
        if (!(await save(6)))
            throw new ApiError(503, 'SAVE_FAILED', 'Nie udało się zapisać danych.');
        await api.submitDraft();
        Router.leaveGuard = null;
        Router.dirty = false;
        overlay.remove();
        navigate('/zgloszenie/potwierdzenie');
    }
    catch (e) {
        overlay.remove();
        done();
        $('.save-error', form)?.remove();
        if (e instanceof ApiError && e.status === 422)
            showErrors(form, e.fields.map((f) => ({ field: f.field, message: f.message })), 'Nie można wysłać zgłoszenia');
        else {
            alertEl.innerHTML = alertBox('error', 'Nie udało się wysłać zgłoszenia', 'Twoje dane są zapisane. Sprawdź połączenie i spróbuj ponownie.', '<button type="button" class="btn btn-secondary btn-sm" data-retry-submit>Spróbuj ponownie</button>');
            $('[data-retry-submit]', alertEl).addEventListener('click', () => btn.click());
            alertEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }
}
// ---------- Z-00 Zgłoszenie w imieniu klienta ----------
route({
    pattern: '/obsluga/nowe', id: 'Z-00', title: 'Nowe zgłoszenie w imieniu klienta', roles: ['AGENT'],
    render(root) {
        root.innerHTML = `${screenTag('Z-00', 'Wyszukaj zamówienie klienta')}<div class="container narrow section">
      <h1>Nowe zgłoszenie w imieniu klienta</h1><p class="muted">Klient dzwoni lub jest w sklepie? Znajdź zamówienie i przeprowadź go przez zgłoszenie.</p>
      <form class="card" novalidate data-form>
        ${radioGroup({ name: 'channel', label: 'Kanał kontaktu', required: true, value: 'PHONE', options: [['PHONE', 'Telefon'], ['STORE', 'Sklep stacjonarny'], ['EMAIL', 'E-mail']], inline: true })}
        <div class="search-row"><label class="sr-only" for="f-q">Szukaj</label><input id="f-q" name="q" type="search" placeholder="Nr zamówienia, e-mail, telefon lub nazwisko"><button class="btn btn-primary" type="submit">Szukaj</button></div>
        <div class="field-error small" data-q-err hidden></div>
      </form><div data-results aria-live="polite"></div>
      <p class="demo-hint">Demo: <code>Kowalska</code>, <code>TS-10455</code>, <code>kasia</code></p></div>`;
        const form = $('[data-form]', root);
        const res = $('[data-results]', root);
        form.addEventListener('submit', (ev) => {
            ev.preventDefault();
            const v = formValues(form);
            const err = $('[data-q-err]', form);
            if (v.q.length < 3) {
                err.hidden = false;
                err.textContent = 'Wpisz co najmniej 3 znaki.';
                return;
            }
            err.hidden = true;
            loadInto(res, {
                skeleton: skelCards(2),
                load: () => api.boSearchOrders(v.q),
                isEmpty: (os) => os.length === 0,
                empty: () => `<div class="card">${emptyState('🔍', 'Brak zamówień', `Nie znaleźliśmy zamówień dla „${esc(v.q)}”. Sprawdź numer z paragonu lub e-mail klienta.`)}</div>`,
                render: (os) => {
                    res.innerHTML = os.map((o) => `<div class="card order-card"><div class="row-between"><div><strong class="mono">${esc(o.number)}</strong> · ${esc(o.customerName)}<div class="small muted">${esc(o.email)} · ${esc(o.phone)} · ${fmtDate(o.placedAt)}</div></div>
            ${o.deliveredAt ? `<button class="btn btn-primary btn-sm" data-start="${o.id}">Rozpocznij zgłoszenie</button>` : '<span class="badge badge-info">W drodze</span>'}</div>
            <div class="small">${o.lines.map((l) => `${l.emoji} ${esc(l.name)}`).join(' · ')}</div></div>`).join('');
                    $$('[data-start]', res).forEach((b) => b.addEventListener('click', () => {
                        const o = os.find((x) => x.id === b.dataset.start);
                        Store.db.session.assisted = { orderId: o.id, channel: formValues(form).channel, customerName: o.customerName };
                        Store.db.draft = null;
                        Store.save();
                        navigate('/zgloszenie/1?zamowienie=' + o.id);
                    }));
                },
            });
        });
    },
});
// ---------- Z-07 Potwierdzenie ----------
route({
    pattern: '/zgloszenie/potwierdzenie', id: 'Z-07', title: 'Zgłoszenie wysłane', roles: ['CUSTOMER', 'AGENT'],
    render(root) {
        const c = Store.db.lastClaimId ? Store.claim(Store.db.lastClaimId) : undefined;
        if (!c) {
            root.innerHTML = `${screenTag('Z-07', 'Potwierdzenie')}<div class="container narrow section"><h1 class="sr-only">Potwierdzenie</h1>${emptyState('📭', 'Brak zgłoszenia do wyświetlenia', 'Potwierdzenie jest dostępne zaraz po wysłaniu zgłoszenia. Numer RMA znajdziesz też w e-mailu.', `<a class="btn btn-primary" href="#${homeFor(Store.db.session?.role)}">Wróć</a>`)}</div>`;
            return;
        }
        const agent = Store.db.session?.role === 'AGENT';
        const auto = c.timeline.some((t) => t.actor === 'System');
        const variant = c.status === 'RESOLVED' ? 'keep' : c.status === 'APPROVED' ? 'approved' : 'pending';
        root.innerHTML = `${screenTag('Z-07', 'Potwierdzenie')}<div class="container narrow section">
      <div class="card confirm"><div class="confirm-icon" aria-hidden="true">✓</div>
        <h1>${variant === 'approved' ? 'Zgłoszenie zaakceptowane' : variant === 'keep' ? 'Gotowe — sprawa rozwiązana' : 'Zgłoszenie wysłane'}</h1>
        <p>Numer zgłoszenia:</p><div class="claim-no"><span class="mono" data-no>${esc(c.number)}</span><button class="btn btn-ghost btn-sm" data-copy>Kopiuj</button></div>
        <p class="small muted">Potwierdzenie wysłaliśmy na ${esc(c.email)}.${auto ? ' Zgłoszenie rozpatrzone automatycznie na podstawie zasad sklepu.' : ''}</p></div>
      ${variant === 'approved' && c.label ? `<div class="card label-box">${qrCode(c.label.code)}<div><h2 class="h3">Nadaj paczkę</h2><p class="code mono">${esc(c.label.code)}</p>
        <p>${c.returnMethod === 'PARCEL_LOCKER' ? `Paczkomat ${esc(c.pickupPoint ?? '')} — zeskanuj kod na ekranie paczkomatu.` : c.returnMethod === 'COURIER' ? `Kurier odbierze paczkę ${fmtDate(c.courier?.date ?? '')}.` : 'Pokaż kod w sklepie.'} Kod ważny do <strong>${fmtDate(c.label.expiresAt)}</strong>.</p></div></div>` : ''}
      ${variant === 'keep' ? alertBox('success', 'Nie musisz odsyłać produktu', esc(c.timeline[c.timeline.length - 1].title) + (c.outcome?.amount ? ` — ${fmtMoney(c.outcome.amount)}.` : '.')) : ''}
      ${variant === 'pending' ? `<div class="card"><h2 class="h3">Co dalej?</h2><ol class="next-steps">
        <li><strong>${c.kind === 'COMPLAINT' ? `Do ${fmtDate(c.responseDueAt)}` : 'W ciągu 2 dni roboczych'}</strong> — rozpatrzymy zgłoszenie${c.priority === 'HIGH' ? ' (priorytetowo)' : ''}.</li>
        <li>Jeśli trzeba odesłać produkt — prześlemy kod QR e-mailem i pokażemy go w portalu.</li>
        <li>O każdej zmianie poinformujemy Cię e-mailem.</li></ol></div>` : ''}
      <div class="row-wrap">${agent
            ? `<a class="btn btn-primary" href="#/obsluga/zgloszenia/${c.id}">Otwórz kartę zgłoszenia</a><a class="btn btn-secondary" href="#/obsluga">Wróć do skrzynki</a>`
            : `<a class="btn btn-primary" href="#/zgloszenia/${c.id}">Przejdź do zgłoszenia</a>${Store.db.session?.email && !Store.db.session.orderId ? '<a class="btn btn-secondary" href="#/konto">Moje zamówienia</a>' : ''}`}</div></div>`;
        if (agent && Store.db.session) {
            Store.db.session.assisted = undefined;
            Store.save();
        }
        $('[data-copy]', root).addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(c.number);
                toast('Skopiowano numer zgłoszenia.', 'info');
            }
            catch {
                toast('Nie udało się skopiować — zaznacz numer ręcznie.', 'error');
            }
        });
    },
});
// ---------- Z-01 … Z-06 ----------
route({
    pattern: '/zgloszenie/:step', id: 'Z-0x', title: 'Zgłoszenie', roles: ['CUSTOMER', 'AGENT'],
    render(root, p, q) {
        const n = Number(p.step);
        if (!(n >= 1 && n <= 6)) {
            notFoundRoute.render(root, p, q);
            return;
        }
        document.title = `${WIZ_STEPS[n - 1]} · Zgłoszenie · ${SHOP.name}`;
        return renderWizardStep(root, n, q);
    },
});
// Panel obsługi: B-01 Skrzynka, B-02 Karta zgłoszenia
function sla(c) {
    if (!OPEN_STATUSES.includes(c.status))
        return { tone: 'neutral', label: '—' };
    if (c.status === 'AWAITING_CUSTOMER')
        return { tone: 'neutral', label: 'wstrzymane' };
    const left = daysBetween(todayISO(), c.responseDueAt);
    if (left < 0)
        return { tone: 'danger', label: `po terminie ${-left} d` };
    if (left < 2)
        return { tone: 'danger', label: left === 0 ? 'dziś' : 'jutro' };
    if (left < 5)
        return { tone: 'warn', label: `za ${left} dni` };
    return { tone: 'ok', label: `za ${left} dni` };
}
const BO_VIEWS = [['decide', 'Do decyzji'], ['waiting', 'Czeka na klienta'], ['warehouse', 'Do rozwiązania'], ['mine', 'Moje'], ['open', 'Wszystkie otwarte'], ['all', 'Wszystkie']];
// ---------- B-01 Skrzynka ----------
route({
    pattern: '/obsluga', id: 'B-01', title: 'Skrzynka zgłoszeń', roles: ['AGENT'],
    render(root, _p, q) {
        const f = { view: q.get('widok') || 'decide', kind: '', priority: '', team: '', q: '' };
        const me = Store.db.session.name;
        root.innerHTML = `${screenTag('B-01', 'Skrzynka zgłoszeń')}<div class="bo-page">
      <div class="page-head"><div><h1>Skrzynka zgłoszeń</h1><p class="muted">Posortowane wg priorytetu i terminu odpowiedzi.</p></div><a class="btn btn-primary" href="#/obsluga/nowe">＋ Nowe zgłoszenie</a></div>
      <div class="tabs" role="tablist" aria-label="Widoki">${BO_VIEWS.map(([k, l]) => `<button role="tab" data-view="${k}" aria-selected="${k === f.view}">${l} <span class="count neutral">${Store.db.claims.filter((c) => viewFilter(k, c, me)).length}</span></button>`).join('')}</div>
      <div class="toolbar">
        <div class="filters">
          <label class="inline-field">Typ <select data-f="kind"><option value="">Wszystkie</option>${Object.keys(KINDS).map((k) => `<option value="${k}">${KINDS[k].short}</option>`).join('')}</select></label>
          <label class="inline-field">Priorytet <select data-f="priority"><option value="">Każdy</option><option value="HIGH">Wysoki</option><option value="NORMAL">Normalny</option></select></label>
          <label class="inline-field">Zespół <select data-f="team"><option value="">Wszystkie</option>${TEAMS.map((t) => `<option>${t}</option>`).join('')}</select></label>
        </div>
        <div class="search"><label class="sr-only" for="bo-q">Szukaj</label><input id="bo-q" type="search" placeholder="RMA, zamówienie, e-mail, nazwisko…"></div>
      </div>
      <div class="bulk" data-bulk hidden><span data-bulk-n></span><button class="btn btn-secondary btn-sm" data-bulk-a="me">Przypisz do mnie</button><button class="btn btn-secondary btn-sm" data-bulk-a="high">Priorytet wysoki</button></div>
      <div data-list></div></div>`;
        const list = $('[data-list]', root);
        const selected = new Set();
        const updBulk = () => { const b = $('[data-bulk]', root); b.hidden = !selected.size; $('[data-bulk-n]', root).textContent = `Zaznaczono: ${selected.size}`; };
        const load = () => loadInto(list, {
            skeleton: skelTable(6),
            load: () => api.boClaims(f),
            isEmpty: (cs) => cs.length === 0,
            empty: () => `<div class="card">${f.q || f.kind || f.priority || f.team ? emptyState('🔍', 'Brak wyników dla filtrów', 'Zmień filtry lub frazę wyszukiwania.', '<button class="btn btn-secondary" data-clear>Wyczyść filtry</button>') : emptyState('🎉', 'Brak zgłoszeń w tym widoku', 'Wszystko obsłużone. Zajrzyj do innych widoków.')}</div>`,
            render: (cs) => {
                selected.clear();
                updBulk();
                list.innerHTML = `<div class="card table-wrap"><table class="table bo-table"><caption class="sr-only">Zgłoszenia</caption>
          <thead><tr><th scope="col"><input type="checkbox" data-all aria-label="Zaznacz wszystkie"></th><th scope="col">Zgłoszenie</th><th scope="col">Klient</th><th scope="col">Produkty</th><th scope="col" class="num">Wartość</th><th scope="col">Status</th><th scope="col">Odpowiedź</th><th scope="col">Opiekun</th></tr></thead>
          <tbody>${cs.map((c) => {
                    const t = sla(c);
                    return `<tr class="${c.priority === 'HIGH' ? 'row-high' : ''}">
            <td><input type="checkbox" data-sel="${c.id}" aria-label="Zaznacz ${esc(c.number)}"></td>
            <td data-label="Zgłoszenie"><a class="mono strong" href="#/obsluga/zgloszenia/${c.id}">${esc(c.number)}</a><div class="small">${kindTag(c.kind)} ${c.priority === 'HIGH' ? '<span class="tag tag-danger">Wysoki</span>' : ''} ${c.customerReplied && c.status === 'SUBMITTED' ? '<span class="tag tag-info">Odpowiedź klienta</span>' : ''} ${c.channel !== 'PORTAL' ? `<span class="tag">${c.channel === 'PHONE' ? '📞' : c.channel === 'STORE' ? '🏬' : '✉️'}</span>` : ''}</div></td>
            <td data-label="Klient">${esc(c.customerName)}<div class="small muted">${esc(c.orderNumber)}</div></td>
            <td data-label="Produkty">${c.items.map((i) => `<span title="${esc(i.name)}">${i.emoji}</span>`).join(' ')} <span class="small">${esc(c.items[0].name)}${c.items.length > 1 ? ` +${c.items.length - 1}` : ''}</span></td>
            <td data-label="Wartość" class="num">${fmtMoney(c.value)}</td>
            <td data-label="Status">${statusBadge(c.status)}</td>
            <td data-label="Odpowiedź"><span class="sla sla-${t.tone}">${t.label}</span></td>
            <td data-label="Opiekun">${c.assignee ? esc(c.assignee) : '<span class="muted">—</span>'}<div class="small muted">${esc(c.team)}</div></td></tr>`;
                }).join('')}</tbody></table></div>`;
                $$('[data-sel]', list).forEach((cb) => cb.addEventListener('change', () => { const i = cb; i.checked ? selected.add(i.dataset.sel) : selected.delete(i.dataset.sel); updBulk(); }));
                $('[data-all]', list).addEventListener('change', (e) => { const on = e.target.checked; $$('[data-sel]', list).forEach((cb) => { cb.checked = on; on ? selected.add(cb.dataset.sel) : selected.delete(cb.dataset.sel); }); updBulk(); });
            },
        }).then(() => $('[data-clear]', list)?.addEventListener('click', () => {
            f.kind = f.priority = f.team = f.q = '';
            $$('[data-f]', root).forEach((s) => (s.value = ''));
            $('#bo-q', root).value = '';
            load();
        }));
        $$('[data-view]', root).forEach((b) => b.addEventListener('click', () => {
            f.view = b.dataset.view;
            $$('[data-view]', root).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
            history.replaceState(null, '', '#/obsluga?widok=' + f.view);
            Router.prevHash = location.hash;
            load();
        }));
        $$('[data-f]', root).forEach((s) => s.addEventListener('change', () => { f[s.dataset.f] = s.value; load(); }));
        let deb;
        $('#bo-q', root).addEventListener('input', (e) => { clearTimeout(deb); deb = window.setTimeout(() => { const v = e.target.value.trim(); if (v.length === 1)
            return; f.q = v; load(); }, 300); });
        $$('[data-bulk-a]', root).forEach((b) => b.addEventListener('click', async () => {
            const d = busy(b, '…');
            try {
                await api.boBulk([...selected], b.dataset.bulkA === 'me' ? { assignee: me } : { priority: 'HIGH' });
                toast(`Zaktualizowano ${selected.size} zgłoszeń.`);
                load();
            }
            catch (e) {
                toast(e.message, 'error');
            }
            d();
        }));
        load();
    },
});
// ---------- B-02 Karta zgłoszenia ----------
route({
    pattern: '/obsluga/zgloszenia/:id', id: 'B-02', title: 'Karta zgłoszenia', roles: ['AGENT'],
    render(root, p) {
        root.innerHTML = `${screenTag('B-02', 'Karta zgłoszenia')}<div class="bo-page" data-body></div>`;
        const body = $('[data-body]', root);
        const load = () => loadInto(body, {
            skeleton: `<div aria-busy="true"><div class="skel skel-title" style="width:35%"></div><div class="grid-2-1">${skelCards(3)}${skelCards(2)}</div></div>`,
            load: () => api.boClaim(p.id),
            render: (c) => renderBoClaim(body, c, () => { load(); renderShell(); }),
        });
        load();
    },
});
function resolutionsFor(kind) {
    return kind === 'RETURN' ? ['REFUND', 'STORE_CREDIT', 'EXCHANGE'] : kind === 'COMPLAINT' ? ['REPLACEMENT', 'REPAIR', 'PRICE_REDUCTION', 'REFUND'] : kind === 'TRANSPORT' ? ['REPLACEMENT', 'REFUND'] : ['SPARE_PART', 'REFUND'];
}
function fillTpl(t, c) { return t.replace(/\{imie\}/g, c.customerName.split(' ')[0]).replace(/\{rma\}/g, c.number); }
function supplierCheck(c) {
    const sup = Store.supplier(c.items[0].supplierId);
    if (!sup)
        return { missing: ['Brak dostawcy dla produktu'] };
    const m = [];
    c.items.forEach((it) => {
        if (sup.requires.includes('SERIAL') && !it.serial)
            m.push('numer seryjny');
        if (sup.requires.includes('VIDEO') && !it.files.some((f) => isVideo(f.name, f.mime)))
            m.push('nagranie wideo');
        if (sup.requires.includes('PHOTO') && !it.files.some((f) => !isVideo(f.name, f.mime)))
            m.push('zdjęcia');
    });
    if (sup.requires.includes('INSPECTION') && c.inspection?.defectConfirmed !== 'yes')
        m.push('inspekcja z potwierdzoną wadą');
    return { sup, missing: Array.from(new Set(m)) };
}
function renderBoClaim(body, c, reload) {
    const order = Store.order(c.orderId);
    const history = Store.db.claims.filter((x) => x.email === c.email && x.id !== c.id);
    const sc = supplierCheck(c);
    const supClaim = c.supplierClaimId ? Store.db.supplierClaims.find((x) => x.id === c.supplierClaimId) : undefined;
    const t = sla(c);
    body.innerHTML = `
    <nav class="breadcrumbs" aria-label="Okruszki"><a href="#/obsluga">Skrzynka</a> › <span>${esc(c.number)}</span></nav>
    <div class="claim-top">
      <div><h1 class="h2"><span class="mono">${esc(c.number)}</span> ${statusBadge(c.status)}</h1>
        <p class="muted">${kindTag(c.kind)} · ${esc(c.customerName)} · zamówienie ${esc(c.orderNumber)} · zgłoszono ${fmtDateTime(c.createdAt)} · kanał: ${c.channel === 'PORTAL' ? 'portal' : c.channel === 'PHONE' ? 'telefon' : c.channel === 'STORE' ? 'sklep' : 'e-mail'}</p></div>
      <div class="claim-ctrl">
        <label class="inline-field">Opiekun <select data-patch="assignee"><option value="">—</option>${AGENTS.map((a) => `<option ${a === c.assignee ? 'selected' : ''}>${a}</option>`).join('')}</select></label>
        <label class="inline-field">Zespół <select data-patch="team">${TEAMS.map((x) => `<option ${x === c.team ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label class="inline-field">Priorytet <select data-patch="priority"><option value="NORMAL" ${c.priority === 'NORMAL' ? 'selected' : ''}>Normalny</option><option value="HIGH" ${c.priority === 'HIGH' ? 'selected' : ''}>Wysoki</option></select></label>
        <span class="sla sla-${t.tone}" title="Termin odpowiedzi: ${fmtDate(c.responseDueAt)}">⏰ ${t.label}</span>
      </div></div>
    <div class="grid-2-1">
      <div class="stack">
        <div data-reco></div>
        <div data-panel></div>
        <section class="card"><h2 class="h3">Produkty i dowody</h2>${c.items.map((i) => `<div class="item-block">
          <div class="item-row"><span class="thumb lg" aria-hidden="true">${i.emoji}</span><div class="item-main"><strong>${esc(i.name)}</strong> <span class="muted small">${esc(i.variant)} · ${esc(i.sku)}</span>
            <div class="small">${i.qty} × ${fmtMoney(i.price)} · ${esc(CATEGORIES[i.category])} · dostawca: ${esc(Store.supplier(i.supplierId)?.name ?? '—')}</div></div></div>
          <dl class="dl"><dt>Powód</dt><dd><strong>${esc(reasonLabel(c.kind, i.reason))}</strong></dd>${i.description ? `<dt>Opis klienta</dt><dd>${esc(i.description)}</dd>` : ''}
            ${i.detectedAt ? `<dt>Wykrycie wady</dt><dd>${fmtDate(i.detectedAt)} (${daysBetween(order.deliveredAt ?? i.detectedAt, i.detectedAt)} dni po dostawie)</dd>` : ''}
            ${i.serial ? `<dt>Nr seryjny</dt><dd class="mono">${esc(i.serial)}</dd>` : ''}${i.missingPart ? `<dt>Brakujący element</dt><dd>${esc(i.missingPart)}</dd>` : ''}</dl>
          ${i.files.length ? `<div class="gallery">${i.files.map((f) => `<button class="g-item" data-file="${esc(f.name)}" aria-label="Podgląd ${esc(f.name)}"><span aria-hidden="true">${isVideo(f.name, f.mime) ? '🎬' : i.emoji}</span><span class="g-name">${esc(f.name)}</span></button>`).join('')}</div>` : '<p class="muted small">Brak załączników.</p>'}
        </div>`).join('')}
        <dl class="dl top-gap"><dt>Rozwiązanie wybrane przez klienta</dt><dd>${RESOLUTIONS[c.resolution].icon} ${esc(RESOLUTIONS[c.resolution].label)}${c.exchangeVariant ? ` — ${esc(c.exchangeVariant)}` : ''}${c.refundAmount ? ` · ${fmtMoney(c.refundAmount)}` : ''}${c.resolutionNote ? `<div class="small muted">„${esc(c.resolutionNote)}”</div>` : ''}</dd>
          <dt>Wartość zgłoszenia</dt><dd>${fmtMoney(c.value)}</dd></dl></section>
        ${c.inspection ? `<section class="card"><h2 class="h3">Inspekcja magazynowa</h2><dl class="dl"><dt>Kiedy / kto</dt><dd>${fmtDateTime(c.inspection.at)} · ${esc(c.inspection.by)}</dd><dt>Stan / ocena</dt><dd>${{ NEW: 'Nowy', OPENED: 'Otwarty', USED: 'Używany', DAMAGED: 'Uszkodzony' }[c.inspection.condition]} · <strong>${c.inspection.grade}</strong> · ${c.inspection.complete ? 'kompletny' : '<span class="err">niekompletny</span>'}</dd>
          <dt>Wada</dt><dd>${c.inspection.defectConfirmed === 'yes' ? 'potwierdzona' : c.inspection.defectConfirmed === 'no' ? '<span class="err">niepotwierdzona</span>' : 'n/d'}</dd><dt>Dyspozycja</dt><dd>${{ RESTOCK: 'Na stan', OUTLET: 'Outlet', SUPPLIER: 'Do dostawcy', SCRAP: 'Utylizacja' }[c.inspection.disposition]}</dd>${c.inspection.notes ? `<dt>Notatka</dt><dd>${esc(c.inspection.notes)}</dd>` : ''}</dl></section>` : ''}
        <section class="card"><h2 class="h3">Korespondencja</h2><div class="thread" data-thread>${threadHtml(c.messages, 'AGENT')}</div>
          <form class="composer" novalidate data-msg>
            <div class="row-between"><label class="inline-field">Szablon <select data-tpl><option value="">—</option>${Store.db.templates.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select></label>
              <label class="toggle small"><input type="checkbox" name="internal"><span class="toggle-ui" aria-hidden="true"></span><span>Notatka wewnętrzna</span></label></div>
            ${textareaField({ name: 'body', label: 'Wiadomość', max: 2000, rows: 3 })}
            <div class="row-end"><button class="btn btn-secondary" type="submit">Wyślij</button></div></form></section>
      </div>
      <div class="stack">
        <section class="card"><h2 class="h3">Klient</h2><dl class="dl"><dt>Imię i nazwisko</dt><dd>${esc(c.customerName)}</dd><dt>Kontakt</dt><dd>${esc(c.email)}<br>${esc(c.phone)}</dd>
          <dt>Zamówienie</dt><dd>${esc(order.number)} · ${fmtDate(order.placedAt)}<br><span class="small muted">dostawa ${fmtDate(order.deliveredAt ?? '')} · ${order.paymentMethod === 'COD' ? 'pobranie' : order.paymentMethod === 'BLIK' ? 'BLIK' : 'karta'}</span></dd>
          <dt>Historia</dt><dd>${history.length} inne zgłoszenia${history.length >= 6 ? ' <span class="tag tag-warn">częste zwroty</span>' : ''}</dd></dl></section>
        <section class="card"><h2 class="h3">Zastosowane reguły</h2>${c.appliedRules.length ? `<ul class="plain">${c.appliedRules.map((r) => `<li>⚙️ ${esc(Store.db.rules.find((x) => x.id === r)?.name ?? r)}</li>`).join('')}</ul>` : '<p class="muted small">Żadna reguła nie zadziałała.</p>'}</section>
        <section class="card"><h2 class="h3">Odesłanie</h2><dl class="dl"><dt>Metoda</dt><dd>${esc(RETURN_METHODS[c.returnMethod])}${c.pickupPoint ? ' · ' + esc(c.pickupPoint) : ''}</dd>${c.label ? `<dt>Kod</dt><dd class="mono">${esc(c.label.code)}</dd>` : ''}${c.refundAccount ? `<dt>Rachunek</dt><dd class="mono small">${esc(fmtIban(c.refundAccount))}</dd>` : ''}</dl>
          ${c.status === 'APPROVED' && c.returnMethod !== 'NONE' ? '<button class="btn btn-ghost btn-sm" data-carrier>⚡ Symuluj: paczka nadana (webhook)</button>' : ''}</section>
        <section class="card"><h2 class="h3">Dostawca</h2>${sc.sup ? `<p><strong>${esc(sc.sup.name)}</strong><br><span class="small muted">gwarancja ${sc.sup.warrantyMonths} mies. · ${esc(sc.sup.contact)}</span></p>
          <ul class="checks-list">${sc.sup.requires.map((r) => { const lbl = { SERIAL: 'numer seryjny', VIDEO: 'nagranie wideo', PHOTO: 'zdjęcia', INSPECTION: 'inspekcja z potwierdzoną wadą' }[r]; const miss = sc.missing.includes(lbl); return `<li class="${miss ? 'miss' : 'ok'}">${miss ? '✗' : '✓'} ${lbl}</li>`; }).join('')}</ul>
          ${supClaim ? `<p class="small">W reklamacji <strong>${esc(supClaim.number)}</strong> · ${esc({ DRAFT: 'szkic', SENT: 'wysłana', ACCEPTED: 'uznana', REJECTED: 'odrzucona', CREDITED: 'zaksięgowana' }[supClaim.status])} · <a href="#/obsluga/dostawcy">otwórz</a></p>`
        : c.kind === 'COMPLAINT' || c.kind === 'TRANSPORT' ? `<button class="btn btn-secondary btn-sm" data-forward ${sc.missing.length ? 'disabled' : ''}>🏭 Przekaż do dostawcy</button>${sc.missing.length ? `<p class="small muted">Brakuje: ${sc.missing.map(esc).join(', ')}</p>` : ''}` : '<p class="small muted">Zwroty nie są przekazywane dostawcom.</p>'}` : '<p class="muted small">—</p>'}</section>
        <section class="card"><h2 class="h3">Oś czasu</h2>${timelineHtml(c.timeline)}</section>
      </div></div>`;
    // rekomendacja
    const recoBox = $('[data-reco]', body);
    const decidable = c.status === 'SUBMITTED' || c.status === 'AWAITING_CUSTOMER';
    if (decidable) {
        loadInto(recoBox, {
            skeleton: `<div class="card reco" aria-busy="true">${skelLines(3)}</div>`, compactError: true,
            load: () => api.boRecommendation(c.id),
            render: (r) => {
                recoBox.innerHTML = `<section class="card reco"><div class="row-between"><h2 class="h3">✨ Rekomendacja asystenta <span class="tag">makieta AI</span></h2><span class="conf">pewność ${Math.round(r.confidence * 100)}%</span></div>
          <p><strong>${r.action === 'REQUEST_INFO' ? 'Poproś o informacje' : `Zaakceptuj: ${esc(RESOLUTIONS[r.resolution].label)}`}</strong> — ${esc(r.rationale)}</p>
          <ul class="checks-list">${r.checks.map((x) => `<li class="${x.ok ? 'ok' : 'miss'}">${x.ok ? '✓' : '✗'} ${esc(x.text)}</li>`).join('')}</ul>
          <button class="btn btn-secondary btn-sm" data-apply>Zastosuj rekomendację</button></section>`;
                $('[data-apply]', recoBox).addEventListener('click', () => {
                    const tab = r.action === 'REQUEST_INFO' ? 'request' : 'approve';
                    $(`[data-dtab="${tab}"]`, body)?.click();
                    if (tab === 'approve') {
                        const sel = $('#f-res', body);
                        if (sel)
                            sel.value = r.resolution;
                    }
                    else {
                        ['VIDEO', 'SERIAL', 'PHOTO'].forEach((k) => { if (r.rationale.toLowerCase().includes({ VIDEO: 'wideo', SERIAL: 'seryjny', PHOTO: 'zdjęcia' }[k])) {
                            const cb = $(`input[name="req-${k}"]`, body);
                            if (cb)
                                cb.checked = true;
                        } });
                    }
                    $('[data-panel]', body).scrollIntoView({ behavior: 'smooth', block: 'start' });
                });
            },
        });
    }
    renderDecisionPanel($('[data-panel]', body), c, reload);
    // kontrolki nagłówka
    $$('[data-patch]', body).forEach((s) => s.addEventListener('change', async () => {
        try {
            await api.boPatch(c.id, { [s.dataset.patch]: s.value || undefined });
            toast('Zapisano.');
            reload();
        }
        catch (e) {
            toast(e.message, 'error');
        }
    }));
    // galeria
    $$('[data-file]', body).forEach((b) => b.addEventListener('click', () => openModal({
        title: b.dataset.file, wide: true, body: `<div class="lightbox"><span aria-hidden="true">${b.querySelector('span').textContent}</span><p class="muted small">Podgląd załącznika (makieta) — w systemie: pełnowymiarowe zdjęcie / odtwarzacz wideo, zoom, pobieranie.</p></div>`,
        actions: [{ label: 'Zamknij', kind: 'secondary', onClick: ({ close }) => close() }],
    })));
    // wiadomości
    const mf = $('[data-msg]', body);
    bindCounters(mf);
    $('[data-tpl]', mf).addEventListener('change', (e) => {
        const tpl = Store.db.templates.find((x) => x.id === e.target.value);
        if (tpl) {
            const ta = $('textarea', mf);
            ta.value = fillTpl(tpl.body, c);
            ta.dispatchEvent(new Event('input'));
        }
    });
    mf.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const v = formValues(mf);
        if (!v.body) {
            showErrors(mf, [{ field: 'body', message: 'Wpisz treść.' }], 'Nie można wysłać');
            return;
        }
        const d = busy($('button[type=submit]', mf), 'Wysyłanie…');
        try {
            await api.sendMessage(c.id, v.body, v.internal === 'on');
            toast(v.internal === 'on' ? 'Dodano notatkę.' : 'Wiadomość wysłana do klienta.');
            reload();
        }
        catch (e) {
            d();
            showErrors(mf, [{ field: 'body', message: e.message }], 'Błąd wysyłki');
        }
    });
    $('[data-carrier]', body)?.addEventListener('click', async () => { await api.boCarrierEvent(c.id); toast('Zdarzenie przewoźnika: paczka nadana.', 'info'); reload(); });
    $('[data-forward]', body)?.addEventListener('click', async (e) => {
        const d = busy(e.currentTarget, 'Przekazywanie…');
        try {
            const r = await api.boForwardSupplier(c.id);
            toast(`Dodano do reklamacji ${r.number} (szkic).`);
            reload();
        }
        catch (err) {
            d();
            toast(err.message, 'error');
        }
    });
}
function renderDecisionPanel(box, c, reload) {
    const tplBody = (id) => fillTpl(Store.db.templates.find((x) => x.id === id)?.body ?? '', c);
    if (c.status === 'SUBMITTED' || c.status === 'AWAITING_CUSTOMER') {
        const resOpts = resolutionsFor(c.kind).map((r) => [r, RESOLUTIONS[r].label]);
        box.innerHTML = `<section class="card decision-panel"><h2 class="h3">Decyzja</h2>
      ${c.status === 'AWAITING_CUSTOMER' ? alertBox('info', 'Czekamy na odpowiedź klienta', c.offer?.status === 'PENDING' ? `Wysłana propozycja: ${esc(RESOLUTIONS[c.offer.resolution].label)}${c.offer.amount ? ' ' + fmtMoney(c.offer.amount) : ''}.` : `Poproszono o: ${(c.requestedInfo ?? []).map((r) => esc(REQUEST_ITEMS.find((x) => x[0] === r)?.[1] ?? r)).join(', ')}.`) : ''}
      <div class="seg-tabs" role="tablist">${[['approve', '✓ Akceptuj'], ['request', '？ Poproś o informacje'], ['offer', '⇄ Zaproponuj inne'], ['reject', '✕ Odrzuć']].map(([k, l], i) => `<button type="button" role="tab" data-dtab="${k}" aria-selected="${i === 0}">${l}</button>`).join('')}</div>
      <form novalidate data-dform="approve">
        ${selectField({ name: 'res', label: 'Rozwiązanie', required: true, value: c.resolution, options: resOpts })}
        ${checkboxField({ name: 'keep', label: 'Klient zatrzymuje produkt (bez odsyłania)', checked: c.returnMethod === 'NONE' })}
        ${textareaField({ name: 'msg', label: 'Wiadomość do klienta', value: tplBody('t2'), max: 2000, rows: 3 })}
        <button class="btn btn-primary" type="submit">Zaakceptuj</button></form>
      <form novalidate data-dform="request" hidden>
        <fieldset class="field" data-field="req" tabindex="-1"><legend>Czego potrzebujesz? <span class="req">*</span></legend><div class="checks">${REQUEST_ITEMS.map(([k, l]) => `<label class="check"><input type="checkbox" name="req-${k}"><span>${l}</span></label>`).join('')}</div><div class="field-error" hidden></div></fieldset>
        ${textareaField({ name: 'msg', label: 'Wiadomość do klienta', required: true, value: tplBody('t1'), max: 2000, rows: 3 })}
        <button class="btn btn-primary" type="submit">Wyślij prośbę</button></form>
      <form novalidate data-dform="offer" hidden>
        <div class="grid-2">${selectField({ name: 'ores', label: 'Proponowane rozwiązanie', required: true, value: 'PRICE_REDUCTION', options: ['PRICE_REDUCTION', 'STORE_CREDIT', 'REFUND', 'REPLACEMENT', 'REPAIR'].map((r) => [r, RESOLUTIONS[r].label]) })}
        ${textField({ name: 'amount', label: 'Kwota (zł)', inputmode: 'decimal', hint: `Maks. ${fmtMoney(c.value)}`, value: String(Math.round(c.value * 0.15)) })}</div>
        ${textareaField({ name: 'text', label: 'Treść propozycji', required: true, value: tplBody('t3'), max: 1000, rows: 3 })}
        <button class="btn btn-primary" type="submit">Wyślij propozycję</button></form>
      <form novalidate data-dform="reject" hidden>
        ${textareaField({ name: 'msg', label: 'Uzasadnienie (widoczne dla klienta)', required: true, min: 30, value: '', max: 2000, rows: 4, hint: 'Wskaż podstawę (np. uszkodzenie mechaniczne, termin). Klient może odpowiedzieć.' })}
        <button type="button" class="link small" data-tpl-reject>Wstaw szablon „Odmowa — uszkodzenie mechaniczne”</button>
        <div class="row-end"><button class="btn btn-danger" type="submit">Odrzuć zgłoszenie</button></div></form>
      <div data-dalert></div></section>`;
        bindCounters(box);
        $$('[data-dtab]', box).forEach((b) => b.addEventListener('click', () => {
            $$('[data-dtab]', box).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
            $$('[data-dform]', box).forEach((f) => (f.hidden = f.dataset.dform !== b.dataset.dtab));
        }));
        $('[data-tpl-reject]', box).addEventListener('click', () => { const ta = $('[data-dform="reject"] textarea', box); ta.value = tplBody('t4'); ta.dispatchEvent(new Event('input')); });
        const submit = (kind, fn) => {
            const form = $(`[data-dform="${kind}"]`, box);
            form.addEventListener('submit', async (ev) => {
                ev.preventDefault();
                const v = formValues(form);
                const p = fn(v, form);
                if (!p)
                    return;
                const d = busy($('button[type=submit]', form), 'Zapisywanie…');
                try {
                    await p;
                    reload();
                }
                catch (e) {
                    d();
                    $('[data-dalert]', box).innerHTML = alertBox('error', 'Nie udało się zapisać decyzji', esc(e.message));
                }
            });
        };
        submit('approve', (v) => api.boDecision(c.id, { action: 'APPROVE', resolution: v.res, keepItem: v.keep === 'on', message: v.msg }).then(() => toast('Zgłoszenie zaakceptowane — klient otrzymał powiadomienie.')));
        submit('request', (v, form) => {
            const req = REQUEST_ITEMS.map(([k]) => k).filter((k) => v['req-' + k] === 'on');
            const e = [];
            if (!req.length)
                e.push({ field: 'req', message: 'Zaznacz, czego potrzebujesz od klienta.' });
            if (!v.msg)
                e.push({ field: 'msg', message: 'Napisz wiadomość do klienta.' });
            showErrors(form, e, 'Uzupełnij prośbę');
            if (e.length)
                return null;
            return api.boDecision(c.id, { action: 'REQUEST_INFO', requested: req, message: v.msg }).then(() => toast('Prośba wysłana — SLA wstrzymane do odpowiedzi klienta.'));
        });
        submit('offer', (v, form) => {
            const e = [];
            const needAmount = ['PRICE_REDUCTION', 'STORE_CREDIT', 'REFUND'].includes(v.ores);
            const amt = Number(v.amount.replace(',', '.'));
            if (needAmount && !V.money(v.amount))
                e.push({ field: 'amount', message: 'Podaj kwotę większą od zera.' });
            else if (needAmount && amt > c.value * (v.ores === 'STORE_CREDIT' ? 1.5 : 1))
                e.push({ field: 'amount', message: `Kwota nie może przekroczyć ${fmtMoney(c.value)}.` });
            if (v.text.trim().length < 10)
                e.push({ field: 'text', message: 'Opisz propozycję (min. 10 znaków).' });
            showErrors(form, e, 'Popraw propozycję');
            if (e.length)
                return null;
            return api.boDecision(c.id, { action: 'OFFER', offer: { resolution: v.ores, amount: needAmount ? amt : 0, text: v.text }, message: '' }).then(() => toast('Propozycja wysłana do klienta.'));
        });
        submit('reject', (v, form) => {
            if (v.msg.trim().length < 30) {
                showErrors(form, [{ field: 'msg', message: `Uzasadnienie musi mieć min. 30 znaków (teraz ${v.msg.trim().length}).` }], 'Popraw uzasadnienie');
                return null;
            }
            return confirmModal('Odrzucić zgłoszenie?', 'Klient otrzyma uzasadnienie i będzie mógł odpowiedzieć. Przy reklamacji odmowa musi wskazywać przyczynę.', 'Odrzuć', true)
                .then((ok) => ok ? api.boDecision(c.id, { action: 'REJECT', message: v.msg }).then(() => toast('Zgłoszenie odrzucone.', 'info')) : undefined);
        });
        return;
    }
    // Rozwiązanie
    const canResolve = c.status === 'RECEIVED' || c.status === 'IN_SERVICE' || (c.status === 'APPROVED' && c.returnMethod === 'NONE');
    if (canResolve) {
        const def = c.resolution === 'STORE_CREDIT' ? 'STORE_CREDIT' : c.resolution === 'REFUND' || c.resolution === 'PRICE_REDUCTION' ? 'REFUND' : c.resolution === 'REPAIR' ? 'REPAIR' : c.resolution === 'SPARE_PART' ? 'SPARE_PART' : 'REPLACEMENT';
        const actions = [['REFUND', '💸 Zwróć pieniądze'], ['STORE_CREDIT', '🎁 Wydaj bon'], ['REPLACEMENT', '📦 Wyślij zamiennik / wariant'], ...(c.kind === 'MISSING' ? [['SPARE_PART', '🧩 Wyślij brakującą część']] : []), ...(c.kind === 'COMPLAINT' && c.status !== 'IN_SERVICE' ? [['REPAIR', '🔧 Wyślij do serwisu']] : [])];
        box.innerHTML = `<section class="card decision-panel"><h2 class="h3">Wykonaj rozwiązanie</h2>
      ${c.status === 'IN_SERVICE' ? alertBox('info', 'Produkt w serwisie / u dostawcy', 'Po otrzymaniu wyniku naprawy zamknij sprawę wybranym rozwiązaniem.') : c.inspection ? alertBox(c.inspection.grade === 'C' && c.kind === 'RETURN' ? 'warning' : 'success', `Inspekcja: ocena ${c.inspection.grade}`, c.inspection.grade === 'C' && c.kind === 'RETURN' ? 'Produkt nosi ślady zużycia ponad zwykłe sprawdzenie — możesz pomniejszyć kwotę zwrotu (z uzasadnieniem).' : 'Produkt zgodny ze zgłoszeniem.') : ''}
      <form novalidate data-rform>
        ${radioGroup({ name: 'act', label: 'Akcja', required: true, value: def, options: actions })}
        <div class="cond" data-show-if="act=REFUND|STORE_CREDIT">${textField({ name: 'amount', label: 'Kwota (zł)', required: true, value: String((c.resolution === 'STORE_CREDIT' || c.resolution === 'REFUND') && c.refundAmount ? c.refundAmount : c.value), inputmode: 'decimal', cls: 'w-md', hint: `Wartość zgłoszenia ${fmtMoney(c.value)}. Powyżej 2000 zł — akceptacja kierownika.` })}</div>
        <div class="row-wrap"><button class="btn btn-primary" type="submit">Wykonaj</button></div><div data-ralert></div></form></section>`;
        const form = $('[data-rform]', box);
        applyConditions(form);
        form.addEventListener('change', () => applyConditions(form));
        form.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const v = formValues(form);
            const money = v.act === 'REFUND' || v.act === 'STORE_CREDIT';
            const amt = Number((v.amount ?? '').replace(',', '.'));
            if (money) {
                if (!V.money(v.amount)) {
                    showErrors(form, [{ field: 'amount', message: 'Podaj kwotę większą od zera.' }], 'Popraw kwotę');
                    return;
                }
                if (v.act === 'REFUND' && amt > c.value) {
                    showErrors(form, [{ field: 'amount', message: `Zwrot nie może przekroczyć wartości zgłoszenia (${fmtMoney(c.value)}).` }], 'Popraw kwotę');
                    return;
                }
                if (amt > 2000 && !(await confirmModal('Kwota powyżej limitu agenta', `Zwrot ${fmtMoney(amt)} wymaga akceptacji kierownika. W makiecie zakładamy, że jesteś zalogowany/-a jako kierownik.`, 'Zatwierdź jako kierownik')))
                    return;
            }
            clearErrors(form);
            const d = busy($('button[type=submit]', form), 'Wykonywanie…');
            try {
                await api.boResolve(c.id, v.act, money ? amt : undefined);
                toast(v.act === 'REPAIR' ? 'Przekazano do serwisu.' : 'Wykonano — klient otrzymał powiadomienie.');
                reload();
            }
            catch (e) {
                d();
                $('[data-ralert]', form).innerHTML = alertBox('error', 'Nie udało się wykonać akcji', esc(e.message), money ? '<div class="small">Bramka płatności niedostępna? Możesz wydać bon zamiast zwrotu.</div>' : '');
            }
        });
        return;
    }
    const info = {
        APPROVED: ['info', 'Czekamy na przesyłkę od klienta', `Kod ${c.label?.code ?? ''} ważny do ${fmtDate(c.label?.expiresAt ?? '')}. Po nadaniu status zmieni się automatycznie (webhook przewoźnika).`],
        IN_TRANSIT: ['info', 'Paczka w drodze do magazynu', 'Po dostarczeniu magazyn zeskanuje kod i wykona inspekcję (ekran Magazyn).'],
        RESOLVED: ['success', 'Rozwiązane', c.outcome ? `${{ REFUND: 'Zwrot pieniędzy', STORE_CREDIT: 'Bon', REPLACEMENT: 'Zamiennik', REPAIR: 'Naprawa', SPARE_PART: 'Część', PRICE_REDUCTION: 'Obniżenie ceny' }[c.outcome.type]}${c.outcome.amount ? ': ' + fmtMoney(c.outcome.amount) : ''}${c.outcome.ref ? ' · ' + c.outcome.ref : ''} · ${fmtDateTime(c.outcome.at)}` : ''],
        REJECTED: ['error', 'Odrzucone', c.rejectReason ?? ''],
        CANCELLED: ['info', 'Anulowane przez klienta', ''],
    };
    const x = info[c.status];
    box.innerHTML = x ? `${alertBox(x[0], x[1], esc(x[2]))}${c.status === 'IN_TRANSIT' ? '<a class="btn btn-secondary btn-sm" href="#/magazyn">Przejdź do magazynu</a>' : ''}` : '';
}
// Operacje: B-03 Magazyn, B-04 Reklamacje do dostawców, D-01 Portal dostawcy
const CONDITIONS = [['NEW', 'Nowy, nieużywany'], ['OPENED', 'Otwarty, nieużywany'], ['USED', 'Używany'], ['DAMAGED', 'Uszkodzony']];
const DISPOSITIONS = [['RESTOCK', 'Na stan (sprzedaż)'], ['OUTLET', 'Outlet'], ['SUPPLIER', 'Do dostawcy'], ['SCRAP', 'Utylizacja']];
const SC_STATUS = { DRAFT: ['Szkic', 'neutral'], SENT: ['Wysłana', 'info'], ACCEPTED: ['Uznana', 'ok'], REJECTED: ['Odrzucona', 'danger'], CREDITED: ['Zaksięgowana', 'ok'] };
// ---------- B-03 Magazyn ----------
route({
    pattern: '/magazyn', id: 'B-03', title: 'Przyjęcia magazynowe', roles: ['WAREHOUSE', 'AGENT'],
    render(root) {
        root.innerHTML = `${screenTag('B-03', 'Przyjęcia magazynowe i inspekcja')}<div class="bo-page">
      <div class="page-head"><div><h1>Przyjęcia zwrotów</h1><p class="muted">Zeskanuj kod z paczki (RMA lub numer nadania) — skaner działa jak klawiatura.</p></div></div>
      <form class="card scan-card" novalidate data-scan>
        <label for="scan" class="scan-label">Kod przesyłki</label>
        <div class="search-row"><input id="scan" name="code" class="scan-input" autocomplete="off" placeholder="RMA-2026-00874 lub 6620 2210 7781"><button class="btn btn-primary" type="submit">Szukaj</button></div>
        <div class="field-error" data-scan-err hidden></div>
        <p class="demo-hint">Demo: <code>RMA-2026-00874</code> (blender, w drodze) · <code>RMA-2026-00893</code> (pościel) · <code>6620 1145 9921</code></p></form>
      <div data-inspect></div>
      <div class="grid-2"><section><h2 class="h3">Oczekiwane przesyłki</h2><div data-expected></div></section><section><h2 class="h3">Przyjęte dziś</h2><div data-today></div></section></div></div>`;
        const scanForm = $('[data-scan]', root);
        const scanInput = $('#scan', root);
        const err = $('[data-scan-err]', root);
        const insp = $('[data-inspect]', root);
        scanInput.focus();
        const loadLists = () => loadInto($('[data-expected]', root), {
            skeleton: skelTable(3), compactError: true,
            load: () => api.inbound(),
            isEmpty: (d) => d.expected.length === 0,
            empty: () => `<div class="card">${emptyState('📭', 'Brak przesyłek w drodze', 'Nowe zwroty pojawią się tu po nadaniu przez klientów.')}</div>`,
            render: (d) => {
                $('[data-expected]', root).innerHTML = `<div class="card list-card">${d.expected.map((c) => `<div class="claim-row"><span class="cr-icon" aria-hidden="true">${c.items[0].emoji}</span><span class="cr-main"><span class="cr-title mono">${esc(c.number)}</span><span class="cr-sub">${c.items.map((i) => `${i.qty}× ${esc(i.name)}`).join(', ')} · ${esc(KINDS[c.kind].short)}</span></span><span class="cr-status">${statusBadge(c.status)}</span><button class="btn btn-secondary btn-sm" data-take="${esc(c.number)}">Przyjmij</button></div>`).join('')}</div>`;
                $('[data-today]', root).innerHTML = d.today.length ? `<div class="card list-card">${d.today.map((c) => `<div class="claim-row"><span class="cr-icon" aria-hidden="true">${c.items[0].emoji}</span><span class="cr-main"><span class="cr-title mono">${esc(c.number)}</span><span class="cr-sub">Ocena ${c.inspection.grade} · ${esc(DISPOSITIONS.find((x) => x[0] === c.inspection.disposition)[1])}</span></span><span class="small muted">${fmtDateTime(c.inspection.at).split(', ')[1]}</span></div>`).join('')}</div>` : `<div class="card card-quiet"><p class="muted">Dziś jeszcze nic nie przyjęto.</p></div>`;
                $$('[data-take]', root).forEach((b) => b.addEventListener('click', () => { scanInput.value = b.dataset.take; scanForm.requestSubmit(); }));
            },
        });
        scanForm.addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const code = scanInput.value.trim();
            if (!code) {
                err.hidden = false;
                err.textContent = 'Zeskanuj lub wpisz kod przesyłki.';
                return;
            }
            err.hidden = true;
            insp.innerHTML = `<div class="card">${spinner()} Szukamy przesyłki ${esc(code)}…</div>`;
            try {
                const c = await api.warehouseLookup(code);
                renderInspection(insp, c, () => { insp.innerHTML = ''; scanInput.value = ''; scanInput.focus(); loadLists(); });
            }
            catch (e) {
                insp.innerHTML = alertBox(e instanceof ApiError && e.status === 404 ? 'warning' : 'error', e instanceof ApiError && e.status === 404 ? 'Nie znaleziono przesyłki' : 'Nie można przyjąć', esc(e.message), e instanceof ApiError && e.status === 404 ? '<div class="small">Paczka bez kodu? Utwórz przyjęcie bez RMA i przekaż do obsługi (poza mockupem).</div>' : '');
                scanInput.select();
            }
        });
        loadLists();
    },
});
function renderInspection(box, c, done) {
    const expected = c.items.reduce((s, i) => s + i.qty, 0);
    const defect = c.kind === 'COMPLAINT' || c.kind === 'TRANSPORT';
    const files = [];
    box.innerHTML = `<section class="card inspect-card"><div class="row-between"><h2 class="h3">Inspekcja · <span class="mono">${esc(c.number)}</span></h2>${kindTag(c.kind)}</div>
    <div class="expected">${c.items.map((i) => `<div class="item-row"><span class="thumb lg" aria-hidden="true">${i.emoji}</span><div><strong>${i.qty}× ${esc(i.name)}</strong><div class="small muted">${esc(i.variant)} · ${esc(i.sku)}${i.serial ? ' · S/N ' + esc(i.serial) : ''}</div><div class="small">Zgłoszony powód: ${esc(reasonLabel(c.kind, i.reason))}${i.description ? ' — „' + esc(i.description) + '”' : ''}</div></div></div>`).join('')}</div>
    <form novalidate data-form>
      <div class="grid-2">${selectField({ name: 'qty', label: 'Przyjęta ilość', required: true, value: String(expected), options: Array.from({ length: expected + 1 }, (_, i) => [String(i), `${i} z ${expected}`]) })}
        ${checkboxField({ name: 'complete', label: 'Komplet (akcesoria, instrukcja)', checked: true })}</div>
      ${radioGroup({ name: 'condition', label: 'Stan produktu', required: true, value: '', options: CONDITIONS, inline: true })}
      ${radioGroup({ name: 'grade', label: 'Ocena', required: true, value: '', options: [['A', 'A — jak nowy'], ['B', 'B — drobne ślady'], ['C', 'C — uszkodzony / niesprzedawalny']], inline: true })}
      ${defect ? radioGroup({ name: 'defect', label: 'Czy wada zgłoszona przez klienta jest potwierdzona?', required: true, value: '', options: [['yes', 'Tak'], ['no', 'Nie']], inline: true }) : ''}
      ${radioGroup({ name: 'disposition', label: 'Dyspozycja', required: true, value: '', options: DISPOSITIONS, inline: true })}
      ${textareaField({ name: 'notes', label: 'Notatka', max: 500, rows: 2, hint: 'Wymagana, gdy ilość się nie zgadza lub produkt jest niekompletny.' })}
      <div class="field"><label>Zdjęcia z inspekcji <span class="opt">(opcjonalnie)</span></label>${uploaderHtml('insp', [], true)}</div>
      <div data-form-alert></div>
      <div class="row-wrap"><button class="btn btn-primary btn-lg" type="submit">Zatwierdź przyjęcie</button><button type="button" class="btn btn-ghost" data-cancel>Anuluj</button></div></form></section>`;
    const form = $('[data-form]', box);
    bindCounters(form);
    bindUploader(form, 'insp', files, c.id, () => { });
    $('[data-cancel]', box).addEventListener('click', done);
    form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const v = formValues(form);
        const e = [];
        if (!v.condition)
            e.push({ field: 'condition', message: 'Wybierz stan produktu.' });
        if (!v.grade)
            e.push({ field: 'grade', message: 'Wybierz ocenę A/B/C.' });
        if (defect && !v.defect)
            e.push({ field: 'defect', message: 'Zaznacz, czy wada jest potwierdzona.' });
        if (!v.disposition)
            e.push({ field: 'disposition', message: 'Wybierz dyspozycję towaru.' });
        if ((Number(v.qty) < expected || v.complete !== 'on') && v.notes.trim().length < 5)
            e.push({ field: 'notes', message: 'Opisz rozbieżność (ilość lub braki w komplecie).' });
        showErrors(form, e, 'Uzupełnij inspekcję');
        if (e.length)
            return;
        const d = busy($('button[type=submit]', form), 'Zapisywanie…');
        try {
            await api.inspect(c.id, { qtyReceived: Number(v.qty), complete: v.complete === 'on', condition: v.condition, grade: v.grade, defectConfirmed: (defect ? v.defect : 'na'), disposition: v.disposition, notes: v.notes });
            toast(`Przyjęto ${c.number}. Zgłoszenie trafiło do obsługi.`);
            done();
        }
        catch (err) {
            d();
            $('[data-form-alert]', form).innerHTML = alertBox('error', 'Nie udało się zapisać inspekcji', esc(err.message) + ' Dane formularza zostały zachowane.');
        }
    });
}
// ---------- B-04 Reklamacje do dostawców ----------
route({
    pattern: '/obsluga/dostawcy', id: 'B-04', title: 'Reklamacje do dostawców', roles: ['AGENT'],
    render(root) {
        root.innerHTML = `${screenTag('B-04', 'Reklamacje do dostawców')}<div class="bo-page">
      <div class="page-head"><div><h1>Reklamacje do dostawców</h1><p class="muted">Udokumentowane reklamacje przekazywane producentom — odzysk kosztów wadliwych produktów.</p></div></div>
      <div data-body></div></div>`;
        const bodyEl = $('[data-body]', root);
        const load = () => loadInto(bodyEl, {
            skeleton: `<div class="kpis">${skelCards(3)}</div>${skelTable(4)}`,
            load: () => api.supplierClaims(),
            isEmpty: (l) => l.length === 0,
            empty: () => `<div class="card">${emptyState('🏭', 'Brak reklamacji do dostawców', 'Przekaż reklamację z karty zgłoszenia — przycisk „Przekaż do dostawcy”.', '<a class="btn btn-secondary" href="#/obsluga">Przejdź do skrzynki</a>')}</div>`,
            render: (list) => {
                const rec = list.reduce((s, x) => s + (x.response?.decision === 'ACCEPT' ? x.response.creditAmount ?? 0 : 0), 0);
                const pend = list.filter((x) => x.status === 'SENT').reduce((s, x) => s + x.amount, 0);
                bodyEl.innerHTML = `<div class="kpis">
            <div class="kpi"><span class="kpi-label">Odzyskano</span><span class="kpi-value">${fmtMoney(rec)}</span></div>
            <div class="kpi"><span class="kpi-label">W rozpatrzeniu u dostawców</span><span class="kpi-value">${fmtMoney(pend)}</span></div>
            <div class="kpi"><span class="kpi-label">Szkice do wysłania</span><span class="kpi-value">${list.filter((x) => x.status === 'DRAFT').length}</span></div></div>
          <div class="card table-wrap"><table class="table bo-table"><caption class="sr-only">Reklamacje do dostawców</caption>
          <thead><tr><th scope="col">Numer</th><th scope="col">Dostawca</th><th scope="col">Pozycje</th><th scope="col" class="num">Wartość</th><th scope="col">Status</th><th scope="col">Wysłano</th><th scope="col" class="num">Uznano</th><th scope="col"></th></tr></thead>
          <tbody>${list.map((x) => `<tr><td data-label="Numer" class="mono">${esc(x.number)}</td><td data-label="Dostawca">${esc(Store.supplier(x.supplierId)?.name ?? '')}</td><td data-label="Pozycje">${x.claimIds.length || '—'}</td>
            <td data-label="Wartość" class="num">${fmtMoney(x.amount)}</td><td data-label="Status"><span class="badge badge-${SC_STATUS[x.status][1]}">${SC_STATUS[x.status][0]}</span></td>
            <td data-label="Wysłano">${x.sentAt ? fmtDate(x.sentAt) : '—'}</td><td data-label="Uznano" class="num">${x.response?.creditAmount ? fmtMoney(x.response.creditAmount) : '—'}</td>
            <td><button class="btn btn-secondary btn-sm" data-open="${x.id}">Szczegóły</button></td></tr>`).join('')}</tbody></table></div>`;
                $$('[data-open]', bodyEl).forEach((b) => b.addEventListener('click', () => openSupplierDrawer(list.find((x) => x.id === b.dataset.open), load)));
            },
        });
        load();
    },
});
function openSupplierDrawer(sc, reload) {
    const sup = Store.supplier(sc.supplierId);
    const claims = sc.claimIds.map((id) => Store.claim(id)).filter(Boolean);
    const checks = claims.map((c) => ({ c, ...supplierCheck(c) }));
    const blocked = checks.some((x) => x.missing.length);
    const m = openModal({
        title: `${sc.number} · ${sup.name}`, wide: true,
        body: `<dl class="dl"><dt>Warunki</dt><dd>Gwarancja ${sup.warrantyMonths} mies. · wymagane: ${sup.requires.map((r) => ({ SERIAL: 'nr seryjny', VIDEO: 'wideo', PHOTO: 'zdjęcia', INSPECTION: 'inspekcja' }[r])).join(', ')}</dd><dt>Kontakt</dt><dd>${esc(sup.contact)}</dd><dt>Status</dt><dd><span class="badge badge-${SC_STATUS[sc.status][1]}">${SC_STATUS[sc.status][0]}</span></dd>
        ${sc.response ? `<dt>Odpowiedź</dt><dd>${sc.response.decision === 'ACCEPT' ? `Uznano ${fmtMoney(sc.response.creditAmount ?? 0)} · nota ${esc(sc.response.creditNoteNo ?? '')}` : `Odrzucono: ${esc(sc.response.reason ?? '')}`}</dd>` : ''}</dl>
      ${claims.length ? `<h3 class="h4">Pozycje</h3><ul class="plain">${checks.map(({ c, missing }) => `<li class="sc-item"><a href="#/obsluga/zgloszenia/${c.id}" data-close-nav>${esc(c.number)}</a> · ${c.items.map((i) => esc(i.name)).join(', ')} · ${fmtMoney(c.value)}<br>${missing.length ? `<span class="err small">✗ brakuje: ${missing.map(esc).join(', ')}</span>` : '<span class="ok small">✓ komplet dowodów wg wytycznych</span>'}</li>`).join('')}</ul>` : '<p class="muted">Reklamacja historyczna (dane zbiorcze).</p>'}
      <div data-alert></div>`,
        actions: [
            { label: 'Zamknij', kind: 'secondary', onClick: ({ close }) => close() },
            ...(sc.status === 'DRAFT' ? [{ label: blocked ? 'Uzupełnij dowody, aby wysłać' : 'Wyślij do dostawcy', kind: 'primary', onClick: async ({ close, btn, el }) => {
                        if (blocked)
                            return;
                        const d = busy(btn, 'Wysyłanie…');
                        try {
                            await api.sendSupplierClaim(sc.id);
                            close();
                            toast(`Wysłano ${sc.number} do ${sup.name}.`);
                            reload();
                        }
                        catch (e) {
                            d();
                            $('[data-alert]', el).innerHTML = alertBox('error', 'Nie udało się wysłać', esc(e.message));
                        }
                    } }] : []),
            ...(sc.status === 'ACCEPTED' ? [{ label: 'Oznacz notę jako zaksięgowaną', kind: 'primary', onClick: async ({ close }) => { await api.markCredited(sc.id); close(); toast('Zaksięgowano.'); reload(); } }] : []),
        ],
    });
    if (sc.status === 'DRAFT' && blocked)
        m.el.querySelector('.modal-foot .btn-primary').disabled = true;
    $$('[data-close-nav]', m.el).forEach((a) => a.addEventListener('click', () => m.close()));
}
// ---------- D-01 Portal dostawcy ----------
route({
    pattern: '/dostawca', id: 'D-01', title: 'Portal dostawcy', roles: ['SUPPLIER'],
    render(root) {
        const sup = Store.supplier(Store.db.session.supplierId);
        root.innerHTML = `${screenTag('D-01', 'Portal dostawcy')}<div class="container section">
      <div class="page-head"><div><h1>Reklamacje od ${SHOP.name}</h1><p class="muted">${esc(sup.name)} · warunki: gwarancja ${sup.warrantyMonths} mies.</p></div></div>
      <div data-list></div><div data-detail></div></div>`;
        const list = $('[data-list]', root);
        const detail = $('[data-detail]', root);
        const load = () => loadInto(list, {
            skeleton: skelTable(3),
            load: () => api.supPortalClaims(),
            isEmpty: (l) => l.length === 0,
            empty: () => `<div class="card">${emptyState('📭', 'Brak reklamacji do rozpatrzenia', `Gdy ${SHOP.name} przekaże reklamację, pojawi się tutaj wraz z dowodami.`)}</div>`,
            render: (l) => {
                list.innerHTML = `<div class="card table-wrap"><table class="table bo-table"><caption class="sr-only">Reklamacje</caption><thead><tr><th scope="col">Numer</th><th scope="col">Otrzymano</th><th scope="col">Pozycje</th><th scope="col" class="num">Wartość</th><th scope="col">Status</th><th scope="col"></th></tr></thead>
          <tbody>${l.map((x) => `<tr><td data-label="Numer" class="mono">${esc(x.number)}</td><td data-label="Otrzymano">${fmtDate(x.sentAt ?? x.createdAt)}</td><td data-label="Pozycje">${x.claimIds.length}</td><td data-label="Wartość" class="num">${fmtMoney(x.amount)}</td>
            <td data-label="Status"><span class="badge badge-${SC_STATUS[x.status][1]}">${x.status === 'SENT' ? 'Do rozpatrzenia' : SC_STATUS[x.status][0]}</span></td><td><button class="btn btn-secondary btn-sm" data-open="${x.id}">${x.status === 'SENT' ? 'Rozpatrz' : 'Pokaż'}</button></td></tr>`).join('')}</tbody></table></div>`;
                $$('[data-open]', list).forEach((b) => b.addEventListener('click', () => drawSupDetail(detail, l.find((x) => x.id === b.dataset.open), () => { load(); })));
                const first = l.find((x) => x.status === 'SENT');
                if (first && !detail.innerHTML)
                    drawSupDetail(detail, first, load);
            },
        });
        load();
    },
});
function drawSupDetail(box, sc, reload) {
    const claims = sc.claimIds.map((id) => Store.claim(id)).filter(Boolean);
    box.innerHTML = `<section class="card top-gap"><div class="row-between"><h2 class="h3">${esc(sc.number)}</h2><span class="badge badge-${SC_STATUS[sc.status][1]}">${SC_STATUS[sc.status][0]}</span></div>
    ${claims.map((c) => `<div class="item-block">${c.items.map((i) => `<div class="item-row"><span class="thumb lg" aria-hidden="true">${i.emoji}</span><div class="item-main"><strong>${esc(i.name)}</strong> <span class="small muted">${esc(i.sku)}</span>
      <dl class="dl"><dt>Wada</dt><dd>${esc(reasonLabel(c.kind, i.reason))} — ${esc(i.description)}</dd><dt>Nr seryjny</dt><dd class="mono">${esc(i.serial || '—')}</dd><dt>Data sprzedaży</dt><dd>${fmtDate(Store.order(c.orderId)?.deliveredAt ?? '')}</dd><dt>Wykrycie wady</dt><dd>${fmtDate(i.detectedAt)}</dd>
      ${c.inspection ? `<dt>Inspekcja sklepu</dt><dd>${c.inspection.defectConfirmed === 'yes' ? 'wada potwierdzona' : 'n/d'} · ocena ${c.inspection.grade} · ${esc(c.inspection.notes)}</dd>` : ''}
      <dt>Dowody</dt><dd><div class="file-chips">${i.files.map((f) => `<span class="chip">${fileIcon(f)} ${esc(f.name)}</span>`).join('')}<span class="chip">📄 dowód zakupu ${esc(c.orderNumber)}.pdf</span></div></dd></dl></div></div>`).join('')}</div>`).join('')}
    ${sc.status === 'SENT' ? `<form novalidate data-form><h3 class="h4">Odpowiedź</h3>
      ${radioGroup({ name: 'decision', label: 'Decyzja', required: true, value: '', options: [['ACCEPT', 'Uznaję reklamację'], ['REJECT', 'Odrzucam']], inline: true })}
      <div class="cond" data-show-if="decision=ACCEPT"><div class="grid-2">${textField({ name: 'amount', label: 'Kwota noty kredytowej (zł)', required: true, value: String(sc.amount), inputmode: 'decimal', hint: `Maks. ${fmtMoney(sc.amount)}` })}${textField({ name: 'note', label: 'Numer noty', required: true, placeholder: 'np. NK/2026/0042' })}</div></div>
      <div class="cond" data-show-if="decision=REJECT">${textareaField({ name: 'reason', label: 'Uzasadnienie', required: true, min: 30, max: 1000, rows: 3 })}</div>
      <div data-alert></div><button class="btn btn-primary" type="submit">Wyślij odpowiedź</button></form>`
        : sc.response ? alertBox(sc.response.decision === 'ACCEPT' ? 'success' : 'info', sc.response.decision === 'ACCEPT' ? `Uznano: ${fmtMoney(sc.response.creditAmount ?? 0)}` : 'Odrzucono', esc(sc.response.creditNoteNo ?? sc.response.reason ?? '')) : ''}</section>`;
    const form = $('[data-form]', box);
    if (!form)
        return;
    bindCounters(form);
    applyConditions(form);
    form.addEventListener('change', () => applyConditions(form));
    form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const v = formValues(form);
        const e = [];
        if (!v.decision)
            e.push({ field: 'decision', message: 'Wybierz decyzję.' });
        if (v.decision === 'ACCEPT') {
            if (!V.money(v.amount))
                e.push({ field: 'amount', message: 'Podaj kwotę większą od zera.' });
            else if (Number(v.amount.replace(',', '.')) > sc.amount)
                e.push({ field: 'amount', message: `Kwota nie może przekroczyć ${fmtMoney(sc.amount)}.` });
            if (v.note.trim().length < 3 || v.note.trim().length > 30)
                e.push({ field: 'note', message: 'Podaj numer noty (3–30 znaków).' });
        }
        if (v.decision === 'REJECT' && v.reason.trim().length < 30)
            e.push({ field: 'reason', message: `Uzasadnienie musi mieć min. 30 znaków (teraz ${v.reason.trim().length}).` });
        showErrors(form, e, 'Uzupełnij odpowiedź');
        if (e.length)
            return;
        const d = busy($('button[type=submit]', form), 'Wysyłanie…');
        try {
            await api.supRespond(sc.id, v.decision === 'ACCEPT' ? { decision: 'ACCEPT', creditAmount: Number(v.amount.replace(',', '.')), creditNoteNo: v.note } : { decision: 'REJECT', reason: v.reason });
            toast('Odpowiedź wysłana do sklepu.');
            box.innerHTML = '';
            reload();
        }
        catch (err) {
            d();
            $('[data-alert]', form).innerHTML = alertBox('error', 'Nie udało się wysłać', esc(err.message));
        }
    });
}
// Konfiguracja i analityka: B-05 Reguły, B-06 Analityka, B-07 Ustawienia
const ACTIONS = {
    AUTO_APPROVE: 'zaakceptuj automatycznie i wygeneruj etykietę',
    KEEP_ITEM: 'zaakceptuj bez odsyłania produktu (keep it)',
    HIGH_PRIORITY: 'ustaw priorytet wysoki',
    ASSIGN_TEAM: 'przypisz do zespołu',
    REQUIRE_VIDEO: 'wymagaj nagrania wideo w formularzu',
};
function ruleSentence(r) {
    const c = r.conditions;
    const parts = [];
    if (c.kinds.length)
        parts.push(`typ: <strong>${c.kinds.map((k) => KINDS[k].short).join(' lub ')}</strong>`);
    if (c.categories.length)
        parts.push(`kategoria: <strong>${c.categories.map((k) => CATEGORIES[k]).join(' lub ')}</strong>`);
    if (c.reasons.length)
        parts.push(`powód: <strong>${c.reasons.map((x) => esc(allReasons().find((y) => y[0] === x)?.[1] ?? x)).join(' lub ')}</strong>`);
    if (c.minValue !== null)
        parts.push(`wartość ≥ <strong>${fmtMoney(c.minValue)}</strong>`);
    if (c.maxValue !== null)
        parts.push(`wartość ≤ <strong>${fmtMoney(c.maxValue)}</strong>`);
    if (c.maxDays !== null)
        parts.push(`≤ <strong>${c.maxDays} dni</strong> od dostawy`);
    return `<span class="kw">JEŚLI</span> ${parts.join(' <span class="kw">i</span> ') || 'każde zgłoszenie'} <span class="kw">TO</span> ${ACTIONS[r.action]}${r.action === 'ASSIGN_TEAM' ? ` <strong>${esc(r.param)}</strong>` : ''}`;
}
function allReasons() {
    const seen = new Set();
    const out = [];
    Object.keys(REASONS).forEach((k) => REASONS[k].forEach(([c, l]) => { if (!seen.has(c)) {
        seen.add(c);
        out.push([c, l]);
    } }));
    return out;
}
// ---------- B-05 Reguły ----------
route({
    pattern: '/obsluga/reguly', id: 'B-05', title: 'Reguły automatyzacji', roles: ['AGENT'],
    render(root) {
        root.innerHTML = `${screenTag('B-05', 'Reguły automatyzacji')}<div class="bo-page">
      <div class="page-head"><div><h1>Reguły automatyzacji</h1><p class="muted">Reguły są sprawdzane przy każdym nowym zgłoszeniu, w podanej kolejności. Pasujące akcje są stosowane łącznie.</p></div>
        <button class="btn btn-primary" data-new>＋ Nowa reguła</button></div><div data-list></div></div>`;
        const list = $('[data-list]', root);
        const load = () => loadInto(list, {
            skeleton: skelCards(4),
            load: () => api.rules(),
            isEmpty: (rs) => rs.length === 0,
            empty: () => `<div class="card">${emptyState('⚙️', 'Nie masz jeszcze reguł', 'Zacznij od szablonu, np. automatycznej akceptacji zwrotów tanich produktów.', '<button class="btn btn-primary" data-template>Użyj szablonu „Szybki zwrot”</button>')}</div>`,
            render: (rs) => {
                list.innerHTML = rs.map((r, i) => `<article class="card rule ${r.enabled ? '' : 'off'}">
          <div class="rule-order"><button class="icon-btn" data-up="${r.id}" ${i === 0 ? 'disabled' : ''} aria-label="W górę">▲</button><span>${i + 1}</span><button class="icon-btn" data-down="${r.id}" ${i === rs.length - 1 ? 'disabled' : ''} aria-label="W dół">▼</button></div>
          <div class="rule-main"><div class="row-between"><h2 class="h4">${esc(r.name)}</h2>
            <label class="toggle"><input type="checkbox" data-toggle="${r.id}" ${r.enabled ? 'checked' : ''}><span class="toggle-ui" aria-hidden="true"></span><span class="small">${r.enabled ? 'Włączona' : 'Wyłączona'}</span></label></div>
            <p class="rule-text">${ruleSentence(r)}</p>
            <div class="row-between"><span class="small muted">Trafienia (30 dni): <strong>${r.hits}</strong></span><span><button class="btn btn-ghost btn-sm" data-edit="${r.id}">Edytuj</button><button class="btn btn-ghost btn-sm" data-del="${r.id}">Usuń</button></span></div></div></article>`).join('');
                $$('[data-toggle]', list).forEach((t) => t.addEventListener('change', async () => {
                    try {
                        await api.toggleRule(t.dataset.toggle, t.checked);
                        toast(t.checked ? 'Reguła włączona.' : 'Reguła wyłączona.', 'info');
                        load();
                    }
                    catch (e) {
                        toast(e.message, 'error');
                        load();
                    }
                }));
                $$('[data-up],[data-down]', list).forEach((b) => b.addEventListener('click', async () => { await api.moveRule(b.dataset.up ?? b.dataset.down, b.dataset.up ? -1 : 1); load(); }));
                $$('[data-edit]', list).forEach((b) => b.addEventListener('click', () => ruleEditor(rs.find((r) => r.id === b.dataset.edit), load)));
                $$('[data-del]', list).forEach((b) => b.addEventListener('click', async () => {
                    const r = rs.find((x) => x.id === b.dataset.del);
                    if (await confirmModal('Usunąć regułę?', `„${esc(r.name)}” przestanie działać dla nowych zgłoszeń. Zgłoszenia już obsłużone nie zmienią się.`, 'Usuń', true)) {
                        await api.deleteRule(r.id);
                        toast('Usunięto regułę.');
                        load();
                    }
                }));
            },
        }).then(() => $('[data-template]', list)?.addEventListener('click', () => ruleEditor({ id: uid('R'), name: 'Szybki zwrot drobnych produktów', enabled: true, order: 1, conditions: { kinds: ['RETURN'], categories: [], reasons: [], minValue: null, maxValue: 150, maxDays: null }, action: 'AUTO_APPROVE', param: '', hits: 0 }, load)));
        $('[data-new]', root).addEventListener('click', () => ruleEditor({ id: uid('R'), name: '', enabled: true, order: 99, conditions: { kinds: [], categories: [], reasons: [], minValue: null, maxValue: null, maxDays: null }, action: 'AUTO_APPROVE', param: '', hits: 0 }, load));
        load();
    },
});
function ruleEditor(r, reload) {
    const isNew = !Store.db.rules.some((x) => x.id === r.id);
    const chips = (name, opts, sel) => `<div class="chips">${opts.map(([v, l]) => `<label class="chip-check"><input type="checkbox" name="${name}" value="${v}" ${sel.includes(v) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
    const read = (el) => {
        const vals = (n) => $$(`input[name="${n}"]:checked`, el).map((i) => i.value);
        const num = (n) => { const x = $(`[name="${n}"]`, el).value.trim(); return x === '' ? null : Number(x.replace(',', '.')); };
        return { ...r, name: $('[name=name]', el).value.trim(), conditions: { kinds: vals('kinds'), categories: vals('cats'), reasons: vals('reasons'), minValue: num('minValue'), maxValue: num('maxValue'), maxDays: num('maxDays') }, action: $('[name=action]', el).value, param: $('[name=param]', el).value };
    };
    const validate = (x, el) => {
        const e = [];
        if (x.name.length < 3 || x.name.length > 60)
            e.push({ field: 'name', message: 'Nazwa: 3–60 znaków.' });
        const c = x.conditions;
        if (!c.kinds.length && !c.categories.length && !c.reasons.length && c.minValue === null && c.maxValue === null && c.maxDays === null)
            e.push({ field: 'conds', message: 'Dodaj co najmniej jeden warunek.' });
        for (const k of ['minValue', 'maxValue', 'maxDays']) {
            const v = c[k];
            if (v !== null && (isNaN(v) || v < 0))
                e.push({ field: k, message: 'Podaj liczbę ≥ 0.' });
        }
        if (c.minValue !== null && c.maxValue !== null && c.minValue > c.maxValue)
            e.push({ field: 'maxValue', message: 'Wartość „do” musi być ≥ „od”.' });
        if (x.action === 'ASSIGN_TEAM' && !x.param)
            e.push({ field: 'param', message: 'Wybierz zespół.' });
        const warn = $('[data-warn]', el);
        warn.innerHTML = (x.action === 'AUTO_APPROVE' || x.action === 'KEEP_ITEM') && c.maxValue === null ? alertBox('warning', 'Brak limitu wartości', 'Automatyczna akceptacja bez limitu kwoty może zatwierdzać drogie zgłoszenia. Rozważ warunek „wartość ≤”.') : '';
        return e;
    };
    openModal({
        title: isNew ? 'Nowa reguła' : `Edycja: ${r.name}`, wide: true,
        body: `<form novalidate data-form>
      ${textField({ name: 'name', label: 'Nazwa reguły', required: true, value: r.name, maxlength: 60 })}
      <fieldset class="field rule-box" data-field="conds" tabindex="-1"><legend><span class="kw">JEŚLI</span> (wszystkie warunki muszą być spełnione)</legend>
        <div class="field"><label>Typ zgłoszenia</label>${chips('kinds', Object.keys(KINDS).map((k) => [k, KINDS[k].short]), r.conditions.kinds)}</div>
        <div class="field"><label>Kategoria produktu</label>${chips('cats', Object.keys(CATEGORIES).map((k) => [k, CATEGORIES[k]]), r.conditions.categories)}</div>
        <details ${r.conditions.reasons.length ? 'open' : ''}><summary>Powód zgłoszenia</summary>${chips('reasons', allReasons(), r.conditions.reasons)}</details>
        <div class="grid-3">${textField({ name: 'minValue', label: 'Wartość od (zł)', value: r.conditions.minValue?.toString() ?? '', inputmode: 'decimal' })}${textField({ name: 'maxValue', label: 'Wartość do (zł)', value: r.conditions.maxValue?.toString() ?? '', inputmode: 'decimal' })}${textField({ name: 'maxDays', label: 'Maks. dni od dostawy', value: r.conditions.maxDays?.toString() ?? '', inputmode: 'numeric' })}</div>
        <div class="field-error" hidden></div></fieldset>
      <fieldset class="field rule-box"><legend><span class="kw">TO</span></legend>
        <div class="grid-2">${selectField({ name: 'action', label: 'Akcja', required: true, value: r.action, options: Object.entries(ACTIONS) })}
        <div class="cond" data-show-if="action=ASSIGN_TEAM">${selectField({ name: 'param', label: 'Zespół', required: true, value: r.param, options: TEAMS.map((t) => [t, t]) })}</div></div></fieldset>
      <div data-warn></div><div data-sim aria-live="polite"></div><div data-alert></div></form>`,
        onOpen: (el) => { const f = $('[data-form]', el); applyConditions(f); f.addEventListener('change', () => { applyConditions(f); validate(read(el), el); }); validate(read(el), el); },
        actions: [
            { label: 'Anuluj', kind: 'ghost', onClick: ({ close }) => close() },
            { label: 'Symuluj', kind: 'secondary', onClick: async ({ el, btn }) => {
                    const x = read(el);
                    const form = $('[data-form]', el);
                    const errs = validate(x, el).filter((e) => e.field !== 'name');
                    showErrors(form, errs, 'Popraw warunki');
                    if (errs.length)
                        return;
                    const d = busy(btn, 'Liczenie…');
                    const sim = $('[data-sim]', el);
                    try {
                        const s = await api.simulateRule(x);
                        sim.innerHTML = alertBox('info', `Pasowałoby ${s.matched} z ${Store.db.claims.length} bieżących zgłoszeń (≈ ${s.estimated90d} w ostatnich 90 dniach)`, s.sample.length ? s.sample.map(esc).join('<br>') : 'Brak przykładów.');
                    }
                    catch (e) {
                        sim.innerHTML = alertBox('error', 'Symulacja nieudana', esc(e.message));
                    }
                    d();
                } },
            { label: 'Zapisz regułę', kind: 'primary', onClick: async ({ el, btn, close }) => {
                    const x = read(el);
                    const form = $('[data-form]', el);
                    const errs = validate(x, el);
                    showErrors(form, errs, 'Popraw regułę');
                    if (errs.length)
                        return;
                    const d = busy(btn, 'Zapisywanie…');
                    try {
                        await api.saveRule(x);
                        close();
                        toast(isNew ? 'Dodano regułę — działa dla nowych zgłoszeń.' : 'Zapisano regułę.');
                        reload();
                    }
                    catch (e) {
                        d();
                        if (e instanceof ApiError && e.fields.length)
                            showErrors(form, e.fields, 'Popraw regułę');
                        else
                            $('[data-alert]', el).innerHTML = alertBox('error', 'Nie udało się zapisać', esc(e.message));
                    }
                } },
        ],
    });
}
// ---------- B-06 Analityka ----------
function barChart(title, data, opts = {}) {
    const id = uid('ch');
    const max = Math.max(1, ...data.map((d) => d[1]));
    const top = data.reduce((a, b) => (b[1] > a[1] ? b : a), data[0] ?? ['', 0]);
    const unit = opts.unit ?? 'zgł.';
    const table = `<table class="table chart-table" hidden data-table="${id}"><caption class="sr-only">${esc(title)}</caption><thead><tr><th scope="col">Kategoria</th><th scope="col" class="num">Wartość</th></tr></thead><tbody>${data.map(([l, v]) => `<tr><td>${esc(l)}</td><td class="num">${v}</td></tr>`).join('')}</tbody></table>`;
    const plot = opts.vertical
        ? `<div class="vbars" role="img" aria-label="${esc(title)}: ${data.map(([l, v]) => `${l} ${v}`).join(', ')}">${data.map(([l, v]) => `<div class="vbar" data-tip="${esc(l)}: ${v} ${unit}"><div class="vbar-track"><div class="vbar-fill" style="height:${(v / max) * 100}%"></div></div><span class="vbar-label">${esc(l)}</span></div>`).join('')}</div>`
        : `<div class="hbars" role="img" aria-label="${esc(title)}: ${data.map(([l, v]) => `${l} ${v}`).join(', ')}">${data.map(([l, v]) => `<div class="hbar" data-tip="${esc(l)}: ${v} ${unit}"><span class="hbar-label">${esc(l)}</span><span class="hbar-track"><span class="hbar-fill" style="width:${(v / max) * 100}%"></span>${l === top[0] ? `<span class="hbar-val">${v}</span>` : ''}</span></div>`).join('')}</div>`;
    return `<section class="card chart"><div class="row-between"><h2 class="h4">${esc(title)}</h2><button class="link small" data-toggle-table="${id}" aria-pressed="false">Pokaż tabelę</button></div><div data-plot="${id}">${plot}</div>${table}</section>`;
}
route({
    pattern: '/obsluga/analityka', id: 'B-06', title: 'Analityka', roles: ['AGENT'],
    render(root) {
        const f = { period: 30, kind: '' };
        root.innerHTML = `${screenTag('B-06', 'Analityka')}<div class="bo-page">
      <div class="page-head"><div><h1>Analityka zwrotów i reklamacji</h1><p class="muted">Dane z hurtowni (symulacja) + bieżące zgłoszenia z demo.</p></div></div>
      <div class="toolbar"><div class="segmented" role="radiogroup" aria-label="Okres">${[30, 90].map((p) => `<button type="button" role="radio" aria-checked="${p === 30}" data-period="${p}">${p} dni</button>`).join('')}</div>
        <label class="inline-field">Typ <select data-kind><option value="">Wszystkie</option>${Object.keys(KINDS).map((k) => `<option value="${k}">${KINDS[k].short}</option>`).join('')}</select></label></div>
      <div data-body></div><div class="chart-tip" role="tooltip" hidden></div></div>`;
        const body = $('[data-body]', root);
        const tip = $('.chart-tip', root);
        const load = () => loadInto(body, {
            skeleton: `<div class="kpis">${skelCards(5)}</div><div class="charts">${skelCards(4)}</div>`,
            load: () => api.analytics(f.period, f.kind),
            isEmpty: (d) => !d || d.kpi.total === 0,
            empty: () => `<div class="card">${emptyState('📊', 'Brak danych dla wybranego okresu', 'Zmień okres lub typ zgłoszenia.')}</div>`,
            render: (d) => {
                if (!d)
                    return;
                const k = d.kpi;
                body.innerHTML = `<div class="kpis">
            <div class="kpi"><span class="kpi-label">Zgłoszenia</span><span class="kpi-value">${k.total}</span><span class="kpi-sub">w ${f.period} dni</span></div>
            <div class="kpi"><span class="kpi-label">Wskaźnik zgłoszeń</span><span class="kpi-value">${k.returnRate.toFixed(1).replace('.', ',')}%</span><span class="kpi-sub">zamówień</span></div>
            <div class="kpi"><span class="kpi-label">Automatyzacja</span><span class="kpi-value">${k.automation}%</span><span class="kpi-sub">rozstrzygnięte regułą</span></div>
            <div class="kpi"><span class="kpi-label">Średni czas rozwiązania</span><span class="kpi-value">${k.avgDays.toFixed(1).replace('.', ',')} dni</span><span class="kpi-sub">od zgłoszenia</span></div>
            <div class="kpi"><span class="kpi-label">Odzysk od dostawców</span><span class="kpi-value">${fmtMoney(k.recovered)}</span><span class="kpi-sub">noty kredytowe</span></div></div>
          <div class="charts">${barChart('Najczęstsze powody', d.reasons)}${barChart('Produkty z największą liczbą zgłoszeń', d.products)}${barChart('Zgłoszenia tygodniowo', d.weeks, { vertical: true })}${barChart('Struktura rozwiązań (%)', d.resolutions, { unit: '%' })}</div>`;
                $$('[data-toggle-table]', body).forEach((b) => b.addEventListener('click', () => {
                    const id = b.dataset.toggleTable;
                    const t = $(`[data-table="${id}"]`, body);
                    const p = $(`[data-plot="${id}"]`, body);
                    t.hidden = !t.hidden;
                    p.hidden = !t.hidden;
                    b.textContent = t.hidden ? 'Pokaż tabelę' : 'Pokaż wykres';
                    b.setAttribute('aria-pressed', String(!t.hidden));
                }));
                $$('[data-tip]', body).forEach((el) => {
                    el.addEventListener('mouseenter', () => { tip.hidden = false; tip.textContent = el.dataset.tip; el.classList.add('hover'); });
                    el.addEventListener('mousemove', (e) => { const m = e; tip.style.left = m.clientX + 12 + 'px'; tip.style.top = m.clientY - 34 + 'px'; });
                    el.addEventListener('mouseleave', () => { tip.hidden = true; el.classList.remove('hover'); });
                });
            },
        });
        $$('[data-period]', root).forEach((b) => b.addEventListener('click', () => { f.period = Number(b.dataset.period); $$('[data-period]', root).forEach((x) => x.setAttribute('aria-checked', String(x === b))); load(); }));
        $('[data-kind]', root).addEventListener('change', (e) => { f.kind = e.target.value; load(); });
        load();
    },
});
// ---------- B-07 Ustawienia ----------
route({
    pattern: '/obsluga/ustawienia', id: 'B-07', title: 'Ustawienia', roles: ['AGENT'],
    render(root) {
        root.innerHTML = `${screenTag('B-07', 'Ustawienia: polityka zwrotów i szablony')}<div class="bo-page narrow-page">
      <div class="page-head"><h1>Ustawienia</h1></div><div data-policy></div><div data-tpls></div></div>`;
        const pBox = $('[data-policy]', root);
        loadInto(pBox, {
            skeleton: skelCards(1), compactError: true,
            load: () => api.policy(),
            render: (p) => {
                pBox.innerHTML = `<form class="card" novalidate data-form><h2 class="h3">Polityka zwrotów</h2>
          ${alertBox('info', 'Terminy ustawowe (tylko do odczytu)', 'Odstąpienie od umowy: min. 14 dni · reklamacja: 2 lata od dostawy · odpowiedź na reklamację: 14 dni.')}
          <div class="grid-3">${textField({ name: 'returnDays', label: 'Okno zwrotu (dni)', required: true, value: String(p.returnDays), inputmode: 'numeric', hint: '14–365' })}
          ${textField({ name: 'returnFee', label: 'Koszt odesłania (zł)', required: true, value: String(p.returnFee).replace('.', ','), inputmode: 'decimal', hint: '0 = darmowe zwroty' })}
          ${textField({ name: 'transportDays', label: 'Zgłoszenia transportowe (dni)', required: true, value: String(p.transportDays), inputmode: 'numeric', hint: '1–30' })}</div>
          <div class="grid-2">${textField({ name: 'creditBonus', label: 'Bonus za wybór bonu (%)', required: true, value: String(p.creditBonus), inputmode: 'numeric', hint: '0–50' })}
          <div class="field"><label class="toggle"><input type="checkbox" name="freeCredit" ${p.freeReturnForCredit ? 'checked' : ''}><span class="toggle-ui" aria-hidden="true"></span><span>Darmowe odesłanie przy wyborze bonu</span></label></div></div>
          <fieldset class="field"><legend>Kategorie wyłączone ze zwrotu (po otwarciu)</legend><div class="chips">${Object.keys(CATEGORIES).map((k) => `<label class="chip-check"><input type="checkbox" name="ex-${k}" ${p.excludedCategories.includes(k) ? 'checked' : ''}><span>${CATEGORIES[k]}</span></label>`).join('')}</div></fieldset>
          <div data-alert></div><button class="btn btn-primary" type="submit">Zapisz politykę</button></form>`;
                const form = $('[data-form]', pBox);
                form.addEventListener('submit', async (ev) => {
                    ev.preventDefault();
                    const v = formValues(form);
                    const e = [];
                    const int = (x) => /^\d+$/.test(x) ? Number(x) : NaN;
                    const rd = int(v.returnDays), td = int(v.transportDays), cb = int(v.creditBonus), fee = Number(v.returnFee.replace(',', '.'));
                    if (!(rd >= 14 && rd <= 365))
                        e.push({ field: 'returnDays', message: 'Okno zwrotu: 14–365 dni (min. ustawowe 14).' });
                    if (!(fee >= 0 && fee <= 100) || !/^\d+([.,]\d{1,2})?$/.test(v.returnFee))
                        e.push({ field: 'returnFee', message: 'Koszt: 0–100 zł, maks. 2 miejsca po przecinku.' });
                    if (!(td >= 1 && td <= 30))
                        e.push({ field: 'transportDays', message: 'Podaj 1–30 dni.' });
                    if (!(cb >= 0 && cb <= 50))
                        e.push({ field: 'creditBonus', message: 'Bonus: 0–50%.' });
                    showErrors(form, e, 'Popraw politykę');
                    if (e.length)
                        return;
                    const d = busy($('button[type=submit]', form), 'Zapisywanie…');
                    try {
                        await api.savePolicy({ returnDays: rd, returnFee: fee, transportDays: td, creditBonus: cb, freeReturnForCredit: v.freeCredit === 'on', excludedCategories: Object.keys(CATEGORIES).filter((k) => v['ex-' + k] === 'on') });
                        toast('Zapisano — zmiany obowiązują dla nowych zgłoszeń.');
                    }
                    catch (err) {
                        $('[data-alert]', form).innerHTML = alertBox('error', 'Nie udało się zapisać', esc(err.message));
                    }
                    d();
                });
            },
        });
        const tBox = $('[data-tpls]', root);
        const loadT = () => loadInto(tBox, {
            skeleton: skelCards(1), compactError: true,
            load: () => api.templates(),
            isEmpty: (ts) => ts.length === 0,
            empty: () => `<div class="card">${emptyState('✉️', 'Brak szablonów odpowiedzi', 'Szablony przyspieszają odpowiedzi agentów.', '<button class="btn btn-primary" data-add-tpl>Dodaj pierwszy szablon</button>')}</div>`,
            render: (ts) => {
                tBox.innerHTML = `<section class="card"><div class="row-between"><h2 class="h3">Szablony odpowiedzi</h2><button class="btn btn-secondary btn-sm" data-add-tpl>＋ Dodaj</button></div>
          <p class="small muted">Zmienne: <code>{imie}</code>, <code>{rma}</code></p>
          <ul class="plain tpl-list">${ts.map((t) => `<li><div><strong>${esc(t.name)}</strong><div class="small muted">${esc(t.body.slice(0, 110))}…</div></div><button class="btn btn-ghost btn-sm" data-edit-tpl="${t.id}">Edytuj</button></li>`).join('')}</ul></section>`;
                $$('[data-edit-tpl]', tBox).forEach((b) => b.addEventListener('click', () => tplEditor(ts.find((t) => t.id === b.dataset.editTpl), loadT)));
            },
        }).then(() => $$('[data-add-tpl]', tBox).forEach((b) => b.addEventListener('click', () => tplEditor({ id: uid('t'), name: '', body: '' }, loadT))));
        loadT();
    },
});
function tplEditor(t, reload) {
    openModal({
        title: t.name ? `Szablon: ${t.name}` : 'Nowy szablon', wide: true,
        body: `<form novalidate data-form>${textField({ name: 'name', label: 'Nazwa', required: true, value: t.name, maxlength: 60 })}${textareaField({ name: 'body', label: 'Treść', required: true, value: t.body, min: 10, max: 2000, rows: 6 })}<div data-alert></div></form>`,
        onOpen: (el) => bindCounters(el),
        actions: [{ label: 'Anuluj', onClick: ({ close }) => close() }, {
                label: 'Zapisz', kind: 'primary', onClick: async ({ el, btn, close }) => {
                    const form = $('[data-form]', el);
                    const v = formValues(form);
                    const e = [];
                    if (v.name.length < 3 || v.name.length > 60)
                        e.push({ field: 'name', message: 'Nazwa: 3–60 znaków.' });
                    if (v.body.length < 10)
                        e.push({ field: 'body', message: 'Treść: min. 10 znaków.' });
                    showErrors(form, e, 'Popraw szablon');
                    if (e.length)
                        return;
                    const d = busy(btn, 'Zapisywanie…');
                    try {
                        await api.saveTemplate({ id: t.id, name: v.name, body: v.body });
                        close();
                        toast('Zapisano szablon.');
                        reload();
                    }
                    catch (err) {
                        d();
                        $('[data-alert]', el).innerHTML = alertBox('error', 'Nie udało się zapisać', esc(err.message));
                    }
                },
            }],
    });
}
// Start aplikacji
(function boot() {
    Store.load();
    const saved = storage.get('portal-reklamacje-scenario');
    if (saved && ['normal', 'slow', 'empty', 'error'].includes(saved))
        Demo.scenario = saved;
    renderFooter();
    renderDemoPanel();
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('beforeunload', (e) => { if (Router.dirty) {
        e.preventDefault();
        e.returnValue = '';
    } });
    if (!location.hash)
        history.replaceState(null, '', '#/');
    renderRoute();
})();
