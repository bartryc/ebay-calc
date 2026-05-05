(() => {
  const TITLE_SUFFIX = ' | eCommerce pricing tool';
  const THEME_COOKIE_KEY = 'theme';
  const FONT_SCALE_GLOBAL_KEY = 'fontScale:global';
  const FONT_SCALE_MIN = 0.7;
  const FONT_SCALE_MAX = 1.5;
  const FONT_SCALE_STEP = 0.1;

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

  function clampFontScale(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 1;
    return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, n));
  }

  function applyFontScale(scale) {
    const safe = clampFontScale(scale);
    document.documentElement.style.fontSize = `${(safe * 100).toFixed(0)}%`;
    return safe;
  }

  function initFontScaleControls() {
    const downBtn = document.getElementById('textSizeDownBtn');
    const resetBtn = document.getElementById('textSizeResetBtn');
    const upBtn = document.getElementById('textSizeUpBtn');
    if (!downBtn || !upBtn) return;

    const stored = localStorage.getItem(FONT_SCALE_GLOBAL_KEY);
    let currentScale = applyFontScale(stored || 1);

    const syncButtons = () => {
      downBtn.disabled = currentScale <= FONT_SCALE_MIN + 0.0001;
      upBtn.disabled = currentScale >= FONT_SCALE_MAX - 0.0001;
      if (resetBtn) {
        const pct = Math.round(currentScale * 100);
        resetBtn.textContent = `${pct}%`;
        resetBtn.disabled = Math.abs(currentScale - 1) < 0.0001;
      }
    };
    syncButtons();

    const updateScale = (next) => {
      currentScale = applyFontScale(next);
      localStorage.setItem(FONT_SCALE_GLOBAL_KEY, String(currentScale));
      syncButtons();
    };

    if (!downBtn.dataset.boundTextScale) {
      downBtn.dataset.boundTextScale = '1';
      downBtn.addEventListener('click', () => updateScale(currentScale - FONT_SCALE_STEP));
    }

    if (!upBtn.dataset.boundTextScale) {
      upBtn.dataset.boundTextScale = '1';
      upBtn.addEventListener('click', () => updateScale(currentScale + FONT_SCALE_STEP));
    }

    if (resetBtn && !resetBtn.dataset.boundTextScale) {
      resetBtn.dataset.boundTextScale = '1';
      resetBtn.addEventListener('click', () => updateScale(1));
    }
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

    initFontScaleControls();
  }

  window.UITheme = { init };
})();
