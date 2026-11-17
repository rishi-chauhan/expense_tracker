// Runs before first paint (blocking, tiny) to avoid a theme flash.
// External file so the CSP needs no 'unsafe-inline' for scripts.
(function () {
  var t = null;
  try { t = localStorage.getItem('expense-tracker-theme'); } catch { /* storage blocked */ }
  if (t !== 'light' && t !== 'dark') {
    t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
})();
