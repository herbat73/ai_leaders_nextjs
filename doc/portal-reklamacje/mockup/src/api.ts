// Symulowane API. Ścieżki i kody odpowiadają docs/05-katalog-api.md.
// Panel demo wymusza scenariusz: normal / slow (loading) / empty / error.

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields: FieldError[] = [], public extra: Record<string, unknown> = {}) { super(message); }
}

interface ApiLogEntry { at: string; method: string; path: string; status: number; ms: number }

const Demo = {
  scenario: 'normal' as Scenario,
  log: [] as ApiLogEntry[],
  listeners: [] as (() => void)[],
  setScenario(s: Scenario) { this.scenario = s; storage.set('portal-reklamacje-scenario', s); this.emit(); },
  emit() { this.listeners.forEach((l) => l()); },
};

async function apiCall<T>(method: string, path: string, fn: () => T, opts: { empty?: () => T; noFail?: boolean } = {}): Promise<T> {
  const t0 = performance.now();
  await sleep(Demo.scenario === 'slow' ? 2500 + Math.random() * 1000 : 220 + Math.random() * 330);
  const record = (status: number) => {
    Demo.log.unshift({ at: nowTime(), method, path, status, ms: Math.round(performance.now() - t0) });
    Demo.log = Demo.log.slice(0, 40);
    Demo.emit();
  };
  try {
    if (Demo.scenario === 'error' && !opts.noFail) throw new ApiError(503, 'SERVICE_UNAVAILABLE', 'Usługa jest chwilowo niedostępna.', [], { traceId: Math.random().toString(16).slice(2, 10) });
    if (Demo.scenario === 'empty' && opts.empty) { const r = opts.empty(); record(200); return clone(r); }
    const r = fn();
    Store.save();
    record(method === 'POST' && /submit|claims$|labels|refunds|inspection|messages|rules$/.test(path) ? 201 : method === 'DELETE' ? 204 : 200);
    return r === undefined ? r : clone(r);
  } catch (e) {
    record(e instanceof ApiError ? e.status : 500);
    throw e;
  }
}

function sess(...roles: Role[]): Session {
  const s = Store.db.session;
  if (!s || (roles.length && !roles.includes(s.role))) throw new ApiError(401, 'UNAUTHENTICATED', 'Sesja wygasła.');
  return s;
}

function canSeeClaim(c: Claim): boolean {
  const s = Store.db.session;
  if (!s) return false;
  if (s.role === 'AGENT' || s.role === 'WAREHOUSE') return true;
  if (s.role === 'CUSTOMER') return (!!s.email && !s.orderId && s.email === c.email) || s.orderId === c.orderId || s.claimId === c.id;
  return false;
}

function getClaim(id: string): Claim {
  const c = Store.claim(id);
  if (!c || !canSeeClaim(c)) throw new ApiError(404, 'NOT_FOUND', 'Nie znaleziono zgłoszenia.');
  return c;
}

function push(c: Claim, status: ClaimStatus, title: string, actor: string, description?: string) {
  c.status = status;
  c.timeline.push({ at: new Date().toISOString(), status, title, description, actor });
}

function sysMsg(c: Claim, body: string) { c.messages.push({ id: uid('m'), from: 'SYSTEM', author: SHOP.name, body, at: new Date().toISOString() }); }

