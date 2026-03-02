let lastChanged = null;
let originalEbayPrice = null;
let originalCurrency = 'EUR';
let originalExchangeRate = 4.3;
let lastCurrency = 'EUR';
let currentExchangeRate = 4.3;
const VAT23 = 0.23;
const DEFAULT_RATES = { EUR: 4.3, USD: 3.9, GBP: 5.0 };
const RATE_PROVIDERS = {
  frankfurter: {
    label: 'Frankfurter',
    buildUrl: (currency) => `https://api.frankfurter.app/latest?from=PLN&to=${currency}`,
    readRate: (data, currency) => data?.rates?.[currency]
  },
  exchangerate: {
    label: 'exchangerate.host',
    buildUrl: (currency) => `https://api.exchangerate.host/latest?base=PLN&symbols=${currency}`,
    readRate: (data, currency) => data?.rates?.[currency]
  },
  erapi: {
    label: 'open.er-api.com',
    buildUrl: () => 'https://open.er-api.com/v6/latest/PLN',
    readRate: (data, currency) => data?.rates?.[currency]
  }
};
const rateStatusCache = {};
let isPresetApplied = false;
const numberFormatter = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
let selfTestHideTimer = null;
const historyEntries = [];
const historyTimers = {};
let lastHistorySignature = '';
let lastClearedHistory = [];
let restoreHistoryTimer = null;
const fieldBaselines = {};
const lastLoggedValues = {};
const mainToastStack = document.getElementById('mainToastStack');
const activityLogCache = {};
const appVersionEl = document.getElementById('appVersion');
const appVersion = appVersionEl ? appVersionEl.textContent.trim() : '';
if (appVersion) {
  localStorage.setItem('appVersion', appVersion);
}

const INDEX_LAYOUT_STORAGE_KEY = 'indexLayoutOrderV1';
const INDEX_LAYOUT_COOKIE_KEY = 'indexLayoutOrderV1';
const layoutGroups = {
  calc: document.getElementById('calcLayoutContainer'),
  info: document.getElementById('infoLayoutContainer')
};
const layoutCustomizeBtn = document.getElementById('layoutCustomizeBtn');
const layoutEditBar = document.getElementById('layoutEditBar');
const layoutSaveBtn = document.getElementById('layoutSaveBtn');
const layoutResetBtn = document.getElementById('layoutResetBtn');
const layoutExitBtn = document.getElementById('layoutExitBtn');
let isLayoutEditMode = false;
let defaultLayoutOrder = null;
let preEditLayoutOrder = null;
let currentDraggedItem = null;
let currentDraggedEl = null;

function beginLayoutDrag(groupKey, itemId, item, event) {
  if (!isLayoutEditMode) return;
  currentDraggedItem = { groupKey, itemId };
  currentDraggedEl = item;
  item.classList.add('is-dragging');
  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', itemId);
    event.dataTransfer.setDragImage(item, 24, 18);
  }
}

