// Komponenty UI (design system mockupu) — nazwy jak w docs/04-specyfikacja-ekranow.md (4.0)

// ---------- Drobne komponenty ----------
function statusBadge(s: ClaimStatus): string {
  const st = STATUS[s];
  // w panelu obsługi etykiety pisane są z perspektywy pracownika
  const r = Store.db.session?.role;
  const label = r === 'AGENT' || r === 'WAREHOUSE' || r === 'SUPPLIER' ? st.bo : st.label;
  return `<span class="badge badge-${st.tone}">${esc(label)}</span>`;
}

function alertBox(tone: 'info' | 'success' | 'warning' | 'error', title: string, body = '', extra = ''): string {
  const icon = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '⛔' }[tone];
  const role = tone === 'error' ? 'alert' : 'status';
  return `<div class="alert alert-${tone}" role="${role}"><span class="alert-icon" aria-hidden="true">${icon}</span><div class="alert-body"><strong>${esc(title)}</strong>${body ? `<div>${body}</div>` : ''}${extra}</div></div>`;
}

function emptyState(icon: string, title: string, text: string, action = ''): string {
  return `<div class="state state-empty"><div class="state-icon" aria-hidden="true">${icon}</div><h3>${esc(title)}</h3><p>${text}</p>${action}</div>`;
}

function errorState(e: unknown, compact = false): string {
  const err = e instanceof ApiError ? e : new ApiError(0, 'NETWORK', 'Brak połączenia z internetem.');
  const trace = (err.extra.traceId as string) || '';
  const title = err.status === 404 ? 'Nie znaleziono' : 'Nie udało się wczytać danych';
  const text = err.status === 404 ? esc(err.message) : `${esc(err.message)} Spróbuj ponownie za chwilę.`;
  return `<div class="state state-error ${compact ? 'compact' : ''}" role="alert"><div class="state-icon" aria-hidden="true">⚠️</div><h3>${title}</h3><p>${text}</p>
    ${err.status !== 404 ? '<button class="btn btn-secondary" data-retry>Spróbuj ponownie</button>' : ''}
    ${trace ? `<p class="muted small">Kod błędu dla infolinii: <code>${esc(trace)}</code></p>` : ''}</div>`;
}

