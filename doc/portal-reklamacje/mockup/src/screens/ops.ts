// Operacje: B-03 Magazyn, B-04 Reklamacje do dostawców, D-01 Portal dostawcy

const CONDITIONS: [string, string][] = [['NEW', 'Nowy, nieużywany'], ['OPENED', 'Otwarty, nieużywany'], ['USED', 'Używany'], ['DAMAGED', 'Uszkodzony']];
const DISPOSITIONS: [string, string][] = [['RESTOCK', 'Na stan (sprzedaż)'], ['OUTLET', 'Outlet'], ['SUPPLIER', 'Do dostawcy'], ['SCRAP', 'Utylizacja']];
const SC_STATUS: Record<SupplierClaim['status'], [string, string]> = { DRAFT: ['Szkic', 'neutral'], SENT: ['Wysłana', 'info'], ACCEPTED: ['Uznana', 'ok'], REJECTED: ['Odrzucona', 'danger'], CREDITED: ['Zaksięgowana', 'ok'] };

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
    const scanForm = $('[data-scan]', root)!;
    const scanInput = $('#scan', root) as HTMLInputElement;
    const err = $('[data-scan-err]', root)!;
    const insp = $('[data-inspect]', root)!;
    scanInput.focus();
    const loadLists = () => loadInto($('[data-expected]', root)!, {
      skeleton: skelTable(3), compactError: true,
      load: () => api.inbound(),
      isEmpty: (d) => d.expected.length === 0,
      empty: () => `<div class="card">${emptyState('📭', 'Brak przesyłek w drodze', 'Nowe zwroty pojawią się tu po nadaniu przez klientów.')}</div>`,
      render: (d) => {
        $('[data-expected]', root)!.innerHTML = `<div class="card list-card">${d.expected.map((c) => `<div class="claim-row"><span class="cr-icon" aria-hidden="true">${c.items[0].emoji}</span><span class="cr-main"><span class="cr-title mono">${esc(c.number)}</span><span class="cr-sub">${c.items.map((i) => `${i.qty}× ${esc(i.name)}`).join(', ')} · ${esc(KINDS[c.kind].short)}</span></span><span class="cr-status">${statusBadge(c.status)}</span><button class="btn btn-secondary btn-sm" data-take="${esc(c.number)}">Przyjmij</button></div>`).join('')}</div>`;
        $('[data-today]', root)!.innerHTML = d.today.length ? `<div class="card list-card">${d.today.map((c) => `<div class="claim-row"><span class="cr-icon" aria-hidden="true">${c.items[0].emoji}</span><span class="cr-main"><span class="cr-title mono">${esc(c.number)}</span><span class="cr-sub">Ocena ${c.inspection!.grade} · ${esc(DISPOSITIONS.find((x) => x[0] === c.inspection!.disposition)![1])}</span></span><span class="small muted">${fmtDateTime(c.inspection!.at).split(', ')[1]}</span></div>`).join('')}</div>` : `<div class="card card-quiet"><p class="muted">Dziś jeszcze nic nie przyjęto.</p></div>`;
        $$('[data-take]', root).forEach((b) => b.addEventListener('click', () => { scanInput.value = b.dataset.take!; (scanForm as HTMLFormElement).requestSubmit(); }));
      },
    });
    scanForm.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const code = scanInput.value.trim();
      if (!code) { err.hidden = false; err.textContent = 'Zeskanuj lub wpisz kod przesyłki.'; return; }
      err.hidden = true;
      insp.innerHTML = `<div class="card">${spinner()} Szukamy przesyłki ${esc(code)}…</div>`;
      try { const c = await api.warehouseLookup(code); renderInspection(insp, c, () => { insp.innerHTML = ''; scanInput.value = ''; scanInput.focus(); loadLists(); }); }
      catch (e) { insp.innerHTML = alertBox(e instanceof ApiError && e.status === 404 ? 'warning' : 'error', e instanceof ApiError && e.status === 404 ? 'Nie znaleziono przesyłki' : 'Nie można przyjąć', esc((e as Error).message), e instanceof ApiError && e.status === 404 ? '<div class="small">Paczka bez kodu? Utwórz przyjęcie bez RMA i przekaż do obsługi (poza mockupem).</div>' : ''); scanInput.select(); }
    });
    loadLists();
  },
});

