// Konfiguracja i analityka: B-05 Reguły, B-06 Analityka, B-07 Ustawienia

const ACTIONS: Record<RuleAction, string> = {
  AUTO_APPROVE: 'zaakceptuj automatycznie i wygeneruj etykietę',
  KEEP_ITEM: 'zaakceptuj bez odsyłania produktu (keep it)',
  HIGH_PRIORITY: 'ustaw priorytet wysoki',
  ASSIGN_TEAM: 'przypisz do zespołu',
  REQUIRE_VIDEO: 'wymagaj nagrania wideo w formularzu',
};

function ruleSentence(r: Rule): string {
  const c = r.conditions; const parts: string[] = [];
  if (c.kinds.length) parts.push(`typ: <strong>${c.kinds.map((k) => KINDS[k].short).join(' lub ')}</strong>`);
  if (c.categories.length) parts.push(`kategoria: <strong>${c.categories.map((k) => CATEGORIES[k]).join(' lub ')}</strong>`);
  if (c.reasons.length) parts.push(`powód: <strong>${c.reasons.map((x) => esc(allReasons().find((y) => y[0] === x)?.[1] ?? x)).join(' lub ')}</strong>`);
  if (c.minValue !== null) parts.push(`wartość ≥ <strong>${fmtMoney(c.minValue)}</strong>`);
  if (c.maxValue !== null) parts.push(`wartość ≤ <strong>${fmtMoney(c.maxValue)}</strong>`);
  if (c.maxDays !== null) parts.push(`≤ <strong>${c.maxDays} dni</strong> od dostawy`);
  return `<span class="kw">JEŚLI</span> ${parts.join(' <span class="kw">i</span> ') || 'każde zgłoszenie'} <span class="kw">TO</span> ${ACTIONS[r.action]}${r.action === 'ASSIGN_TEAM' ? ` <strong>${esc(r.param)}</strong>` : ''}`;
}

function allReasons(): [string, string][] {
  const seen = new Set<string>(); const out: [string, string][] = [];
  (Object.keys(REASONS) as ClaimKind[]).forEach((k) => REASONS[k].forEach(([c, l]) => { if (!seen.has(c)) { seen.add(c); out.push([c, l]); } }));
  return out;
}

// ---------- B-05 Reguły ----------
route({
  pattern: '/obsluga/reguly', id: 'B-05', title: 'Reguły automatyzacji', roles: ['AGENT'],
  render(root) {
    root.innerHTML = `${screenTag('B-05', 'Reguły automatyzacji')}<div class="bo-page">
      <div class="page-head"><div><h1>Reguły automatyzacji</h1><p class="muted">Reguły są sprawdzane przy każdym nowym zgłoszeniu, w podanej kolejności. Pasujące akcje są stosowane łącznie.</p></div>
        <button class="btn btn-primary" data-new>＋ Nowa reguła</button></div><div data-list></div></div>`;
    const list = $('[data-list]', root)!;
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
          try { await api.toggleRule(t.dataset.toggle!, (t as HTMLInputElement).checked); toast((t as HTMLInputElement).checked ? 'Reguła włączona.' : 'Reguła wyłączona.', 'info'); load(); } catch (e) { toast((e as Error).message, 'error'); load(); }
        }));
        $$('[data-up],[data-down]', list).forEach((b) => b.addEventListener('click', async () => { await api.moveRule(b.dataset.up ?? b.dataset.down!, b.dataset.up ? -1 : 1); load(); }));
        $$('[data-edit]', list).forEach((b) => b.addEventListener('click', () => ruleEditor(rs.find((r) => r.id === b.dataset.edit)!, load)));
        $$('[data-del]', list).forEach((b) => b.addEventListener('click', async () => {
          const r = rs.find((x) => x.id === b.dataset.del)!;
          if (await confirmModal('Usunąć regułę?', `„${esc(r.name)}” przestanie działać dla nowych zgłoszeń. Zgłoszenia już obsłużone nie zmienią się.`, 'Usuń', true)) { await api.deleteRule(r.id); toast('Usunięto regułę.'); load(); }
        }));
      },
    }).then(() => $('[data-template]', list)?.addEventListener('click', () => ruleEditor({ id: uid('R'), name: 'Szybki zwrot drobnych produktów', enabled: true, order: 1, conditions: { kinds: ['RETURN'], categories: [], reasons: [], minValue: null, maxValue: 150, maxDays: null }, action: 'AUTO_APPROVE', param: '', hits: 0 }, load)));
    $('[data-new]', root)!.addEventListener('click', () => ruleEditor({ id: uid('R'), name: '', enabled: true, order: 99, conditions: { kinds: [], categories: [], reasons: [], minValue: null, maxValue: null, maxDays: null }, action: 'AUTO_APPROVE', param: '', hits: 0 }, load));
    load();
  },
});

