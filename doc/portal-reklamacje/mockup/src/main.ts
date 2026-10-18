// Start aplikacji

(function boot() {
  Store.load();
  const saved = storage.get('portal-reklamacje-scenario') as Scenario | null;
  if (saved && ['normal', 'slow', 'empty', 'error'].includes(saved)) Demo.scenario = saved;
  renderFooter();
  renderDemoPanel();
  window.addEventListener('hashchange', onHashChange);
  window.addEventListener('beforeunload', (e) => { if (Router.dirty) { e.preventDefault(); e.returnValue = ''; } });
  if (!location.hash) history.replaceState(null, '', '#/');
  renderRoute();
})();