function endLayoutDrag() {
  document.querySelectorAll('.layout-item.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
  if (currentDraggedEl) {
    currentDraggedEl.classList.remove('is-dragging');
  }
  currentDraggedItem = null;
  currentDraggedEl = null;
  if (isLayoutEditMode) {
    renderLayoutItemControls();
    updateLayoutDiffHighlight();
  }
}

function layoutGetCookieValue(name) {
  const prefix = `${name}=`;
  const parts = (document.cookie || '').split(';').map((item) => item.trim());
  for (const part of parts) {
    if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
  }
  return '';
}

function layoutSetCookieValue(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCurrentLayoutOrder() {
  const order = {};
  Object.entries(layoutGroups).forEach(([groupKey, groupEl]) => {
    if (!groupEl) return;
    order[groupKey] = Array.from(groupEl.children)
      .map((child) => child.getAttribute('data-layout-item'))
      .filter(Boolean);
  });
  return order;
}

function normalizeLayoutOrder(rawOrder) {
  const normalized = {};
  Object.entries(layoutGroups).forEach(([groupKey, groupEl]) => {
    if (!groupEl) return;
    const available = Array.from(groupEl.children)
      .map((child) => child.getAttribute('data-layout-item'))
      .filter(Boolean);
    const seen = new Set();
    const requested = Array.isArray(rawOrder?.[groupKey]) ? rawOrder[groupKey] : [];
    const finalOrder = [];
    requested.forEach((id) => {
      if (!id || seen.has(id) || !available.includes(id)) return;
      seen.add(id);
      finalOrder.push(id);
    });
    available.forEach((id) => {
      if (seen.has(id)) return;
      seen.add(id);
      finalOrder.push(id);
    });
    normalized[groupKey] = finalOrder;
  });
  return normalized;
}

function applyLayoutOrder(orderMap) {
  const normalized = normalizeLayoutOrder(orderMap);
  Object.entries(layoutGroups).forEach(([groupKey, groupEl]) => {
    if (!groupEl) return;
    const allChildren = Array.from(groupEl.children);
    const movableChildren = allChildren.filter((child) => child.getAttribute('data-layout-item'));
    const staticChildren = allChildren.filter((child) => !child.getAttribute('data-layout-item'));
    const byId = new Map();
    movableChildren.forEach((child) => {
      const id = child.getAttribute('data-layout-item');
      if (id) byId.set(id, child);
    });
    (normalized[groupKey] || []).forEach((id) => {
      const child = byId.get(id);
      if (child) groupEl.appendChild(child);
    });
    staticChildren.forEach((child) => {
      groupEl.appendChild(child);
    });
  });
  if (isLayoutEditMode) {
    renderLayoutItemControls();
  }
}

function loadSavedLayoutOrder() {
  const raw = localStorage.getItem(INDEX_LAYOUT_STORAGE_KEY) || layoutGetCookieValue(INDEX_LAYOUT_COOKIE_KEY);
  if (!raw) return null;
  try {
    return normalizeLayoutOrder(JSON.parse(raw));
  } catch (error) {
    return null;
  }
}

function saveLayoutOrder(orderMap) {
  const normalized = normalizeLayoutOrder(orderMap);
  const payload = JSON.stringify(normalized);
  localStorage.setItem(INDEX_LAYOUT_STORAGE_KEY, payload);
  layoutSetCookieValue(INDEX_LAYOUT_COOKIE_KEY, payload);
}

function clearSavedLayoutOrder() {
  localStorage.removeItem(INDEX_LAYOUT_STORAGE_KEY);
  document.cookie = `${INDEX_LAYOUT_COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

function updateLayoutDiffHighlight() {
  const baseline = normalizeLayoutOrder(preEditLayoutOrder || {});
  const current = getCurrentLayoutOrder();
  Object.entries(layoutGroups).forEach(([groupKey, groupEl]) => {
    if (!groupEl) return;
    const baseOrder = Array.isArray(baseline[groupKey]) ? baseline[groupKey] : [];
    const currOrder = Array.isArray(current[groupKey]) ? current[groupKey] : [];
    const baseIndex = new Map();
    baseOrder.forEach((id, index) => {
      baseIndex.set(id, index);
    });
    Array.from(groupEl.children).forEach((item) => {
      const id = item.getAttribute('data-layout-item');
      if (!id) return;
      const nowIndex = currOrder.indexOf(id);
      const prevIndex = baseIndex.has(id) ? baseIndex.get(id) : nowIndex;
      item.classList.toggle('is-layout-modified', nowIndex !== prevIndex);
    });
  });
}

function removeLayoutItemControls() {
  document.querySelectorAll('.layout-item-controls').forEach((el) => el.remove());
  Object.values(layoutGroups).forEach((groupEl) => {
    if (!groupEl) return;
    Array.from(groupEl.children).forEach((item) => {
      if (!item.classList.contains('layout-item')) return;
      item.removeAttribute('draggable');
      item.classList.remove('is-layout-draggable', 'is-dragging', 'is-drop-target', 'is-layout-modified');
      item.ondragstart = null;
      item.ondragend = null;
      item.ondragover = null;
      item.ondragleave = null;
      item.ondrop = null;
    });
  });
}

function moveLayoutItem(groupKey, itemId, direction) {
  const groupEl = layoutGroups[groupKey];
  if (!groupEl || !itemId) return;
  const order = getCurrentLayoutOrder();
  const list = Array.isArray(order[groupKey]) ? order[groupKey].slice() : [];
  const index = list.indexOf(itemId);
  if (index < 0) return;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= list.length) return;
  [list[index], list[targetIndex]] = [list[targetIndex], list[index]];
  order[groupKey] = list;
  applyLayoutOrder(order);
  updateLayoutDiffHighlight();
}

function renderLayoutItemControls() {
  removeLayoutItemControls();
  Object.entries(layoutGroups).forEach(([groupKey, groupEl]) => {
    if (!groupEl) return;
    const items = Array.from(groupEl.children).filter((child) => child.getAttribute('data-layout-item'));
    items.forEach((item, index) => {
      const itemId = item.getAttribute('data-layout-item');
      if (!itemId) return;
      item.classList.add('is-layout-draggable');
      item.ondragover = (event) => {
        if (!isLayoutEditMode || !currentDraggedItem || currentDraggedItem.groupKey !== groupKey) return;
        event.preventDefault();
        if (currentDraggedItem.itemId === itemId) return;
        item.classList.add('is-drop-target');
        if (!currentDraggedEl || currentDraggedEl === item || currentDraggedEl.parentElement !== groupEl) return;
        const rect = item.getBoundingClientRect();
        const insertAfter = event.clientY > rect.top + rect.height / 2;
        if (insertAfter) {
          if (item.nextElementSibling !== currentDraggedEl) {
            groupEl.insertBefore(currentDraggedEl, item.nextElementSibling);
            updateLayoutDiffHighlight();
          }
        } else if (item !== currentDraggedEl.nextElementSibling) {
          groupEl.insertBefore(currentDraggedEl, item);
          updateLayoutDiffHighlight();
        }
      };
      item.ondragleave = () => {
        item.classList.remove('is-drop-target');
      };
      item.ondrop = (event) => {
        event.preventDefault();
        item.classList.remove('is-drop-target');
        if (!isLayoutEditMode || !currentDraggedItem || currentDraggedItem.groupKey !== groupKey) return;
        renderLayoutItemControls();
        updateLayoutDiffHighlight();
      };
      const controls = document.createElement('div');
      controls.className = 'layout-item-controls';
      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'layout-item-handle';
      handle.textContent = '::';
      handle.setAttribute('aria-label', 'Przeciągnij sekcję');
      handle.setAttribute('title', 'Przeciągnij, aby zmienić kolejność');
      handle.setAttribute('draggable', 'true');
      handle.addEventListener('dragstart', (event) => {
        beginLayoutDrag(groupKey, itemId, item, event);
      });
      handle.addEventListener('dragend', () => {
        endLayoutDrag();
      });
      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'layout-item-move';
      upBtn.textContent = '↑';
      upBtn.setAttribute('aria-label', 'Przesuń wyżej');
      upBtn.disabled = index === 0;
      upBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        moveLayoutItem(groupKey, itemId, 'up');
      });
      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'layout-item-move';
      downBtn.textContent = '↓';
      downBtn.setAttribute('aria-label', 'Przesuń niżej');
      downBtn.disabled = index === items.length - 1;
      downBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        moveLayoutItem(groupKey, itemId, 'down');
      });
      controls.append(handle, upBtn, downBtn);
      const detailsSummary = item.tagName === 'DETAILS'
        ? item.querySelector('.collapsible-summary')
        : null;
      const controlsHost = detailsSummary || item;
      controlsHost.appendChild(controls);
    });
  });
  if (isLayoutEditMode) {
    updateLayoutDiffHighlight();
  }
}

function blockDetailsToggleInLayoutMode(event) {
  if (!isLayoutEditMode) return;
  const summary = event.target?.closest('details.layout-item > .collapsible-summary');
  if (!summary) return;
  const controlButton = event.target?.closest('.layout-item-controls button');
  if (controlButton) return;
  event.preventDefault();
  event.stopPropagation();
}

function setLayoutEditMode(enabled) {
  isLayoutEditMode = !!enabled;
  document.body.classList.toggle('layout-edit-mode', isLayoutEditMode);
  if (layoutEditBar) {
    layoutEditBar.hidden = !isLayoutEditMode;
  }
  if (layoutCustomizeBtn) {
    layoutCustomizeBtn.classList.toggle('is-active', isLayoutEditMode);
  }
  if (isLayoutEditMode) {
    preEditLayoutOrder = getCurrentLayoutOrder();
    renderLayoutItemControls();
    updateLayoutDiffHighlight();
    showMainToast('Tryb edycji układu aktywny.', 'info');
    return;
  }
  currentDraggedItem = null;
  removeLayoutItemControls();
}

function getFieldElement(source) {
  const map = {
    netto: 'plnNetto',
    brutto: 'plnBrutto',
    ebayPrice: 'ebayPrice',
    vatRate: 'vatRate',
    exchangeRate: 'exchangeRate',
    commission: 'commission'
  };
  const id = map[source] || source;
  return document.getElementById(id);
}

function parseNumber(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return '0';
  return numberFormatter.format(value);
}

function hideSelfTestDetails() {}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(2);
}

function updateMinSaleByMarkup() {
  const purchaseEl = document.getElementById('purchaseAmount');
  const markupEl = document.getElementById('minMarkup');
  const minSalePlnEl = document.getElementById('minSalePln');
  const minSaleEbayEl = document.getElementById('minSaleEbay');
  const minSaleCurrencyLabelEl = document.getElementById('minSaleCurrencyLabel');
  const currencyEl = document.getElementById('currency');
  if (!purchaseEl || !markupEl || !minSalePlnEl || !minSaleEbayEl || !currencyEl) return;

  const purchase = parseNumber(purchaseEl.value);
  const markupPercent = parseNumber(markupEl.value);
  const exchangeRate = parseNumber(document.getElementById('exchangeRate')?.value);
  const commissionRaw = advancedOptionsToggle?.checked
    ? parseNumber(document.getElementById('commission')?.value)
    : 15;
  const commission = Number.isFinite(commissionRaw) ? commissionRaw / 100 : NaN;
  const currency = currencyEl.value || 'EUR';

  if (minSaleCurrencyLabelEl) minSaleCurrencyLabelEl.textContent = currency;

  if (!Number.isFinite(purchase) || purchase <= 0 || !Number.isFinite(markupPercent) || markupPercent < 0) {
    minSalePlnEl.textContent = '—';
    minSaleEbayEl.textContent = '—';
    return;
  }

  const minSalePlnBrutto = purchase * (1 + (markupPercent / 100));
  minSalePlnEl.textContent = `${minSalePlnBrutto.toFixed(2)} PLN`;

  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0 || !Number.isFinite(commission) || commission < 0) {
    minSaleEbayEl.textContent = '—';
    return;
  }

  const minSaleEbay = minSalePlnBrutto * exchangeRate * (1 + commission);
  minSaleEbayEl.textContent = `${minSaleEbay.toFixed(2)} ${currency}`;
}

function updateBaseMultiplier() {
  const multiplierEl = document.getElementById('baseMultiplierValue');
  const multiplierSummaryEl = document.getElementById('baseMultiplierSummaryValue');
  if (!multiplierEl) return;
  const exchangeRate = parseNumber(document.getElementById('exchangeRate').value);
  const commissionRaw = advancedOptionsToggle.checked ? parseNumber(document.getElementById('commission').value) : 15;
  const commission = Number.isFinite(commissionRaw) ? commissionRaw / 100 : NaN;
  const vatRateRaw = parseNumber(document.getElementById('vatRate').value);
  const vatRate = Number.isFinite(vatRateRaw) ? vatRateRaw / 100 : NaN;

  if (!Number.isFinite(exchangeRate) || !Number.isFinite(commission) || !Number.isFinite(vatRate)) {
    multiplierEl.textContent = '—';
    multiplierEl.dataset.value = '';
    if (multiplierSummaryEl) multiplierSummaryEl.textContent = '—';
    return;
  }

  const bruttoClient = 1 * (1 + vatRate);
  const priceInCurrency = bruttoClient * exchangeRate;
  const finalPriceMultiplier = priceInCurrency * (1 + commission);
  const multiplierBrutto = finalPriceMultiplier / (1 + VAT23);
  const formatted = multiplierBrutto.toFixed(4);
  multiplierEl.textContent = formatted;
  multiplierEl.dataset.value = formatted;
  if (multiplierSummaryEl) multiplierSummaryEl.textContent = formatted;
}

function openSearch(urlBase, query) {
  const trimmed = query.trim();
  if (!trimmed) return false;
  const url = `${urlBase}${encodeURIComponent(trimmed)}`;
  window.open(url, '_blank', 'noopener');
  return true;
}

function showMainToast(message, variant = 'info', durationMs) {
  if (!mainToastStack) return;
  const maxToasts = 6;
  while (mainToastStack.children.length >= maxToasts) {
    mainToastStack.firstElementChild?.remove();
  }
  const toast = document.createElement('div');
  toast.className = 'mapping-toast';
  if (variant === 'warn') toast.classList.add('is-warn');
  if (variant === 'info') toast.classList.add('is-info');
  if (variant === 'success' || variant === 'ok') toast.classList.add('is-ok');
  const hasTiming = Number.isFinite(durationMs) && durationMs > 0;
  const ms = hasTiming ? Math.round(durationMs) : 0;
  const toastText = document.createElement('span');
  toastText.className = 'mapping-toast-text';
  toastText.textContent = hasTiming ? `${message || ''} (${ms} ms)` : `${message || ''}`;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'mapping-toast-close';
  closeBtn.setAttribute('aria-label', 'Zamknij komunikat');
  closeBtn.textContent = '×';
  toast.append(toastText, closeBtn);
  mainToastStack.append(toast);
  requestAnimationFrame(() => {
    toast.classList.add('is-visible');
  });
  let isClosed = false;
  const closeToast = () => {
    if (isClosed) return;
    isClosed = true;
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 200);
  };
  closeBtn.addEventListener('click', closeToast);
  setTimeout(closeToast, 6000);
}

function logActivity(type, meta = {}) {
  if (!window.PN_MAPPINGS_API?.log) return;
  if (appVersion && !meta.appVersion) {
    meta.appVersion = appVersion;
  }
  const key = `${type}:${JSON.stringify(meta).slice(0, 200)}`;
  const now = Date.now();
  if (activityLogCache[key] && now - activityLogCache[key] < 10000) {
    return;
  }
  activityLogCache[key] = now;
  window.PN_MAPPINGS_API.log(type, meta);
}

function normalizePnValue(value) {
  return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function getBestPatternMatch(patterns, normalized) {
  if (!Array.isArray(patterns) || !window.PN_MAPPINGS_API?.matchPattern) return null;
  const scored = [];
  for (const rule of patterns) {
    if (!rule?.pattern || !rule?.vendor) continue;
    if (!window.PN_MAPPINGS_API.matchPattern(rule.pattern, normalized)) continue;
    const pattern = window.PN_MAPPINGS_API.normalizePattern
      ? window.PN_MAPPINGS_API.normalizePattern(String(rule.pattern))
      : String(rule.pattern);
    let literalCount = 0;
    let wildcardCount = 0;
    for (const char of pattern) {
      if (char === 'x' || char === '*' || char === '+') {
        wildcardCount += 1;
      } else {
        literalCount += 1;
      }
    }
    scored.push({
      vendor: rule.vendor,
      pattern,
      literalCount,
      wildcardCount,
      length: pattern.length
    });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => {
    if (b.literalCount !== a.literalCount) return b.literalCount - a.literalCount;
    if (b.length !== a.length) return b.length - a.length;
    return a.wildcardCount - b.wildcardCount;
  });
  return scored[0];
}

function resolvePnManufacturer(value) {
  const normalized = normalizePnValue(value);
  if (!normalized) return { vendor: '', source: '' };
  if (/^\d{6}-\d{3}$/.test(normalized)) {
    return { vendor: 'HPE', source: 'rule', detail: 'xxxxxx-xxx' };
  }
  const data = window.PN_MAPPINGS_API?.get?.() || { exact: {}, patterns: [] };
  const hasMappings = (data.exact && Object.keys(data.exact).length > 0)
    || (Array.isArray(data.patterns) && data.patterns.length > 0);
  if (data.exact && data.exact[normalized]) {
    return { vendor: data.exact[normalized], source: 'exact', detail: normalized };
  }
  if (normalized.length < 5) return { vendor: '', source: '' };
  const best = getBestPatternMatch(data.patterns, normalized);
  if (best) {
    return { vendor: best.vendor, source: 'pattern', detail: best.pattern };
  }
  if (hasMappings) return { vendor: '', source: '' };
  if (normalized.length === 5) return { vendor: 'Dell', source: 'fallback', detail: 'xxxxx' };
  if (normalized.length === 6 && normalized.startsWith('0')) {
    return { vendor: 'Dell', source: 'fallback', detail: '0xxxxx' };
  }
  return { vendor: '', source: '' };
}

function enforceTwoDecimals(inputEl) {
  const raw = inputEl.value;
  if (!raw) return;
  const normalized = raw.replace(',', '.');
  const match = normalized.match(/^-?\d*(?:\.\d{0,2})?/);
  if (!match) return;
  const next = match[0];
  if (next !== raw) {
    inputEl.value = next;
  }
}

function renderHistory() {
  const list = document.getElementById('historyList');
  const restoreBtn = document.getElementById('restoreHistoryBtn');
  if (!list) return;
  if (!historyEntries.length) {
    list.innerHTML = '<div class="history-item"><strong>Brak wpisów</strong><div class="history-meta">Wprowadź dane, aby pojawiła się historia.</div></div>';
    if (!lastClearedHistory.length) {
      restoreBtn.style.display = 'none';
    }
    return;
  }
  list.innerHTML = historyEntries
    .slice(0, 8)
    .map((entry, index) => (
      `<div class="history-item">
        <div class="history-row">
          <strong>${entry.title}</strong>
          <div class="history-actions-inline">
            <button type="button" class="history-copy" data-index="${index}" aria-label="Kopiuj brutto">
              <svg class="history-copy-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M16 1H6a2 2 0 0 0-2 2v12h2V3h10V1zm3 4H10a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H10V7h9v14z"/>
              </svg>
            </button>
            <button type="button" class="history-remove" data-index="${index}" aria-label="Usuń wpis">×</button>
          </div>
        </div>
        <div class="history-summary">${entry.summary}</div>
        <div class="history-meta">${entry.meta} · ${entry.timestamp}</div>
      </div>`
    ))
    .join('');
}

defaultLayoutOrder = getCurrentLayoutOrder();
const savedLayoutOrder = loadSavedLayoutOrder();
if (savedLayoutOrder) {
  applyLayoutOrder(savedLayoutOrder);
}

if (layoutCustomizeBtn) {
  layoutCustomizeBtn.addEventListener('click', () => {
    if (isLayoutEditMode) {
      if (preEditLayoutOrder) {
        applyLayoutOrder(preEditLayoutOrder);
      }
      setLayoutEditMode(false);
      showMainToast('Anulowano zmiany układu.', 'info');
      return;
    }
    setLayoutEditMode(true);
  });
}

if (layoutSaveBtn) {
  layoutSaveBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const order = getCurrentLayoutOrder();
    saveLayoutOrder(order);
    preEditLayoutOrder = order;
    setLayoutEditMode(false);
    showMainToast('Układ zapisany.', 'ok');
  });
}

if (layoutResetBtn) {
  layoutResetBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!defaultLayoutOrder) return;
    applyLayoutOrder(defaultLayoutOrder);
    clearSavedLayoutOrder();
    preEditLayoutOrder = getCurrentLayoutOrder();
    showMainToast('Przywrócono domyślny układ.', 'ok');
  });
}

if (layoutExitBtn) {
  layoutExitBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (preEditLayoutOrder) {
      applyLayoutOrder(preEditLayoutOrder);
    }
    setLayoutEditMode(false);
    showMainToast('Wyjście z edycji bez zapisu.', 'info');
  });
}

document.addEventListener('click', blockDetailsToggleInLayoutMode, true);
document.addEventListener('keydown', (event) => {
  if (!isLayoutEditMode) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  blockDetailsToggleInLayoutMode(event);
}, true);

const baseMultiplierValue = document.getElementById('baseMultiplierValue');
if (baseMultiplierValue) {
  baseMultiplierValue.addEventListener('click', () => {
    const value = baseMultiplierValue.dataset.value;
    if (!value) {
      showMainToast('Brak wartości do skopiowania.', 'warn');
      return;
    }
    navigator.clipboard.writeText(value)
      .then(() => {
        showMainToast('Skopiowano mnożnik do schowka.', 'success');
      })
      .catch(() => {
        showMainToast('Nie udało się skopiować mnożnika.', 'warn');
      });
  });
}

function addHistoryEntry(source) {
  const netto = parseNumber(document.getElementById('plnNetto').value);
  const brutto = parseNumber(document.getElementById('plnBrutto').value);
  const ebayPrice = parseNumber(document.getElementById('ebayPrice').value);
  const currency = document.getElementById('currency').value;
  const vatRateRaw = parseNumber(document.getElementById('vatRate').value);
  const commissionRaw = advancedOptionsToggle.checked ? parseNumber(document.getElementById('commission').value) : 15;
  const exchangeRate = parseNumber(document.getElementById('exchangeRate').value);

  const sourceLabel = {
    netto: 'ERP netto',
    brutto: 'ERP brutto',
    ebayPrice: 'eBay',
    vatRate: 'VAT',
    currency: 'Waluta',
    exchangeRate: 'Kurs',
    commission: 'Prowizja',
    preset: 'Preset'
  }[source] || 'Przeliczenie';

  const timestamp = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const details = [
    `Netto <span class="history-value">${formatCurrency(netto)}</span> PLN`,
    `Brutto <span class="history-value">${formatCurrency(brutto)}</span> PLN`,
    `eBay <span class="history-value">${formatCurrency(ebayPrice)}</span> ${currency}`
  ].join(' <span class="history-dot">•</span> ');
  const meta = [
    `VAT ${Number.isFinite(vatRateRaw) ? vatRateRaw.toFixed(1) : '-'}%`,
    `Prowizja ${Number.isFinite(commissionRaw) ? commissionRaw.toFixed(1) : '-'}%`,
    `Kurs 1 PLN = ${Number.isFinite(exchangeRate) ? exchangeRate.toFixed(4) : '-'} ${currency}`
  ].join(' <span class="history-dot">•</span> ');

  if (!Number.isFinite(netto) && !Number.isFinite(brutto) && !Number.isFinite(ebayPrice)) {
    return;
  }

  const signature = `${sourceLabel}|${details}|${meta}`;
  if (signature === lastHistorySignature) {
    return;
  }
  lastHistorySignature = signature;
  const loggedEl = getFieldElement(source);
  if (loggedEl) {
    lastLoggedValues[source] = loggedEl.value;
  }

  historyEntries.unshift({
    title: sourceLabel,
    summary: details,
    meta,
    bruttoValue: Number.isFinite(brutto) ? brutto.toFixed(2) : '',
    timestamp
  });

  if (historyEntries.length > 20) {
    historyEntries.pop();
  }
  renderHistory();
  logActivity('calc', {
    source: sourceLabel,
    netto: Number.isFinite(netto) ? netto.toFixed(2) : null,
    brutto: Number.isFinite(brutto) ? brutto.toFixed(2) : null,
    ebay: Number.isFinite(ebayPrice) ? ebayPrice.toFixed(2) : null,
    currency,
    vat: Number.isFinite(vatRateRaw) ? vatRateRaw.toFixed(1) : null,
    commission: Number.isFinite(commissionRaw) ? commissionRaw.toFixed(1) : null,
    rate: Number.isFinite(exchangeRate) ? exchangeRate.toFixed(4) : null
  });
}

function setFieldBaseline(source) {
  const el = getFieldElement(source);
  if (!el) return;
  fieldBaselines[source] = el.value;
}

function hasFieldChanged(source) {
  const el = getFieldElement(source);
  if (!el) return false;
  const baseline = fieldBaselines[source];
  if (baseline === undefined) return el.value !== '';
  return el.value !== baseline;
}

function hasValueChangedSinceLog(source) {
  const el = getFieldElement(source);
  if (!el) return false;
  const lastLogged = lastLoggedValues[source];
  return el.value !== lastLogged;
}

function scheduleHistoryLog(source) {
  if (!hasValueChangedSinceLog(source)) return;
  if (historyTimers[source]) {
    clearTimeout(historyTimers[source]);
  }
  historyTimers[source] = setTimeout(() => {
    addHistoryEntry(source);
    historyTimers[source] = null;
  }, 700);
}

function flushHistoryLog(source) {
  if (historyTimers[source]) {
    clearTimeout(historyTimers[source]);
    historyTimers[source] = null;
  }
  if (!hasFieldChanged(source)) return;
  addHistoryEntry(source);
}

if (window.UITheme?.init) {
  window.UITheme.init();
}

// Advanced options toggle
const advancedOptionsToggle = document.getElementById('advancedOptionsToggle');
const advancedOptions = document.getElementById('advancedOptions');
const exchangeRateInput = document.getElementById('exchangeRate');
const ebayCurrencyLabel = document.getElementById('ebayCurrencyLabel');

advancedOptionsToggle.addEventListener('change', () => {
  advancedOptions.style.display = advancedOptionsToggle.checked ? 'block' : 'none';
  exchangeRateInput.disabled = !advancedOptionsToggle.checked;
  hideSelfTestDetails();
  calculatePrice();
  if (advancedOptionsToggle.checked) {
    checkRateProvidersStatus(document.getElementById('currency').value);
  }
});

// Update eBay currency label with VAT rate
function updateEbayCurrencyLabel() {
  const currency = document.getElementById('currency').value;
  const vatRateInput = document.getElementById('vatRate');
  const vatRate = parseNumber(vatRateInput.value);
  const vatRateDisplay = Number.isFinite(vatRate) ? vatRate : 0;
  ebayCurrencyLabel.innerText = `${currency} (z VAT ${formatPercent(vatRateDisplay)}%)`;
}

// Clear button handler
document.getElementById('clearBtn').addEventListener('click', () => {
  document.getElementById('plnNetto').value = '';
  document.getElementById('plnBrutto').value = '';
  document.getElementById('ebayPrice').value = '';
  document.getElementById('vatRate').value = '23';
  document.getElementById('commission').value = '15';
  document.getElementById('purchaseAmount').value = '';
  document.getElementById('minMarkup').value = '';
  updateMinSaleByMarkup();
  document.getElementById('productId').value = '';
  document.getElementById('currency').value = 'EUR';
  document.getElementById('currencyLabel').innerText = 'EUR';
  updateEbayCurrencyLabel(); // Ensure label updates with default VAT 23%
  advancedOptionsToggle.checked = false;
  advancedOptions.style.display = 'none';
  exchangeRateInput.disabled = true;
  lastChanged = null;
  originalEbayPrice = null;
  originalCurrency = 'EUR';
  lastCurrency = 'EUR';
  hideSelfTestDetails();
  historyEntries.length = 0;
  renderHistory();
  fetchExchangeRate('EUR');
});

function syncFields(source) {
  const nettoInput = document.getElementById('plnNetto');
  const bruttoInput = document.getElementById('plnBrutto');
  const ebayPriceInput = document.getElementById('ebayPrice');
  const vatRateInput = document.getElementById('vatRate');
  const exchangeRate = parseNumber(document.getElementById('exchangeRate').value);
  const commissionRaw = advancedOptionsToggle.checked ? parseNumber(document.getElementById('commission').value) : 15;
  const commission = Number.isFinite(commissionRaw) ? commissionRaw / 100 : NaN;
  const vatRateRaw = parseNumber(vatRateInput.value);
  const vatRate = Number.isFinite(vatRateRaw) ? vatRateRaw / 100 : NaN;
  const resultDiv = document.getElementById('result');

  // Validate negative inputs
  if (source === 'netto' && Number.isFinite(parseNumber(nettoInput.value)) && parseNumber(nettoInput.value) < 0) {
    resultDiv.innerHTML = '<span class="error">Kwota netto nie może być ujemna.</span>';
    return;
  }
  if (source === 'brutto' && Number.isFinite(parseNumber(bruttoInput.value)) && parseNumber(bruttoInput.value) < 0) {
    resultDiv.innerHTML = '<span class="error">Kwota brutto nie może być ujemna.</span>';
    return;
  }
  if (source === 'ebayPrice' && Number.isFinite(parseNumber(ebayPriceInput.value)) && parseNumber(ebayPriceInput.value) < 0) {
    resultDiv.innerHTML = '<span class="error">Cena na eBay nie może być ujemna.</span>';
    return;
  }
  if (source === 'vatRate' && Number.isFinite(parseNumber(vatRateInput.value)) && parseNumber(vatRateInput.value) < 0) {
    resultDiv.innerHTML = '<span class="error">Stawka VAT nie może być ujemna.</span>';
    return;
  }

  if (source === 'netto' && Number.isFinite(parseNumber(nettoInput.value))) {
    const netto = parseNumber(nettoInput.value);
    const brutto = netto * (1 + VAT23);
    bruttoInput.value = brutto.toFixed(2);
    if (validateInputs(exchangeRate, commission, vatRate, resultDiv)) {
      const priceInCurrency = brutto * exchangeRate;
      const finalPrice = priceInCurrency * (1 + commission);
      ebayPriceInput.value = finalPrice.toFixed(2);
      originalEbayPrice = finalPrice;
      originalCurrency = document.getElementById('currency').value;
      originalExchangeRate = exchangeRate;
    }
  } else if (source === 'brutto' && Number.isFinite(parseNumber(bruttoInput.value))) {
    const brutto = parseNumber(bruttoInput.value);
    const netto = brutto / (1 + VAT23);
    nettoInput.value = netto.toFixed(2);
    if (validateInputs(exchangeRate, commission, vatRate, resultDiv)) {
      const priceInCurrency = brutto * exchangeRate;
      const finalPrice = priceInCurrency * (1 + commission);
      ebayPriceInput.value = finalPrice.toFixed(2);
      originalEbayPrice = finalPrice;
      originalCurrency = document.getElementById('currency').value;
      originalExchangeRate = exchangeRate;
    }
  } else if (source === 'ebayPrice' && Number.isFinite(parseNumber(ebayPriceInput.value))) {
    const ebayPrice = parseNumber(ebayPriceInput.value);
    if (validateInputs(exchangeRate, commission, vatRate, resultDiv)) {
      const priceInCurrency = ebayPrice / (1 + commission);
      const brutto = priceInCurrency / exchangeRate;
      const netto = brutto / (1 + VAT23);
      nettoInput.value = netto.toFixed(2);
      bruttoInput.value = brutto.toFixed(2);
      originalEbayPrice = ebayPrice;
      originalCurrency = document.getElementById('currency').value;
      originalExchangeRate = exchangeRate;
    }
  } else if (source === 'vatRate' && Number.isFinite(parseNumber(vatRateInput.value))) {
    const vatRatePercent = Math.max(0, Math.min(100, parseNumber(vatRateInput.value)));
    vatRateInput.value = vatRatePercent.toString();
    updateEbayCurrencyLabel();
    let brutto = parseNumber(bruttoInput.value);
    if (!Number.isFinite(brutto)) {
      const netto = parseNumber(nettoInput.value);
      if (Number.isFinite(netto)) {
        brutto = netto * (1 + VAT23);
        bruttoInput.value = brutto.toFixed(2);
      }
    }
    if (Number.isFinite(brutto) && brutto > 0 && validateInputs(exchangeRate, commission, vatRatePercent / 100, resultDiv)) {
      const netto = brutto / (1 + VAT23);
      nettoInput.value = netto.toFixed(2);
      const priceInCurrency = brutto * exchangeRate;
      const finalPrice = priceInCurrency * (1 + commission);
      ebayPriceInput.value = finalPrice.toFixed(2);
      originalEbayPrice = finalPrice;
      originalCurrency = document.getElementById('currency').value;
      originalExchangeRate = exchangeRate;
    } else {
      resultDiv.innerHTML = '<span class="error">Wpisz kwotę netto lub brutto, aby przeliczyć cenę z nową stawką VAT.</span>';
      return;
    }
  }

  calculatePrice();
}

function validateInputs(exchangeRate, commission, vatRate, resultDiv) {
  if (isNaN(exchangeRate) || exchangeRate <= 0) {
    resultDiv.innerHTML = '<span class="error">Kurs waluty musi być dodatni.</span>';
    return false;
  }
  if (isNaN(commission) || commission < 0) {
    resultDiv.innerHTML = '<span class="error">Prowizja nie może być ujemna.</span>';
    return false;
  }
  if (isNaN(vatRate) || vatRate < 0 || vatRate > 1) {
    resultDiv.innerHTML = '<span class="error">Stawka VAT musi być w przedziale 0-100%.</span>';
    return false;
  }
  return true;
}

function calculatePrice() {
  const netto = parseNumber(document.getElementById('plnNetto').value);
  const brutto = parseNumber(document.getElementById('plnBrutto').value);
  const ebayPrice = parseNumber(document.getElementById('ebayPrice').value);
  const exchangeRate = parseNumber(document.getElementById('exchangeRate').value);
  const commissionRaw = advancedOptionsToggle.checked ? parseNumber(document.getElementById('commission').value) : 15;
  const commission = Number.isFinite(commissionRaw) ? commissionRaw / 100 : NaN;
  const vatRateRaw = parseNumber(document.getElementById('vatRate').value);
  const vatRate = Number.isFinite(vatRateRaw) ? vatRateRaw / 100 : NaN;
  const currency = document.getElementById('currency').value;
  const resultDiv = document.getElementById('result');

  if (!validateInputs(exchangeRate, commission, vatRate, resultDiv)) {
    return;
  }

  const bruttoClient = 1 * (1 + vatRate);
  const priceInCurrency = bruttoClient * exchangeRate;
  const finalPriceMultiplier = priceInCurrency * (1 + commission);

  const multiplierNetto = finalPriceMultiplier;
  const multiplierBrutto = finalPriceMultiplier / (1 + VAT23);
  updateBaseMultiplier();
  updateMinSaleByMarkup();

  let resultHTML = ``;

  if (isNaN(netto) && isNaN(brutto) && isNaN(ebayPrice)) {
    resultDiv.innerHTML = `<span class="error">Wprowadź kwotę netto, brutto lub cenę na eBay, aby zobaczyć cenę końcową.</span>`;
    resultDiv.classList.add('is-visible');
    return;
  }

  resultDiv.innerHTML = resultHTML;
  resultDiv.classList.toggle('is-visible', resultHTML.trim().length > 0);
}

function applyPreset(currency, vat) {
  isPresetApplied = true;
  document.getElementById('currency').value = currency;
  document.getElementById('vatRate').value = parseNumber(vat).toString();
  document.getElementById('currencyLabel').innerText = currency;
  ebayCurrencyLabel.innerText = `${currency} (z VAT ${formatPercent(parseNumber(vat))}%)`;
  lastChanged = 'vatRate';
  fetchExchangeRate(currency);
}

function convertEbayPrice(newRate) {
  if (originalEbayPrice === null || isNaN(originalEbayPrice) || originalExchangeRate === null) return null;
  return (originalEbayPrice / originalExchangeRate) * newRate;
}

function updateEbayPriceFromNettoOrBrutto() {
  const nettoInput = document.getElementById('plnNetto');
  const bruttoInput = document.getElementById('plnBrutto');
  const ebayPriceInput = document.getElementById('ebayPrice');
  const exchangeRate = parseNumber(document.getElementById('exchangeRate').value);
  const commissionRaw = advancedOptionsToggle.checked ? parseNumber(document.getElementById('commission').value) : 15;
  const commission = Number.isFinite(commissionRaw) ? commissionRaw / 100 : NaN;
  const vatRateRaw = parseNumber(document.getElementById('vatRate').value);
  const vatRate = Number.isFinite(vatRateRaw) ? vatRateRaw / 100 : NaN;

  if (lastChanged === 'netto' && Number.isFinite(parseNumber(nettoInput.value))) {
    const netto = parseNumber(nettoInput.value);
    if (validateInputs(exchangeRate, commission, vatRate, document.getElementById('result'))) {
      const brutto = netto * (1 + VAT23);
      bruttoInput.value = brutto.toFixed(2);
      const priceInCurrency = brutto * exchangeRate;
      const finalPrice = priceInCurrency * (1 + commission);
      ebayPriceInput.value = finalPrice.toFixed(2);
    }
  } else if (lastChanged === 'brutto' && Number.isFinite(parseNumber(bruttoInput.value))) {
    const brutto = parseNumber(bruttoInput.value);
    if (validateInputs(exchangeRate, commission, vatRate, document.getElementById('result'))) {
      const netto = brutto / (1 + VAT23);
      nettoInput.value = netto.toFixed(2);
      const priceInCurrency = brutto * exchangeRate;
      const finalPrice = priceInCurrency * (1 + commission);
      ebayPriceInput.value = finalPrice.toFixed(2);
    }
  }
}

function fetchExchangeRate(currency, options = {}) {
  const exchangeInfo = document.getElementById('exchangeInfo');
  const exchangeRateTooltip = document.getElementById('exchangeRateTooltip');
  const exchangeRateInp = document.getElementById('exchangeRate');
  const ebayPriceInput = document.getElementById('ebayPrice');
  const rateSourceSelect = document.getElementById('rateSource');
  const providerKey = rateSourceSelect?.value || 'frankfurter';
  const provider = RATE_PROVIDERS[providerKey] || RATE_PROVIDERS.frankfurter;
  const notify = options.notify === true;
  exchangeInfo.innerText = 'Pobieranie kursu...';
  if (exchangeRateTooltip) exchangeRateTooltip.setAttribute('data-tooltip', '');

  const ebayPriceValue = parseNumber(ebayPriceInput.value);
  const convertEbayPriceNeeded = Number.isFinite(ebayPriceValue) && lastChanged === 'ebayPrice' && lastCurrency !== currency && !isPresetApplied;
  const nettoValue = parseNumber(document.getElementById('plnNetto').value);
  const bruttoValue = parseNumber(document.getElementById('plnBrutto').value);
  const updateFromNettoOrBrutto = (Number.isFinite(nettoValue) || Number.isFinite(bruttoValue)) && (lastChanged === 'netto' || lastChanged === 'brutto');
  const oldCurrency = lastCurrency;
  lastCurrency = currency;

  const applyRate = (rate, providerLabel, providerKeyUsed) => {
    exchangeRateInp.value = rate.toFixed(4);
    currentExchangeRate = rate;
    const now = new Date();
    exchangeInfo.innerText = `Kurs PLN/${currency}: ${rate.toFixed(4)} (${now.toLocaleString('pl-PL')})`;
    if (exchangeRateTooltip && Number.isFinite(rate) && rate > 0) {
      const inverse = 1 / rate;
      const label = providerLabel ? ` • ${providerLabel}` : '';
      exchangeRateTooltip.setAttribute('data-tooltip', `Kurs ${currency}/PLN: ${inverse.toFixed(4)}${label} (${now.toLocaleString('pl-PL')})`);
    }
    if (notify && providerLabel) {
      showMainToast(`Kurs pobrany z: ${providerLabel}`, 'info');
    }
    if (rateSourceSelect && providerKeyUsed && rateSourceSelect.value !== providerKeyUsed) {
      rateSourceSelect.value = providerKeyUsed;
    }
    updateBaseMultiplier();
    updateMinSaleByMarkup();

    if (convertEbayPriceNeeded) {
      const newEbayPrice = convertEbayPrice(rate);
      if (newEbayPrice !== null) {
        ebayPriceInput.value = newEbayPrice.toFixed(2);
        if (originalCurrency === currency) {
          ebayPriceInput.value = originalEbayPrice.toFixed(2);
        }
        lastChanged = 'ebayPrice';
        syncFields('ebayPrice');
      }
    } else if (updateFromNettoOrBrutto) {
      updateEbayPriceFromNettoOrBrutto();
      syncFields(lastChanged);
    } else if (Number.isFinite(ebayPriceValue) && lastChanged === 'ebayPrice') {
      syncFields('ebayPrice');
    } else if (isPresetApplied || lastChanged === 'vatRate') {
      syncFields('vatRate');
      if (isPresetApplied) {
        addHistoryEntry('preset');
      }
    } else {
      calculatePrice();
    }
    isPresetApplied = false;
  };

  const fetchRateFrom = (providerToUse) => fetch(providerToUse.buildUrl(currency))
    .then(response => {
      if (!response.ok) throw new Error('Błąd sieci');
      return response.json();
    })
    .then(data => {
      const rate = providerToUse.readRate(data, currency);
      if (!rate) throw new Error('Brak kursu dla wybranej waluty');
      return { rate, label: providerToUse.label };
    });

  fetchRateFrom(provider)
    .then(({ rate, label }) => {
      applyRate(rate, label, providerKey);
    })
    .catch(() => {
      const fallbackProvider = RATE_PROVIDERS.frankfurter;
      if (providerKey !== 'frankfurter' && fallbackProvider) {
        fetchRateFrom(fallbackProvider)
          .then(({ rate, label }) => {
            applyRate(rate, label, 'frankfurter');
            if (notify) {
              showMainToast(`Źródło ${provider.label} niedostępne. Użyto ${label}.`, 'warn');
            }
          })
          .catch(error => {
            console.error('Błąd pobierania kursu:', error);
            const fallbackRate = DEFAULT_RATES[currency] || 4.3;
            exchangeRateInp.value = fallbackRate.toFixed(4);
            currentExchangeRate = fallbackRate;
            exchangeInfo.innerText = `Błąd pobierania kursu. Użyto domyślnego kursu PLN/${currency}: ${fallbackRate.toFixed(4)}`;
            if (exchangeRateTooltip) {
              const inverse = 1 / fallbackRate;
              exchangeRateTooltip.setAttribute('data-tooltip', `Kurs ${currency}/PLN: ${inverse.toFixed(4)} • domyślny (${now.toLocaleString('pl-PL')})`);
            }
            if (notify) {
              showMainToast(`Błąd pobierania kursu. Użyto domyślnego.`, 'warn');
            }
            updateBaseMultiplier();
            updateMinSaleByMarkup();
            calculatePrice();
            isPresetApplied = false;
          });
        return;
      }
      const fallbackRate = DEFAULT_RATES[currency] || 4.3;
      exchangeRateInp.value = fallbackRate.toFixed(4);
      currentExchangeRate = fallbackRate;
      exchangeInfo.innerText = `Błąd pobierania kursu. Użyto domyślnego kursu PLN/${currency}: ${fallbackRate.toFixed(4)}`;
      if (exchangeRateTooltip) {
        const inverse = 1 / fallbackRate;
        exchangeRateTooltip.setAttribute('data-tooltip', `Kurs ${currency}/PLN: ${inverse.toFixed(4)} • domyślny (${now.toLocaleString('pl-PL')})`);
      }
      if (notify) {
        showMainToast(`Błąd pobierania kursu. Użyto domyślnego.`, 'warn');
      }
      updateBaseMultiplier();
      updateMinSaleByMarkup();
      calculatePrice();
      isPresetApplied = false;
    });
}

function updateRateStatusBadge(key, status) {
  const container = document.getElementById('rateStatusRow');
  if (!container) return;
  const el = container.querySelector(`[data-provider="${key}"]`);
  if (!el) return;
  el.classList.remove('is-ok', 'is-fail', 'is-loading');
  if (status) {
    el.classList.add(`is-${status}`);
  }
}

function fetchWithTimeout(url, ms = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

function checkRateProvidersStatus(currency) {
  const now = Date.now();
  Object.keys(RATE_PROVIDERS).forEach((key) => {
    const cached = rateStatusCache[key];
    if (cached && now - cached.ts < 60000) {
      updateRateStatusBadge(key, cached.status);
      return;
    }
    updateRateStatusBadge(key, 'loading');
    const provider = RATE_PROVIDERS[key];
    fetchWithTimeout(provider.buildUrl(currency), 5000)
      .then((resp) => {
        if (!resp.ok) throw new Error('status');
        return resp.json();
      })
      .then((data) => {
        const rate = provider.readRate(data, currency);
        const status = rate ? 'ok' : 'fail';
        rateStatusCache[key] = { ts: Date.now(), status };
        updateRateStatusBadge(key, status);
      })
      .catch(() => {
        rateStatusCache[key] = { ts: Date.now(), status: 'fail' };
        updateRateStatusBadge(key, 'fail');
      });
  });
}

// STOCK URL button handler
document.getElementById('stockUrlBtn').addEventListener('click', () => {
  const productId = document.getElementById('productId').value;
  if (/^\d{1,6}$/.test(productId)) {
    const url = `https://stock/product/product/details/${productId}`;
    window.open(url, '_blank');
  } else {
    document.getElementById('result').innerHTML = '<span class="error">ID produktu musi być liczbą od 1 do 6 cyfr.</span>';
  }
});

