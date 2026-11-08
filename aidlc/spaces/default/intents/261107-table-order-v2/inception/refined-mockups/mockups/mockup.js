/* Mockup page helper: the Follow device / Light / Dark switch in each page's toolbar.
   It is the same behaviour the app's theme toggle must have (FR2.3). */
(function () {
  var root = document.documentElement;
  var KEY = 'mockup-theme';
  function apply(mode) {
    if (mode === 'light' || mode === 'dark') { root.setAttribute('data-theme', mode); }
    else { root.removeAttribute('data-theme'); }
    document.querySelectorAll('.mock-theme button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === (mode || 'device')));
    });
  }
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* storage may be blocked */ }
  apply(saved === 'light' || saved === 'dark' ? saved : null);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.mock-theme button');
    if (!b) return;
    var mode = b.getAttribute('data-mode');
    try { if (mode === 'device') localStorage.removeItem(KEY); else localStorage.setItem(KEY, mode); } catch (err) { /* ignore */ }
    apply(mode === 'device' ? null : mode);
  });
})();
