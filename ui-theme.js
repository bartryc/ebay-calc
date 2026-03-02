(() => {
  const TITLE_SUFFIX = ' | eCommerce pricing tool';
  const THEME_COOKIE_KEY = 'theme';

  function getCookieValue(name) {
    const prefix = `${name}=`;
    const parts = (document.cookie || '').split(';').map((item) => item.trim());
    for (const part of parts) {
      if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
    }
    return '';
  }

  function setCookieValue(name, value, days = 365) {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  }

  function applyPageTitle() {
    const pageTitle = document.body?.dataset?.pageTitle;
    if (!pageTitle) return;
    document.title = `${pageTitle}${TITLE_SUFFIX}`;
  }

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
    applyPageTitle();
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const storedTheme = localStorage.getItem('theme') || getCookieValue(THEME_COOKIE_KEY);
    const isDark = storedTheme === 'dark';
    body.classList.toggle('dark-mode', isDark);
    setCookieValue(THEME_COOKIE_KEY, isDark ? 'dark' : 'light');
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
        setCookieValue(THEME_COOKIE_KEY, nowDark ? 'dark' : 'light');
      });
    }
  }

  window.UITheme = { init };
})();
