(() => {
  function applySourceIconsTheme(isDark) {
    const sourceIcons = Array.from(document.querySelectorAll('.source-icon[data-dark-src]'));
    sourceIcons.forEach((icon) => {
      const darkSrc = icon.dataset.darkSrc;
      if (!darkSrc) return;
      if (!icon.dataset.lightSrc) {
        icon.dataset.lightSrc = icon.getAttribute('src') || '';
      }
      icon.setAttribute('src', isDark ? darkSrc : icon.dataset.lightSrc);
    });
  }

  function updateToggleLabel(btn, isDark) {
    if (!btn) return;
    const label = isDark ? 'Wlacz tryb jasny' : 'Wlacz tryb ciemny';
    btn.setAttribute('aria-label', label);
    btn.setAttribute('title', label);
  }

  function init() {
    const body = document.body;
    if (!body) return;
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const storedTheme = localStorage.getItem('theme');
    const isDark = storedTheme === 'dark';
    body.classList.toggle('dark-mode', isDark);
    updateToggleLabel(themeToggleBtn, isDark);
    applySourceIconsTheme(isDark);

    if (themeToggleBtn && !themeToggleBtn.dataset.themeBound) {
      themeToggleBtn.dataset.themeBound = '1';
      themeToggleBtn.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        const nowDark = body.classList.contains('dark-mode');
        updateToggleLabel(themeToggleBtn, nowDark);
        applySourceIconsTheme(nowDark);
        localStorage.setItem('theme', nowDark ? 'dark' : 'light');
      });
    }
  }

  window.UITheme = { init };
})();
