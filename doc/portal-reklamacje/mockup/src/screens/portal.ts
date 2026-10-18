// Portal klienta: K-01 … K-05 oraz logowanie pracownika (X-03)

let lookupFailures = 0;

function kindTag(k: ClaimKind): string { return `<span class="tag tag-kind">${KINDS[k].icon} ${esc(KINDS[k].short)}</span>`; }

function claimCard(c: Claim, href: string): string {
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
    let mode: 'email' | 'phone' = 'email';
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
    const form = $('[data-form]', root)!;
    const contact = $('[data-contact]', root)!;
    const drawContact = () => {
      contact.innerHTML = mode === 'email'
        ? textField({ name: 'contact', label: 'E-mail z zamówienia', type: 'email', required: true, autocomplete: 'email' })
        : textField({ name: 'contact', label: 'Telefon z zamówienia', type: 'tel', required: true, autocomplete: 'tel' });
    };
    drawContact();
    $$('[data-mode]', root).forEach((b) => b.addEventListener('click', () => {
      mode = b.dataset.mode as typeof mode;
      $$('[data-mode]', root).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      drawContact();
    }));
    const drawCaptcha = () => { $('[data-captcha]', form)!.innerHTML = lookupFailures >= 5 ? `<div class="captcha">${checkboxField({ name: 'captcha', label: 'Nie jestem robotem (CAPTCHA — makieta)', checked: false, required: true })}</div>` : ''; };
    drawCaptcha();
    const validate = (): FieldError[] => {
      const v = formValues(form);
      const e: FieldError[] = [];
      if (!V.required(v.orderNo)) e.push({ field: 'orderNo', message: 'Wpisz numer zamówienia.' });
      else if (!V.orderNo(v.orderNo)) e.push({ field: 'orderNo', message: 'Numer zamówienia ma format TS-12345.' });
      if (!V.required(v.contact)) e.push({ field: 'contact', message: mode === 'email' ? 'Wpisz e-mail podany w zamówieniu.' : 'Wpisz telefon podany w zamówieniu.' });
      else if (mode === 'email' ? !V.email(v.contact) : !V.phone(v.contact)) e.push({ field: 'contact', message: mode === 'email' ? 'Wpisz poprawny e-mail, np. jan@example.com.' : 'Wpisz 9 cyfr numeru telefonu.' });
      if (lookupFailures >= 5 && v.captcha !== 'on') e.push({ field: 'captcha', message: 'Potwierdź, że nie jesteś robotem.' });
      return e;
    };
    bindBlurValidation(form, validate);
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const errs = validate();
      showErrors(form, errs, 'Popraw dane');
      if (errs.length) return;
      const v = formValues(form);
      const alertEl = $('[data-form-alert]', form)!;
      alertEl.innerHTML = '';
      const done = busy($('button[type=submit]', form) as HTMLButtonElement, 'Szukamy zamówienia…');
      try {
        const r = await api.lookupOrder(v.orderNo, v.contact);
        lookupFailures = 0;
        navigate('/zgloszenie/1?zamowienie=' + r.orderId);
      } catch (e) {
        done();
        if (e instanceof ApiError && e.code === 'ORDER_NOT_FOUND') {
          lookupFailures++; drawCaptcha();
          alertEl.innerHTML = alertBox('error', 'Nie znaleźliśmy zamówienia', 'Sprawdź numer w e-mailu potwierdzającym zamówienie oraz e-mail lub telefon podany przy zakupie.');
        } else if (e instanceof ApiError && e.code === 'NOT_DELIVERED') {
          alertEl.innerHTML = alertBox('info', `Zamówienie ${esc(String(e.extra.orderNumber))} jest jeszcze w drodze`, 'Zwrot lub reklamację zgłosisz po dostarczeniu paczki.', '<button type="button" class="btn btn-secondary btn-sm" data-track>Śledź przesyłkę</button>');
          $('[data-track]', alertEl)?.addEventListener('click', () => toast('Otwieramy stronę przewoźnika (demo).', 'info'));
        } else alertEl.innerHTML = alertBox('error', 'Nie udało się wyszukać zamówienia', esc((e as Error).message) + ' Spróbuj ponownie za chwilę.');
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
      const form = $('[data-form]', root)!;
      const validate = (): FieldError[] => { const v = formValues(form); return V.email(v.email) ? [] : [{ field: 'email', message: v.email ? 'Wpisz poprawny e-mail, np. jan@example.com.' : 'Wpisz e-mail.' }]; };
      bindBlurValidation(form, validate);
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const errs = validate(); showErrors(form, errs, 'Popraw e-mail'); if (errs.length) return;
        const email = formValues(form).email;
        const done = busy($('button[type=submit]', form) as HTMLButtonElement, 'Wysyłanie…');
        try { await api.magicLink(email); drawSent(email); }
        catch (e) { done(); $('[data-form-alert]', form)!.innerHTML = alertBox('error', 'Nie udało się wysłać linku', esc((e as Error).message)); }
      });
    };
    const drawSent = (email: string) => {
      let left = 60;
      root.innerHTML = `${screenTag('K-02', 'Logowanie linkiem e-mail')}<div class="container narrow section"><div class="card form-card center">
        <div class="big-icon" aria-hidden="true">✉️</div><h1>Sprawdź skrzynkę</h1>
        <p>Jeśli konto <strong>${esc(email)}</strong> istnieje, wysłaliśmy na nie link do logowania. Link jest ważny 15 minut.</p>
        <div class="row-wrap center-row"><button class="btn btn-ghost" data-change>Zmień e-mail</button><button class="btn btn-secondary" data-resend disabled>Wyślij ponownie (60 s)</button></div>
        <hr><button class="btn btn-primary" data-open>📬 Otwórz link z e-maila (demo)</button></div></div>`;
      const resend = $('[data-resend]', root) as HTMLButtonElement;
      const iv = setInterval(() => {
        if (!resend.isConnected) { clearInterval(iv); return; }
        left--; resend.disabled = left > 0; resend.textContent = left > 0 ? `Wyślij ponownie (${left} s)` : 'Wyślij ponownie';
      }, 1000);
      $('[data-change]', root)!.addEventListener('click', () => { clearInterval(iv); drawForm(); });
      resend.addEventListener('click', async () => { const d = busy(resend, 'Wysyłanie…'); await api.magicLink(email).catch(() => {}); d(); left = 60; toast('Wysłaliśmy nowy link.', 'info'); });
      $('[data-open]', root)!.addEventListener('click', async (e) => {
        const d = busy(e.currentTarget as HTMLButtonElement, 'Logowanie…');
        try { await api.magicVerify(email); clearInterval(iv); toast('Zalogowano.'); navigate(returnUrl); }
        catch (err) { d(); toast((err as Error).message, 'error'); }
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
    const wrap = $('[data-claims-wrap]', root)!;
    loadInto($('[data-claims]', root)!, {
      skeleton: skelCards(1), compactError: true,
      load: () => api.myClaims(),
      isEmpty: (cs) => cs.length === 0,
      empty: () => { wrap.hidden = true; return ''; },
      render: (cs) => { $('[data-claims]', root)!.innerHTML = `<div class="card list-card">${cs.map((c) => claimCard(c, '/zgloszenia/' + c.id)).join('')}</div>`; },
    });
    loadInto($('[data-orders]', root)!, {
      skeleton: skelCards(3),
      load: () => api.myOrders(),
      isEmpty: (os) => os.length === 0,
      empty: () => `<div class="card">${emptyState('🛍️', 'Nie widzimy zamówień dla tego e-maila', 'Kupowałeś/-aś jako gość na inny adres? Znajdź zamówienie po numerze.', '<a class="btn btn-secondary" href="#/">Znajdź zamówienie</a>')}</div>`,
      render: (os) => {
        $('[data-orders]', root)!.innerHTML = `<div class="orders">${os.map((o) => {
          const ret = kindAvailability(o, 'RETURN');
          const com = kindAvailability(o, 'COMPLAINT');
          const any = (Object.keys(KINDS) as ClaimKind[]).some((k) => kindAvailability(o, k).available);
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
    const form = $('[data-form]', root)!;
    const validate = (): FieldError[] => {
      const v = formValues(form); const e: FieldError[] = [];
      if (!V.rmaNo(v.rma)) e.push({ field: 'rma', message: v.rma ? 'Numer ma format RMA-2026-00871.' : 'Wpisz numer zgłoszenia.' });
      if (!V.email(v.email)) e.push({ field: 'email', message: v.email ? 'Wpisz poprawny e-mail.' : 'Wpisz e-mail.' });
      return e;
    };
    bindBlurValidation(form, validate);
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const errs = validate(); showErrors(form, errs, 'Popraw dane'); if (errs.length) return;
      const v = formValues(form);
      const done = busy($('button[type=submit]', form) as HTMLButtonElement, 'Szukamy…');
      try { const r = await api.claimStatus(v.rma, v.email); navigate('/zgloszenia/' + r.claimId); }
      catch (e) {
        done();
        $('[data-form-alert]', form)!.innerHTML = e instanceof ApiError && e.status === 404
          ? alertBox('error', 'Nie znaleźliśmy zgłoszenia', 'Sprawdź numer RMA i e-mail podany w zgłoszeniu.')
          : alertBox('error', 'Nie udało się sprawdzić statusu', esc((e as Error).message) + ' Spróbuj ponownie.');
      }
    });
  },
});

// ---------- K-05 Szczegóły zgłoszenia ----------
function whatNow(c: Claim): string {
  if (c.status === 'APPROVED') {
    if (c.returnMethod === 'NONE') return 'Nie musisz odsyłać produktu. Realizujemy rozwiązanie.';
    if (c.returnMethod === 'COURIER') return `Kurier odbierze paczkę ${c.courier?.date ? fmtDate(c.courier.date) : 'w najbliższy dzień roboczy'} spod adresu ${esc(c.courier?.street ?? '')}. Zapakuj produkt.`;
    if (c.returnMethod === 'STORE') return `Zanieś produkt do sklepu: ${esc(STORES.find((s) => s.id === c.store)?.name ?? '')}. Pokaż kod QR przy kasie.`;
    return `Nadaj paczkę w paczkomacie do ${fmtDate(c.label?.expiresAt ?? '')} — zeskanuj kod QR na ekranie paczkomatu.`;
  }
  if (c.status === 'RESOLVED' && c.outcome) {
    const o = c.outcome;
    return o.type === 'REFUND' ? `Zwrot ${fmtMoney(o.amount ?? 0)} został zlecony — środki pojawią się na koncie w ciągu 1–3 dni roboczych.`
      : o.type === 'STORE_CREDIT' ? `Bon o wartości ${fmtMoney(o.amount ?? 0)} wysłaliśmy e-mailem.`
      : o.type === 'PRICE_REDUCTION' ? `Zwrot różnicy ${fmtMoney(o.amount ?? 0)} został zlecony.`
      : `Wysłaliśmy ${o.type === 'SPARE_PART' ? 'brakujący element' : 'nowy produkt'} — zamówienie ${esc(o.ref ?? '')}.`;
  }
  if (c.status === 'AWAITING_CUSTOMER') return c.offer?.status === 'PENDING' ? 'Sklep zaproponował rozwiązanie — zaakceptuj je lub odrzuć poniżej.' : 'Uzupełnij informacje, o które prosi sklep — formularz poniżej.';
  if (c.status === 'SUBMITTED' && c.kind === 'COMPLAINT') return `Odpowiemy najpóźniej do ${fmtDate(c.responseDueAt)} (14 dni), zwykle szybciej.`;
  return STATUS[c.status].next;
}

route({
  pattern: '/zgloszenia/:id', id: 'K-05', title: 'Twoje zgłoszenie', roles: ['CUSTOMER'],
  render(root, p) {
    root.innerHTML = `${screenTag('K-05', 'Szczegóły zgłoszenia')}<div class="container section" data-body></div>`;
    const body = $('[data-body]', root)!;
    const load = () => loadInto(body, {
      skeleton: `<div aria-busy="true"><div class="skel skel-title" style="width:40%"></div>${skelCards(3)}</div>`,
      load: () => api.claim(p.id),
      render: (c) => renderCustomerClaim(body, c, load),
    });
    load();
  },
});

function renderCustomerClaim(body: HTMLElement, c: Claim, reload: () => void): void {
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
  renderActionCard($('[data-action]', body)!, c, reload);
  bindCounters(body);
  const mf = $('[data-msg]', body)!;
  mf.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const v = formValues(mf);
    if (!v.body) { showErrors(mf, [{ field: 'body', message: 'Wpisz treść wiadomości.' }], 'Nie można wysłać'); return; }
    clearErrors(mf);
    const done = busy($('button[type=submit]', mf) as HTMLButtonElement, 'Wysyłanie…');
    try { const m = await api.sendMessage(c.id, v.body); msgs.push(m); $('[data-thread]', body)!.innerHTML = threadHtml(msgs, 'CUSTOMER'); ($('textarea', mf) as HTMLTextAreaElement).value = ''; toast('Wiadomość wysłana.'); }
    catch { showErrors(mf, [{ field: 'body', message: 'Nie udało się wysłać — spróbuj ponownie. Treść została zachowana.' }], 'Błąd wysyłki'); }
    done();
  });
  $('[data-cancel]', body)?.addEventListener('click', async () => {
    if (!(await confirmModal('Anulować zgłoszenie?', 'Zgłoszenie zostanie zamknięte. Jeśli zmienisz zdanie, możesz utworzyć nowe — w terminie zwrotu lub reklamacji.', 'Anuluj zgłoszenie', true))) return;
    try { await api.cancelClaim(c.id); toast('Zgłoszenie anulowane.', 'info'); reload(); } catch (e) { toast((e as Error).message, 'error'); }
  });
}

function threadHtml(msgs: Message[], me: 'CUSTOMER' | 'AGENT'): string {
  if (!msgs.length) return emptyState('💬', 'Brak wiadomości', me === 'CUSTOMER' ? 'Masz pytanie? Napisz do nas — odpowiadamy zwykle w ciągu kilku godzin.' : 'Brak korespondencji w tej sprawie.');
  return msgs.map((m) => `<div class="msg ${m.from === me ? 'msg-me' : m.from === 'SYSTEM' ? 'msg-sys' : 'msg-them'} ${m.internal ? 'msg-internal' : ''}"><div class="msg-meta">${m.internal ? '🔒 Notatka wewnętrzna · ' : ''}${esc(m.author)} · ${fmtDateTime(m.at)}</div><div class="msg-body">${esc(m.body)}</div></div>`).join('');
}

function renderActionCard(box: HTMLElement, c: Claim, reload: () => void): void {
  // Propozycja sklepu
  if (c.status === 'AWAITING_CUSTOMER' && c.offer?.status === 'PENDING') {
    const o = c.offer;
    box.innerHTML = `<section class="card action-card warn"><h2 class="h3">Propozycja sklepu</h2>
      <div class="offer"><span class="offer-icon" aria-hidden="true">${RESOLUTIONS[o.resolution].icon}</span><div><strong>${esc(RESOLUTIONS[o.resolution].label)}${o.amount ? `: ${fmtMoney(o.amount)}` : ''}</strong><p>${esc(o.text)}</p></div></div>
      <div class="row-wrap"><button class="btn btn-primary" data-accept>Akceptuję</button><button class="btn btn-secondary" data-decline>Odrzucam</button></div></section>`;
    $('[data-accept]', box)!.addEventListener('click', async (e) => {
      const d = busy(e.currentTarget as HTMLButtonElement, 'Zapisywanie…');
      try { await api.offerDecision(c.id, true, ''); toast('Dziękujemy — propozycja zaakceptowana.'); reload(); } catch (err) { d(); toast((err as Error).message, 'error'); }
    });
    $('[data-decline]', box)!.addEventListener('click', () => {
      openModal({
        title: 'Odrzucić propozycję?', body: `<form novalidate data-form>${textareaField({ name: 'comment', label: 'Dlaczego? (pomoże nam znaleźć inne rozwiązanie)', max: 500, rows: 3 })}</form>`,
        onOpen: (el) => bindCounters(el),
        actions: [{ label: 'Wróć', onClick: ({ close }) => close() }, {
          label: 'Odrzuć propozycję', kind: 'danger', onClick: async ({ el, close, btn }) => {
            const d = busy(btn, 'Zapisywanie…');
            try { await api.offerDecision(c.id, false, formValues($('[data-form]', el)!).comment); close(); toast('Przekazaliśmy Twoją decyzję do sklepu.', 'info'); reload(); }
            catch (err) { d(); toast((err as Error).message, 'error'); }
          },
        }],
      });
    });
    return;
  }
  // Prośba o informacje
  if (c.status === 'AWAITING_CUSTOMER' && c.requestedInfo?.length) {
    const req = c.requestedInfo;
    const files: FileMeta[] = [];
    box.innerHTML = `<section class="card action-card warn"><h2 class="h3">Sklep prosi o uzupełnienie</h2>
      <ul class="checklist">${req.map((r) => `<li>${esc(REQUEST_ITEMS.find((x) => x[0] === r)?.[1] ?? r)}</li>`).join('')}</ul>
      <form novalidate data-form>
        ${req.includes('PHOTO') || req.includes('VIDEO') || req.includes('RECEIPT') ? `<div class="field" data-field="files" tabindex="-1"><label>Pliki <span class="req">*</span></label>${req.includes('VIDEO') ? '<div class="hint">Nagraj 10–30 s pokazujące wadę. Wideo do 100 MB.</div>' : ''}${uploaderHtml('resp', [])}<div class="field-error" hidden></div></div>` : ''}
        ${req.includes('SERIAL') ? textField({ name: 'serial', label: 'Numer seryjny', required: true, hint: 'Na naklejce na spodzie lub z tyłu urządzenia (S/N).', attrs: 'style="text-transform:uppercase"', cls: 'w-md' }) : ''}
        ${textareaField({ name: 'message', label: 'Wiadomość', max: 2000, rows: 2 })}
        <div data-form-alert></div>
        <button class="btn btn-primary" type="submit">Wyślij odpowiedź</button></form>
      <p class="demo-hint">Demo: numer seryjny np. <code>KF-B500-11823</code>; użyj „+ nagranie wideo”.</p></section>`;
    const form = $('[data-form]', box)!;
    bindCounters(form);
    bindUploader(form, 'resp', files, c.id, () => {});
    const validate = (): FieldError[] => {
      const v = formValues(form); const e: FieldError[] = [];
      const ready = files.filter((f) => f.status === 'ready');
      if (files.some((f) => f.status === 'uploading' || f.status === 'scanning')) e.push({ field: 'files', message: 'Poczekaj na zakończenie wysyłania plików.' });
      if (req.includes('VIDEO') && !ready.some((f) => isVideo(f.name, f.mime))) e.push({ field: 'files', message: 'Dodaj nagranie wideo (MP4 lub MOV).' });
      if (req.includes('PHOTO') && !ready.some((f) => !isVideo(f.name, f.mime))) e.push({ field: 'files', message: 'Dodaj co najmniej jedno zdjęcie.' });
      if (req.includes('RECEIPT') && !ready.length) e.push({ field: 'files', message: 'Dodaj dowód zakupu (zdjęcie lub PDF).' });
      if (req.includes('SERIAL')) { if (!v.serial) e.push({ field: 'serial', message: 'Wpisz numer seryjny.' }); else if (!V.serial(v.serial)) e.push({ field: 'serial', message: 'Numer seryjny ma 6–20 znaków: litery, cyfry i myślniki.' }); }
      return e;
    };
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const errs = validate(); showErrors(form, errs, 'Uzupełnij odpowiedź'); if (errs.length) return;
      const v = formValues(form);
      const d = busy($('button[type=submit]', form) as HTMLButtonElement, 'Wysyłanie…');
      try { await api.respond(c.id, files, v.serial ?? '', v.message); toast('Dziękujemy! Przekazaliśmy informacje do sklepu.'); reload(); }
      catch (e) { d(); $('[data-form-alert]', form)!.innerHTML = alertBox('error', 'Nie udało się wysłać', esc((e as Error).message) + ' Pliki zostały zachowane — spróbuj ponownie.'); }
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
    $('[data-pdf]', box)!.addEventListener('click', async (e) => {
      const d = busy(e.currentTarget as HTMLButtonElement, 'Pobieranie…');
      try { await api.download(`/portal/claims/${c.id}/label`); toast('Pobieranie rozpoczęte (demo).', 'info'); } catch { toast('Nie udało się pobrać — wysłaliśmy etykietę także e-mailem.', 'error'); }
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
      const d = busy(b as HTMLButtonElement, 'Logowanie…');
      try {
        await apiCall('POST', '/auth/sso/callback', () => { Store.db.session = clone(DEMO_SESSIONS[b.dataset.r!]); });
        const ret = q.get('returnUrl');
        navigate(ret && shellFor(ret) !== 'shop' ? ret : homeFor(b.dataset.r as Role));
      } catch (e) { d(); toast((e as Error).message, 'error'); }
    }));
  },
});