function skelLines(n = 3): string {
  return `<div class="skel-group" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<div class="skel skel-line" style="width:${90 - (i % 3) * 18}%"></div>`).join('')}</div>`;
}

function skelCards(n = 3): string {
  return `<div class="skel-cards" aria-busy="true" aria-label="Wczytywanie">${Array.from({ length: n }, () => `<div class="card skel-card"><div class="skel skel-title"></div>${skelLines(2)}</div>`).join('')}</div>`;
}

function skelTable(rows = 5): string {
  return `<div class="card" aria-busy="true" aria-label="Wczytywanie">${Array.from({ length: rows }, () => `<div class="skel-row"><div class="skel skel-line" style="width:18%"></div><div class="skel skel-line" style="width:30%"></div><div class="skel skel-line" style="width:20%"></div><div class="skel skel-line" style="width:14%"></div></div>`).join('')}</div>`;
}

function spinner(): string { return '<span class="spinner" aria-hidden="true"></span>'; }

function busy(btn: HTMLButtonElement | null, label: string): () => void {
  if (!btn) return () => {};
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  btn.innerHTML = `${spinner()} ${esc(label)}`;
  return () => { btn.disabled = false; btn.removeAttribute('aria-busy'); btn.innerHTML = html; };
}

// ---------- Ładowanie danych ze stanami ----------
async function loadInto<T>(el: HTMLElement, o: { skeleton: string; load: () => Promise<T>; isEmpty?: (d: T) => boolean; empty?: () => string; render: (d: T) => void; compactError?: boolean }): Promise<void> {
  el.innerHTML = o.skeleton;
  const slowTimer = setTimeout(() => {
    if (el.isConnected && el.querySelector('[aria-busy]')) el.insertAdjacentHTML('beforeend', '<p class="muted small slow-note">To trwa dłużej niż zwykle…</p>');
  }, 2000);
  try {
    const data = await o.load();
    clearTimeout(slowTimer);
    if (!el.isConnected) return;
    if (o.isEmpty && o.isEmpty(data) && o.empty) { el.innerHTML = o.empty(); return; }
    o.render(data);
  } catch (e) {
    clearTimeout(slowTimer);
    if (!el.isConnected) return;
    if (e instanceof ApiError && e.status === 401) { showSessionExpired(); return; }
    el.innerHTML = errorState(e, o.compactError);
    $('[data-retry]', el)?.addEventListener('click', () => loadInto(el, o));
  }
}

// ---------- Toast ----------
function toast(msg: string, tone: 'success' | 'error' | 'info' = 'success'): void {
  const box = $('#toasts');
  if (!box) return;
  const t = document.createElement('div');
  t.className = `toast toast-${tone}`;
  t.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  t.innerHTML = `<span>${tone === 'success' ? '✅' : tone === 'error' ? '⛔' : 'ℹ️'}</span><span>${esc(msg)}</span>`;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 5000);
}

// ---------- Modal ----------
interface ModalAction { label: string; kind?: 'primary' | 'secondary' | 'danger' | 'ghost'; onClick: (ctx: { close: () => void; el: HTMLElement; btn: HTMLButtonElement }) => void | Promise<void> }

function openModal(o: { title: string; body: string; actions: ModalAction[]; dismissible?: boolean; onOpen?: (el: HTMLElement) => void; wide?: boolean }): { close: () => void; el: HTMLElement } {
  const prev = document.activeElement as HTMLElement | null;
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  const titleId = uid('mt');
  wrap.innerHTML = `<div class="modal ${o.wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
    <div class="modal-head"><h2 id="${titleId}">${esc(o.title)}</h2>${o.dismissible !== false ? '<button class="icon-btn" data-close aria-label="Zamknij">✕</button>' : ''}</div>
    <div class="modal-body">${o.body}</div>
    <div class="modal-foot">${o.actions.map((a, i) => `<button class="btn btn-${a.kind ?? 'secondary'}" data-act="${i}">${esc(a.label)}</button>`).join('')}</div></div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  const el = wrap.querySelector('.modal') as HTMLElement;
  const close = () => {
    wrap.remove();
    if (!$('.modal-backdrop')) document.body.classList.remove('no-scroll');
    prev?.focus?.();
  };
  o.actions.forEach((a, i) => {
    const btn = el.querySelector(`[data-act="${i}"]`) as HTMLButtonElement;
    btn.addEventListener('click', () => a.onClick({ close, el, btn }));
  });
  $('[data-close]', el)?.addEventListener('click', close);
  wrap.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && o.dismissible !== false) close();
    if (ev.key === 'Tab') {
      const f = $$('button, input, select, textarea, a[href]', el).filter((x) => !(x as HTMLButtonElement).disabled);
      if (!f.length) return;
      if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
      else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
    }
  });
  o.onOpen?.(el);
  ($('input, textarea, select', el) ?? el.querySelector('[data-act]') as HTMLElement)?.focus();
  return { close, el };
}