const api = {
  // ---------- Portal: identyfikacja ----------
  config() { return apiCall('GET', '/portal/config', () => ({ policy: Store.db.policy }), { noFail: true }); },
  lookupOrder(orderNo: string, contact: string) {
    return apiCall('POST', '/portal/orders/lookup', () => {
      const n = orderNo.trim().toUpperCase();
      const c = contact.trim().toLowerCase().replace(/[\s-]/g, '');
      const o = Store.db.orders.find((x) => x.number === n && (x.email.toLowerCase() === c || x.phone.replace(/[\s-]/g, '').endsWith(c.replace(/^\+48/, ''))));
      if (!o) throw new ApiError(404, 'ORDER_NOT_FOUND', 'Nie znaleźliśmy zamówienia dla podanych danych.');
      if (!o.deliveredAt) throw new ApiError(409, 'NOT_DELIVERED', 'Zamówienie jest jeszcze w drodze.', [], { orderNumber: o.number });
      Store.db.session = { role: 'CUSTOMER', name: o.customerName.split(' ')[0], email: o.email, orderId: o.id };
      return { orderId: o.id };
    });
  },
  magicLink(email: string) { return apiCall('POST', '/portal/auth/magic-link', () => ({ sent: true })); },
  magicVerify(email: string) {
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
    }, { empty: () => [] as Order[] });
  },
  myClaims() {
    return apiCall('GET', '/portal/me/claims', () => {
      sess('CUSTOMER');
      return Store.db.claims.filter(canSeeClaim).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }, { empty: () => [] as Claim[] });
  },
  order(id: string) {
    return apiCall('GET', `/portal/orders/${id}`, () => {
      const s = sess('CUSTOMER', 'AGENT');
      const o = Store.order(id);
      if (!o || (s.role === 'CUSTOMER' && (s.orderId ? s.orderId !== id : s.email !== o.email))) throw new ApiError(404, 'NOT_FOUND', 'Nie znaleziono zamówienia.');
      return o;
    });
  },
  eligibility(orderId: string) {
    return apiCall('GET', `/portal/orders/${orderId}/eligibility`, () => {
      const o = Store.order(orderId)!;
      return (Object.keys(KINDS) as ClaimKind[]).map((k) => ({ kind: k, ...kindAvailability(o, k) }));
    });
  },

  // ---------- Portal: kreator ----------
  createDraft(orderId: string, kind: ClaimKind) {
    return apiCall('POST', '/portal/claims/drafts', () => {
      const o = Store.order(orderId)!;
      const s = Store.db.session!;
      const d: Draft = {
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
  patchDraft(data: DraftData, step: number) {
    return apiCall('PATCH', `/portal/claims/drafts/${Store.db.draft?.id ?? 'new'}`, () => {
      const d = Store.db.draft;
      if (!d) throw new ApiError(404, 'NOT_FOUND', 'Wersja robocza wygasła.');
      d.data = data; d.step = Math.max(d.step, step); d.updatedAt = new Date().toISOString();
      return d;
    });
  },
  reasons(kind: ClaimKind) { return apiCall('GET', `/portal/reasons?kind=${kind}`, () => REASONS[kind]); },
  requirements(d: DraftData) {
    return apiCall('GET', `/portal/requirements?orderId=${d.orderId}&kind=${d.kind}`, () => {
      const o = Store.order(d.orderId)!;
      return d.items.map((it) => ({ lineId: it.lineId, ...itemRequirements(d.kind as ClaimKind, it, o.lines.find((l) => l.lineId === it.lineId), d.items, draftValue(d), daysSinceDelivery(o)) }));
    });
  },
  quote(d: DraftData) {
    return apiCall('POST', `/portal/claims/drafts/${Store.db.draft?.id}/quote`, () => {
      const o = Store.order(d.orderId)!;
      return { options: quoteOptions(d, o), keepItemRule: keepItemPreview(d, o)?.name ?? null };
    });
  },
  pickupPoints(q: string) {
    return apiCall('GET', `/portal/pickup-points?query=${encodeURIComponent(q)}`, () => {
      const ql = q.trim().toLowerCase();
      return PICKUP_POINTS.filter((p) => !ql || p.id.toLowerCase().includes(ql) || p.address.toLowerCase().includes(ql));
    }, { empty: () => [] as typeof PICKUP_POINTS });
  },
  registerAttachment(meta: FileMeta) { return apiCall('POST', `/portal/claims/drafts/${Store.db.draft?.id ?? '-'}/attachments`, () => ({ ...meta, status: 'scanning' as const })); },
  scanStatus(meta: FileMeta) {
    return apiCall('GET', `/portal/claims/drafts/${Store.db.draft?.id ?? '-'}/attachments/${meta.id}`, () => ({ scanStatus: /virus|wirus|eicar/i.test(meta.name) ? 'INFECTED' : 'CLEAN' }), { noFail: true });
  },
  submitDraft() {
    const s0 = Store.db.session;
    const path = s0?.role === 'AGENT' ? '/bo/claims' : `/portal/claims/drafts/${Store.db.draft?.id}/submit`;
    return apiCall('POST', path, () => {
      const s = sess('CUSTOMER', 'AGENT');
      const d = Store.db.draft;
      if (!d) throw new ApiError(404, 'NOT_FOUND', 'Wersja robocza wygasła.');
      const data = d.data;
      const o = Store.order(data.orderId)!;
      const kind = data.kind as ClaimKind;
      const avail = kindAvailability(o, kind);
      if (!avail.available) throw new ApiError(422, 'WINDOW_EXPIRED', avail.reason, [{ field: 'step-1', message: avail.reason }]);
      const value = draftValue(data);
      const q = quoteOptions(data, o).find((x) => x.resolution === data.resolution);
      const now = new Date().toISOString();
      const c: Claim = {
        id: uid('c'), number: nextRma(), kind, status: 'SUBMITTED', channel: s.assisted?.channel ?? 'PORTAL',
        orderId: o.id, orderNumber: o.number, customerName: o.customerName, email: data.contact.email || o.email, phone: data.contact.phone || o.phone,
        createdAt: now, responseDueAt: addDays(todayISO(), 14), items: clone(data.items).map((i) => ({ ...i, files: i.files.filter((f) => f.status === 'ready') })),
        resolution: data.resolution as Resolution, exchangeVariant: data.exchangeVariant || undefined, resolutionNote: data.refundJustification || undefined,
        returnMethod: returnNeeded(data) ? (data.returnMethod || 'PARCEL_LOCKER') as ReturnMethod : 'NONE',
        pickupPoint: data.pickupPoint || undefined, store: data.store || undefined, courier: data.returnMethod === 'COURIER' ? clone(data.courier) : undefined,
        refundAccount: data.refundAccount || undefined, value, refundAmount: q?.amount ?? 0,
        priority: 'NORMAL', team: defaultTeam(kind, data.items), tags: [], appliedRules: [], keepItem: false,
        timeline: [{ at: now, status: 'SUBMITTED', title: 'Zgłoszenie przyjęte', description: s.assisted ? `Utworzone przez ${s.name} (${s.assisted.channel === 'PHONE' ? 'telefon' : s.assisted.channel === 'STORE' ? 'sklep stacjonarny' : 'e-mail'}).` : 'Zgłoszone przez portal.', actor: s.role === 'AGENT' ? s.name : 'Klient' }],
        messages: [],
      };
      // Silnik reguł
      const days = daysSinceDelivery(o);
      activeRules().forEach((r) => {
        if (!matchRule(r, kind, c.items, value, days)) return;
        r.hits += 1;
        if (r.action === 'REQUIRE_VIDEO') { c.appliedRules.push(r.id); return; }
        c.appliedRules.push(r.id);
        if (r.action === 'HIGH_PRIORITY') c.priority = 'HIGH';
        if (r.action === 'ASSIGN_TEAM') c.team = r.param || c.team;
        if (r.action === 'AUTO_APPROVE' && c.status === 'SUBMITTED') {
          if (c.returnMethod !== 'NONE') c.label = newLabel();
          push(c, 'APPROVED', 'Zaakceptowane automatycznie', 'System', `Reguła: ${r.name}.${c.label ? ' Wygenerowano kod QR do nadania.' : ''}`);
        }
        if (r.action === 'KEEP_ITEM' && c.status === 'SUBMITTED') {
          c.keepItem = true; c.returnMethod = 'NONE';
          const amount = c.resolution === 'REFUND' ? c.value : undefined;
          c.outcome = { type: c.resolution === 'REFUND' ? 'REFUND' : 'REPLACEMENT', amount, ref: c.resolution === 'REFUND' ? undefined : 'TS-' + (10600 + Math.floor(Math.random() * 300)), at: now };
          push(c, 'RESOLVED', c.resolution === 'REFUND' ? 'Zwrot pieniędzy zlecony automatycznie' : 'Zamiennik wysłany automatycznie', 'System', `Reguła: ${r.name}. Nie musisz odsyłać produktu.`);
        }
      });
      Store.db.claims.unshift(c);
      Store.db.draft = null;
      Store.db.lastClaimId = c.id;
      if (s.role === 'CUSTOMER' && s.orderId && s.orderId !== c.orderId) s.claimId = c.id;
      return c;
    });
  },

  // ---------- Portal: zgłoszenie ----------
  claimStatus(number: string, email: string) {
    return apiCall('POST', '/portal/claims/status', () => {
      const c = Store.db.claims.find((x) => x.number === number.trim().toUpperCase() && x.email.toLowerCase() === email.trim().toLowerCase());
      if (!c) throw new ApiError(404, 'NOT_FOUND', 'Nie znaleźliśmy zgłoszenia dla podanych danych.');
      const s = Store.db.session;
      if (!s || s.role !== 'CUSTOMER') Store.db.session = { role: 'CUSTOMER', name: c.customerName.split(' ')[0], claimId: c.id, email: undefined };
      else s.claimId = c.id;
      return { claimId: c.id };
    });
  },
  claim(id: string) { return apiCall('GET', `/portal/claims/${id}`, () => getClaim(id)); },
  sendMessage(id: string, body: string, internal = false) {
    const s0 = Store.db.session;
    return apiCall('POST', `${s0?.role === 'AGENT' ? '/bo' : '/portal'}/claims/${id}/messages`, () => {
      const s = sess();
      const c = getClaim(id);
      const m: Message = { id: uid('m'), from: s.role === 'AGENT' ? 'AGENT' : 'CUSTOMER', author: s.role === 'AGENT' ? s.name : c.customerName, body, at: new Date().toISOString(), internal: internal || undefined };
      c.messages.push(m);
      if (s.role === 'CUSTOMER') c.customerReplied = true;
      return m;
    });
  },
  respond(id: string, files: FileMeta[], serial: string, message: string) {
    return apiCall('POST', `/portal/claims/${id}/responses`, () => {
      const c = getClaim(id);
      if (serial) c.items.forEach((i) => { if (!i.serial) i.serial = serial.toUpperCase(); });
      c.items[0].files.push(...files.filter((f) => f.status === 'ready'));
      if (message) c.messages.push({ id: uid('m'), from: 'CUSTOMER', author: c.customerName, body: message, at: new Date().toISOString() });
      c.requestedInfo = undefined; c.customerReplied = true;
      push(c, 'SUBMITTED', 'Klient uzupełnił informacje', 'Klient', `${files.length} plik(i)${serial ? ', numer seryjny' : ''}.`);
    });
  },
  offerDecision(id: string, accept: boolean, comment: string) {
    return apiCall('POST', `/portal/claims/${id}/offer/${accept ? 'accept' : 'decline'}`, () => {
      const c = getClaim(id);
      if (!c.offer || c.offer.status !== 'PENDING') throw new ApiError(409, 'STATE_CONFLICT', 'Propozycja nie jest już aktualna.');
      c.offer.status = accept ? 'ACCEPTED' : 'DECLINED';
      if (comment) c.messages.push({ id: uid('m'), from: 'CUSTOMER', author: c.customerName, body: comment, at: new Date().toISOString() });
      c.customerReplied = true;
      if (accept) {
        c.resolution = c.offer.resolution; c.refundAmount = c.offer.amount;
        if (c.offer.resolution === 'PRICE_REDUCTION') {
          c.returnMethod = 'NONE';
          c.outcome = { type: 'PRICE_REDUCTION', amount: c.offer.amount, at: new Date().toISOString() };
          push(c, 'RESOLVED', 'Propozycja zaakceptowana — obniżenie ceny', 'Klient', `Zwrot ${fmtMoney(c.offer.amount)} zlecony.`);
        } else {
          if (c.returnMethod !== 'NONE' && !c.label) c.label = newLabel();
          push(c, 'APPROVED', 'Propozycja zaakceptowana', 'Klient');
        }
      } else push(c, 'SUBMITTED', 'Propozycja odrzucona przez klienta', 'Klient');
    });
  },
  cancelClaim(id: string) {
    return apiCall('POST', `/portal/claims/${id}/cancel`, () => {
      const c = getClaim(id);
      if (!['SUBMITTED', 'AWAITING_CUSTOMER', 'APPROVED'].includes(c.status)) throw new ApiError(409, 'STATE_CONFLICT', 'Paczka została już nadana — nie można anulować.');
      push(c, 'CANCELLED', 'Zgłoszenie anulowane przez klienta', 'Klient');
    });
  },
  download(path: string) { return apiCall('GET', path, () => ({ url: '#' })); },

  // ---------- Back-office ----------
  boClaims(f: { view: string; kind: string; priority: string; team: string; q: string }) {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
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
    }, { empty: () => [] as Claim[] });
  },
  boClaim(id: string) { return apiCall('GET', `/bo/claims/${id}`, () => { sess('AGENT', 'WAREHOUSE'); return getClaim(id); }); },
  boRecommendation(id: string) { return apiCall('GET', `/bo/claims/${id}/recommendation`, () => recommend(getClaim(id))); },
  boPatch(id: string, patch: Partial<Pick<Claim, 'assignee' | 'priority' | 'team'>>) {
    return apiCall('PATCH', `/bo/claims/${id}`, () => { const c = getClaim(id); Object.assign(c, patch); return c; });
  },
  boBulk(ids: string[], patch: Partial<Pick<Claim, 'assignee' | 'priority'>>) {
    return apiCall('PATCH', `/bo/claims (${ids.length})`, () => { ids.forEach((id) => Object.assign(getClaim(id), patch)); });
  },
  boDecision(id: string, p: { action: 'APPROVE' | 'REQUEST_INFO' | 'OFFER' | 'REJECT'; resolution?: Resolution; keepItem?: boolean; requested?: string[]; offer?: { resolution: Resolution; amount: number; text: string }; message: string }) {
    return apiCall('POST', `/bo/claims/${id}/decision`, () => {
      const s = sess('AGENT');
      const c = getClaim(id);
      if (!['SUBMITTED', 'AWAITING_CUSTOMER'].includes(c.status)) throw new ApiError(409, 'STATE_CONFLICT', 'Zgłoszenie zmieniło status — odśwież kartę.');
      if (!c.assignee) c.assignee = s.name;
      c.customerReplied = false;
      if (p.message) c.messages.push({ id: uid('m'), from: 'AGENT', author: s.name, body: p.message, at: new Date().toISOString() });
      if (p.action === 'APPROVE') {
        c.resolution = p.resolution ?? c.resolution;
        if (p.keepItem) { c.keepItem = true; c.returnMethod = 'NONE'; }
        if (c.returnMethod !== 'NONE') c.label = c.label ?? newLabel();
        push(c, 'APPROVED', `Zaakceptowane — ${RESOLUTIONS[c.resolution].label.toLowerCase()}`, s.name, c.keepItem ? 'Bez odsyłania produktu.' : 'Wygenerowano kod QR do nadania.');
      } else if (p.action === 'REQUEST_INFO') {
        c.requestedInfo = p.requested;
        push(c, 'AWAITING_CUSTOMER', 'Prośba o dodatkowe informacje', s.name, (p.requested ?? []).map((r) => REQUEST_ITEMS.find((x) => x[0] === r)?.[1]).join(', '));
      } else if (p.action === 'OFFER') {
        c.offer = { ...p.offer!, status: 'PENDING' };
        push(c, 'AWAITING_CUSTOMER', 'Propozycja rozwiązania wysłana', s.name, `${RESOLUTIONS[p.offer!.resolution].label}${p.offer!.amount ? ': ' + fmtMoney(p.offer!.amount) : ''}`);
      } else {
        c.rejectReason = p.message;
        push(c, 'REJECTED', 'Zgłoszenie odrzucone', s.name);
      }
    });
  },
  boResolve(id: string, action: 'REFUND' | 'STORE_CREDIT' | 'REPLACEMENT' | 'REPAIR' | 'SPARE_PART', amount?: number) {
    const path = action === 'REFUND' || action === 'STORE_CREDIT' ? 'refunds' : action === 'REPAIR' ? 'service-orders' : 'replacement-orders';
    return apiCall('POST', `/bo/claims/${id}/${path}`, () => {
      const s = sess('AGENT');
      const c = getClaim(id);
      const now = new Date().toISOString();
      if (action === 'REPAIR') { push(c, 'IN_SERVICE', 'Przekazano do serwisu', s.name); return; }
      if ((action === 'REFUND' || action === 'STORE_CREDIT') && (amount ?? 0) > c.value * 1.5) throw new ApiError(422, 'AMOUNT_TOO_HIGH', 'Kwota przekracza wartość zgłoszenia.');
      const ref = action === 'REPLACEMENT' || action === 'SPARE_PART' ? 'TS-' + (10600 + Math.floor(Math.random() * 300)) : undefined;
      c.outcome = { type: action, amount, ref, at: now };
      const title = action === 'REFUND' ? `Zwrot pieniędzy zlecony: ${fmtMoney(amount ?? 0)}` : action === 'STORE_CREDIT' ? `Wydano bon: ${fmtMoney(amount ?? 0)}` : action === 'SPARE_PART' ? `Wysłano brakującą część (${ref})` : `Wysłano zamiennik (${ref})`;
      push(c, 'RESOLVED', title, s.name);
      sysMsg(c, `${title}. Dziękujemy za cierpliwość!`);
    });
  },
  boForwardSupplier(id: string) {
    return apiCall('POST', '/bo/supplier-claims', () => {
      const c = getClaim(id);
      const supId = c.items[0].supplierId;
      let sc = Store.db.supplierClaims.find((x) => x.supplierId === supId && x.status === 'DRAFT');
      if (!sc) { sc = { id: uid('sc'), number: `SC-${todayISO().slice(0, 4)}-${String(Store.db.supplierClaims.length + 30).padStart(4, '0')}`, supplierId: supId, status: 'DRAFT', claimIds: [], amount: 0, createdAt: new Date().toISOString() }; Store.db.supplierClaims.unshift(sc); }
      if (!sc.claimIds.includes(c.id)) { sc.claimIds.push(c.id); sc.amount += c.value; }
      c.supplierClaimId = sc.id;
      c.timeline.push({ at: new Date().toISOString(), status: c.status, title: `Dodano do reklamacji dostawcy ${sc.number}`, actor: sess().name });
      return sc;
    });
  },
  boCarrierEvent(id: string) {
    return apiCall('POST', '/hooks/carrier', () => { const c = getClaim(id); push(c, 'IN_TRANSIT', 'Paczka nadana', 'Przewoźnik', c.label ? `Kod ${c.label.code}.` : ''); }, { noFail: true });
  },
  boSearchOrders(q: string) {
    return apiCall('GET', `/bo/orders?q=${encodeURIComponent(q)}`, () => {
      const ql = q.trim().toLowerCase();
      return Store.db.orders.filter((o) => [o.number, o.email, o.phone.replace(/\s/g, ''), o.customerName].some((x) => x.toLowerCase().includes(ql.replace(/\s/g, ''))));
    }, { empty: () => [] as Order[] });
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
    }, { empty: () => ({ expected: [] as Claim[], today: [] as Claim[] }) });
  },
  warehouseLookup(code: string) {
    return apiCall('GET', `/bo/warehouse/lookup?code=${encodeURIComponent(code)}`, () => {
      const k = code.replace(/\s+/g, '').toUpperCase();
      const c = Store.db.claims.find((x) => x.number === k || x.label?.code.replace(/\s+/g, '') === k);
      if (!c) throw new ApiError(404, 'NOT_FOUND', `Nie znaleziono przesyłki o kodzie ${code}.`);
      if (!['IN_TRANSIT', 'APPROVED'].includes(c.status)) throw new ApiError(409, 'STATE_CONFLICT', `Zgłoszenie ${c.number} ma status „${STATUS[c.status].bo}” — nie oczekuje na przyjęcie.`);
      return c;
    });
  },
  inspect(id: string, ins: Omit<Inspection, 'at' | 'by'>) {
    return apiCall('POST', `/bo/claims/${id}/inspection`, () => {
      const s = sess('AGENT', 'WAREHOUSE');
      const c = getClaim(id);
      c.inspection = { ...ins, at: new Date().toISOString(), by: s.name };
      const g = { A: 'A — jak nowy', B: 'B — ślady użytkowania', C: 'C — uszkodzony' }[ins.grade];
      push(c, 'RECEIVED', 'Produkt przyjęty w magazynie', 'Magazyn', `Ocena ${g}. ${ins.defectConfirmed === 'yes' ? 'Wada potwierdzona. ' : ins.defectConfirmed === 'no' ? 'Wada niepotwierdzona. ' : ''}${ins.notes}`);
    });
  },

  // ---------- Dostawcy ----------
  supplierClaims() { return apiCall('GET', '/bo/supplier-claims', () => { sess('AGENT'); return Store.db.supplierClaims; }, { empty: () => [] as SupplierClaim[] }); },
  sendSupplierClaim(id: string) {
    return apiCall('POST', `/bo/supplier-claims/${id}/send`, () => {
      const sc = Store.db.supplierClaims.find((x) => x.id === id)!;
      sc.status = 'SENT'; sc.sentAt = new Date().toISOString();
      sc.claimIds.forEach((cid) => { const c = Store.claim(cid); c?.timeline.push({ at: sc.sentAt!, status: c.status, title: `Reklamacja ${sc.number} wysłana do dostawcy`, actor: sess().name }); });
    });
  },
  markCredited(id: string) {
    return apiCall('PATCH', `/bo/supplier-claims/${id}`, () => { const sc = Store.db.supplierClaims.find((x) => x.id === id)!; sc.status = 'CREDITED'; });
  },
  supPortalClaims() {
    return apiCall('GET', '/supplier/claims', () => {
      const s = sess('SUPPLIER');
      return Store.db.supplierClaims.filter((x) => x.supplierId === s.supplierId && x.status !== 'DRAFT');
    }, { empty: () => [] as SupplierClaim[] });
  },
  supRespond(id: string, r: { decision: 'ACCEPT' | 'REJECT'; creditAmount?: number; creditNoteNo?: string; reason?: string }) {
    return apiCall('POST', `/supplier/claims/${id}/response`, () => {
      const sc = Store.db.supplierClaims.find((x) => x.id === id)!;
      if (sc.status !== 'SENT') throw new ApiError(409, 'STATE_CONFLICT', 'Reklamacja została już rozpatrzona.');
      sc.response = { ...r, at: new Date().toISOString() };
      sc.status = r.decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    });
  },

  // ---------- Reguły, analityka, ustawienia ----------
  rules() { return apiCall('GET', '/bo/rules', () => Store.db.rules.slice().sort((a, b) => a.order - b.order), { empty: () => [] as Rule[] }); },
  saveRule(r: Rule) {
    const isNew = !Store.db.rules.some((x) => x.id === r.id);
    return apiCall(isNew ? 'POST' : 'PATCH', isNew ? '/bo/rules' : `/bo/rules/${r.id}`, () => {
      if (Store.db.rules.some((x) => x.id !== r.id && x.name.trim().toLowerCase() === r.name.trim().toLowerCase())) throw new ApiError(422, 'VALIDATION_FAILED', 'Reguła o tej nazwie już istnieje.', [{ field: 'name', message: 'Reguła o tej nazwie już istnieje.' }]);
      const i = Store.db.rules.findIndex((x) => x.id === r.id);
      if (i >= 0) Store.db.rules[i] = r; else Store.db.rules.push({ ...r, order: Store.db.rules.length + 1 });
      return r;
    });
  },
  toggleRule(id: string, enabled: boolean) { return apiCall('PATCH', `/bo/rules/${id}`, () => { Store.db.rules.find((r) => r.id === id)!.enabled = enabled; }); },
  moveRule(id: string, dir: -1 | 1) {
    return apiCall('PATCH', `/bo/rules/${id}`, () => {
      const rs = Store.db.rules.sort((a, b) => a.order - b.order);
      const i = rs.findIndex((r) => r.id === id); const j = i + dir;
      if (j < 0 || j >= rs.length) return;
      [rs[i].order, rs[j].order] = [rs[j].order, rs[i].order];
    });
  },
  deleteRule(id: string) { return apiCall('DELETE', `/bo/rules/${id}`, () => { Store.db.rules = Store.db.rules.filter((r) => r.id !== id); }); },
  simulateRule(r: Rule) {
    return apiCall('POST', '/bo/rules/simulate', () => {
      const matched = Store.db.claims.filter((c) => matchRule(r, c.kind, c.items, c.value, Store.order(c.orderId) ? daysSinceDelivery(Store.order(c.orderId)!) : 0));
      // dane historyczne (90 dni) — szacunek proporcjonalny
      return { matched: matched.length, estimated90d: Math.round(matched.length / Math.max(1, Store.db.claims.length) * 790), sample: matched.slice(0, 4).map((c) => `${c.number} · ${KINDS[c.kind].short} · ${fmtMoney(c.value)}`) };
    });
  },
  analytics(period: 30 | 90, kind: string) {
    return apiCall('GET', `/bo/analytics/summary?period=${period}d${kind ? '&kind=' + kind : ''}`, () => buildAnalytics(period, kind), { empty: () => null });
  },
  policy() { return apiCall('GET', '/bo/settings/return-policy', () => Store.db.policy); },
  savePolicy(p: Policy) { return apiCall('PUT', '/bo/settings/return-policy', () => { Store.db.policy = p; return p; }); },
  templates() { return apiCall('GET', '/bo/templates', () => Store.db.templates, { empty: () => [] as Template[] }); },
  saveTemplate(t: Template) {
    return apiCall('PUT', `/bo/templates/${t.id}`, () => { const i = Store.db.templates.findIndex((x) => x.id === t.id); if (i >= 0) Store.db.templates[i] = t; else Store.db.templates.push(t); return t; });
  },
};