document.getElementById('plnNetto').addEventListener('input', () => {
  lastChanged = 'netto';
  hideSelfTestDetails();
  enforceTwoDecimals(document.getElementById('plnNetto'));
  syncFields('netto');
  scheduleHistoryLog('netto');
});
document.getElementById('plnNetto').addEventListener('focus', () => {
  setFieldBaseline('netto');
});
document.getElementById('plnNetto').addEventListener('blur', () => {
  flushHistoryLog('netto');
});

document.getElementById('plnBrutto').addEventListener('input', () => {
  lastChanged = 'brutto';
  hideSelfTestDetails();
  enforceTwoDecimals(document.getElementById('plnBrutto'));
  syncFields('brutto');
  scheduleHistoryLog('brutto');
});
document.getElementById('plnBrutto').addEventListener('focus', () => {
  setFieldBaseline('brutto');
});
document.getElementById('plnBrutto').addEventListener('blur', () => {
  flushHistoryLog('brutto');
});

document.getElementById('ebayPrice').addEventListener('input', () => {
  lastChanged = 'ebayPrice';
  hideSelfTestDetails();
  enforceTwoDecimals(document.getElementById('ebayPrice'));
  syncFields('ebayPrice');
  scheduleHistoryLog('ebayPrice');
});
document.getElementById('ebayPrice').addEventListener('focus', () => {
  setFieldBaseline('ebayPrice');
});
document.getElementById('ebayPrice').addEventListener('blur', () => {
  flushHistoryLog('ebayPrice');
});

