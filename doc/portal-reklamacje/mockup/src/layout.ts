// Powłoki aplikacji (portal klienta / panel obsługi / portal dostawcy) i panel demo

const DEMO_SESSIONS: Record<string, Session> = {
  CUSTOMER: { role: 'CUSTOMER', name: 'Anna', email: DEMO.email },
  AGENT: { role: 'AGENT', name: 'Marta Wiśniewska' },
  WAREHOUSE: { role: 'WAREHOUSE', name: 'Jan Kowal (magazyn Błonie)' },
  SUPPLIER: { role: 'SUPPLIER', name: 'CleanAir Europe', supplierId: 'sup-cleanair' },
};

function homeFor(role?: Role): string {
  if (role === 'AGENT') return '/obsluga';
  if (role === 'WAREHOUSE') return '/magazyn';
  if (role === 'SUPPLIER') return '/dostawca';
  if (role === 'CUSTOMER') return Store.db.session?.email && !Store.db.session.orderId ? '/konto' : '/';
  return '/';
}

function shellFor(path: string): 'shop' | 'bo' | 'supplier' {
  if (/^\/(obsluga|magazyn)/.test(path)) return 'bo';
  if (path.startsWith('/dostawca')) return 'supplier';
  if (path.startsWith('/zgloszenie') && Store.db.session?.role === 'AGENT') return 'bo';
  if (path.startsWith('/panel-logowanie')) return 'supplier';
  return 'shop';
}

function renderShell(): void {
  const { path } = parseHash();
  const shell = shellFor(path);
  document.body.classList.toggle('shell-bo', shell === 'bo');
  document.body.classList.toggle('shell-supplier', shell === 'supplier');
  document.body.classList.toggle('shell-shop', shell === 'shop');
  const header = $('#header')!;
  header.className = shell === 'bo' ? 'sidebar' : 'app-header';
  if (shell === 'bo') renderSidebar(header, path);
  else if (shell === 'supplier') renderSupplierHeader(header);
  else renderShopHeader(header, path);
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
  $('#footer')!.hidden = shell === 'bo';
}

function renderShopHeader(header: HTMLElement, path: string): void {
  const s = Store.db.session;
  const customer = s?.role === 'CUSTOMER';
  const items: [string, string][] = [['/', 'Zwroty i reklamacje'], ['/status', 'Sprawdź status']];
  if (customer && s?.email && !s.orderId) items.push(['/konto', 'Moje zamówienia']);
  header.innerHTML = `<div class="container header-inner">
    <a class="logo" href="#/" aria-label="${SHOP.name} — zwroty i reklamacje"><span class="logo-mark" aria-hidden="true">T</span><span><strong>${SHOP.name}</strong><small>Zwroty i reklamacje</small></span></a>
    <button class="icon-btn nav-toggle" aria-expanded="false" aria-controls="main-nav" aria-label="Menu">☰</button>
    <nav id="main-nav" class="main-nav" aria-label="Menu główne">
      <ul>${items.map(([h, l]) => `<li><a href="#${h}" ${path === h ? 'aria-current="page"' : ''}>${l}</a></li>`).join('')}</ul>
      <div class="nav-actions">
        ${customer ? `<span class="user-chip" aria-hidden="true">${esc(s!.name.charAt(0))}</span><span class="user-name">${esc(s!.email ?? s!.name)}</span><button class="btn btn-ghost btn-sm" data-logout>Wyloguj</button>`
          : s ? `<a class="btn btn-secondary btn-sm" href="#${homeFor(s.role)}">Wróć do panelu</a>` : `<a class="btn btn-secondary btn-sm" href="#/logowanie">Zaloguj się</a>`}
      </div></nav></div>`;
}

function renderSupplierHeader(header: HTMLElement): void {
  const s = Store.db.session;
  header.innerHTML = `<div class="container header-inner">
    <a class="logo" href="#${homeFor(s?.role)}"><span class="logo-mark dark" aria-hidden="true">T</span><span><strong>${SHOP.name}</strong><small>${s?.role === 'SUPPLIER' ? 'Portal dostawcy' : 'Panel obsługi'}</small></span></a>
    <div class="nav-actions push">${s ? `<span class="user-name">${esc(s.name)}</span><button class="btn btn-ghost btn-sm" data-logout>Wyloguj</button>` : ''}</div></div>`;
}