function viewFilter(view: string, c: Claim, me: string): boolean {
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
function buildAnalytics(period: 30 | 90, kind: string) {
  const m = period === 90 ? 2.95 : 1;
  const share: Record<string, number> = { '': 1, RETURN: 0.62, COMPLAINT: 0.24, TRANSPORT: 0.09, MISSING: 0.05 };
  const k = share[kind] ?? 1;
  const live = Store.db.claims.filter((c) => !kind || c.kind === kind);
  const total = Math.round(268 * m * k) + live.length;
  const auto = live.filter((c) => c.appliedRules.some((r) => ['R1', 'R2'].includes(r)) || c.timeline.some((t) => t.actor === 'System')).length;
  const recovered = Store.db.supplierClaims.reduce((s, x) => s + (x.response?.decision === 'ACCEPT' ? x.response.creditAmount ?? 0 : 0), 0);
  const reasonsBase: [string, number][] = kind === 'COMPLAINT' ? [['Nie działa / nie włącza się', 21], ['Działa z przerwami', 14], ['Problem z baterią', 9], ['Przecieka', 6], ['Wada wizualna', 5]]
    : kind === 'TRANSPORT' ? [['Produkt rozbity', 12], ['Zgnieciona paczka', 9], ['Paczka zalana', 3]]
    : kind === 'MISSING' ? [['Brak elementu zestawu', 8], ['Inny produkt', 4], ['Brak produktu', 2]]
    : [['Nie pasuje rozmiar', 74], ['Wygląda inaczej niż na zdjęciach', 38], ['Rozmyśliłem/-am się', 29], ['Nie działa / nie włącza się', 21], ['Znalazłem/-am taniej', 12], ['Produkt rozbity (transport)', 12]];
  const kindLabelToReason = (c: Claim) => reasonLabel(c.kind, c.items[0].reason);
  const reasons = reasonsBase.map(([l, v]) => [l, Math.round(v * m) + live.filter((c) => kindLabelToReason(c).startsWith(l.slice(0, 12))).length] as [string, number]);
  const products: [string, number][] = [['Koszula lniana', 31], ['Kurtka puchowa Nordic', 24], ['Słuchawki SoundPro X2', 17], ['Buty trekkingowe Alpina', 15], ['Ekspres Barista 500', 9], ['Lampa Lumo Glass', 7]].map(([l, v]) => [l as string, Math.round((v as number) * m * (kind ? k * 1.6 : 1))]);
  const weeksN = period === 90 ? 12 : 6;
  const baseWeek = [52, 61, 58, 70, 66, 59, 74, 63, 68, 71, 60, 66];
  const weeks: [string, number][] = Array.from({ length: weeksN }, (_, i) => {
    const d = addDays(todayISO(), -7 * (weeksN - 1 - i));
    return [`${fmtDate(d).slice(0, 5)}`, Math.round(baseWeek[(i + 12 - weeksN) % 12] * k) + (i === weeksN - 1 ? live.filter((c) => daysBetween(c.createdAt, todayISO()) <= 7).length : 0)];
  });
  const resolutions: [string, number][] = (kind === 'COMPLAINT' ? [['Wymiana na nowy', 38], ['Naprawa', 27], ['Zwrot pieniędzy', 18], ['Obniżenie ceny', 9]]
    : [['Zwrot pieniędzy', 56], ['Bon sklepowy', 21], ['Wymiana wariantu', 14], ['Wymiana na nowy', 7], ['Dosłanie części', 2]]).map(([l, v]) => [l as string, v as number]);
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
