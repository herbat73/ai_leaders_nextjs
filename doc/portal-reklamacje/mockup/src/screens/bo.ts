// Panel obsługi: B-01 Skrzynka, B-02 Karta zgłoszenia

function sla(c: Claim): { tone: 'ok' | 'warn' | 'danger' | 'neutral'; label: string } {
  if (!OPEN_STATUSES.includes(c.status)) return { tone: 'neutral', label: '—' };
  if (c.status === 'AWAITING_CUSTOMER') return { tone: 'neutral', label: 'wstrzymane' };
  const left = daysBetween(todayISO(), c.responseDueAt);
  if (left < 0) return { tone: 'danger', label: `po terminie ${-left} d` };
  if (left < 2) return { tone: 'danger', label: left === 0 ? 'dziś' : 'jutro' };
  if (left < 5) return { tone: 'warn', label: `za ${left} dni` };
  return { tone: 'ok', label: `za ${left} dni` };
}

const BO_VIEWS: [string, string][] = [['decide', 'Do decyzji'], ['waiting', 'Czeka na klienta'], ['warehouse', 'Do rozwiązania'], ['mine', 'Moje'], ['open', 'Wszystkie otwarte'], ['all', 'Wszystkie']];

// ---------- B-01 Skrzynka ----------
route({
  pattern: '/obsluga', id: 'B-01', title: 'Skrzynka zgłoszeń', roles: ['AGENT'],
  render(root, _p, q) {
    const f = { view: q.get('widok') || 'decide', kind: '', priority: '', team: '', q: '' };
    const me = Store.db.session!.name;
    root.innerHTML = `${screenTag('B-01', 'Skrzynka zgłoszeń')}<div class="bo-page">
      <div class="page-head"><div><h1>Skrzynka zgłoszeń</h1><p class="muted">Posortowane wg priorytetu i terminu odpowiedzi.</p></div><a class="btn btn-primary" href="#/obsluga/nowe">＋ Nowe zgłoszenie</a></div>
      <div class="tabs" role="tablist" aria-label="Widoki">${BO_VIEWS.map(([k, l]) => `<button role="tab" data-view="${k}" aria-selected="${k === f.view}">${l} <span class="count neutral">${Store.db.claims.filter((c) => viewFilter(k, c, me)).length}</span></button>`).join('')}</div>
      <div class="toolbar">
        <div class="filters">
          <label class="inline-field">Typ <select data-f="kind"><option value="">Wszystkie</option>${(Object.keys(KINDS) as ClaimKind[]).map((k) => `<option value="${k}">${KINDS[k].short}</option>`).join('')}</select></label>
          <label class="inline-field">Priorytet <select data-f="priority"><option value="">Każdy</option><option value="HIGH">Wysoki</option><option value="NORMAL">Normalny</option></select></label>
          <label class="inline-field">Zespół <select data-f="team"><option value="">Wszystkie</option>${TEAMS.map((t) => `<option>${t}</option>`).join('')}</select></label>
        </div>
        <div class="search"><label class="sr-only" for="bo-q">Szukaj</label><input id="bo-q" type="search" placeholder="RMA, zamówienie, e-mail, nazwisko…"></div>
      </div>
      <div class="bulk" data-bulk hidden><span data-bulk-n></span><button class="btn btn-secondary btn-sm" data-bulk-a="me">Przypisz do mnie</button><button class="btn btn-secondary btn-sm" data-bulk-a="high">Priorytet wysoki</button></div>
      <div data-list></div></div>`;
    const list = $('[data-list]', root)!;
    const selected = new Set<string>();
    const updBulk = () => { const b = $('[data-bulk]', root)!; b.hidden = !selected.size; $('[data-bulk-n]', root)!.textContent = `Zaznaczono: ${selected.size}`; };
    const load = () => loadInto(list, {
      skeleton: skelTable(6),
      load: () => api.boClaims(f),
      isEmpty: (cs) => cs.length === 0,
      empty: () => `<div class="card">${f.q || f.kind || f.priority || f.team ? emptyState('🔍', 'Brak wyników dla filtrów', 'Zmień filtry lub frazę wyszukiwania.', '<button class="btn btn-secondary" data-clear>Wyczyść filtry</button>') : emptyState('🎉', 'Brak zgłoszeń w tym widoku', 'Wszystko obsłużone. Zajrzyj do innych widoków.')}</div>`,
      render: (cs) => {
        selected.clear(); updBulk();
        list.innerHTML = `<div class="card table-wrap"><table class="table bo-table"><caption class="sr-only">Zgłoszenia</caption>
          <thead><tr><th scope="col"><input type="checkbox" data-all aria-label="Zaznacz wszystkie"></th><th scope="col">Zgłoszenie</th><th scope="col">Klient</th><th scope="col">Produkty</th><th scope="col" class="num">Wartość</th><th scope="col">Status</th><th scope="col">Odpowiedź</th><th scope="col">Opiekun</th></tr></thead>
          <tbody>${cs.map((c) => { const t = sla(c); return `<tr class="${c.priority === 'HIGH' ? 'row-high' : ''}">
            <td><input type="checkbox" data-sel="${c.id}" aria-label="Zaznacz ${esc(c.number)}"></td>
            <td data-label="Zgłoszenie"><a class="mono strong" href="#/obsluga/zgloszenia/${c.id}">${esc(c.number)}</a><div class="small">${kindTag(c.kind)} ${c.priority === 'HIGH' ? '<span class="tag tag-danger">Wysoki</span>' : ''} ${c.customerReplied && c.status === 'SUBMITTED' ? '<span class="tag tag-info">Odpowiedź klienta</span>' : ''} ${c.channel !== 'PORTAL' ? `<span class="tag">${c.channel === 'PHONE' ? '📞' : c.channel === 'STORE' ? '🏬' : '✉️'}</span>` : ''}</div></td>
            <td data-label="Klient">${esc(c.customerName)}<div class="small muted">${esc(c.orderNumber)}</div></td>
            <td data-label="Produkty">${c.items.map((i) => `<span title="${esc(i.name)}">${i.emoji}</span>`).join(' ')} <span class="small">${esc(c.items[0].name)}${c.items.length > 1 ? ` +${c.items.length - 1}` : ''}</span></td>
            <td data-label="Wartość" class="num">${fmtMoney(c.value)}</td>
            <td data-label="Status">${statusBadge(c.status)}</td>
            <td data-label="Odpowiedź"><span class="sla sla-${t.tone}">${t.label}</span></td>
            <td data-label="Opiekun">${c.assignee ? esc(c.assignee) : '<span class="muted">—</span>'}<div class="small muted">${esc(c.team)}</div></td></tr>`; }).join('')}</tbody></table></div>`;
        $$('[data-sel]', list).forEach((cb) => cb.addEventListener('change', () => { const i = cb as HTMLInputElement; i.checked ? selected.add(i.dataset.sel!) : selected.delete(i.dataset.sel!); updBulk(); }));
        $('[data-all]', list)!.addEventListener('change', (e) => { const on = (e.target as HTMLInputElement).checked; $$('[data-sel]', list).forEach((cb) => { (cb as HTMLInputElement).checked = on; on ? selected.add(cb.dataset.sel!) : selected.delete(cb.dataset.sel!); }); updBulk(); });
      },
    }).then(() => $('[data-clear]', list)?.addEventListener('click', () => {
      f.kind = f.priority = f.team = f.q = ''; $$('[data-f]', root).forEach((s) => ((s as HTMLSelectElement).value = '')); ($('#bo-q', root) as HTMLInputElement).value = ''; load();
    }));
    $$('[data-view]', root).forEach((b) => b.addEventListener('click', () => {
      f.view = b.dataset.view!;
      $$('[data-view]', root).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      history.replaceState(null, '', '#/obsluga?widok=' + f.view); Router.prevHash = location.hash;
      load();
    }));
    $$('[data-f]', root).forEach((s) => s.addEventListener('change', () => { (f as Record<string, string>)[s.dataset.f!] = (s as HTMLSelectElement).value; load(); }));
    let deb: number | undefined;
    $('#bo-q', root)!.addEventListener('input', (e) => { clearTimeout(deb); deb = window.setTimeout(() => { const v = (e.target as HTMLInputElement).value.trim(); if (v.length === 1) return; f.q = v; load(); }, 300); });
    $$('[data-bulk-a]', root).forEach((b) => b.addEventListener('click', async () => {
      const d = busy(b as HTMLButtonElement, '…');
      try { await api.boBulk([...selected], b.dataset.bulkA === 'me' ? { assignee: me } : { priority: 'HIGH' }); toast(`Zaktualizowano ${selected.size} zgłoszeń.`); load(); }
      catch (e) { toast((e as Error).message, 'error'); }
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
    const body = $('[data-body]', root)!;
    const load = () => loadInto(body, {
      skeleton: `<div aria-busy="true"><div class="skel skel-title" style="width:35%"></div><div class="grid-2-1">${skelCards(3)}${skelCards(2)}</div></div>`,
      load: () => api.boClaim(p.id),
      render: (c) => renderBoClaim(body, c, () => { load(); renderShell(); }),
    });
    load();
  },
});

function resolutionsFor(kind: ClaimKind): Resolution[] {
  return kind === 'RETURN' ? ['REFUND', 'STORE_CREDIT', 'EXCHANGE'] : kind === 'COMPLAINT' ? ['REPLACEMENT', 'REPAIR', 'PRICE_REDUCTION', 'REFUND'] : kind === 'TRANSPORT' ? ['REPLACEMENT', 'REFUND'] : ['SPARE_PART', 'REFUND'];
}

function fillTpl(t: string, c: Claim): string { return t.replace(/\{imie\}/g, c.customerName.split(' ')[0]).replace(/\{rma\}/g, c.number); }

function supplierCheck(c: Claim): { sup?: Supplier; missing: string[] } {
  const sup = Store.supplier(c.items[0].supplierId);
  if (!sup) return { missing: ['Brak dostawcy dla produktu'] };
  const m: string[] = [];
  c.items.forEach((it) => {
    if (sup.requires.includes('SERIAL') && !it.serial) m.push('numer seryjny');
    if (sup.requires.includes('VIDEO') && !it.files.some((f) => isVideo(f.name, f.mime))) m.push('nagranie wideo');
    if (sup.requires.includes('PHOTO') && !it.files.some((f) => !isVideo(f.name, f.mime))) m.push('zdjęcia');
  });
  if (sup.requires.includes('INSPECTION') && c.inspection?.defectConfirmed !== 'yes') m.push('inspekcja z potwierdzoną wadą');
  return { sup, missing: Array.from(new Set(m)) };
}

function renderBoClaim(body: HTMLElement, c: Claim, reload: () => void): void {
  const order = Store.order(c.orderId)!;
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
  const recoBox = $('[data-reco]', body)!;
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
        $('[data-apply]', recoBox)!.addEventListener('click', () => {
          const tab = r.action === 'REQUEST_INFO' ? 'request' : 'approve';
          ($(`[data-dtab="${tab}"]`, body) as HTMLElement)?.click();
          if (tab === 'approve') { const sel = $('#f-res', body) as HTMLSelectElement | null; if (sel) sel.value = r.resolution; }
          else { (['VIDEO', 'SERIAL', 'PHOTO'] as string[]).forEach((k) => { if (r.rationale.toLowerCase().includes({ VIDEO: 'wideo', SERIAL: 'seryjny', PHOTO: 'zdjęcia' }[k]!)) { const cb = $(`input[name="req-${k}"]`, body) as HTMLInputElement | null; if (cb) cb.checked = true; } }); }
          $('[data-panel]', body)!.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      },
    });
  }

  renderDecisionPanel($('[data-panel]', body)!, c, reload);

  // kontrolki nagłówka
  $$('[data-patch]', body).forEach((s) => s.addEventListener('change', async () => {
    try { await api.boPatch(c.id, { [s.dataset.patch!]: (s as HTMLSelectElement).value || undefined } as Partial<Claim>); toast('Zapisano.'); reload(); }
    catch (e) { toast((e as Error).message, 'error'); }
  }));
  // galeria
  $$('[data-file]', body).forEach((b) => b.addEventListener('click', () => openModal({
    title: b.dataset.file!, wide: true, body: `<div class="lightbox"><span aria-hidden="true">${b.querySelector('span')!.textContent}</span><p class="muted small">Podgląd załącznika (makieta) — w systemie: pełnowymiarowe zdjęcie / odtwarzacz wideo, zoom, pobieranie.</p></div>`,
    actions: [{ label: 'Zamknij', kind: 'secondary', onClick: ({ close }) => close() }],
  })));
  // wiadomości
  const mf = $('[data-msg]', body)!;
  bindCounters(mf);
  $('[data-tpl]', mf)!.addEventListener('change', (e) => {
    const tpl = Store.db.templates.find((x) => x.id === (e.target as HTMLSelectElement).value);
    if (tpl) { const ta = $('textarea', mf) as HTMLTextAreaElement; ta.value = fillTpl(tpl.body, c); ta.dispatchEvent(new Event('input')); }
  });
  mf.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const v = formValues(mf);
    if (!v.body) { showErrors(mf, [{ field: 'body', message: 'Wpisz treść.' }], 'Nie można wysłać'); return; }
    const d = busy($('button[type=submit]', mf) as HTMLButtonElement, 'Wysyłanie…');
    try { await api.sendMessage(c.id, v.body, v.internal === 'on'); toast(v.internal === 'on' ? 'Dodano notatkę.' : 'Wiadomość wysłana do klienta.'); reload(); }
    catch (e) { d(); showErrors(mf, [{ field: 'body', message: (e as Error).message }], 'Błąd wysyłki'); }
  });
  $('[data-carrier]', body)?.addEventListener('click', async () => { await api.boCarrierEvent(c.id); toast('Zdarzenie przewoźnika: paczka nadana.', 'info'); reload(); });
  $('[data-forward]', body)?.addEventListener('click', async (e) => {
    const d = busy(e.currentTarget as HTMLButtonElement, 'Przekazywanie…');
    try { const r = await api.boForwardSupplier(c.id); toast(`Dodano do reklamacji ${r.number} (szkic).`); reload(); }
    catch (err) { d(); toast((err as Error).message, 'error'); }
  });
}

