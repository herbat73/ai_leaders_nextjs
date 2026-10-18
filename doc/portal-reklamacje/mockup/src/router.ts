// Prosty router oparty o hash (#/sciezka?param=wartosc)

type Params = Record<string, string>;
interface Route {
  pattern: string;
  id: string;
  title: string;
  roles?: Role[];
  render: (root: HTMLElement, p: Params, q: URLSearchParams) => void | Promise<void>;
}

const Router = {
  routes: [] as Route[],
  current: null as Route | null,
  prevHash: '',
  skipNext: false,
  leaveGuard: null as null | (() => Promise<boolean>),
  dirty: false,
};

function route(r: Route): void { Router.routes.push(r); }

function navigate(path: string): void {
  const target = '#' + path;
  if (location.hash === target) renderRoute();
  else location.hash = target;
}

function parseHash(): { path: string; query: URLSearchParams } {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [p, qs] = raw.split('?');
  return { path: p.replace(/\/+$/, '') || '/', query: new URLSearchParams(qs ?? '') };
}

function matchRoute(pattern: string, path: string): Params | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

async function onHashChange(): Promise<void> {
  if (Router.skipNext) { Router.skipNext = false; return; }
  if (Router.leaveGuard) {
    const ok = await Router.leaveGuard();
    if (!ok) { Router.skipNext = true; location.hash = Router.prevHash; return; }
  }
  renderRoute();
}

function renderRoute(): void {
  const { path, query } = parseHash();
  Router.prevHash = location.hash || '#/';
  Router.leaveGuard = null;
  Router.dirty = false;
  let found: Route | null = null;
  let params: Params = {};
  for (const r of Router.routes) {
    const m = matchRoute(r.pattern, path);
    if (m) { found = r; params = m; break; }
  }
  const session = Store.db.session;
  if (found?.roles) {
    if (!session) {
      const staff = /^\/(obsluga|magazyn|dostawca)/.test(path);
      navigate((staff ? '/panel-logowanie' : '/logowanie') + '?returnUrl=' + encodeURIComponent(path + (query.toString() ? '?' + query.toString() : '')));
      return;
    }
    if (!found.roles.includes(session.role)) found = null;
  }
  const r = found ?? notFoundRoute;
  Router.current = r;
  document.title = `${r.title} · TwójSklep — zwroty i reklamacje`;
  renderShell();
  const main = $('#main')!;
  main.innerHTML = '';
  window.scrollTo(0, 0);
  Promise.resolve(r.render(main, params, query)).then(() => {
    const h = $('h1', main);
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  });
  updateDemoPanel();
}

const notFoundRoute: Route = {
  pattern: '*', id: 'X-01', title: 'Nie znaleziono strony',
  render(root) {
    root.innerHTML = `${screenTag('X-01', 'Nie znaleziono')}<div class="container narrow section">
      ${emptyState('🧭', 'Nie znaleziono strony', 'Strona nie istnieje lub nie masz do niej dostępu.', `<a class="btn btn-primary" href="#${homeFor(Store.db.session?.role)}">Wróć na stronę główną</a>`)}
      <h1 class="sr-only">Nie znaleziono strony</h1></div>`;
  },
};