function ruleEditor(r: Rule, reload: () => void): void {
  const isNew = !Store.db.rules.some((x) => x.id === r.id);
  const chips = (name: string, opts: [string, string][], sel: string[]) => `<div class="chips">${opts.map(([v, l]) => `<label class="chip-check"><input type="checkbox" name="${name}" value="${v}" ${sel.includes(v) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
  const read = (el: HTMLElement): Rule => {
    const vals = (n: string) => $$(`input[name="${n}"]:checked`, el).map((i) => (i as HTMLInputElement).value);
    const num = (n: string) => { const x = ($(`[name="${n}"]`, el) as HTMLInputElement).value.trim(); return x === '' ? null : Number(x.replace(',', '.')); };
    return { ...r, name: ($('[name=name]', el) as HTMLInputElement).value.trim(), conditions: { kinds: vals('kinds') as ClaimKind[], categories: vals('cats') as Category[], reasons: vals('reasons'), minValue: num('minValue'), maxValue: num('maxValue'), maxDays: num('maxDays') }, action: ($('[name=action]', el) as HTMLSelectElement).value as RuleAction, param: ($('[name=param]', el) as HTMLSelectElement).value };
  };
  const validate = (x: Rule, el: HTMLElement): FieldError[] => {
    const e: FieldError[] = [];
    if (x.name.length < 3 || x.name.length > 60) e.push({ field: 'name', message: 'Nazwa: 3–60 znaków.' });
    const c = x.conditions;
    if (!c.kinds.length && !c.categories.length && !c.reasons.length && c.minValue === null && c.maxValue === null && c.maxDays === null) e.push({ field: 'conds', message: 'Dodaj co najmniej jeden warunek.' });
    for (const k of ['minValue', 'maxValue', 'maxDays'] as const) { const v = c[k]; if (v !== null && (isNaN(v) || v < 0)) e.push({ field: k, message: 'Podaj liczbę ≥ 0.' }); }
    if (c.minValue !== null && c.maxValue !== null && c.minValue > c.maxValue) e.push({ field: 'maxValue', message: 'Wartość „do” musi być ≥ „od”.' });
    if (x.action === 'ASSIGN_TEAM' && !x.param) e.push({ field: 'param', message: 'Wybierz zespół.' });
    const warn = $('[data-warn]', el)!;
    warn.innerHTML = (x.action === 'AUTO_APPROVE' || x.action === 'KEEP_ITEM') && c.maxValue === null ? alertBox('warning', 'Brak limitu wartości', 'Automatyczna akceptacja bez limitu kwoty może zatwierdzać drogie zgłoszenia. Rozważ warunek „wartość ≤”.') : '';
    return e;
  };
  openModal({
    title: isNew ? 'Nowa reguła' : `Edycja: ${r.name}`, wide: true,
    body: `<form novalidate data-form>
      ${textField({ name: 'name', label: 'Nazwa reguły', required: true, value: r.name, maxlength: 60 })}
      <fieldset class="field rule-box" data-field="conds" tabindex="-1"><legend><span class="kw">JEŚLI</span> (wszystkie warunki muszą być spełnione)</legend>
        <div class="field"><label>Typ zgłoszenia</label>${chips('kinds', (Object.keys(KINDS) as ClaimKind[]).map((k) => [k, KINDS[k].short]), r.conditions.kinds)}</div>
        <div class="field"><label>Kategoria produktu</label>${chips('cats', (Object.keys(CATEGORIES) as Category[]).map((k) => [k, CATEGORIES[k]]), r.conditions.categories)}</div>
        <details ${r.conditions.reasons.length ? 'open' : ''}><summary>Powód zgłoszenia</summary>${chips('reasons', allReasons(), r.conditions.reasons)}</details>
        <div class="grid-3">${textField({ name: 'minValue', label: 'Wartość od (zł)', value: r.conditions.minValue?.toString() ?? '', inputmode: 'decimal' })}${textField({ name: 'maxValue', label: 'Wartość do (zł)', value: r.conditions.maxValue?.toString() ?? '', inputmode: 'decimal' })}${textField({ name: 'maxDays', label: 'Maks. dni od dostawy', value: r.conditions.maxDays?.toString() ?? '', inputmode: 'numeric' })}</div>
        <div class="field-error" hidden></div></fieldset>
      <fieldset class="field rule-box"><legend><span class="kw">TO</span></legend>
        <div class="grid-2">${selectField({ name: 'action', label: 'Akcja', required: true, value: r.action, options: Object.entries(ACTIONS) as [string, string][] })}
        <div class="cond" data-show-if="action=ASSIGN_TEAM">${selectField({ name: 'param', label: 'Zespół', required: true, value: r.param, options: TEAMS.map((t) => [t, t] as [string, string]) })}</div></div></fieldset>
      <div data-warn></div><div data-sim aria-live="polite"></div><div data-alert></div></form>`,
    onOpen: (el) => { const f = $('[data-form]', el)!; applyConditions(f); f.addEventListener('change', () => { applyConditions(f); validate(read(el), el); }); validate(read(el), el); },
    actions: [
      { label: 'Anuluj', kind: 'ghost', onClick: ({ close }) => close() },
      { label: 'Symuluj', kind: 'secondary', onClick: async ({ el, btn }) => {
        const x = read(el); const form = $('[data-form]', el)!;
        const errs = validate(x, el).filter((e) => e.field !== 'name'); showErrors(form, errs, 'Popraw warunki'); if (errs.length) return;
        const d = busy(btn, 'Liczenie…'); const sim = $('[data-sim]', el)!;
        try { const s = await api.simulateRule(x); sim.innerHTML = alertBox('info', `Pasowałoby ${s.matched} z ${Store.db.claims.length} bieżących zgłoszeń (≈ ${s.estimated90d} w ostatnich 90 dniach)`, s.sample.length ? s.sample.map(esc).join('<br>') : 'Brak przykładów.'); }
        catch (e) { sim.innerHTML = alertBox('error', 'Symulacja nieudana', esc((e as Error).message)); }
        d();
      } },
      { label: 'Zapisz regułę', kind: 'primary', onClick: async ({ el, btn, close }) => {
        const x = read(el); const form = $('[data-form]', el)!;
        const errs = validate(x, el); showErrors(form, errs, 'Popraw regułę'); if (errs.length) return;
        const d = busy(btn, 'Zapisywanie…');
        try { await api.saveRule(x); close(); toast(isNew ? 'Dodano regułę — działa dla nowych zgłoszeń.' : 'Zapisano regułę.'); reload(); }
        catch (e) { d(); if (e instanceof ApiError && e.fields.length) showErrors(form, e.fields, 'Popraw regułę'); else $('[data-alert]', el)!.innerHTML = alertBox('error', 'Nie udało się zapisać', esc((e as Error).message)); }
      } },
    ],
  });
}

// ---------- B-06 Analityka ----------
function barChart(title: string, data: [string, number][], opts: { vertical?: boolean; unit?: string } = {}): string {
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
    const f: { period: 30 | 90; kind: string } = { period: 30, kind: '' };
    root.innerHTML = `${screenTag('B-06', 'Analityka')}<div class="bo-page">
      <div class="page-head"><div><h1>Analityka zwrotów i reklamacji</h1><p class="muted">Dane z hurtowni (symulacja) + bieżące zgłoszenia z demo.</p></div></div>
      <div class="toolbar"><div class="segmented" role="radiogroup" aria-label="Okres">${[30, 90].map((p) => `<button type="button" role="radio" aria-checked="${p === 30}" data-period="${p}">${p} dni</button>`).join('')}</div>
        <label class="inline-field">Typ <select data-kind><option value="">Wszystkie</option>${(Object.keys(KINDS) as ClaimKind[]).map((k) => `<option value="${k}">${KINDS[k].short}</option>`).join('')}</select></label></div>
      <div data-body></div><div class="chart-tip" role="tooltip" hidden></div></div>`;
    const body = $('[data-body]', root)!;
    const tip = $('.chart-tip', root)!;
    const load = () => loadInto(body, {
      skeleton: `<div class="kpis">${skelCards(5)}</div><div class="charts">${skelCards(4)}</div>`,
      load: () => api.analytics(f.period, f.kind),
      isEmpty: (d) => !d || d.kpi.total === 0,
      empty: () => `<div class="card">${emptyState('📊', 'Brak danych dla wybranego okresu', 'Zmień okres lub typ zgłoszenia.')}</div>`,
      render: (d) => {
        if (!d) return;
        const k = d.kpi;
        body.innerHTML = `<div class="kpis">
            <div class="kpi"><span class="kpi-label">Zgłoszenia</span><span class="kpi-value">${k.total}</span><span class="kpi-sub">w ${f.period} dni</span></div>
            <div class="kpi"><span class="kpi-label">Wskaźnik zgłoszeń</span><span class="kpi-value">${k.returnRate.toFixed(1).replace('.', ',')}%</span><span class="kpi-sub">zamówień</span></div>
            <div class="kpi"><span class="kpi-label">Automatyzacja</span><span class="kpi-value">${k.automation}%</span><span class="kpi-sub">rozstrzygnięte regułą</span></div>
            <div class="kpi"><span class="kpi-label">Średni czas rozwiązania</span><span class="kpi-value">${k.avgDays.toFixed(1).replace('.', ',')} dni</span><span class="kpi-sub">od zgłoszenia</span></div>
            <div class="kpi"><span class="kpi-label">Odzysk od dostawców</span><span class="kpi-value">${fmtMoney(k.recovered)}</span><span class="kpi-sub">noty kredytowe</span></div></div>
          <div class="charts">${barChart('Najczęstsze powody', d.reasons)}${barChart('Produkty z największą liczbą zgłoszeń', d.products)}${barChart('Zgłoszenia tygodniowo', d.weeks, { vertical: true })}${barChart('Struktura rozwiązań (%)', d.resolutions, { unit: '%' })}</div>`;
        $$('[data-toggle-table]', body).forEach((b) => b.addEventListener('click', () => {
          const id = b.dataset.toggleTable!; const t = $(`[data-table="${id}"]`, body)!; const p = $(`[data-plot="${id}"]`, body)!;
          t.hidden = !t.hidden; p.hidden = !t.hidden; b.textContent = t.hidden ? 'Pokaż tabelę' : 'Pokaż wykres'; b.setAttribute('aria-pressed', String(!t.hidden));
        }));
        $$('[data-tip]', body).forEach((el) => {
          el.addEventListener('mouseenter', () => { tip.hidden = false; tip.textContent = el.dataset.tip!; el.classList.add('hover'); });
          el.addEventListener('mousemove', (e) => { const m = e as MouseEvent; tip.style.left = m.clientX + 12 + 'px'; tip.style.top = m.clientY - 34 + 'px'; });
          el.addEventListener('mouseleave', () => { tip.hidden = true; el.classList.remove('hover'); });
        });
      },
    });
    $$('[data-period]', root).forEach((b) => b.addEventListener('click', () => { f.period = Number(b.dataset.period) as 30 | 90; $$('[data-period]', root).forEach((x) => x.setAttribute('aria-checked', String(x === b))); load(); }));
    $('[data-kind]', root)!.addEventListener('change', (e) => { f.kind = (e.target as HTMLSelectElement).value; load(); });
    load();
  },
});