function renderInspection(box: HTMLElement, c: Claim, done: () => void): void {
  const expected = c.items.reduce((s, i) => s + i.qty, 0);
  const defect = c.kind === 'COMPLAINT' || c.kind === 'TRANSPORT';
  const files: FileMeta[] = [];
  box.innerHTML = `<section class="card inspect-card"><div class="row-between"><h2 class="h3">Inspekcja · <span class="mono">${esc(c.number)}</span></h2>${kindTag(c.kind)}</div>
    <div class="expected">${c.items.map((i) => `<div class="item-row"><span class="thumb lg" aria-hidden="true">${i.emoji}</span><div><strong>${i.qty}× ${esc(i.name)}</strong><div class="small muted">${esc(i.variant)} · ${esc(i.sku)}${i.serial ? ' · S/N ' + esc(i.serial) : ''}</div><div class="small">Zgłoszony powód: ${esc(reasonLabel(c.kind, i.reason))}${i.description ? ' — „' + esc(i.description) + '”' : ''}</div></div></div>`).join('')}</div>
    <form novalidate data-form>
      <div class="grid-2">${selectField({ name: 'qty', label: 'Przyjęta ilość', required: true, value: String(expected), options: Array.from({ length: expected + 1 }, (_, i) => [String(i), `${i} z ${expected}`] as [string, string]) })}
        ${checkboxField({ name: 'complete', label: 'Komplet (akcesoria, instrukcja)', checked: true })}</div>
      ${radioGroup({ name: 'condition', label: 'Stan produktu', required: true, value: '', options: CONDITIONS, inline: true })}
      ${radioGroup({ name: 'grade', label: 'Ocena', required: true, value: '', options: [['A', 'A — jak nowy'], ['B', 'B — drobne ślady'], ['C', 'C — uszkodzony / niesprzedawalny']], inline: true })}
      ${defect ? radioGroup({ name: 'defect', label: 'Czy wada zgłoszona przez klienta jest potwierdzona?', required: true, value: '', options: [['yes', 'Tak'], ['no', 'Nie']], inline: true }) : ''}
      ${radioGroup({ name: 'disposition', label: 'Dyspozycja', required: true, value: '', options: DISPOSITIONS, inline: true })}
      ${textareaField({ name: 'notes', label: 'Notatka', max: 500, rows: 2, hint: 'Wymagana, gdy ilość się nie zgadza lub produkt jest niekompletny.' })}
      <div class="field"><label>Zdjęcia z inspekcji <span class="opt">(opcjonalnie)</span></label>${uploaderHtml('insp', [], true)}</div>
      <div data-form-alert></div>
      <div class="row-wrap"><button class="btn btn-primary btn-lg" type="submit">Zatwierdź przyjęcie</button><button type="button" class="btn btn-ghost" data-cancel>Anuluj</button></div></form></section>`;
  const form = $('[data-form]', box)!;
  bindCounters(form);
  bindUploader(form, 'insp', files, c.id, () => {});
  $('[data-cancel]', box)!.addEventListener('click', done);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const v = formValues(form);
    const e: FieldError[] = [];
    if (!v.condition) e.push({ field: 'condition', message: 'Wybierz stan produktu.' });
    if (!v.grade) e.push({ field: 'grade', message: 'Wybierz ocenę A/B/C.' });
    if (defect && !v.defect) e.push({ field: 'defect', message: 'Zaznacz, czy wada jest potwierdzona.' });
    if (!v.disposition) e.push({ field: 'disposition', message: 'Wybierz dyspozycję towaru.' });
    if ((Number(v.qty) < expected || v.complete !== 'on') && v.notes.trim().length < 5) e.push({ field: 'notes', message: 'Opisz rozbieżność (ilość lub braki w komplecie).' });
    showErrors(form, e, 'Uzupełnij inspekcję');
    if (e.length) return;
    const d = busy($('button[type=submit]', form) as HTMLButtonElement, 'Zapisywanie…');
    try {
      await api.inspect(c.id, { qtyReceived: Number(v.qty), complete: v.complete === 'on', condition: v.condition as Inspection['condition'], grade: v.grade as Inspection['grade'], defectConfirmed: (defect ? v.defect : 'na') as Inspection['defectConfirmed'], disposition: v.disposition as Inspection['disposition'], notes: v.notes });
      toast(`Przyjęto ${c.number}. Zgłoszenie trafiło do obsługi.`);
      done();
    } catch (err) { d(); $('[data-form-alert]', form)!.innerHTML = alertBox('error', 'Nie udało się zapisać inspekcji', esc((err as Error).message) + ' Dane formularza zostały zachowane.'); }
  });
}