document.getElementById('vatRate').addEventListener('input', () => {
  lastChanged = 'vatRate';
  hideSelfTestDetails();
  syncFields('vatRate');
  updateBaseMultiplier();
  scheduleHistoryLog('vatRate');
});
document.getElementById('vatRate').addEventListener('focus', () => {
  setFieldBaseline('vatRate');
});
document.getElementById('vatRate').addEventListener('blur', () => {
  flushHistoryLog('vatRate');
});

['exchangeRate', 'commission'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    hideSelfTestDetails();
    if (lastChanged === 'ebayPrice' && !isNaN(parseFloat(document.getElementById('ebayPrice').value))) {
      syncFields('ebayPrice');
    } else if ((lastChanged === 'netto' || lastChanged === 'brutto') && !isNaN(parseFloat(document.getElementById('plnNetto').value))) {
      syncFields(lastChanged);
    } else if (lastChanged === 'vatRate' && !isNaN(parseInt(document.getElementById('vatRate').value))) {
      syncFields('vatRate');
    } else {
      calculatePrice();
    }
    updateBaseMultiplier();
    updateMinSaleByMarkup();
    scheduleHistoryLog(id);
  });
  document.getElementById(id).addEventListener('focus', () => {
    setFieldBaseline(id);
  });
  document.getElementById(id).addEventListener('blur', () => {
    flushHistoryLog(id);
  });
});