// ---------- B-07 Ustawienia ----------
route({
  pattern: '/obsluga/ustawienia', id: 'B-07', title: 'Ustawienia', roles: ['AGENT'],
  render(root) {
    root.innerHTML = `${screenTag('B-07', 'Ustawienia: polityka zwrotów i szablony')}<div class="bo-page narrow-page">
      <div class="page-head"><h1>Ustawienia</h1></div><div data-policy></div><div data-tpls></div></div>`;
    const pBox = $('[data-policy]', root)!;
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
          <fieldset class="field"><legend>Kategorie wyłączone ze zwrotu (po otwarciu)</legend><div class="chips">${(Object.keys(CATEGORIES) as Category[]).map((k) => `<label class="chip-check"><input type="checkbox" name="ex-${k}" ${p.excludedCategories.includes(k) ? 'checked' : ''}><span>${CATEGORIES[k]}</span></label>`).join('')}</div></fieldset>
          <div data-alert></div><button class="btn btn-primary" type="submit">Zapisz politykę</button></form>`;
        const form = $('[data-form]', pBox)!;
        form.addEventListener('submit', async (ev) => {
          ev.preventDefault();
          const v = formValues(form); const e: FieldError[] = [];
          const int = (x: string) => /^\d+$/.test(x) ? Number(x) : NaN;
          const rd = int(v.returnDays), td = int(v.transportDays), cb = int(v.creditBonus), fee = Number(v.returnFee.replace(',', '.'));
          if (!(rd >= 14 && rd <= 365)) e.push({ field: 'returnDays', message: 'Okno zwrotu: 14–365 dni (min. ustawowe 14).' });
          if (!(fee >= 0 && fee <= 100) || !/^\d+([.,]\d{1,2})?$/.test(v.returnFee)) e.push({ field: 'returnFee', message: 'Koszt: 0–100 zł, maks. 2 miejsca po przecinku.' });
          if (!(td >= 1 && td <= 30)) e.push({ field: 'transportDays', message: 'Podaj 1–30 dni.' });
          if (!(cb >= 0 && cb <= 50)) e.push({ field: 'creditBonus', message: 'Bonus: 0–50%.' });
          showErrors(form, e, 'Popraw politykę'); if (e.length) return;
          const d = busy($('button[type=submit]', form) as HTMLButtonElement, 'Zapisywanie…');
          try { await api.savePolicy({ returnDays: rd, returnFee: fee, transportDays: td, creditBonus: cb, freeReturnForCredit: v.freeCredit === 'on', excludedCategories: (Object.keys(CATEGORIES) as Category[]).filter((k) => v['ex-' + k] === 'on') }); toast('Zapisano — zmiany obowiązują dla nowych zgłoszeń.'); }
          catch (err) { $('[data-alert]', form)!.innerHTML = alertBox('error', 'Nie udało się zapisać', esc((err as Error).message)); }
          d();
        });
      },
    });
    const tBox = $('[data-tpls]', root)!;
    const loadT = () => loadInto(tBox, {
      skeleton: skelCards(1), compactError: true,
      load: () => api.templates(),
      isEmpty: (ts) => ts.length === 0,
      empty: () => `<div class="card">${emptyState('✉️', 'Brak szablonów odpowiedzi', 'Szablony przyspieszają odpowiedzi agentów.', '<button class="btn btn-primary" data-add-tpl>Dodaj pierwszy szablon</button>')}</div>`,
      render: (ts) => {
        tBox.innerHTML = `<section class="card"><div class="row-between"><h2 class="h3">Szablony odpowiedzi</h2><button class="btn btn-secondary btn-sm" data-add-tpl>＋ Dodaj</button></div>
          <p class="small muted">Zmienne: <code>{imie}</code>, <code>{rma}</code></p>
          <ul class="plain tpl-list">${ts.map((t) => `<li><div><strong>${esc(t.name)}</strong><div class="small muted">${esc(t.body.slice(0, 110))}…</div></div><button class="btn btn-ghost btn-sm" data-edit-tpl="${t.id}">Edytuj</button></li>`).join('')}</ul></section>`;
        $$('[data-edit-tpl]', tBox).forEach((b) => b.addEventListener('click', () => tplEditor(ts.find((t) => t.id === b.dataset.editTpl)!, loadT)));
      },
    }).then(() => $$('[data-add-tpl]', tBox).forEach((b) => b.addEventListener('click', () => tplEditor({ id: uid('t'), name: '', body: '' }, loadT))));
    loadT();
  },
});

function tplEditor(t: Template, reload: () => void): void {
  openModal({
    title: t.name ? `Szablon: ${t.name}` : 'Nowy szablon', wide: true,
    body: `<form novalidate data-form>${textField({ name: 'name', label: 'Nazwa', required: true, value: t.name, maxlength: 60 })}${textareaField({ name: 'body', label: 'Treść', required: true, value: t.body, min: 10, max: 2000, rows: 6 })}<div data-alert></div></form>`,
    onOpen: (el) => bindCounters(el),
    actions: [{ label: 'Anuluj', onClick: ({ close }) => close() }, {
      label: 'Zapisz', kind: 'primary', onClick: async ({ el, btn, close }) => {
        const form = $('[data-form]', el)!; const v = formValues(form); const e: FieldError[] = [];
        if (v.name.length < 3 || v.name.length > 60) e.push({ field: 'name', message: 'Nazwa: 3–60 znaków.' });
        if (v.body.length < 10) e.push({ field: 'body', message: 'Treść: min. 10 znaków.' });
        showErrors(form, e, 'Popraw szablon'); if (e.length) return;
        const d = busy(btn, 'Zapisywanie…');
        try { await api.saveTemplate({ id: t.id, name: v.name, body: v.body }); close(); toast('Zapisano szablon.'); reload(); }
        catch (err) { d(); $('[data-alert]', el)!.innerHTML = alertBox('error', 'Nie udało się zapisać', esc((err as Error).message)); }
      },
    }],
  });
}