// ---------- B-04 Reklamacje do dostawców ----------
route({
  pattern: '/obsluga/dostawcy', id: 'B-04', title: 'Reklamacje do dostawców', roles: ['AGENT'],
  render(root) {
    root.innerHTML = `${screenTag('B-04', 'Reklamacje do dostawców')}<div class="bo-page">
      <div class="page-head"><div><h1>Reklamacje do dostawców</h1><p class="muted">Udokumentowane reklamacje przekazywane producentom — odzysk kosztów wadliwych produktów.</p></div></div>
      <div data-body></div></div>`;
    const bodyEl = $('[data-body]', root)!;
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
        $$('[data-open]', bodyEl).forEach((b) => b.addEventListener('click', () => openSupplierDrawer(list.find((x) => x.id === b.dataset.open)!, load)));
      },
    });
    load();
  },
});

function openSupplierDrawer(sc: SupplierClaim, reload: () => void): void {
  const sup = Store.supplier(sc.supplierId)!;
  const claims = sc.claimIds.map((id) => Store.claim(id)!).filter(Boolean);
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
      ...(sc.status === 'DRAFT' ? [{ label: blocked ? 'Uzupełnij dowody, aby wysłać' : 'Wyślij do dostawcy', kind: 'primary' as const, onClick: async ({ close, btn, el }: { close: () => void; btn: HTMLButtonElement; el: HTMLElement }) => {
        if (blocked) return;
        const d = busy(btn, 'Wysyłanie…');
        try { await api.sendSupplierClaim(sc.id); close(); toast(`Wysłano ${sc.number} do ${sup.name}.`); reload(); }
        catch (e) { d(); $('[data-alert]', el)!.innerHTML = alertBox('error', 'Nie udało się wysłać', esc((e as Error).message)); }
      } }] : []),
      ...(sc.status === 'ACCEPTED' ? [{ label: 'Oznacz notę jako zaksięgowaną', kind: 'primary' as const, onClick: async ({ close }: { close: () => void }) => { await api.markCredited(sc.id); close(); toast('Zaksięgowano.'); reload(); } }] : []),
    ],
  });
  if (sc.status === 'DRAFT' && blocked) (m.el.querySelector('.modal-foot .btn-primary') as HTMLButtonElement).disabled = true;
  $$('[data-close-nav]', m.el).forEach((a) => a.addEventListener('click', () => m.close()));
}

