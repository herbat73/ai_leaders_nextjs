// Reguły biznesowe: kwalifikowalność, wymagane dowody, kalkulacja, silnik reguł, rekomendacja.
// W docelowym systemie działają po stronie serwera (BFF) — tu symulowane.

function kindWindowDays(kind: ClaimKind, p: Policy): number {
  return kind === 'RETURN' ? p.returnDays : kind === 'COMPLAINT' ? 730 : p.transportDays;
}

function kindAvailability(order: Order, kind: ClaimKind, p: Policy = Store.db.policy): { available: boolean; deadline: string; reason: string } {
  if (!order.deliveredAt) return { available: false, deadline: '', reason: 'Zamówienie nie zostało jeszcze dostarczone.' };
  const deadline = addDays(order.deliveredAt, kindWindowDays(kind, p));
  if (todayISO() > deadline) {
    const msg = kind === 'RETURN' ? `Termin na zwrot minął ${fmtDate(deadline)}. Jeśli produkt jest wadliwy — złóż reklamację.`
      : kind === 'COMPLAINT' ? `Minęły 2 lata od dostawy (${fmtDate(deadline)}).`
      : `Takie zgłoszenia przyjmujemy do ${kindWindowDays(kind, p)} dni od dostawy (minęło ${fmtDate(deadline)}).`;
    return { available: false, deadline, reason: msg };
  }
  return { available: true, deadline, reason: '' };
}

function claimedQty(orderId: string, lineId: string): { qty: number; number: string } {
  const cs = Store.db.claims.filter((c) => c.orderId === orderId && !['CANCELLED', 'REJECTED'].includes(c.status));
  let qty = 0; let number = '';
  cs.forEach((c) => c.items.forEach((i) => { if (i.lineId === lineId) { qty += i.qty; number = c.number; } }));
  return { qty, number };
}

function lineEligibility(order: Order, l: OrderLine, kind: ClaimKind, p: Policy = Store.db.policy): { eligible: boolean; remaining: number; reason: string } {
  const { qty, number } = claimedQty(order.id, l.lineId);
  const remaining = l.qty - qty;
  if (remaining <= 0) return { eligible: false, remaining: 0, reason: `Już zgłoszone (${number}).` };
  if (kind === 'RETURN' && (!l.returnable || p.excludedCategories.includes(l.category))) {
    return { eligible: false, remaining, reason: `${CATEGORIES[l.category]} — produktu nie można zwrócić po otwarciu. Jeśli jest wadliwy, złóż reklamację.` };
  }
  return { eligible: true, remaining, reason: '' };
}

function daysSinceDelivery(order: Order): number { return order.deliveredAt ? daysBetween(order.deliveredAt, todayISO()) : 0; }

function matchRule(r: Rule, kind: ClaimKind, items: ClaimItem[], value: number, days: number): boolean {
  const c = r.conditions;
  if (c.kinds.length && !c.kinds.includes(kind)) return false;
  if (c.categories.length && !items.some((i) => c.categories.includes(i.category))) return false;
  if (c.reasons.length && !items.some((i) => c.reasons.includes(i.reason))) return false;
  if (c.minValue !== null && value < c.minValue) return false;
  if (c.maxValue !== null && value > c.maxValue) return false;
  if (c.maxDays !== null && days > c.maxDays) return false;
  return true;
}

function activeRules(): Rule[] { return Store.db.rules.filter((r) => r.enabled).sort((a, b) => a.order - b.order); }

function itemRequirements(kind: ClaimKind, it: ClaimItem, lineDef: OrderLine | undefined, allItems: ClaimItem[], value: number, days: number): { photos: number; serial: boolean; video: boolean; sources: string[] } {
  const out = { photos: 0, serial: false, video: false, sources: [] as string[] };
  if (kind === 'RETURN') return out;
  out.photos = kind === 'TRANSPORT' ? 2 : 1;
  if (kind !== 'COMPLAINT') return out;
  const sup = Store.supplier(it.supplierId);
  if (lineDef?.serialRequired) { out.serial = true; out.sources.push('produkt ma numer seryjny'); }
  if (sup?.requires.includes('SERIAL')) { out.serial = true; out.sources.push(`dostawca ${sup.name} wymaga numeru seryjnego`); }
  if (sup?.requires.includes('VIDEO')) { out.video = true; out.sources.push(`dostawca ${sup.name} wymaga wideo`); }
  const r = activeRules().find((x) => x.action === 'REQUIRE_VIDEO' && matchRule(x, kind, [it], value, days));
  if (r) { out.video = true; out.sources.push(`reguła sklepu „${r.name}”`); }
  out.sources = Array.from(new Set(out.sources));
  return out;
}

function draftValue(d: DraftData): number { return d.items.reduce((s, i) => s + i.qty * i.price, 0); }

interface QuoteOption { resolution: Resolution; available: boolean; amount: number | null; note: string; tag?: string }