function confirmModal(title: string, text: string, confirmLabel: string, danger = false): Promise<boolean> {
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
function showSessionExpired(): void {
  if (sessionModalOpen) return;
  sessionModalOpen = true;
  const returnUrl = location.hash.slice(1) || '/';
  openModal({
    title: 'Sesja wygasła', dismissible: false,
    body: `<p>Ze względów bezpieczeństwa wylogowaliśmy Cię po 15 minutach bezczynności.</p><p class="muted">Dane wprowadzone w kreatorze zgłoszenia zostały zapisane.</p>`,
    actions: [{
      label: 'Zaloguj się ponownie', kind: 'primary', onClick: ({ close }) => {
        close(); sessionModalOpen = false;
        Router.leaveGuard = null; Router.dirty = false; // wersja robocza jest zapisana — nie pytamy o opuszczenie
        const wasStaff = Store.db.session?.role !== 'CUSTOMER';
        Store.db.session = null; Store.save();
        navigate(wasStaff ? '/' : '/logowanie?returnUrl=' + encodeURIComponent(returnUrl));
      },
    }],
  });
}

// ---------- Pola formularzy ----------
interface FieldOpts { name: string; label: string; value?: string; type?: string; hint?: string; required?: boolean; placeholder?: string; inputmode?: string; autocomplete?: string; maxlength?: number; attrs?: string; cls?: string }

function fid(name: string): string { return 'f-' + name.replace(/[^a-zA-Z0-9]/g, '-'); }

function fieldWrap(o: FieldOpts, control: string): string {
  const id = fid(o.name);
  return `<div class="field ${o.cls ?? ''}" data-field="${esc(o.name)}">
    <label for="${id}">${esc(o.label)}${o.required ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="opt">(opcjonalnie)</span>'}</label>
    ${o.hint ? `<div class="hint" id="${id}-hint">${o.hint}</div>` : ''}
    ${control}
    <div class="field-error" id="${id}-err" hidden></div></div>`;
}

function describedBy(o: FieldOpts): string {
  const id = fid(o.name);
  return `aria-describedby="${o.hint ? id + '-hint ' : ''}${id}-err"`;
}

function textField(o: FieldOpts): string {
  const id = fid(o.name);
  return fieldWrap(o, `<input id="${id}" name="${esc(o.name)}" type="${o.type ?? 'text'}" value="${esc(o.value ?? '')}"
    ${o.placeholder ? `placeholder="${esc(o.placeholder)}"` : ''} ${o.inputmode ? `inputmode="${o.inputmode}"` : ''}
    ${o.autocomplete ? `autocomplete="${o.autocomplete}"` : ''} ${o.maxlength ? `maxlength="${o.maxlength}"` : ''}
    ${o.required ? 'aria-required="true"' : ''} ${describedBy(o)} ${o.attrs ?? ''}>`);
}

function textareaField(o: FieldOpts & { min?: number; max: number; rows?: number }): string {
  const id = fid(o.name);
  const len = (o.value ?? '').length;
  return fieldWrap(o, `<textarea id="${id}" name="${esc(o.name)}" rows="${o.rows ?? 5}" maxlength="${o.max}" ${o.placeholder ? `placeholder="${esc(o.placeholder)}"` : ''}
    ${o.required ? 'aria-required="true"' : ''} ${describedBy(o)} data-counter>${esc(o.value ?? '')}</textarea>
    <div class="counter" aria-live="polite"><span data-count>${len}</span> / ${o.max}${o.min ? ` · min. ${o.min}` : ''}</div>`);
}

function selectField(o: FieldOpts & { options: [string, string][]; placeholder?: string }): string {
  const id = fid(o.name);
  return fieldWrap(o, `<select id="${id}" name="${esc(o.name)}" ${o.required ? 'aria-required="true"' : ''} ${describedBy(o)} ${o.attrs ?? ''}>
    <option value="">${esc(o.placeholder ?? 'Wybierz…')}</option>
    ${o.options.map(([v, l]) => `<option value="${esc(v)}" ${v === o.value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`);
}

function radioGroup(o: { name: string; label: string; value: string; options: [string, string][]; required?: boolean; hint?: string; inline?: boolean }): string {
  const id = fid(o.name);
  return `<fieldset class="field" data-field="${esc(o.name)}" id="${id}" tabindex="-1">
    <legend>${esc(o.label)}${o.required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</legend>
    ${o.hint ? `<div class="hint">${o.hint}</div>` : ''}
    <div class="radios ${o.inline ? 'inline' : ''}">${o.options.map(([v, l]) => `<label class="radio"><input type="radio" name="${esc(o.name)}" value="${esc(v)}" ${v === o.value ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>
    <div class="field-error" id="${id}-err" hidden></div></fieldset>`;
}

function radioCards(o: { name: string; label: string; value: string; options: { value: string; title: string; text?: string; icon?: string; disabled?: boolean }[]; required?: boolean }): string {
  const id = fid(o.name);
  return `<fieldset class="field" data-field="${esc(o.name)}" id="${id}" tabindex="-1">
    <legend>${esc(o.label)}${o.required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</legend>
    <div class="radio-cards">${o.options.map((op) => `<label class="radio-card ${op.disabled ? 'disabled' : ''}">
      <input type="radio" name="${esc(o.name)}" value="${esc(op.value)}" ${op.value === o.value ? 'checked' : ''} ${op.disabled ? 'disabled' : ''}>
      ${op.icon ? `<span class="rc-icon" aria-hidden="true">${op.icon}</span>` : ''}
      <span class="rc-text"><strong>${esc(op.title)}</strong>${op.text ? `<span>${op.text}</span>` : ''}</span></label>`).join('')}</div>
    <div class="field-error" id="${id}-err" hidden></div></fieldset>`;
}

function checkboxField(o: { name: string; label: string; checked: boolean; required?: boolean; hint?: string }): string {
  const id = fid(o.name);
  return `<div class="field field-check" data-field="${esc(o.name)}"><label class="check"><input type="checkbox" id="${id}" name="${esc(o.name)}" ${o.checked ? 'checked' : ''} aria-describedby="${id}-err">
    <span>${o.label}${o.required ? ' <span class="req" aria-hidden="true">*</span>' : ''}</span></label>${o.hint ? `<div class="hint">${o.hint}</div>` : ''}<div class="field-error" id="${id}-err" hidden></div></div>`;
}

function bindCounters(root: HTMLElement): void {
  $$('textarea[data-counter]', root).forEach((ta) => {
    const c = ta.parentElement?.querySelector('[data-count]');
    ta.addEventListener('input', () => { if (c) c.textContent = String((ta as HTMLTextAreaElement).value.length); });
  });
}

function formValues(form: HTMLElement): Record<string, string> {
  const out: Record<string, string> = {};
  $$('input, select, textarea', form).forEach((el) => {
    const i = el as HTMLInputElement;
    if (!i.name) return;
    if (i.type === 'radio') { if (i.checked) out[i.name] = i.value; else if (!(i.name in out)) out[i.name] = ''; return; }
    if (i.type === 'checkbox') { out[i.name] = i.checked ? 'on' : ''; return; }
    if (i.type === 'file') return;
    out[i.name] = i.value.trim();
  });
  return out;
}

function clearErrors(form: HTMLElement): void {
  $$('.field-error', form).forEach((e) => { e.hidden = true; e.textContent = ''; });
  $$('[aria-invalid]', form).forEach((e) => e.removeAttribute('aria-invalid'));
  $$('.field.has-error', form).forEach((e) => e.classList.remove('has-error'));
  $('.error-summary', form)?.remove();
}

function setFieldError(form: HTMLElement, name: string, message: string | null): void {
  const wrap = form.querySelector(`[data-field="${CSS.escape(name)}"]`) as HTMLElement | null;
  if (!wrap) return;
  const err = wrap.querySelector('.field-error') as HTMLElement | null;
  const inputs = $$('input, select, textarea', wrap);
  if (message) {
    wrap.classList.add('has-error');
    if (err) { err.hidden = false; err.textContent = message; }
    inputs.forEach((i) => i.setAttribute('aria-invalid', 'true'));
  } else {
    wrap.classList.remove('has-error');
    if (err) { err.hidden = true; err.textContent = ''; }
    inputs.forEach((i) => i.removeAttribute('aria-invalid'));
  }
}

function showErrors(form: HTMLElement, errors: FieldError[], title = 'Popraw dane, aby przejść dalej'): void {
  clearErrors(form);
  if (!errors.length) return;
  errors.forEach((e) => setFieldError(form, e.field, e.message));
  const sum = document.createElement('div');
  sum.className = 'error-summary';
  sum.setAttribute('role', 'alert');
  sum.tabIndex = -1;
  sum.innerHTML = `<strong>${esc(title)}</strong><ul>${errors.map((e) => `<li><a href="#" data-goto="${esc(e.field)}">${esc(e.message)}</a></li>`).join('')}</ul>`;
  form.prepend(sum);
  sum.querySelectorAll('[data-goto]').forEach((a) => a.addEventListener('click', (ev) => {
    ev.preventDefault();
    const wrap = form.querySelector(`[data-field="${CSS.escape((a as HTMLElement).dataset.goto!)}"]`);
    const target = (wrap?.querySelector('input:not([type=hidden]), select, textarea') ?? wrap) as HTMLElement | null;
    target?.focus();
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }));
  sum.focus();
  sum.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

// Walidacja przy opuszczeniu pola (blur) — pokazuje tylko błąd tego pola
function bindBlurValidation(form: HTMLElement, validate: () => FieldError[]): void {
  form.addEventListener('focusout', (ev) => {
    const t = ev.target as HTMLInputElement;
    if (!t.name || t.type === 'radio' || t.type === 'checkbox' || !t.value) return;
    // nie przesuwaj układu, gdy użytkownik właśnie klika przycisk wysyłki — walidacja i tak nastąpi
    const next = (ev as FocusEvent).relatedTarget as HTMLElement | null;
    if (next?.matches?.('button[type=submit], [data-next]')) return;
    const err = validate().find((e) => e.field === t.name);
    setFieldError(form, t.name, err ? err.message : null);
  });
}

// ---------- Upload plików ----------
let demoFileCounter = 1;

function fileIcon(f: FileMeta): string { return f.mime === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf') ? '📄' : isVideo(f.name, f.mime) ? '🎬' : '🖼️'; }

function renderFileList(files: FileMeta[]): string {
  if (!files.length) return '';
  return `<ul class="file-list">${files.map((f) => `<li class="file-item file-${f.status}">
    <span class="file-icon" aria-hidden="true">${fileIcon(f)}</span>
    <span class="file-main"><span class="file-name">${esc(f.name)}</span>
      <span class="file-meta">${fmtSize(f.size)} · ${f.status === 'uploading' ? `Wysyłanie ${f.progress}%` : f.status === 'scanning' ? 'Skanowanie antywirusowe…' : f.status === 'ready' ? '<span class="ok">Gotowy</span>' : `<span class="err">${esc(f.error ?? 'Błąd')}</span>`}</span>
      ${f.status === 'uploading' ? `<span class="progress"><span style="width:${f.progress}%"></span></span>` : ''}
    </span>
    ${f.status === 'error' && f.error?.includes('Ponów') ? `<button type="button" class="btn btn-ghost btn-sm" data-file-retry="${f.id}">Ponów</button>` : ''}
    <button type="button" class="icon-btn" data-file-remove="${f.id}" aria-label="Usuń plik ${esc(f.name)}">🗑</button></li>`).join('')}</ul>`;
}

function uploaderHtml(key: string, files: FileMeta[], compact = false): string {
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

function bindUploader(root: HTMLElement, key: string, files: FileMeta[], draftId: string, onChange: () => void): void {
  const box = root.querySelector(`[data-uploader="${CSS.escape(key)}"]`) as HTMLElement | null;
  if (!box) return;
  const list = $('[data-file-list]', box)!;
  const rerender = () => { list.innerHTML = renderFileList(files); onChange(); };

  const process = async (f: FileMeta) => {
    f.status = 'uploading'; f.progress = 0; f.error = undefined;
    rerender();
    const stepMs = Demo.scenario === 'slow' ? 250 : 90;
    while (f.progress < 100) {
      await sleep(stepMs);
      f.progress = Math.min(100, f.progress + 20);
      if (!box.isConnected) return;
      rerender();
    }
    try {
      await api.registerAttachment(f);
      f.status = 'scanning';
      rerender();
      const scan = await api.scanStatus(f);
      if (scan.scanStatus === 'INFECTED') { f.status = 'error'; f.error = 'Wykryto zagrożenie — plik odrzucony.'; }
      else f.status = 'ready';
    } catch {
      f.status = 'error'; f.error = 'Nie udało się wysłać · Ponów';
    }
    if (box.isConnected) rerender();
  };

  const add = (name: string, size: number, mime: string) => {
    if (files.length >= FILE_RULES.maxFiles) { toast('Możesz dodać maksymalnie 10 plików.', 'error'); return; }
    const err = validateFile(name, size, mime);
    const meta: FileMeta = { id: uid('f'), name, size, mime, status: err ? 'error' : 'uploading', error: err ?? undefined, progress: 0 };
    files.push(meta);
    if (err) rerender(); else process(meta);
  };

  const input = $('input[type=file]', box) as HTMLInputElement;
  input.addEventListener('change', () => { Array.from(input.files ?? []).forEach((f) => add(f.name, f.size, f.type)); input.value = ''; });
  const dz = $('.dropzone', box)!;
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault(); dz.classList.remove('drag');
    Array.from((e as DragEvent).dataTransfer?.files ?? []).forEach((f) => add(f.name, f.size, f.type));
  });
  $$('[data-demo-file]', box).forEach((b) => b.addEventListener('click', () => {
    const kind = b.dataset.demoFile;
    const n = demoFileCounter++;
    if (kind === 'ok') add(`zdjecie_${n}.jpg`, 1_200_000 + Math.round(Math.random() * 2_500_000), 'image/jpeg');
    if (kind === 'video') add(`nagranie_${n}.mp4`, 18_000_000 + Math.round(Math.random() * 20_000_000), 'video/mp4');
    if (kind === 'big') add(`zdjecie_raw_${n}.jpg`, 48_000_000, 'image/jpeg');
    if (kind === 'type') add(`program_${n}.exe`, 300_000, 'application/x-msdownload');
    if (kind === 'virus') add(`wirus_${n}.pdf`, 220_000, 'application/pdf');
  }));
  box.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const rm = t.closest('[data-file-remove]') as HTMLElement | null;
    if (rm) {
      const i = files.findIndex((f) => f.id === rm.dataset.fileRemove);
      if (i >= 0) files.splice(i, 1);
      rerender();
    }
    const rt = t.closest('[data-file-retry]') as HTMLElement | null;
    if (rt) { const f = files.find((x) => x.id === rt.dataset.fileRetry); if (f) process(f); }
  });
}

// ---------- Inne ----------
function screenTag(id: string, name: string): string {
  return `<div class="screen-tag" title="Identyfikator ekranu w specyfikacji (docs/04)"><span>${esc(id)}</span> ${esc(name)}</div>`;
}

function timelineHtml(entries: TimelineEntry[]): string {
  return `<ol class="timeline">${entries.slice().reverse().map((t, i) => `<li class="tl-item ${i === 0 ? 'current' : ''}">
    <span class="tl-dot tone-${STATUS[t.status].tone}" aria-hidden="true"></span>
    <div><div class="tl-title">${esc(t.title)}</div><div class="tl-meta">${fmtDateTime(t.at)} · ${esc(t.actor)}</div>${t.description ? `<div class="tl-desc">${esc(t.description)}</div>` : ''}</div></li>`).join('')}</ol>`;
}

function statusTracker(status: ClaimStatus, returnNone = false): string {
  const steps = returnNone ? ['Zgłoszone', 'Rozpatrywane', 'Rozwiązane'] : ['Zgłoszone', 'Rozpatrywane', 'Odesłanie', 'W magazynie', 'Rozwiązane'];
  let idx = STATUS[status].step;
  if (returnNone) idx = idx >= 4 ? 2 : Math.min(idx, 1);
  const stop = status === 'REJECTED' || status === 'CANCELLED';
  return `<ol class="mini-progress ${stop ? 'stopped' : ''}" aria-label="Etap: ${esc(stop ? STATUS[status].label : steps[idx])}">${steps.map((s, i) => `<li class="${i < idx || (i === idx && status === 'RESOLVED') ? 'done' : i === idx ? 'current' : ''}">${i === steps.length - 1 && stop ? esc(STATUS[status].label) : s}</li>`).join('')}</ol>`;
}

// Pseudo-kod QR (deterministyczny wzór z treści) — makieta, nie prawdziwy QR
function qrCode(text: string, size = 168): string {
  const n = 21;
  let h = 2166136261;
  for (const ch of text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
  const finder = (x: number, y: number) => {
    const inBox = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7;
    for (const [ox, oy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      if (inBox(ox, oy)) { const dx = x - ox, dy = y - oy; return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) ? 1 : 0; }
    }
    return -1;
  };
  const cell = size / n;
  let rects = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const f = finder(x, y);
    const on = f === -1 ? rnd() > 0.5 : f === 1;
    if (on) rects += `<rect x="${(x * cell).toFixed(2)}" y="${(y * cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`;
  }
  return `<svg class="qr" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Kod QR do nadania paczki: ${esc(text)}"><rect width="${size}" height="${size}" fill="#fff"/><g fill="#111">${rects}</g></svg>`;
}
