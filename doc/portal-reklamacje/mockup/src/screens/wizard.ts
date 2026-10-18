// Kreator zgłoszenia: Z-00 (asysta), Z-01 … Z-06, Z-07

const WIZ_STEPS = ['Rodzaj', 'Produkty', 'Opis', 'Rozwiązanie', 'Odesłanie', 'Podsumowanie'];

interface WizCtx { order: Order; form: HTMLElement; root: HTMLElement; dirty: () => void }
interface StepDef {
  id: string; title: string; intro: (d: DraftData) => string;
  render(d: DraftData, ctx: WizCtx): string;
  bind?(d: DraftData, ctx: WizCtx): void;
  collect(form: HTMLElement, d: DraftData, ctx: WizCtx): void;
  validate(d: DraftData, ctx: WizCtx): FieldError[];
}

function applyConditions(form: HTMLElement): void {
  const v = formValues(form);
  $$('[data-show-if]', form).forEach((el) => {
    const [k, val] = el.dataset.showIf!.split('=');
    el.hidden = !val.split('|').includes(v[k] ?? '');
  });
}

function orderLine(order: Order, lineId: string): OrderLine | undefined { return order.lines.find((l) => l.lineId === lineId); }

const STEP_DEFS: StepDef[] = [
  // Z-01 Rodzaj
  {
    id: 'Z-01', title: 'Co chcesz zgłosić?', intro: () => 'Wybierz rodzaj zgłoszenia — dopasujemy pytania i dostępne rozwiązania.',
    render: () => '<div data-kinds></div>',
    bind(d, ctx) {
      const box = $('[data-kinds]', ctx.form)!;
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
      if (v.kind !== undefined && v.kind !== d.kind) { d.kind = v.kind as ClaimKind; d.items = []; d.resolution = ''; d.exchangeVariant = ''; d.returnMethod = ''; }
    },
    validate(d) { return d.kind ? [] : [{ field: 'kind', message: 'Wybierz rodzaj zgłoszenia.' }]; },
  },
  // Z-02 Produkty
  {
    id: 'Z-02', title: 'Których produktów dotyczy?', intro: (d) => d.kind === 'RETURN' ? 'Zaznacz produkty, które chcesz zwrócić, i ich liczbę.' : 'Zaznacz produkty, których dotyczy problem.',
    render(d, ctx) {
      const lines = ctx.order.lines.map((l) => ({ l, el: lineEligibility(ctx.order, l, d.kind as ClaimKind) }));
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
        const t = clone(d); STEP_DEFS[1].collect(ctx.form, t, ctx);
        const el = $('[data-sum]', ctx.form);
        if (el) el.innerHTML = t.items.length ? `Wybrano: <strong>${t.items.reduce((s, i) => s + i.qty, 0)} szt.</strong> o wartości <strong>${fmtMoney(draftValue(t))}</strong>` : '<span class="muted">Nie wybrano produktów</span>';
      };
      ctx.form.addEventListener('change', upd); upd();
    },
    collect(form, d, ctx) {
      const v = formValues(form);
      const items: ClaimItem[] = [];
      ctx.order.lines.forEach((l) => {
        if (v['pick-' + l.lineId] !== 'on') return;
        const prev = d.items.find((i) => i.lineId === l.lineId);
        const qty = Number(v['qty-' + l.lineId] || 1);
        items.push(prev ? { ...prev, qty } : { lineId: l.lineId, sku: l.sku, name: l.name, variant: l.variant, emoji: l.emoji, qty, price: l.price, category: l.category, supplierId: l.supplierId, reason: '', description: '', detectedAt: '', serial: '', missingPart: '', files: [] });
      });
      if ($('[name^="pick-"]', form)) d.items = items;
    },
    validate(d) { return d.items.length ? [] : [{ field: 'items', message: 'Zaznacz co najmniej jeden produkt.' }]; },
  },
  // Z-03 Opis
  {
    id: 'Z-03', title: 'Opisz problem', intro: (d) => d.kind === 'RETURN' ? 'Powiedz nam, dlaczego zwracasz — to pomaga ulepszać ofertę.' : 'Im dokładniejszy opis i zdjęcia, tym szybciej rozwiążemy sprawę.',
    render: () => '<div data-items></div>',
    bind(d, ctx) {
      const box = $('[data-items]', ctx.form)!;
      loadInto(box, {
        skeleton: skelCards(d.items.length || 1), compactError: true,
        load: () => api.requirements(d),
        render: (reqs) => {
          (ctx as WizCtx & { reqs?: typeof reqs }).reqs = reqs;
          const kind = d.kind as ClaimKind;
          box.innerHTML = d.items.map((it) => {
            const r = reqs.find((x) => x.lineId === it.lineId)!;
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
        if ('r-' + id in v) it.reason = v['r-' + id];
        if ('d-' + id in v) it.description = v['d-' + id];
        if ('dt-' + id in v) it.detectedAt = v['dt-' + id];
        if ('s-' + id in v) it.serial = v['s-' + id].toUpperCase();
        if ('mp-' + id in v) it.missingPart = v['mp-' + id];
      });
    },
    validate(d, ctx) {
      const e: FieldError[] = [];
      const kind = d.kind as ClaimKind;
      const reqs = (ctx as WizCtx & { reqs?: { lineId: string; photos: number; serial: boolean; video: boolean }[] }).reqs
        ?? d.items.map((it) => ({ lineId: it.lineId, ...itemRequirements(kind, it, orderLine(ctx.order, it.lineId), d.items, draftValue(d), daysSinceDelivery(ctx.order)) }));
      d.items.forEach((it) => {
        const id = it.lineId; const r = reqs.find((x) => x.lineId === id);
        const n = it.name;
        if (!it.reason) e.push({ field: 'r-' + id, message: `${n}: wybierz powód.` });
        if (kind === 'COMPLAINT' && it.description.trim().length < 20) e.push({ field: 'd-' + id, message: `${n}: opisz problem (min. 20 znaków, teraz ${it.description.trim().length}).` });
        if (kind === 'MISSING' && ['MISSING_PART', 'WRONG_ITEM'].includes(it.reason) && !it.missingPart.trim()) e.push({ field: 'mp-' + id, message: `${n}: napisz, którego elementu brakuje lub co otrzymałeś/-aś.` });
        if (kind === 'COMPLAINT') {
          if (!it.detectedAt) e.push({ field: 'dt-' + id, message: `${n}: podaj datę wykrycia wady.` });
          else if (it.detectedAt > todayISO() || (ctx.order.deliveredAt && it.detectedAt < ctx.order.deliveredAt)) e.push({ field: 'dt-' + id, message: `${n}: data musi być między dostawą (${fmtDate(ctx.order.deliveredAt ?? '')}) a dziś.` });
          if (r?.serial) { if (!it.serial) e.push({ field: 's-' + id, message: `${n}: wpisz numer seryjny.` }); else if (!V.serial(it.serial)) e.push({ field: 's-' + id, message: `${n}: numer seryjny ma 6–20 znaków (litery, cyfry, myślniki).` }); }
        }
        if (it.files.some((f) => f.status === 'uploading' || f.status === 'scanning')) e.push({ field: 'f-' + id, message: `${n}: poczekaj na zakończenie wysyłania plików.` });
        const ready = it.files.filter((f) => f.status === 'ready');
        const photos = ready.filter((f) => !isVideo(f.name, f.mime)).length;
        if (r && photos < r.photos) e.push({ field: 'f-' + id, message: `${n}: dodaj min. ${r.photos} ${r.photos > 1 ? 'zdjęcia' : 'zdjęcie'} (teraz: ${photos}).` });
        if (r?.video && !ready.some((f) => isVideo(f.name, f.mime))) e.push({ field: 'f-' + id, message: `${n}: dodaj nagranie wideo pokazujące problem.` });
      });
      return e;
    },
  },
  // Z-04 Rozwiązanie
  {
    id: 'Z-04', title: 'Jak mamy to rozwiązać?', intro: (d) => d.kind === 'COMPLAINT' ? 'Wybierz preferowane rozwiązanie. Ostateczną decyzję podejmiemy po analizie zgłoszenia.' : 'Wybierz, co chcesz otrzymać.',
    render: () => '<div data-options></div>',
    bind(d, ctx) {
      const box = $('[data-options]', ctx.form)!;
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
            ${variants.length ? `<div class="cond" data-show-if="resolution=EXCHANGE">${selectField({ name: 'variant', label: 'Na jaki wariant wymienić?', required: true, value: d.exchangeVariant, options: variants.map((x) => [x.label, x.label + (x.inStock ? '' : ' — brak w magazynie')] as [string, string]) })}</div>` : ''}
            ${d.kind === 'COMPLAINT' ? `<div class="cond" data-show-if="resolution=REFUND|PRICE_REDUCTION">${textareaField({ name: 'justification', label: 'Dlaczego naprawa lub wymiana nie wystarczą?', value: d.refundJustification, max: 500, rows: 2 })}</div>` : ''}`;
          bindCounters(box);
          applyConditions(ctx.form);
          if (variants.length) $$('#f-variant option', box).forEach((o) => { if (variants.find((x) => x.label === (o as HTMLOptionElement).value && !x.inStock)) (o as HTMLOptionElement).disabled = true; });
        },
      });
    },
    collect(form, d) {
      const v = formValues(form);
      if (v.resolution !== undefined) d.resolution = v.resolution as Resolution;
      d.exchangeVariant = d.resolution === 'EXCHANGE' ? (v.variant ?? '') : '';
      if ('justification' in v) d.refundJustification = v.justification;
    },
    validate(d, ctx) {
      const e: FieldError[] = [];
      if (!d.resolution) e.push({ field: 'resolution', message: 'Wybierz rozwiązanie.' });
      else if (d.resolution === 'EXCHANGE') {
        const variants = d.items.length === 1 ? (orderLine(ctx.order, d.items[0].lineId)?.exchangeVariants ?? []) : [];
        if (!variants.some((x) => x.inStock)) e.push({ field: 'resolution', message: 'Wymiana nie jest dostępna dla tego produktu — wybierz inne rozwiązanie.' });
        else if (!d.exchangeVariant) e.push({ field: 'variant', message: 'Wybierz wariant, na który chcesz wymienić produkt.' });
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
        <div class="cond" data-show-if="returnMethod=STORE">${selectField({ name: 'store', label: 'Sklep', required: true, value: d.store, options: STORES.map((s) => [s.id, s.name] as [string, string]) })}</div>`}
        ${cod ? `<h2 class="h3">Zwrot pieniędzy</h2>${alertBox('info', 'Zamówienie opłacone przy odbiorze', 'Podaj numer rachunku, na który zwrócimy pieniądze.')}${textField({ name: 'iban', label: 'Numer rachunku (IBAN)', required: true, value: d.refundAccount ? fmtIban(d.refundAccount) : '', inputmode: 'numeric', placeholder: 'PL00 0000 0000 0000 0000 0000 0000' })}` : ''}
        <h2 class="h3">Kontakt w sprawie zgłoszenia</h2>
        <div class="grid-2">${textField({ name: 'email', label: 'E-mail', type: 'email', required: true, value: d.contact.email, autocomplete: 'email' })}${textField({ name: 'phone', label: 'Telefon', type: 'tel', required: d.returnMethod === 'COURIER', value: d.contact.phone, autocomplete: 'tel', hint: 'Wymagany przy odbiorze kurierem.' })}</div>`;
    },
    bind(d, ctx) {
      const list = $('[data-pp-list]', ctx.form);
      if (!list) return;
      const hidden = $('input[name=pickupPoint]', ctx.form) as HTMLInputElement;
      const search = () => {
        const q = ($('#pp-q', ctx.form) as HTMLInputElement).value;
        loadInto(list, {
          skeleton: skelLines(3), compactError: true,
          load: () => api.pickupPoints(q),
          isEmpty: (ps) => ps.length === 0,
          empty: () => `<p class="muted small">Brak paczkomatów dla „${esc(q)}”. Spróbuj kodu pocztowego lub nazwy miasta.</p>`,
          render: (ps) => {
            list.innerHTML = `<div class="radios pp">${ps.map((p) => `<label class="radio"><input type="radio" name="pp" value="${p.id}" ${hidden.value === p.id ? 'checked' : ''}><span><strong>${esc(p.name)}</strong><br><span class="small muted">${esc(p.address)}</span></span></label>`).join('')}</div>`;
            $$('input[name=pp]', list).forEach((r) => r.addEventListener('change', () => { hidden.value = (r as HTMLInputElement).value; setFieldError(ctx.form, 'pickupPoint', null); }));
          },
        });
      };
      $('[data-pp-search]', ctx.form)!.addEventListener('click', search);
      $('#pp-q', ctx.form)!.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') { e.preventDefault(); search(); } });
      ctx.form.addEventListener('change', (e) => { if ((e.target as HTMLInputElement).name === 'returnMethod' && (e.target as HTMLInputElement).value === 'PARCEL_LOCKER' && !list.innerHTML) search(); });
      if (d.returnMethod === 'PARCEL_LOCKER') search();
      const iban = $('#f-iban', ctx.form) as HTMLInputElement | null;
      iban?.addEventListener('blur', () => { if (iban.value) iban.value = fmtIban(iban.value); });
    },
    collect(form, d) {
      const v = formValues(form);
      if ('returnMethod' in v) d.returnMethod = v.returnMethod as ReturnMethod | '';
      if (!$('[name=returnMethod]', form)) d.returnMethod = 'NONE';
      d.pickupPoint = v.pickupPoint ?? d.pickupPoint;
      if ('c.street' in v) d.courier = { street: v['c.street'], zip: v['c.zip'], city: v['c.city'], date: v['c.date'] };
      if ('store' in v) d.store = v.store;
      if ('iban' in v) d.refundAccount = v.iban.replace(/\s+/g, '').toUpperCase();
      d.contact = { email: v.email, phone: v.phone };
    },
    validate(d, ctx) {
      const e: FieldError[] = [];
      if (d.returnMethod === '') e.push({ field: 'returnMethod', message: 'Wybierz sposób odesłania.' });
      if (d.returnMethod === 'PARCEL_LOCKER' && !d.pickupPoint) e.push({ field: 'pickupPoint', message: 'Wyszukaj i wybierz paczkomat.' });
      if (d.returnMethod === 'COURIER') {
        if (!V.required(d.courier.street)) e.push({ field: 'c.street', message: 'Podaj ulicę i numer.' });
        if (!V.zip(d.courier.zip)) e.push({ field: 'c.zip', message: 'Kod pocztowy ma format 00-000.' });
        if (!V.required(d.courier.city)) e.push({ field: 'c.city', message: 'Podaj miasto.' });
        if (!d.courier.date) e.push({ field: 'c.date', message: 'Wybierz dzień odbioru.' });
        else if (d.courier.date <= todayISO()) e.push({ field: 'c.date', message: 'Najwcześniej jutro.' });
        else if ([0, 6].includes(new Date(d.courier.date + 'T12:00:00').getDay())) e.push({ field: 'c.date', message: 'Kurier odbiera paczki w dni robocze — wybierz poniedziałek–piątek.' });
        if (!V.phone(d.contact.phone)) e.push({ field: 'phone', message: 'Podaj telefon — kurier zadzwoni przed odbiorem.' });
      }
      if (d.returnMethod === 'STORE' && !d.store) e.push({ field: 'store', message: 'Wybierz sklep.' });
      const cod = ctx.order.paymentMethod === 'COD' && ['REFUND', 'PRICE_REDUCTION'].includes(d.resolution);
      if (cod && !V.ibanPL(d.refundAccount)) e.push({ field: 'iban', message: d.refundAccount ? 'Numer rachunku jest niepoprawny — sprawdź 26 cyfr.' : 'Podaj numer rachunku do zwrotu.' });
      if (!V.email(d.contact.email)) e.push({ field: 'email', message: d.contact.email ? 'Wpisz poprawny e-mail.' : 'Podaj e-mail — wyślemy na niego potwierdzenie.' });
      if (d.contact.phone && !V.phone(d.contact.phone)) e.push({ field: 'phone', message: 'Wpisz 9 cyfr numeru telefonu.' });
      return e.filter((x, i, a) => a.findIndex((y) => y.field === x.field) === i);
    },
  },
  // Z-06 Podsumowanie
  {
    id: 'Z-06', title: 'Sprawdź i wyślij', intro: () => 'Upewnij się, że wszystko się zgadza.',
    render(d, ctx) {
      const s = Store.db.session!;
      const q = quoteOptions(d, ctx.order).find((o) => o.resolution === d.resolution);
      const keep = keepItemPreview(d, ctx.order);
      const sec = (step: number, title: string, html: string) => `<section class="card summary"><div class="row-between"><h2 class="h3">${title}</h2><a href="#/zgloszenie/${step}?powrot=6">Edytuj</a></div>${html}</section>`;
      const method = !returnNeeded(d) || keep ? 'Bez odsyłania' : d.returnMethod === 'PARCEL_LOCKER' ? `Paczkomat ${esc(d.pickupPoint)}` : d.returnMethod === 'COURIER' ? `Kurier: ${esc(d.courier.street)}, ${esc(d.courier.zip)} ${esc(d.courier.city)} — ${fmtDate(d.courier.date)}` : d.returnMethod === 'STORE' ? esc(STORES.find((x) => x.id === d.store)?.name ?? '') : '—';
      return `${sec(1, 'Rodzaj', `<p>${KINDS[d.kind as ClaimKind].icon} ${esc(KINDS[d.kind as ClaimKind].label)} · zamówienie ${esc(ctx.order.number)}</p>`)}
        ${sec(2, 'Produkty i opis', d.items.map((i) => `<div class="item-row"><span class="thumb" aria-hidden="true">${i.emoji}</span><div><strong>${esc(i.name)}</strong> × ${i.qty}<div class="small">${esc(reasonLabel(d.kind as ClaimKind, i.reason))}${i.description ? ' — ' + esc(i.description) : ''}</div>
          ${i.serial ? `<div class="small muted">S/N ${esc(i.serial)}</div>` : ''}${i.files.filter((f) => f.status === 'ready').length ? `<div class="file-chips">${i.files.filter((f) => f.status === 'ready').map((f) => `<span class="chip">${fileIcon(f)} ${esc(f.name)}</span>`).join('')}</div>` : ''}</div></div>`).join(''))}
        ${sec(4, 'Rozwiązanie', `<p>${RESOLUTIONS[d.resolution as Resolution].icon} <strong>${esc(RESOLUTIONS[d.resolution as Resolution].label)}</strong>${d.exchangeVariant ? ' — ' + esc(d.exchangeVariant) : ''}${q?.amount ? ` · <strong>${fmtMoney(q.amount)}</strong>` : ''}</p><p class="small muted">${esc(q?.note ?? '')}</p>`)}
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
      const e: FieldError[] = [];
      if (Store.db.session?.role === 'AGENT') { if (!d.consents.confirmedByCustomer) e.push({ field: 'confirmed', message: 'Potwierdź, że klient zweryfikował dane.' }); return e; }
      if (!d.consents.truthful) e.push({ field: 'truthful', message: 'Potwierdź prawdziwość informacji.' });
      if (d.kind === 'RETURN' && !d.consents.withdrawal) e.push({ field: 'withdrawal', message: 'Zaznacz oświadczenie o odstąpieniu od umowy — bez niego nie możemy przyjąć zwrotu.' });
      return e;
    },
  },
];

function orderAside(order: Order, d: DraftData): string {
  const v = draftValue(d);
  return `<aside class="order-aside"><details open><summary><strong>Zamówienie ${esc(order.number)}</strong></summary>
    <p class="small muted">Złożone ${fmtDate(order.placedAt)} · dostarczone ${fmtDate(order.deliveredAt ?? '')}</p>
    <ul class="aside-lines">${order.lines.map((l) => { const sel = d.items.find((i) => i.lineId === l.lineId); return `<li class="${sel ? 'sel' : ''}"><span class="thumb" aria-hidden="true">${l.emoji}</span><span>${esc(l.name)}<br><span class="small muted">${sel ? `zgłaszasz: ${sel.qty} szt.` : `${l.qty} × ${fmtMoney(l.price)}`}</span></span></li>`; }).join('')}</ul>
    ${d.items.length ? `<p class="aside-sum">Wartość zgłoszenia: <strong>${fmtMoney(v)}</strong></p>` : ''}
    ${d.kind ? `<p class="small muted">${KINDS[d.kind as ClaimKind].icon} ${esc(KINDS[d.kind as ClaimKind].label)} · termin do ${fmtDate(kindAvailability(order, d.kind as ClaimKind).deadline)}</p>` : ''}</details></aside>`;
}

async function renderWizardStep(root: HTMLElement, stepNo: number, q: URLSearchParams): Promise<void> {
  const s = Store.db.session!;
  const orderParam = q.get('zamowienie');
  let draft = Store.db.draft;
  if (orderParam && draft && draft.data.orderId !== orderParam) draft = null;
  const orderId = orderParam ?? draft?.data.orderId ?? (s.role === 'AGENT' ? s.assisted?.orderId : s.orderId);
  if (!orderId) { navigate(s.role === 'AGENT' ? '/obsluga/nowe' : homeFor(s.role)); return; }
  const furthest = draft ? draft.step : 1;
  if (stepNo > furthest) { navigate('/zgloszenie/' + furthest); return; }

  root.innerHTML = `<div class="container section">${skelCards(2)}</div>`;
  let order: Order;
  try { order = await api.order(orderId); }
  catch (e) {
    if (!root.isConnected) return;
    if (e instanceof ApiError && e.status === 401) { showSessionExpired(); return; }
    root.innerHTML = `<div class="container narrow section"><h1 class="sr-only">Błąd</h1>${errorState(e)}</div>`;
    $('[data-retry]', root)?.addEventListener('click', () => renderWizardStep(root, stepNo, q));
    return;
  }
  if (!root.isConnected) return;

  const d: DraftData = draft ? clone(draft.data) : {
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
          const n = i + 1; const cls = n === stepNo ? 'current' : n <= furthest ? 'done' : '';
          const inner = `<span class="st-num">${cls === 'done' ? '✓' : n}</span><span class="st-label">${t}</span>`;
          return `<li class="${cls}" ${n === stepNo ? 'aria-current="step"' : ''}>${cls === 'done' ? `<a class="st" href="#/zgloszenie/${n}">${inner}</a>` : `<span class="st">${inner}</span>`}</li>`;
        }).join('')}</ol></div></div>
      <div class="container section wiz-grid">
        <form novalidate data-form class="wiz-form"><h1>${step.title}</h1><p class="muted">${step.intro(d)}</p>${step.render(d, { order, form: root, root, dirty: () => {} })}</form>
        ${orderAside(order, d)}
      </div>
      <div class="wiz-actions"><div class="container row-between">
        ${stepNo > 1 ? '<button type="button" class="btn btn-secondary" data-back>‹ Wstecz</button>' : `<a class="btn btn-ghost" href="#${s.role === 'AGENT' ? '/obsluga' : homeFor(s.role)}">Anuluj</a>`}
        <button type="button" class="btn btn-primary" data-next>${stepNo === 6 ? 'Wyślij zgłoszenie' : returnTo ? 'Zapisz i wróć do podsumowania' : 'Dalej ›'}</button></div></div>
    </div>`;

  const form = $('[data-form]', root)!;
  const markDirty = () => { dirty = true; Router.dirty = true; };
  const ctx: WizCtx = { order, form, root, dirty: markDirty };
  step.bind?.(d, ctx);
  bindCounters(form);
  applyConditions(form);
  form.addEventListener('change', () => { applyConditions(form); markDirty(); });
  form.addEventListener('input', markDirty);
  bindBlurValidation(form, () => { const t = clone(d); step.collect(form, t, ctx); return step.validate(t, ctx); });
  form.addEventListener('submit', (e) => e.preventDefault());

  Router.leaveGuard = async () => !dirty || confirmModal('Opuścić zgłoszenie?', 'Zmiany na tym kroku nie zostały zapisane. Dane z poprzednich kroków są bezpieczne.', 'Opuść bez zapisu', true);

  const savedLbl = $('[data-saved]', root)!;
  const save = async (nextStep: number): Promise<boolean> => {
    savedLbl.textContent = 'Zapisywanie…';
    try {
      if (!Store.db.draft || Store.db.draft.data.orderId !== order.id) await api.createDraft(order.id, d.kind as ClaimKind);
      const r = await api.patchDraft(d, nextStep);
      savedLbl.textContent = 'Zapisano ' + fmtDateTime(r.updatedAt).split(', ')[1];
      dirty = false; Router.dirty = false;
      return true;
    } catch {
      savedLbl.textContent = 'Nie zapisano';
      $('.save-error', form)?.remove();
      form.insertAdjacentHTML('afterbegin', `<div class="save-error">${alertBox('error', 'Nie udało się zapisać', 'Sprawdź połączenie i spróbuj ponownie. Wprowadzone dane nie zostały utracone.')}</div>`);
      return false;
    }
  };

  $('[data-back]', root)?.addEventListener('click', () => {
    step.collect(form, d, ctx);
    if (Store.db.draft) { Store.db.draft.data = d; Store.save(); }
    Router.leaveGuard = null; Router.dirty = false;
    navigate('/zgloszenie/' + (stepNo - 1));
  });

  $('[data-next]', root)!.addEventListener('click', async (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    step.collect(form, d, ctx);
    $('.save-error', form)?.remove();
    const errs = step.validate(d, ctx);
    if (errs.length) { showErrors(form, errs); return; }
    clearErrors(form);
    if (stepNo === 6) { await submitClaim(btn, form, d, ctx, save); return; }
    const done = busy(btn, 'Zapisywanie…');
    const next = returnTo && stepNo !== 1 ? Number(returnTo) : stepNo + 1;
    const ok = await save(Math.max(next, stepNo + 1));
    done();
    if (!ok) return;
    Router.leaveGuard = null;
    navigate('/zgloszenie/' + next);
  });
}

async function submitClaim(btn: HTMLButtonElement, form: HTMLElement, d: DraftData, ctx: WizCtx, save: (n: number) => Promise<boolean>): Promise<void> {
  const all: FieldError[] = [];
  STEP_DEFS.slice(0, 5).forEach((s, i) => s.validate(d, ctx).forEach((e) => all.push({ field: `step-${i + 1}`, message: `Krok ${i + 1} (${WIZ_STEPS[i]}): ${e.message}` })));
  if (all.length) {
    showErrors(form, [], '');
    form.insertAdjacentHTML('afterbegin', `<div class="error-summary" role="alert" tabindex="-1"><strong>Uzupełnij brakujące dane</strong><ul>${all.map((e) => `<li><a href="#/zgloszenie/${e.field.split('-')[1]}?powrot=6">${esc(e.message)}</a></li>`).join('')}</ul></div>`);
    ($('.error-summary', form) as HTMLElement).focus();
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<div class="overlay-box" role="status">${spinner()}<strong>Wysyłamy zgłoszenie…</strong><span class="small muted">Nie zamykaj okna.</span></div>`;
  document.body.appendChild(overlay);
  const done = busy(btn, 'Wysyłanie…');
  const alertEl = $('[data-submit-alert]', form)!;
  alertEl.innerHTML = '';
  try {
    if (!(await save(6))) throw new ApiError(503, 'SAVE_FAILED', 'Nie udało się zapisać danych.');
    await api.submitDraft();
    Router.leaveGuard = null; Router.dirty = false;
    overlay.remove();
    navigate('/zgloszenie/potwierdzenie');
  } catch (e) {
    overlay.remove(); done();
    $('.save-error', form)?.remove();
    if (e instanceof ApiError && e.status === 422) showErrors(form, e.fields.map((f) => ({ field: f.field, message: f.message })), 'Nie można wysłać zgłoszenia');
    else {
      alertEl.innerHTML = alertBox('error', 'Nie udało się wysłać zgłoszenia', 'Twoje dane są zapisane. Sprawdź połączenie i spróbuj ponownie.', '<button type="button" class="btn btn-secondary btn-sm" data-retry-submit>Spróbuj ponownie</button>');
      $('[data-retry-submit]', alertEl)!.addEventListener('click', () => btn.click());
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
    const form = $('[data-form]', root)!;
    const res = $('[data-results]', root)!;
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const v = formValues(form);
      const err = $('[data-q-err]', form)!;
      if (v.q.length < 3) { err.hidden = false; err.textContent = 'Wpisz co najmniej 3 znaki.'; return; }
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
            const o = os.find((x) => x.id === b.dataset.start)!;
            Store.db.session!.assisted = { orderId: o.id, channel: formValues(form).channel as Channel, customerName: o.customerName };
            Store.db.draft = null; Store.save();
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
    if (agent && Store.db.session) { Store.db.session.assisted = undefined; Store.save(); }
    $('[data-copy]', root)!.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(c.number); toast('Skopiowano numer zgłoszenia.', 'info'); } catch { toast('Nie udało się skopiować — zaznacz numer ręcznie.', 'error'); }
    });
  },
});

// ---------- Z-01 … Z-06 ----------
route({
  pattern: '/zgloszenie/:step', id: 'Z-0x', title: 'Zgłoszenie', roles: ['CUSTOMER', 'AGENT'],
  render(root, p, q) {
    const n = Number(p.step);
    if (!(n >= 1 && n <= 6)) { notFoundRoute.render(root, p, q); return; }
    document.title = `${WIZ_STEPS[n - 1]} · Zgłoszenie · ${SHOP.name}`;
    return renderWizardStep(root, n, q);
  },
});