// ---------- D-01 Portal dostawcy ----------
route({
  pattern: '/dostawca', id: 'D-01', title: 'Portal dostawcy', roles: ['SUPPLIER'],
  render(root) {
    const sup = Store.supplier(Store.db.session!.supplierId!)!;
    root.innerHTML = `${screenTag('D-01', 'Portal dostawcy')}<div class="container section">
      <div class="page-head"><div><h1>Reklamacje od ${SHOP.name}</h1><p class="muted">${esc(sup.name)} · warunki: gwarancja ${sup.warrantyMonths} mies.</p></div></div>
      <div data-list></div><div data-detail></div></div>`;
    const list = $('[data-list]', root)!;
    const detail = $('[data-detail]', root)!;
    const load = () => loadInto(list, {
      skeleton: skelTable(3),
      load: () => api.supPortalClaims(),
      isEmpty: (l) => l.length === 0,
      empty: () => `<div class="card">${emptyState('📭', 'Brak reklamacji do rozpatrzenia', `Gdy ${SHOP.name} przekaże reklamację, pojawi się tutaj wraz z dowodami.`)}</div>`,
      render: (l) => {
        list.innerHTML = `<div class="card table-wrap"><table class="table bo-table"><caption class="sr-only">Reklamacje</caption><thead><tr><th scope="col">Numer</th><th scope="col">Otrzymano</th><th scope="col">Pozycje</th><th scope="col" class="num">Wartość</th><th scope="col">Status</th><th scope="col"></th></tr></thead>
          <tbody>${l.map((x) => `<tr><td data-label="Numer" class="mono">${esc(x.number)}</td><td data-label="Otrzymano">${fmtDate(x.sentAt ?? x.createdAt)}</td><td data-label="Pozycje">${x.claimIds.length}</td><td data-label="Wartość" class="num">${fmtMoney(x.amount)}</td>
            <td data-label="Status"><span class="badge badge-${SC_STATUS[x.status][1]}">${x.status === 'SENT' ? 'Do rozpatrzenia' : SC_STATUS[x.status][0]}</span></td><td><button class="btn btn-secondary btn-sm" data-open="${x.id}">${x.status === 'SENT' ? 'Rozpatrz' : 'Pokaż'}</button></td></tr>`).join('')}</tbody></table></div>`;
        $$('[data-open]', list).forEach((b) => b.addEventListener('click', () => drawSupDetail(detail, l.find((x) => x.id === b.dataset.open)!, () => { load(); })));
        const first = l.find((x) => x.status === 'SENT');
        if (first && !detail.innerHTML) drawSupDetail(detail, first, load);
      },
    });
    load();
  },
});

function drawSupDetail(box: HTMLElement, sc: SupplierClaim, reload: () => void): void {
  const claims = sc.claimIds.map((id) => Store.claim(id)).filter(Boolean) as Claim[];
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
  if (!form) return;
  bindCounters(form); applyConditions(form); form.addEventListener('change', () => applyConditions(form));
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const v = formValues(form); const e: FieldError[] = [];
    if (!v.decision) e.push({ field: 'decision', message: 'Wybierz decyzję.' });
    if (v.decision === 'ACCEPT') {
      if (!V.money(v.amount)) e.push({ field: 'amount', message: 'Podaj kwotę większą od zera.' });
      else if (Number(v.amount.replace(',', '.')) > sc.amount) e.push({ field: 'amount', message: `Kwota nie może przekroczyć ${fmtMoney(sc.amount)}.` });
      if (v.note.trim().length < 3 || v.note.trim().length > 30) e.push({ field: 'note', message: 'Podaj numer noty (3–30 znaków).' });
    }
    if (v.decision === 'REJECT' && v.reason.trim().length < 30) e.push({ field: 'reason', message: `Uzasadnienie musi mieć min. 30 znaków (teraz ${v.reason.trim().length}).` });
    showErrors(form, e, 'Uzupełnij odpowiedź'); if (e.length) return;
    const d = busy($('button[type=submit]', form) as HTMLButtonElement, 'Wysyłanie…');
    try {
      await api.supRespond(sc.id, v.decision === 'ACCEPT' ? { decision: 'ACCEPT', creditAmount: Number(v.amount.replace(',', '.')), creditNoteNo: v.note } : { decision: 'REJECT', reason: v.reason });
      toast('Odpowiedź wysłana do sklepu.'); box.innerHTML = ''; reload();
    } catch (err) { d(); $('[data-alert]', form)!.innerHTML = alertBox('error', 'Nie udało się wysłać', esc((err as Error).message)); }
  });
}
