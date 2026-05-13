(() => {
  const TITLE_SUFFIX = ' | eCommerce pricing tool';
  const THEME_COOKIE_KEY = 'theme';
  const FONT_SCALE_GLOBAL_KEY = 'fontScale:global';
  const MOBILE_MENU_BREAKPOINT = 1180;
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

  function initResponsiveMenu() {
    const topActions = document.querySelector('.top-actions');
    const menu = topActions?.querySelector('.top-menu');
    if (!topActions || !menu) return;
    const themeBtn = topActions.querySelector('#themeToggleBtn');

    let burger = topActions.querySelector('.top-menu-hamburger');
    if (!burger) {
      burger = document.createElement('button');
      burger.type = 'button';
      burger.className = 'top-menu-hamburger';
      burger.setAttribute('aria-label', 'Menu');
      burger.setAttribute('aria-expanded', 'false');
      burger.innerHTML = '<span></span><span></span><span></span>';
      topActions.insertBefore(burger, menu);
    }

    // Keep theme switch always visible outside hamburger panel (left to burger).
    if (themeBtn && themeBtn.parentElement === menu) {
      topActions.insertBefore(themeBtn, burger);
    }

    const closeMenu = () => {
      topActions.classList.remove('is-menu-open');
      burger.setAttribute('aria-expanded', 'false');
      menu.querySelectorAll('.top-menu-group.has-dropdown.is-open').forEach((group) => {
        group.classList.remove('is-open');
      });
    };

    const openMenu = () => {
      topActions.classList.add('is-menu-open');
      burger.setAttribute('aria-expanded', 'true');
      menu.querySelectorAll('.top-menu-group.has-dropdown').forEach((group) => {
        if (group.querySelector('#layoutCustomizeBtn') || group.querySelector('.top-menu-dropdown-text-size')) {
          group.classList.add('is-open');
        }
      });
    };

    const isMobile = () => window.innerWidth <= MOBILE_MENU_BREAKPOINT;

    if (!burger.dataset.boundMenu) {
      burger.dataset.boundMenu = '1';
      burger.addEventListener('click', () => {
        if (!isMobile()) return;
        if (topActions.classList.contains('is-menu-open')) closeMenu();
        else openMenu();
      });
    }

    if (!menu.dataset.boundMobileDropdowns) {
      menu.dataset.boundMobileDropdowns = '1';
      menu.querySelectorAll('.top-menu-group.has-dropdown').forEach((group) => {
        const trigger = group.querySelector('.top-menu-link, .top-menu-toggle');
        const dropdown = group.querySelector('.top-menu-dropdown');
        if (!trigger || !dropdown) return;
        trigger.addEventListener('click', (event) => {
          if (!isMobile()) return;
          if (trigger.tagName.toLowerCase() === 'a') {
            event.preventDefault();
          }
          const nextState = !group.classList.contains('is-open');
          menu.querySelectorAll('.top-menu-group.has-dropdown.is-open').forEach((openGroup) => {
            if (openGroup !== group) openGroup.classList.remove('is-open');
          });
          group.classList.toggle('is-open', nextState);
        });
      });
    }

    if (!document.documentElement.dataset.boundMenuOutsideClick) {
      document.documentElement.dataset.boundMenuOutsideClick = '1';
      const closeWhenOutsideMenu = (event) => {
        if (!isMobile()) return;
        const target = event.target;
        if (menu.contains(target) || burger.contains(target)) return;
        closeMenu();
      };
      document.addEventListener('pointerdown', closeWhenOutsideMenu, true);
      document.addEventListener('click', closeWhenOutsideMenu, true);
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeMenu();
      });
    }

    menu.querySelectorAll('a.top-menu-link').forEach((link) => {
      if (!link.dataset.boundMenuLinkClose) {
        link.dataset.boundMenuLinkClose = '1';
        link.addEventListener('click', (event) => {
          if (isMobile() && link.closest('.top-menu-group.has-dropdown')) {
            event.preventDefault();
            return;
          }
          if (isMobile()) closeMenu();
        });
      }
    });

    const syncOnResize = () => {
      if (!isMobile()) closeMenu();
    };
    if (!window.__uiThemeMenuResizeBound) {
      window.__uiThemeMenuResizeBound = true;
      window.addEventListener('resize', syncOnResize);
    }
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
    initResponsiveMenu();
  }

  window.UITheme = { init };
})();