document.getElementById('currency').addEventListener('change', () => {
  const selectedCurrency = document.getElementById('currency').value;
  document.getElementById('currencyLabel').innerText = selectedCurrency;
  updateEbayCurrencyLabel();
  hideSelfTestDetails();
  fetchExchangeRate(selectedCurrency, { notify: false });
  checkRateProvidersStatus(selectedCurrency);
  updateMinSaleByMarkup();
  addHistoryEntry('currency');
});

['purchaseAmount', 'minMarkup'].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => {
    enforceTwoDecimals(el);
    updateMinSaleByMarkup();
  });
});

document.getElementById('refreshRateBtn').addEventListener('click', () => {
  fetchExchangeRate(document.getElementById('currency').value, { notify: true });
  addHistoryEntry('exchangeRate');
});

const rateSourceSelect = document.getElementById('rateSource');
if (rateSourceSelect) {
  rateSourceSelect.addEventListener('change', () => {
    fetchExchangeRate(document.getElementById('currency').value, { notify: true });
    checkRateProvidersStatus(document.getElementById('currency').value);
  });
}

updateEbayCurrencyLabel();
fetchExchangeRate(document.getElementById('currency').value, { notify: false });
renderHistory();
checkRateProvidersStatus(document.getElementById('currency').value);
updateMinSaleByMarkup();

