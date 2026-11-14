/* Mockup page helper: the Dark / Light switch in each page's toolbar, and the
   navigation switch's on/off preview on the staff navigation mockup. */
(function () {
  var root = document.documentElement;
  var KEY = 'tv-mockup-theme';
  function apply(mode) {
    if (mode === 'light') { root.setAttribute('data-theme', 'light'); }
    else { root.removeAttribute('data-theme'); }
    document.querySelectorAll('.mock-theme button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === (mode || 'dark')));
    });
  }
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* storage may be blocked */ }
  apply(saved === 'light' ? 'light' : null);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.mock-theme button');
    if (b) {
      var mode = b.getAttribute('data-mode');
      try { localStorage.setItem(KEY, mode); } catch (err) { /* ignore */ }
      apply(mode === 'light' ? 'light' : null);
      return;
    }
    var s = e.target.closest && e.target.closest('.switch');
    if (s) {
      var on = s.getAttribute('aria-checked') !== 'true';
      s.setAttribute('aria-checked', String(on));
      var label = document.querySelector('[data-testid="tv-takings-switch-state"]');
      if (label) label.textContent = on ? 'On' : 'Off';
    }
  });
})();