function renderSidebar(header: HTMLElement, path: string): void {
  const s = Store.db.session;
  const role = s?.role;
  const toDecide = Store.db.claims.filter((c) => c.status === 'SUBMITTED').length;
  const overdue = Store.db.claims.filter((c) => OPEN_STATUSES.includes(c.status) && daysBetween(todayISO(), c.responseDueAt) < 2).length;
  const inbound = Store.db.claims.filter((c) => c.status === 'IN_TRANSIT').length;
  const supDraft = Store.db.supplierClaims.filter((x) => x.status === 'DRAFT').length;
  const items: [string, string, string, string][] = role === 'WAREHOUSE' ? [['/magazyn', '📥', 'Magazyn', inbound ? String(inbound) : '']] : [
    ['/obsluga', '📨', 'Skrzynka', toDecide ? String(toDecide) : ''],
    ['/magazyn', '📥', 'Magazyn', inbound ? String(inbound) : ''],
    ['/obsluga/dostawcy', '🏭', 'Dostawcy', supDraft ? String(supDraft) : ''],
    ['/obsluga/reguly', '⚙️', 'Reguły', ''],
    ['/obsluga/analityka', '📊', 'Analityka', ''],
    ['/obsluga/ustawienia', '🛠️', 'Ustawienia', ''],
  ];
  const active = (h: string) => h === '/obsluga' ? (path === '/obsluga' || path.startsWith('/obsluga/zgloszenia') || path.startsWith('/zgloszenie') || path === '/obsluga/nowe') : path.startsWith(h);
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

function renderFooter(): void {
  $('#footer')!.innerHTML = `<div class="container footer-inner">
    <div><strong>Pomoc</strong><br><a href="mailto:${SHOP.support}">${SHOP.support}</a> · ${SHOP.phone}</div>
    <div class="small muted">Mockup koncepcyjny · dane fikcyjne · „${SHOP.name}” to nazwa przykładowa</div>
    <div class="small"><a href="#/">Polityka zwrotów</a> · <a href="#/status">Sprawdź status</a></div></div>`;
}

// ---------- Panel demo ----------
const SCREEN_MAP: [string, string, string, Role | ''][] = [
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

function switchRole(role: string): void {
  Store.db.session = role ? clone(DEMO_SESSIONS[role]) : null;
  Store.db.draft = null;
  Store.save();
}

function renderDemoPanel(): void {
  const el = $('#demo')!;
  el.innerHTML = `<button class="demo-toggle" aria-expanded="false" aria-controls="demo-body">🛠 Panel demo</button>
    <div class="demo-body" id="demo-body" hidden>
      <div class="demo-head"><strong>Panel demo</strong><span class="demo-screen" data-cur-screen></span></div>
      <p class="muted small">Nie jest częścią produktu — służy do pokazania stanów, ról i ścieżek.</p>
      <section><h4>Scenariusz API</h4>
        <div class="demo-scen">${([['normal', 'Normalny'], ['slow', 'Wolne API (loading)'], ['empty', 'Puste dane (empty)'], ['error', 'Błąd serwera (error)']] as [Scenario, string][])
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
  const toggle = $('.demo-toggle', el)!;
  const body = $('#demo-body', el)!;
  toggle.addEventListener('click', () => {
    body.hidden = !body.hidden;
    toggle.setAttribute('aria-expanded', String(!body.hidden));
    storage.set('portal-reklamacje-demo-open', body.hidden ? '' : '1');
  });
  if (storage.get('portal-reklamacje-demo-open') === '1') { body.hidden = false; toggle.setAttribute('aria-expanded', 'true'); }
  $$('input[name=scenario]', el).forEach((r) => r.addEventListener('change', () => { Demo.setScenario((r as HTMLInputElement).value as Scenario); renderRoute(); }));
  $$('[data-role]', el).forEach((b) => b.addEventListener('click', () => {
    const r = b.dataset.role!;
    Router.leaveGuard = null;
    switchRole(r);
    navigate(r ? homeFor(r as Role) : '/');
  }));
  $$('[data-map]', el).forEach((a) => a.addEventListener('click', (e) => {
    const [, , p, r] = SCREEN_MAP[Number(a.dataset.map)];
    const cur = Store.db.session?.role ?? '';
    if (r && cur !== r) { e.preventDefault(); Router.leaveGuard = null; switchRole(r); navigate(p); }
  }));
  $$('[data-demo]', el).forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.demo === 'expire') { if (Store.db.session) showSessionExpired(); else toast('Najpierw zaloguj się (np. przyciskiem roli).', 'info'); }
    if (b.dataset.demo === 'reset' && await confirmModal('Reset danych demo', 'Przywrócić dane początkowe? Zgłoszenia utworzone w trakcie demo zostaną usunięte.', 'Przywróć', true)) {
      Store.reset(); toast('Przywrócono dane demo.', 'info'); navigate('/');
    }
  }));
  Demo.listeners.push(updateDemoLog);
}

function updateDemoLog(): void {
  const ul = $('[data-log]');
  if (!ul) return;
  ul.innerHTML = Demo.log.length
    ? Demo.log.slice(0, 12).map((l) => `<li><span class="m m-${l.method.toLowerCase()}">${l.method}</span> <code>${esc(l.path)}</code> <span class="st ${l.status >= 400 ? 'bad' : ''}">${l.status}</span> <span class="muted">${l.ms} ms</span></li>`).join('')
    : '<li class="muted">Brak wywołań</li>';
}

function updateDemoPanel(): void {
  $$('#demo input[name=scenario]').forEach((r) => { (r as HTMLInputElement).checked = (r as HTMLInputElement).value === Demo.scenario; });
  const cur = $('[data-cur-screen]');
  if (cur && Router.current) cur.textContent = 'Ekran ' + (Router.current.id === 'Z-0x' ? 'Z-0' + (parseHash().path.split('/').pop() ?? '') : Router.current.id);
  $('.demo-toggle')?.classList.toggle('alert-on', Demo.scenario !== 'normal');
  updateDemoLog();
}