document.getElementById('historyList').addEventListener('click', (event) => {
  const target = event.target;
  if (!target) return;
  const removeBtn = target.closest('.history-remove');
  const copyBtn = target.closest('.history-copy');

  if (removeBtn) {
    const index = parseInt(removeBtn.getAttribute('data-index'), 10);
    if (Number.isNaN(index)) return;
    const item = removeBtn.closest('.history-item');
    if (!item) return;
    item.classList.add('is-removing');
    setTimeout(() => {
      historyEntries.splice(index, 1);
      renderHistory();
    }, 170);
    return;
  }

  if (copyBtn) {
    const index = parseInt(copyBtn.getAttribute('data-index'), 10);
    if (Number.isNaN(index)) return;
    const entry = historyEntries[index];
    if (!entry || !entry.bruttoValue) return;
    navigator.clipboard.writeText(entry.bruttoValue).catch(() => {});
    copyBtn.classList.add('is-ok');
    const originalHtml = copyBtn.innerHTML;
    copyBtn.innerHTML = '<span class="history-copy-ok">✓</span>';
    setTimeout(() => {
      copyBtn.classList.remove('is-ok');
      copyBtn.innerHTML = originalHtml;
    }, 900);
  }
});

document.getElementById('clearHistoryBtn').addEventListener('click', () => {
  if (!historyEntries.length) return;
  const confirmed = window.confirm('Wyczyścić całą historię?');
  if (!confirmed) return;
  lastClearedHistory = historyEntries.slice();
  historyEntries.length = 0;
  lastHistorySignature = '';
  renderHistory();
  const restoreBtn = document.getElementById('restoreHistoryBtn');
  restoreBtn.style.display = 'inline-flex';
  if (restoreHistoryTimer) {
    clearTimeout(restoreHistoryTimer);
  }
  restoreHistoryTimer = setTimeout(() => {
    lastClearedHistory = [];
    restoreBtn.style.display = 'none';
  }, 8000);
});

