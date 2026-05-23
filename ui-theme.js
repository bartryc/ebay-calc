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

  function initAppInfoTooltip() {
    const info = window.AppVersionInfo || {};
    const version = String(info.version || '').trim();
    const projectLabel = String(info.projectLabel || '').trim();
    const projectUrl = String(info.projectUrl || '').trim();
    const author = String(info.author || '').trim();
    const appLink = document.querySelector('.top-menu-app .top-menu-link[href="index.html"]');
    const tooltip = document.getElementById('appInfoTooltip');
    if (!version && !projectLabel && !author) return;

    if (appLink) {
      const ariaParts = ['Kalkulator'];
      if (version) ariaParts.push(`Wersja ${version}`);
      if (projectLabel) ariaParts.push(`Projekt: ${projectLabel}`);
      if (author) ariaParts.push(`Wykonanie: ${author}`);
      appLink.setAttribute('aria-label', `${ariaParts.join('. ')}.`);
    }

    let versionEl = document.getElementById('appVersion');
    if (!versionEl && appLink) {
      versionEl = document.createElement('span');
      versionEl.id = 'appVersion';
      versionEl.className = 'sr-only';
      appLink.appendChild(versionEl);
    }
    if (versionEl) {
      versionEl.textContent = version;
    }
    if (version) {
      localStorage.setItem('appVersion', version);
    }

    if (!tooltip) return;
    tooltip.textContent = '';
    if (version) {
      const row = document.createElement('span');
      row.textContent = `Wersja ${version}`;
      tooltip.appendChild(row);
    }
    if (projectLabel) {
      const row = document.createElement('span');
      row.append('Projekt: ');
      if (projectUrl) {
        const link = document.createElement('a');
        link.href = projectUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = projectLabel;
        row.appendChild(link);
      } else {
        row.append(projectLabel);
      }
      tooltip.appendChild(row);
    }
    if (author) {
      const row = document.createElement('span');
      row.textContent = `Wykonanie: ${author}`;
      tooltip.appendChild(row);
    }
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

  function initAdminShortcut() {
    if (window.__uiThemeAdminShortcutBound) return;
    window.__uiThemeAdminShortcutBound = true;
    const adminKeys = new Set();

    window.addEventListener('keydown', (event) => {
      const target = event.target;
      const active = document.activeElement;
      const isEditableTarget = !!(
        target?.isContentEditable
        || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)
        || target?.closest?.('[contenteditable="true"]')
        || active?.isContentEditable
        || ['INPUT', 'TEXTAREA', 'SELECT'].includes(active?.tagName)
      );
      if (isEditableTarget) return;
      adminKeys.add(event.key.toLowerCase());
      if (adminKeys.has('a') && adminKeys.has('d') && adminKeys.has('m')) {
        adminKeys.clear();
        sessionStorage.setItem('adminSessionUnlockedV1', '1');
        window.location.href = `admin.html?v=${Date.now()}`;
      }
    });

    window.addEventListener('keyup', (event) => {
      adminKeys.delete(event.key.toLowerCase());
    });
  }

  function initFloatingTooltips() {
    if (window.__uiThemeFloatingTooltipsBound) return;
    window.__uiThemeFloatingTooltipsBound = true;

    const narrowQuery = window.matchMedia('(max-width: 760px)');
    const tooltip = document.createElement('div');
    tooltip.className = 'floating-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.hidden = true;
    document.body.appendChild(tooltip);

    let activeTarget = null;
    let lastPointer = { x: 0, y: 0 };

    const isEnabled = () => narrowQuery.matches;
    const getTooltipTarget = (target) => {
      const node = target?.closest?.('[data-tooltip]');
      if (!node) return null;
      const text = String(node.getAttribute('data-tooltip') || '').trim();
      return text ? node : null;
    };

    const hideTooltip = () => {
      activeTarget = null;
      tooltip.classList.remove('is-visible');
      tooltip.hidden = true;
      document.body.classList.remove('uses-floating-tooltips');
    };

    const positionTooltip = (x, y) => {
      if (tooltip.hidden) return;
      const margin = 12;
      const gap = 14;
      const rect = tooltip.getBoundingClientRect();
      let left = x + gap;
      let top = y + gap;

      if (left + rect.width + margin > window.innerWidth) {
        left = x - rect.width - gap;
      }
      if (top + rect.height + margin > window.innerHeight) {
        top = y - rect.height - gap;
      }

      left = Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin));
      top = Math.max(margin, Math.min(top, window.innerHeight - rect.height - margin));
      tooltip.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    };

    const showTooltip = (target, x, y) => {
      if (!isEnabled() || !target) {
        hideTooltip();
        return;
      }
      const text = String(target.getAttribute('data-tooltip') || '').trim();
      if (!text) {
        hideTooltip();
        return;
      }
      activeTarget = target;
      tooltip.textContent = text;
      tooltip.hidden = false;
      document.body.classList.add('uses-floating-tooltips');
      tooltip.classList.add('is-visible');
      requestAnimationFrame(() => positionTooltip(x, y));
    };

    document.addEventListener('pointerover', (event) => {
      if (!isEnabled()) return;
      const target = getTooltipTarget(event.target);
      if (!target || target === activeTarget) return;
      lastPointer = { x: event.clientX, y: event.clientY };
      showTooltip(target, event.clientX, event.clientY);
    }, true);

    document.addEventListener('pointermove', (event) => {
      if (!activeTarget || !isEnabled()) return;
      lastPointer = { x: event.clientX, y: event.clientY };
      positionTooltip(event.clientX, event.clientY);
    }, true);

    document.addEventListener('pointerout', (event) => {
      if (!activeTarget) return;
      const next = event.relatedTarget;
      if (next && activeTarget.contains(next)) return;
      hideTooltip();
    }, true);

    document.addEventListener('focusin', (event) => {
      if (!isEnabled()) return;
      const target = getTooltipTarget(event.target);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      showTooltip(target, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }, true);

    document.addEventListener('focusout', (event) => {
      if (!activeTarget) return;
      if (event.target === activeTarget || activeTarget.contains(event.target)) hideTooltip();
    }, true);

    const syncMode = () => {
      document.body.classList.toggle('uses-floating-tooltips', isEnabled() && !!activeTarget);
      if (!isEnabled()) hideTooltip();
      else if (activeTarget) positionTooltip(lastPointer.x, lastPointer.y);
    };
    narrowQuery.addEventListener?.('change', syncMode);
    window.addEventListener('resize', syncMode);
    window.addEventListener('scroll', () => {
      if (activeTarget) positionTooltip(lastPointer.x, lastPointer.y);
    }, true);
  }

  function init() {
    const body = document.body;
    if (!body) return;
    applyPageTitle();
    initAppInfoTooltip();
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
    initFloatingTooltips();
    initAdminShortcut();
  }

  window.UITheme = { init };
})();