function quoteOptions(d: DraftData, order: Order, p: Policy = Store.db.policy): QuoteOption[] {
  const v = draftValue(d);
  const round = (n: number) => Math.round(n * 100) / 100;
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

function returnNeeded(d: DraftData): boolean {
  if (d.kind === 'MISSING') return false;
  if (d.resolution === 'PRICE_REDUCTION') return false;
  return true;
}

function keepItemPreview(d: DraftData, order: Order): Rule | undefined {
  if (!d.kind) return undefined;
  return activeRules().find((r) => r.action === 'KEEP_ITEM' && matchRule(r, d.kind as ClaimKind, d.items, draftValue(d), daysSinceDelivery(order)));
}

function defaultTeam(kind: ClaimKind, items: ClaimItem[]): string {
  if (kind === 'RETURN') return 'Zwroty';
  if (kind === 'TRANSPORT') return 'Transport';
  if (kind === 'COMPLAINT' && items.some((i) => i.category === 'ELECTRONICS' || i.category === 'APPLIANCES')) return 'Elektronika';
  return 'Reklamacje';
}

interface Recommendation { action: 'APPROVE' | 'REQUEST_INFO'; resolution: Resolution; confidence: number; rationale: string; checks: { ok: boolean; text: string }[] }

function recommend(c: Claim): Recommendation {
  const order = Store.order(c.orderId)!;
  const days = daysSinceDelivery(order);
  const checks: { ok: boolean; text: string }[] = [];
  const win = kindWindowDays(c.kind, Store.db.policy);
  checks.push({ ok: days <= win, text: `Zgłoszono ${days} dni od dostawy (limit: ${win} dni)` });
  let missing: string[] = [];
  c.items.forEach((it) => {
    const req = itemRequirements(c.kind, it, order.lines.find((l) => l.lineId === it.lineId), c.items, c.value, days);
    const photos = it.files.filter((f) => !f.mime.startsWith('video')).length;
    const videos = it.files.filter((f) => f.mime.startsWith('video')).length;
    if (req.photos) checks.push({ ok: photos >= req.photos, text: `${it.name}: zdjęcia ${photos}/${req.photos}` });
    if (req.serial) { checks.push({ ok: !!it.serial, text: `${it.name}: numer seryjny ${it.serial ? 'podany' : 'brak'}` }); if (!it.serial) missing.push('numer seryjny'); }
    if (req.video) { checks.push({ ok: videos > 0, text: `${it.name}: wideo ${videos ? 'dołączone' : 'brak'}` }); if (!videos) missing.push('nagranie wideo'); }
    if (photos < req.photos) missing.push('zdjęcia');
  });
  const history = Store.db.claims.filter((x) => x.email === c.email && x.id !== c.id).length;
  checks.push({ ok: history < 6, text: `Historia klienta: ${history} inne zgłoszenia` });
  missing = Array.from(new Set(missing));
  if (missing.length) {
    return { action: 'REQUEST_INFO', resolution: c.resolution, confidence: 0.9, rationale: `Brakuje dowodów wymaganych przez wytyczne: ${missing.join(', ')}. Poproś klienta o uzupełnienie przed decyzją.`, checks };
  }
  const sup = Store.supplier(c.items[0].supplierId);
  if (c.kind === 'RETURN') return { action: 'APPROVE', resolution: c.resolution, confidence: 0.96, rationale: 'Zwrot w terminie, produkt podlega zwrotowi. Zaakceptuj zgodnie z wyborem klienta.', checks };
  if (c.kind === 'MISSING') return { action: 'APPROVE', resolution: 'SPARE_PART', confidence: 0.88, rationale: 'Zdjęcie zawartości potwierdza brak. Najtańsze rozwiązanie: dosłanie elementu.', checks };
  if (c.kind === 'TRANSPORT') return { action: 'APPROVE', resolution: 'REPLACEMENT', confidence: 0.84, rationale: 'Zdjęcia pokazują uszkodzenie opakowania i produktu — typowa szkoda transportowa. Wyślij zamiennik i zgłoś szkodę przewoźnikowi.', checks };
  const res: Resolution = c.value >= 500 ? 'REPAIR' : 'REPLACEMENT';
  return { action: 'APPROVE', resolution: res, confidence: 0.81, rationale: `Opis i dowody wskazują na wadę fabryczną (${reasonLabel(c.kind, c.items[0].reason).toLowerCase()}).${sup ? ` Produkt objęty ${sup.warrantyMonths}-mies. gwarancją dostawcy ${sup.name} — po inspekcji przekaż reklamację do dostawcy.` : ''}`, checks };
}

function nextRma(): string { return `RMA-${todayISO().slice(0, 4)}-${String(++Store.db.seq).padStart(5, '0')}`; }
function newLabel(): { carrier: string; code: string; expiresAt: string } {
  const n = () => String(Math.floor(1000 + Math.random() * 9000));
  return { carrier: 'Paczkomat', code: `6620 ${n()} ${n()}`, expiresAt: addDays(todayISO(), 14) };
}