document.getElementById('restoreHistoryBtn').addEventListener('click', () => {
  if (!lastClearedHistory.length) return;
  historyEntries.unshift(...lastClearedHistory);
  historyEntries.splice(20);
  lastClearedHistory = [];
  if (restoreHistoryTimer) {
    clearTimeout(restoreHistoryTimer);
    restoreHistoryTimer = null;
  }
  document.getElementById('restoreHistoryBtn').style.display = 'none';
  renderHistory();
});

const partNumberInput = document.getElementById('partNumberInput');
if (partNumberInput) {
  let lastSearchQuery = '';
  let lastSuggestedVendor = '';
  let mappingsRefreshTimer = null;
  let mappingsRefreshSeq = 0;
  let mappingsAppliedSeq = 0;
  let lastSyncedPnKey = '';
  const SEARCH_SOURCES_STORAGE_KEY = 'searchSources';
  const SEARCH_SOURCES_COOKIE_KEY = 'searchSources';
  const searchStatus = document.getElementById('searchStatus');
  const pnSuggestion = document.getElementById('pnSuggestion');
  const reportMappingBtn = document.getElementById('reportMappingBtn');
  const reportModal = document.getElementById('reportModal');
  const reportModalClose = document.getElementById('reportModalClose');
  const reportModalCancel = document.getElementById('reportModalCancel');
  const reportModalSubmit = document.getElementById('reportModalSubmit');
  const reportModalInfo = document.getElementById('reportModalInfo');
  const reportReason = document.getElementById('reportReason');
  const reportNonMapping = document.getElementById('reportNonMapping');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const sourceGoogle = document.getElementById('sourceGoogle');
  const sourceAllegro = document.getElementById('sourceAllegro');
  const sourceEbay = document.getElementById('sourceEbay');
  const sourceRenewtech = document.getElementById('sourceRenewtech');
  const getCookieValue = (name) => {
    const prefix = `${name}=`;
    const parts = (document.cookie || '').split(';').map((item) => item.trim());
    for (const part of parts) {
      if (part.startsWith(prefix)) return decodeURIComponent(part.slice(prefix.length));
    }
    return '';
  };
  const setCookieValue = (name, value, days = 365) => {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  };
  const getSourcesState = () => ({
    google: !!sourceGoogle?.checked,
    allegro: !!sourceAllegro?.checked,
    ebay: !!sourceEbay?.checked,
    renewtech: !!sourceRenewtech?.checked
  });
  const applySourcesState = (state) => {
    if (!state || typeof state !== 'object') return;
    if (sourceGoogle && typeof state.google === 'boolean') sourceGoogle.checked = state.google;
    if (sourceAllegro && typeof state.allegro === 'boolean') sourceAllegro.checked = state.allegro;
    if (sourceEbay && typeof state.ebay === 'boolean') sourceEbay.checked = state.ebay;
    if (sourceRenewtech && typeof state.renewtech === 'boolean') sourceRenewtech.checked = state.renewtech;
  };
  const persistSourcesState = () => {
    const state = getSourcesState();
    const payload = JSON.stringify(state);
    localStorage.setItem(SEARCH_SOURCES_STORAGE_KEY, payload);
    setCookieValue(SEARCH_SOURCES_COOKIE_KEY, payload);
  };
  const restoreSourcesState = () => {
    const raw = localStorage.getItem(SEARCH_SOURCES_STORAGE_KEY) || getCookieValue(SEARCH_SOURCES_COOKIE_KEY);
    if (!raw) return;
    try {
      applySourcesState(JSON.parse(raw));
    } catch (error) {
      // ignore broken payload
    }
  };
  const clearSearchStatus = () => {
    if (!searchStatus) return;
    searchStatus.textContent = '';
    searchStatus.classList.remove('is-warn');
  };

  const updatePnSuggestion = () => {
    const raw = partNumberInput.value.trim();
    if (!raw) {
      partNumberInput.dataset.suggestion = '';
      if (pnSuggestion) pnSuggestion.textContent = '';
      return;
    }
    const resolved = resolvePnManufacturer(raw);
    const manufacturer = resolved.vendor || '';
    const suggestionValue = manufacturer && !raw.toLowerCase().startsWith(manufacturer.toLowerCase())
      ? `${manufacturer} ${raw}`
      : '';
    partNumberInput.dataset.suggestion = suggestionValue;
    if (manufacturer) {
      lastSuggestedVendor = manufacturer;
      partNumberInput.dataset.suggestionVendor = manufacturer;
    } else if (lastSuggestedVendor && raw.toLowerCase().startsWith(`${lastSuggestedVendor.toLowerCase()} `)) {
      partNumberInput.dataset.suggestionVendor = lastSuggestedVendor;
    } else {
      partNumberInput.dataset.suggestionVendor = '';
    }
    partNumberInput.dataset.suggestionSource = resolved.source || '';
    partNumberInput.dataset.suggestionDetail = resolved.detail || '';
    if (pnSuggestion) {
      pnSuggestion.textContent = '';
      if (suggestionValue) {
        const label = document.createElement('span');
        label.className = 'pn-label';
        label.textContent = `Sugestia ${manufacturer}?`;

        const hint = document.createElement('span');
        hint.className = 'pn-hint';
        hint.textContent = 'Tab, aby uzupełnić';

        pnSuggestion.append(label, hint);
      }
    }
    // no dropdown to reset
  };
  const clearSearchInput = () => {
    if (partNumberInput.value.trim()) {
      partNumberInput.value = '';
      updatePnSuggestion();
      lastSearchQuery = '';
      lastSyncedPnKey = '';
    }
  };
  const syncMappingsForCurrentPn = async () => {
    if (!window.PN_MAPPINGS_API?.load) return;
    const raw = partNumberInput.value.trim();
    if (!raw || raw.length < 3) return;
    const pnKey = normalizePnValue(raw);
    if (!pnKey || pnKey === lastSyncedPnKey) return;
    const seq = ++mappingsRefreshSeq;
    try {
      await window.PN_MAPPINGS_API.load();
      if (seq < mappingsAppliedSeq) return;
      mappingsAppliedSeq = seq;
      lastSyncedPnKey = pnKey;
      updatePnSuggestion();
    } catch (error) {
      // Keep current suggestion on transient fetch failure.
    }
  };
  const scheduleMappingsSync = () => {
    if (mappingsRefreshTimer) {
      clearTimeout(mappingsRefreshTimer);
    }
    mappingsRefreshTimer = setTimeout(() => {
      mappingsRefreshTimer = null;
      syncMappingsForCurrentPn();
    }, 350);
  };
  const runSearchAll = () => {
    const query = partNumberInput.value.trim();
    const sources = [];
    if (sourceGoogle?.checked) sources.push('google');
    if (sourceEbay?.checked) sources.push('ebay');
    if (sourceAllegro?.checked) sources.push('allegro');
    if (sourceRenewtech?.checked) sources.push('renewtech');
    if (!sources.length) {
      showMainToast('Wybierz minimum jedno źródło wyszukiwania.', 'warn');
      return false;
    }
    if (!query) {
      showMainToast('Wpisz Part Number, aby wyszukać.', 'warn');
      return false;
    }
    if (query === lastSearchQuery) {
      showMainToast('To samo zapytanie — pomijam.', 'warn');
      return false;
    }
    lastSearchQuery = query;
    clearSearchStatus();
    if (sources.includes('google')) {
      const vendor = partNumberInput.dataset.suggestionVendor || '';
      let pn = query;
      if (vendor && pn.toLowerCase().startsWith(`${vendor.toLowerCase()} `)) {
        pn = pn.slice(vendor.length).trim();
      }
      if (!pn) pn = query;
      const hasSpaces = /\s/.test(pn);
      const googleQuery = vendor
        ? (hasSpaces ? `${vendor} ${pn}` : `${vendor} "${pn}"`)
        : (hasSpaces ? pn : `"${pn}"`);
      openSearch('https://www.google.com/search?q=', googleQuery);
    }
    if (sources.includes('ebay')) {
      openSearch('https://www.ebay.com/sch/58058/i.html?_oac=1&_from=R40&_nkw=', query);
    }
    if (sources.includes('allegro')) {
      openSearch('https://allegro.pl/kategoria/komputery?string=', query);
    }
    if (sources.includes('renewtech')) {
      let vendorRaw = partNumberInput.dataset.suggestionVendor || '';
      const suggestionValue = partNumberInput.dataset.suggestion || '';
      if (!vendorRaw && suggestionValue) {
        vendorRaw = suggestionValue.split(/\s+/)[0] || '';
      }
      let pn = query;
      if (vendorRaw && pn.toLowerCase().startsWith(`${vendorRaw.toLowerCase()} `)) {
        pn = pn.slice(vendorRaw.length).trim();
      }
      const vendorSlug = vendorRaw.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const pnSlug = (pn || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9-]/g, '');
      if (vendorSlug && pnSlug) {
        const direct = `https://www.renewtech.pl/${vendorSlug}-${pnSlug}.html`;
        window.open(direct, '_blank', 'noopener');
      } else {
        const state = {
          'hr-search': {
            search_term: pn || query,
            filters: [],
            sorting: [],
            offsets: { product: 42 }
          }
        };
        openSearch('https://www.renewtech.pl/#', JSON.stringify(state));
      }
    }
    logActivity('search', { query, sources });
    return true;
  };
  document.getElementById('searchAllBtn').addEventListener('click', () => {
    if (runSearchAll()) {
      clearSearchInput();
    }
  });
  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      clearSearchInput();
      clearSearchStatus();
      partNumberInput.focus();
    });
  }
  [sourceGoogle, sourceAllegro, sourceEbay, sourceRenewtech].forEach((checkbox) => {
    if (!checkbox) return;
    checkbox.addEventListener('change', () => {
      clearSearchStatus();
      persistSourcesState();
    });
  });
  partNumberInput.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      const suggestionValue = partNumberInput.dataset.suggestion;
      if (suggestionValue) {
        event.preventDefault();
        partNumberInput.value = suggestionValue;
        updatePnSuggestion();
        if (runSearchAll()) {
          clearSearchInput();
        }
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (runSearchAll()) {
        clearSearchInput();
      }
    }
  });

  partNumberInput.addEventListener('input', () => {
    updatePnSuggestion();
    clearSearchStatus();
    scheduleMappingsSync();
  });
  updatePnSuggestion();
  restoreSourcesState();
  if (window.PN_MAPPINGS_API?.load) {
    window.PN_MAPPINGS_API.load().then(() => {
      updatePnSuggestion();
    }).catch(() => {});
  }

  const closeReportModal = () => {
    if (!reportModal) return;
    reportModal.style.display = 'none';
    if (reportReason) reportReason.value = '';
    if (reportNonMapping) reportNonMapping.checked = false;
    // no dropdown to reset
  };
  const openReportModal = () => {
    if (!reportModal) return;
    const query = partNumberInput.value.trim();
    const vendor = partNumberInput.dataset.suggestionVendor || '';
    const source = partNumberInput.dataset.suggestionSource || '';
    const detail = partNumberInput.dataset.suggestionDetail || '';
    if (reportModalInfo) {
      reportModalInfo.innerHTML = `
        <div><strong>PN:</strong> ${query || '—'}</div>
        <div><strong>Sugestia:</strong> ${vendor || '—'} ${detail ? `(${detail})` : ''}</div>
        <div><strong>Źródło:</strong> ${source || '—'}</div>
      `;
    }
    reportModal.style.display = 'flex';
    if (reportReason) reportReason.focus();
  };

  if (reportMappingBtn) {
    reportMappingBtn.addEventListener('click', () => {
      openReportModal();
    });
  }
  if (reportModalClose) {
    reportModalClose.addEventListener('click', closeReportModal);
  }
  if (reportModalCancel) {
    reportModalCancel.addEventListener('click', closeReportModal);
  }
  if (reportModalSubmit) {
    reportModalSubmit.addEventListener('click', () => {
      const query = partNumberInput.value.trim();
      const vendor = partNumberInput.dataset.suggestionVendor || '';
      const source = partNumberInput.dataset.suggestionSource || '';
      const detail = partNumberInput.dataset.suggestionDetail || '';
      const reason = reportReason?.value?.trim() || '';
      const nonMapping = !!(reportNonMapping && reportNonMapping.checked);
      if (nonMapping) {
        if (!reason) {
          showMainToast('Dodaj krótki opis problemu.', 'warn');
          return;
        }
      } else if (!query || !vendor) {
        showMainToast('Brak danych do zgłoszenia.', 'warn');
        return;
      }
      const reportId = `R-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const payload = {
        query,
        suggestedVendor: vendor,
        source,
        detail,
        reason,
        kind: nonMapping ? 'ui' : 'mapping',
        reportId,
        appVersion
      };
      const fallbackLog = () => {
        if (window.PN_MAPPINGS_API?.log) {
          window.PN_MAPPINGS_API.log('mapping-report', payload);
        }
      };
      if (window.PN_MAPPINGS_API?.request) {
        window.PN_MAPPINGS_API.request('/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'mapping-report', meta: payload })
        }).then((resp) => {
          if (!resp.ok) fallbackLog();
        }).catch(() => {
          fallbackLog();
        });
      } else {
        fallbackLog();
      }
      showMainToast('Zgłoszenie wysłane do admina.', 'ok');
      closeReportModal();
    });
  }
}


// Start

const adminKeys = new Set();
window.addEventListener('keydown', (event) => {
  adminKeys.add(event.key.toLowerCase());
  if (adminKeys.has('a') && adminKeys.has('d') && adminKeys.has('m')) {
    adminKeys.clear();
    window.location.href = `admin.html?v=${Date.now()}`;
  }
});
window.addEventListener('keyup', (event) => {
  adminKeys.delete(event.key.toLowerCase());
});