function renderDecisionPanel(box: HTMLElement, c: Claim, reload: () => void): void {
  const tplBody = (id: string) => fillTpl(Store.db.templates.find((x) => x.id === id)?.body ?? '', c);
  if (c.status === 'SUBMITTED' || c.status === 'AWAITING_CUSTOMER') {
    const resOpts = resolutionsFor(c.kind).map((r) => [r, RESOLUTIONS[r].label] as [string, string]);
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
        <div class="grid-2">${selectField({ name: 'ores', label: 'Proponowane rozwiązanie', required: true, value: 'PRICE_REDUCTION', options: (['PRICE_REDUCTION', 'STORE_CREDIT', 'REFUND', 'REPLACEMENT', 'REPAIR'] as Resolution[]).map((r) => [r, RESOLUTIONS[r].label] as [string, string]) })}
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
    $('[data-tpl-reject]', box)!.addEventListener('click', () => { const ta = $('[data-dform="reject"] textarea', box) as HTMLTextAreaElement; ta.value = tplBody('t4'); ta.dispatchEvent(new Event('input')); });
    const submit = (kind: string, fn: (v: Record<string, string>, form: HTMLElement) => Promise<void> | null) => {
      const form = $(`[data-dform="${kind}"]`, box)!;
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const v = formValues(form);
        const p = fn(v, form);
        if (!p) return;
        const d = busy($('button[type=submit]', form) as HTMLButtonElement, 'Zapisywanie…');
        try { await p; reload(); }
        catch (e) { d(); $('[data-dalert]', box)!.innerHTML = alertBox('error', 'Nie udało się zapisać decyzji', esc((e as Error).message)); }
      });
    };
    submit('approve', (v) => api.boDecision(c.id, { action: 'APPROVE', resolution: v.res as Resolution, keepItem: v.keep === 'on', message: v.msg }).then(() => toast('Zgłoszenie zaakceptowane — klient otrzymał powiadomienie.')));
    submit('request', (v, form) => {
      const req = REQUEST_ITEMS.map(([k]) => k).filter((k) => v['req-' + k] === 'on');
      const e: FieldError[] = [];
      if (!req.length) e.push({ field: 'req', message: 'Zaznacz, czego potrzebujesz od klienta.' });
      if (!v.msg) e.push({ field: 'msg', message: 'Napisz wiadomość do klienta.' });
      showErrors(form, e, 'Uzupełnij prośbę'); if (e.length) return null;
      return api.boDecision(c.id, { action: 'REQUEST_INFO', requested: req, message: v.msg }).then(() => toast('Prośba wysłana — SLA wstrzymane do odpowiedzi klienta.'));
    });
    submit('offer', (v, form) => {
      const e: FieldError[] = [];
      const needAmount = ['PRICE_REDUCTION', 'STORE_CREDIT', 'REFUND'].includes(v.ores);
      const amt = Number(v.amount.replace(',', '.'));
      if (needAmount && !V.money(v.amount)) e.push({ field: 'amount', message: 'Podaj kwotę większą od zera.' });
      else if (needAmount && amt > c.value * (v.ores === 'STORE_CREDIT' ? 1.5 : 1)) e.push({ field: 'amount', message: `Kwota nie może przekroczyć ${fmtMoney(c.value)}.` });
      if (v.text.trim().length < 10) e.push({ field: 'text', message: 'Opisz propozycję (min. 10 znaków).' });
      showErrors(form, e, 'Popraw propozycję'); if (e.length) return null;
      return api.boDecision(c.id, { action: 'OFFER', offer: { resolution: v.ores as Resolution, amount: needAmount ? amt : 0, text: v.text }, message: '' }).then(() => toast('Propozycja wysłana do klienta.'));
    });
    submit('reject', (v, form) => {
      if (v.msg.trim().length < 30) { showErrors(form, [{ field: 'msg', message: `Uzasadnienie musi mieć min. 30 znaków (teraz ${v.msg.trim().length}).` }], 'Popraw uzasadnienie'); return null; }
      return confirmModal('Odrzucić zgłoszenie?', 'Klient otrzyma uzasadnienie i będzie mógł odpowiedzieć. Przy reklamacji odmowa musi wskazywać przyczynę.', 'Odrzuć', true)
        .then((ok) => ok ? api.boDecision(c.id, { action: 'REJECT', message: v.msg }).then(() => toast('Zgłoszenie odrzucone.', 'info')) : undefined);
    });
    return;
  }
  // Rozwiązanie
  const canResolve = c.status === 'RECEIVED' || c.status === 'IN_SERVICE' || (c.status === 'APPROVED' && c.returnMethod === 'NONE');
  if (canResolve) {
    const def = c.resolution === 'STORE_CREDIT' ? 'STORE_CREDIT' : c.resolution === 'REFUND' || c.resolution === 'PRICE_REDUCTION' ? 'REFUND' : c.resolution === 'REPAIR' ? 'REPAIR' : c.resolution === 'SPARE_PART' ? 'SPARE_PART' : 'REPLACEMENT';
    const actions: [string, string][] = [['REFUND', '💸 Zwróć pieniądze'], ['STORE_CREDIT', '🎁 Wydaj bon'], ['REPLACEMENT', '📦 Wyślij zamiennik / wariant'], ...(c.kind === 'MISSING' ? [['SPARE_PART', '🧩 Wyślij brakującą część'] as [string, string]] : []), ...(c.kind === 'COMPLAINT' && c.status !== 'IN_SERVICE' ? [['REPAIR', '🔧 Wyślij do serwisu'] as [string, string]] : [])];
    box.innerHTML = `<section class="card decision-panel"><h2 class="h3">Wykonaj rozwiązanie</h2>
      ${c.status === 'IN_SERVICE' ? alertBox('info', 'Produkt w serwisie / u dostawcy', 'Po otrzymaniu wyniku naprawy zamknij sprawę wybranym rozwiązaniem.') : c.inspection ? alertBox(c.inspection.grade === 'C' && c.kind === 'RETURN' ? 'warning' : 'success', `Inspekcja: ocena ${c.inspection.grade}`, c.inspection.grade === 'C' && c.kind === 'RETURN' ? 'Produkt nosi ślady zużycia ponad zwykłe sprawdzenie — możesz pomniejszyć kwotę zwrotu (z uzasadnieniem).' : 'Produkt zgodny ze zgłoszeniem.') : ''}
      <form novalidate data-rform>
        ${radioGroup({ name: 'act', label: 'Akcja', required: true, value: def, options: actions })}
        <div class="cond" data-show-if="act=REFUND|STORE_CREDIT">${textField({ name: 'amount', label: 'Kwota (zł)', required: true, value: String((c.resolution === 'STORE_CREDIT' || c.resolution === 'REFUND') && c.refundAmount ? c.refundAmount : c.value), inputmode: 'decimal', cls: 'w-md', hint: `Wartość zgłoszenia ${fmtMoney(c.value)}. Powyżej 2000 zł — akceptacja kierownika.` })}</div>
        <div class="row-wrap"><button class="btn btn-primary" type="submit">Wykonaj</button></div><div data-ralert></div></form></section>`;
    const form = $('[data-rform]', box)!;
    applyConditions(form); form.addEventListener('change', () => applyConditions(form));
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const v = formValues(form);
      const money = v.act === 'REFUND' || v.act === 'STORE_CREDIT';
      const amt = Number((v.amount ?? '').replace(',', '.'));
      if (money) {
        if (!V.money(v.amount)) { showErrors(form, [{ field: 'amount', message: 'Podaj kwotę większą od zera.' }], 'Popraw kwotę'); return; }
        if (v.act === 'REFUND' && amt > c.value) { showErrors(form, [{ field: 'amount', message: `Zwrot nie może przekroczyć wartości zgłoszenia (${fmtMoney(c.value)}).` }], 'Popraw kwotę'); return; }
        if (amt > 2000 && !(await confirmModal('Kwota powyżej limitu agenta', `Zwrot ${fmtMoney(amt)} wymaga akceptacji kierownika. W makiecie zakładamy, że jesteś zalogowany/-a jako kierownik.`, 'Zatwierdź jako kierownik'))) return;
      }
      clearErrors(form);
      const d = busy($('button[type=submit]', form) as HTMLButtonElement, 'Wykonywanie…');
      try { await api.boResolve(c.id, v.act as 'REFUND', money ? amt : undefined); toast(v.act === 'REPAIR' ? 'Przekazano do serwisu.' : 'Wykonano — klient otrzymał powiadomienie.'); reload(); }
      catch (e) { d(); $('[data-ralert]', form)!.innerHTML = alertBox('error', 'Nie udało się wykonać akcji', esc((e as Error).message), money ? '<div class="small">Bramka płatności niedostępna? Możesz wydać bon zamiast zwrotu.</div>' : ''); }
    });
    return;
  }
  const info: Record<string, [string, string, string]> = {
    APPROVED: ['info', 'Czekamy na przesyłkę od klienta', `Kod ${c.label?.code ?? ''} ważny do ${fmtDate(c.label?.expiresAt ?? '')}. Po nadaniu status zmieni się automatycznie (webhook przewoźnika).`],
    IN_TRANSIT: ['info', 'Paczka w drodze do magazynu', 'Po dostarczeniu magazyn zeskanuje kod i wykona inspekcję (ekran Magazyn).'],
    RESOLVED: ['success', 'Rozwiązane', c.outcome ? `${{ REFUND: 'Zwrot pieniędzy', STORE_CREDIT: 'Bon', REPLACEMENT: 'Zamiennik', REPAIR: 'Naprawa', SPARE_PART: 'Część', PRICE_REDUCTION: 'Obniżenie ceny' }[c.outcome.type]}${c.outcome.amount ? ': ' + fmtMoney(c.outcome.amount) : ''}${c.outcome.ref ? ' · ' + c.outcome.ref : ''} · ${fmtDateTime(c.outcome.at)}` : ''],
    REJECTED: ['error', 'Odrzucone', c.rejectReason ?? ''],
    CANCELLED: ['info', 'Anulowane przez klienta', ''],
  };
  const x = info[c.status];
  box.innerHTML = x ? `${alertBox(x[0] as 'info', x[1], esc(x[2]))}${c.status === 'IN_TRANSIT' ? '<a class="btn btn-secondary btn-sm" href="#/magazyn">Przejdź do magazynu</a>' : ''}` : '';
}
