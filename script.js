let lastChanged = null;
let originalEbayPrice = null;
let originalCurrency = 'EUR';
let originalExchangeRate = 4.3;
let lastCurrency = 'EUR';
let currentExchangeRate = 4.3;
const rateStatusCache = {};
let isPresetApplied = false;
const numberFormatter = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 });
let selfTestHideTimer = null;
const historyEntries = [];
const historyTimers = {};
let lastHistorySignature = '';
const lastHistorySignatureBySource = {};
let lastClearedHistory = [];
let restoreHistoryTimer = null;
const fieldBaselines = {};
const lastLoggedValues = {};
const mainToastStack = document.getElementById('mainToastStack');
const activityLogCache = {};
const appVersionEl = document.getElementById('appVersion');
const appVersion = appVersionEl?.textContent?.trim() || window.AppVersionInfo?.version || '';
if (appVersion) {
  localStorage.setItem('appVersion', appVersion);
}
const SEARCH_SOURCES_CONFIG_NOTE_ID = 'search-sources-config-v1';
const SEARCH_SOURCES_CONFIG_CACHE_KEY = 'searchSourcesConfigV1';
const RATE_PROVIDER_DEFAULT_NOTE_ID = 'rate-provider-default-v1';
const RATE_PROVIDER_DEFAULT_CACHE_KEY = 'rateProviderDefaultV1';
const RATE_PROVIDERS_CONFIG_NOTE_ID = 'rate-providers-config-v1';
const RATE_PROVIDERS_CONFIG_CACHE_KEY = 'rateProvidersConfigV1';
const COMMISSION_DEFAULT_NOTE_ID = 'commission-default-v1';
const DEFAULT_COMMISSION_RATE = 15;
let defaultCommissionRate = DEFAULT_COMMISSION_RATE;

const INDEX_LAYOUT_STORAGE_KEY = 'indexLayoutOrderV1';
const INDEX_LAYOUT_COOKIE_KEY = 'indexLayoutOrderV1';
const INDEX_LAYOUT_VISIBILITY_STORAGE_KEY = 'indexLayoutVisibilityV1';
const INDEX_LAYOUT_VISIBILITY_COOKIE_KEY = 'indexLayoutVisibilityV1';
const INDEX_LAYOUT_COLORS_STORAGE_KEY = 'indexLayoutColorsV1';
const INDEX_LAYOUT_COLORS_COOKIE_KEY = 'indexLayoutColorsV1';
const INDEX_LAYOUT_COLUMN_WIDTH_STORAGE_KEY = 'indexLayoutColumnWidthV1';
const INDEX_LAYOUT_COLUMN_WIDTH_COOKIE_KEY = 'indexLayoutColumnWidthV1';
const INDEX_LAYOUT_SPANS_STORAGE_KEY = 'indexLayoutSpansV1';
const INDEX_LAYOUT_SPANS_COOKIE_KEY = 'indexLayoutSpansV1';
const INDEX_LAYOUT_GLOBAL_PRESETS_NOTE_ID = 'layout-presets-v1';
const INDEX_LAYOUT_ACTIVE_PRESET_KEY = 'indexLayoutActivePresetV1';
const DEFAULT_LAYOUT_COLUMN_WIDTH = 62;
const MIN_LAYOUT_COLUMN_WIDTH = 35;
const MAX_LAYOUT_COLUMN_WIDTH = 80;
const DEFAULT_LAYOUT_COLUMN_PROFILE = { count: 2, widths: { calc: 62, info: 38, extra: 0 } };
const DEFAULT_THREE_COLUMN_PROFILE = { count: 3, widths: { calc: 46, info: 30, extra: 24 } };
const MIN_THREE_COLUMN_WIDTH = 18;
const LAYOUT_GROUP_KEYS = ['calc', 'info', 'extra'];
const LAYOUT_SPAN_ITEMS = new Set(['calc-clear']);
const LAYOUT_SPAN_VALUES = ['1', '2'];
const DEFAULT_LAYOUT_SPANS = { 'calc-clear': '1' };
const LAYOUT_TINTS = ['', 'mint', 'blue', 'amber', 'violet', 'rose'];
const LAYOUT_TINT_LABELS = {
  '': 'Brak',
  mint: 'Mięta',
  blue: 'Niebieski',
  amber: 'Bursztyn',
  violet: 'Fiolet',
  rose: 'Róż'
};
const layoutGroups = {
  calc: document.getElementById('calcLayoutContainer'),
  info: document.getElementById('infoLayoutContainer'),
  extra: document.getElementById('extraLayoutContainer')
};
const topMenuLayoutGroup = document.querySelector('.top-menu-group.has-dropdown');
const topMenuLayoutLink = topMenuLayoutGroup?.querySelector('.top-menu-link');
const layoutCustomizeBtn = document.getElementById('layoutCustomizeBtn');
const layoutEditBar = document.getElementById('layoutEditBar');
const layoutSaveBtn = document.getElementById('layoutSaveBtn');
const layoutResetBtn = document.getElementById('layoutResetBtn');
const layoutExitBtn = document.getElementById('layoutExitBtn');
const layoutGlobalPresetsEl = document.getElementById('layoutGlobalPresets');
const layoutColumnRatioEl = document.getElementById('layoutColumnRatio');
const layoutColumnModeBtn = document.getElementById('layoutColumnModeBtn');
const layoutFitWindowBtn = document.getElementById('layoutFitWindowBtn');
const pageLayoutRoot = document.querySelector('body[data-page-title="Kalkulator"] .layout');
const columnResizer = document.getElementById('columnResizer');
const columnResizerRight = document.getElementById('columnResizerRight');
const layoutResetModal = document.getElementById('layoutResetModal');
const layoutResetModalClose = document.getElementById('layoutResetModalClose');
const layoutResetModalCancel = document.getElementById('layoutResetModalCancel');
const layoutResetModalConfirm = document.getElementById('layoutResetModalConfirm');
let isLayoutEditMode = false;
let defaultLayoutOrder = null;
let preEditLayoutOrder = null;
let defaultLayoutVisibility = null;
let preEditLayoutVisibility = null;
let defaultLayoutColors = null;
let preEditLayoutColors = null;
let defaultLayoutSpans = null;
let preEditLayoutSpans = null;
let defaultLayoutColumnWidth = DEFAULT_LAYOUT_COLUMN_PROFILE;
let preEditLayoutColumnWidth = null;
let currentDraggedItem = null;
let currentDraggedEl = null;
let layoutResetModalResolver = null;
let globalLayoutPresets = [];
let layoutEditBarResizeObserver = null;
let selectedLayoutPresetKey = localStorage.getItem(INDEX_LAYOUT_ACTIVE_PRESET_KEY) || 'custom';
let preEditLayoutPresetKey = selectedLayoutPresetKey;
if (selectedLayoutPresetKey.startsWith('builtin:')) {
  selectedLayoutPresetKey = 'custom';
  localStorage.setItem(INDEX_LAYOUT_ACTIVE_PRESET_KEY, selectedLayoutPresetKey);
}

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

function getAllLayoutItems() {
  return Array.from(document.querySelectorAll('.layout-item[data-layout-item]'));
}

function getCurrentLayoutVisibility() {
  const visibility = {};
  getAllLayoutItems().forEach((item) => {
    const id = item.getAttribute('data-layout-item');
    if (!id) return;
    visibility[id] = !item.classList.contains('is-user-hidden');
  });
  return visibility;
}

function getCurrentLayoutColors() {
  const colors = {};
  getAllLayoutItems().forEach((item) => {
    const id = item.getAttribute('data-layout-item');
    if (!id) return;
    const tint = String(item.dataset.layoutTint || '');
    colors[id] = LAYOUT_TINTS.includes(tint) ? tint : '';
  });
  return colors;
}

function getCurrentLayoutSpans() {
  const spans = {};
  getAllLayoutItems().forEach((item) => {
    const id = item.getAttribute('data-layout-item');
    if (!id || !LAYOUT_SPAN_ITEMS.has(id)) return;
    const value = String(item.dataset.layoutSpan || DEFAULT_LAYOUT_SPANS[id] || '1');
    spans[id] = LAYOUT_SPAN_VALUES.includes(value) ? value : '1';
  });
  return spans;
}

function normalizeLayoutVisibility(rawVisibility) {
  const normalized = {};
  getAllLayoutItems().forEach((item) => {
    const id = item.getAttribute('data-layout-item');
    if (!id) return;
    const rawValue = rawVisibility?.[id];
    normalized[id] = rawValue !== false;
  });
  return normalized;
}

function normalizeLayoutColors(rawColors) {
  const normalized = {};
  getAllLayoutItems().forEach((item) => {
    const id = item.getAttribute('data-layout-item');
    if (!id) return;
    const rawValue = String(rawColors?.[id] || '');
    normalized[id] = LAYOUT_TINTS.includes(rawValue) ? rawValue : '';
  });
  return normalized;
}

function normalizeLayoutSpans(rawSpans) {
  const normalized = {};
  getAllLayoutItems().forEach((item) => {
    const id = item.getAttribute('data-layout-item');
    if (!id || !LAYOUT_SPAN_ITEMS.has(id)) return;
    const rawValue = String(rawSpans?.[id] || DEFAULT_LAYOUT_SPANS[id] || '1');
    normalized[id] = LAYOUT_SPAN_VALUES.includes(rawValue) ? rawValue : '1';
  });
  return normalized;
}

function normalizeLayoutOrder(rawOrder) {
  const allIds = getAllLayoutItems()
    .map((item) => item.getAttribute('data-layout-item'))
    .filter(Boolean);
  const currentOrder = getCurrentLayoutOrder();
  const currentGroupById = {};
  Object.entries(currentOrder).forEach(([groupKey, ids]) => {
    (ids || []).forEach((id) => {
      currentGroupById[id] = groupKey;
    });
  });

  const normalized = {};
  const used = new Set();
  Object.entries(layoutGroups).forEach(([groupKey, groupEl]) => {
    if (!groupEl) return;
    const requested = Array.isArray(rawOrder?.[groupKey]) ? rawOrder[groupKey] : [];
    const finalOrder = [];
    requested.forEach((id) => {
      if (!id || used.has(id) || !allIds.includes(id)) return;
      used.add(id);
      finalOrder.push(id);
    });
    normalized[groupKey] = finalOrder;
  });

  allIds.forEach((id) => {
    if (used.has(id)) return;
    const groupKey = currentGroupById[id] && normalized[currentGroupById[id]]
      ? currentGroupById[id]
      : Object.keys(layoutGroups)[0];
    normalized[groupKey].push(id);
    used.add(id);
  });

  return normalized;
}

function applyLayoutOrder(orderMap) {
  const normalized = normalizeLayoutOrder(orderMap);
  const movableById = new Map();
  Object.entries(layoutGroups).forEach(([groupKey, groupEl]) => {
    if (!groupEl) return;
    const movableChildren = Array.from(groupEl.children).filter((child) => child.getAttribute('data-layout-item'));
    movableChildren.forEach((child) => {
      const id = child.getAttribute('data-layout-item');
      if (id) movableById.set(id, child);
    });
  });

  Object.entries(layoutGroups).forEach(([groupKey, groupEl]) => {
    if (!groupEl) return;
    const firstStatic = Array.from(groupEl.children).find((child) => !child.getAttribute('data-layout-item')) || null;
    (normalized[groupKey] || []).forEach((id) => {
      const child = movableById.get(id);
      if (!child) return;
      groupEl.insertBefore(child, firstStatic);
    });
  });

  if (isLayoutEditMode) {
    renderLayoutItemControls();
  }
}

function applyLayoutVisibility(visibilityMap, options = {}) {
  const normalized = normalizeLayoutVisibility(visibilityMap);
  const forceShowAll = options.forceShowAll === true;
  getAllLayoutItems().forEach((item) => {
    const id = item.getAttribute('data-layout-item');
    if (!id) return;
    const isVisible = normalized[id] !== false;
    const shouldHide = !isVisible && !forceShowAll;
    item.classList.toggle('is-user-hidden', !isVisible);
    item.classList.toggle('is-layout-hidden-preview', !isVisible && forceShowAll);
    item.style.display = shouldHide ? 'none' : '';
    item.setAttribute('aria-hidden', shouldHide ? 'true' : 'false');
  });
}

function applyLayoutColors(colorMap) {
  const normalized = normalizeLayoutColors(colorMap);
  getAllLayoutItems().forEach((item) => {
    const id = item.getAttribute('data-layout-item');
    if (!id) return;
    const tint = normalized[id] || '';
    item.dataset.layoutTint = tint;
    item.classList.toggle('has-layout-tint', !!tint);
  });
}

function applyLayoutSpans(spanMap) {
  const normalized = normalizeLayoutSpans(spanMap);
  getAllLayoutItems().forEach((item) => {
    const id = item.getAttribute('data-layout-item');
    if (!id || !LAYOUT_SPAN_ITEMS.has(id)) {
      item.removeAttribute('data-layout-span');
      return;
    }
    item.dataset.layoutSpan = normalized[id] || '1';
  });
}

function normalizeLayoutColumnWidth(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LAYOUT_COLUMN_WIDTH;
  return Math.min(MAX_LAYOUT_COLUMN_WIDTH, Math.max(MIN_LAYOUT_COLUMN_WIDTH, parsed));
}

function roundLayoutWidth(value) {
  return Math.round(Number(value) || 0);
}

function normalizeThreeColumnWidths(rawWidths = {}) {
  const fallback = DEFAULT_THREE_COLUMN_PROFILE.widths;
  let calc = Number(rawWidths.calc ?? fallback.calc);
  let info = Number(rawWidths.info ?? fallback.info);
  let extra = Number(rawWidths.extra ?? fallback.extra);
  if (!Number.isFinite(calc)) calc = fallback.calc;
  if (!Number.isFinite(info)) info = fallback.info;
  if (!Number.isFinite(extra)) extra = fallback.extra;

  calc = Math.max(MIN_THREE_COLUMN_WIDTH, calc);
  info = Math.max(MIN_THREE_COLUMN_WIDTH, info);
  extra = Math.max(MIN_THREE_COLUMN_WIDTH, extra);

  const total = calc + info + extra;
  const scale = total > 0 ? 100 / total : 1;
  calc *= scale;
  info *= scale;
  extra *= scale;

  return { calc, info, extra };
}

function normalizeLayoutColumnProfile(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const count = Number(value.count) === 3 ? 3 : 2;
    const widths = value.widths || {};
    if (count === 3) {
      return {
        count: 3,
        widths: normalizeThreeColumnWidths(widths)
      };
    }
    const calc = normalizeLayoutColumnWidth(widths.calc ?? value.calc ?? DEFAULT_LAYOUT_COLUMN_WIDTH);
    return {
      count: 2,
      widths: { calc, info: Math.max(1, 100 - calc), extra: 0 }
    };
  }
  const calc = normalizeLayoutColumnWidth(value);
  return {
    count: 2,
    widths: { calc, info: Math.max(1, 100 - calc), extra: 0 }
  };
}

function formatLayoutColumnRatio(profile) {
  const normalized = normalizeLayoutColumnProfile(profile);
  const left = roundLayoutWidth(normalized.widths.calc);
  const right = roundLayoutWidth(normalized.widths.info);
  if (normalized.count === 3) {
    const third = Math.max(0, 100 - left - right);
    return `Kolumny ${left}% / ${right}% / ${third}%`;
  }
  return `Kolumny ${left}% / ${Math.max(0, 100 - left)}%`;
}

function updateLayoutColumnModeControls(profile) {
  const normalized = normalizeLayoutColumnProfile(profile);
  document.body.classList.toggle('layout-three-columns', normalized.count === 3);
  if (layoutColumnModeBtn) {
    layoutColumnModeBtn.textContent = normalized.count === 3 ? '2 kolumny' : '3 kolumny';
    layoutColumnModeBtn.setAttribute('aria-pressed', normalized.count === 3 ? 'true' : 'false');
    layoutColumnModeBtn.setAttribute('title', normalized.count === 3 ? 'Przełącz na dwie kolumny' : 'Przełącz na trzy kolumny');
  }
}

function setLayoutColumnCount(count) {
  const current = getCurrentLayoutColumnWidth();
  const nextCount = count === 3 ? 3 : 2;
  if (nextCount === 3) {
    const calc = Math.min(64, Math.max(MIN_THREE_COLUMN_WIDTH, current.widths.calc || DEFAULT_THREE_COLUMN_PROFILE.widths.calc));
    const remaining = 100 - calc;
    const infoShare = current.count === 2 ? 0.56 : (current.widths.info / Math.max(1, current.widths.info + current.widths.extra));
    applyLayoutColumnWidth({
      count: 3,
      widths: {
        calc,
        info: remaining * infoShare,
        extra: remaining * (1 - infoShare)
      }
    });
    if (isLayoutEditMode) {
      renderLayoutItemControls();
      updateLayoutDiffHighlight();
    }
    return;
  }
  if (layoutGroups.extra && layoutGroups.info) {
    Array.from(layoutGroups.extra.children)
      .filter((child) => child.getAttribute('data-layout-item'))
      .forEach((child) => layoutGroups.info.appendChild(child));
  }
  applyLayoutColumnWidth({
    count: 2,
    widths: {
      calc: normalizeLayoutColumnWidth(current.widths.calc || DEFAULT_LAYOUT_COLUMN_WIDTH),
      info: 100 - normalizeLayoutColumnWidth(current.widths.calc || DEFAULT_LAYOUT_COLUMN_WIDTH),
      extra: 0
    }
  });
  if (isLayoutEditMode) {
    renderLayoutItemControls();
    updateLayoutDiffHighlight();
  }
}

function getCurrentLayoutContainerWidth() {
  const width = pageLayoutRoot?.getBoundingClientRect?.().width;
  if (Number.isFinite(width) && width > 0) return width;
  return window.innerWidth || 0;
}

function getFitLayoutColumnProfile() {
  const current = getCurrentLayoutColumnWidth();
  const containerWidth = getCurrentLayoutContainerWidth();
  if (current.count === 3) {
    const resizerSpace = containerWidth <= 760 ? 8 : 24;
    const usableWidth = Math.max(1, containerWidth - resizerSpace);
    const infoPx = Math.min(420, Math.max(300, usableWidth * 0.25));
    const extraPx = Math.min(360, Math.max(240, usableWidth * 0.22));
    const minPx = Math.max(180, usableWidth * (MIN_THREE_COLUMN_WIDTH / 100));
    let calcPx = usableWidth - infoPx - extraPx;
    let nextInfoPx = infoPx;
    let nextExtraPx = extraPx;

    if (calcPx < minPx) {
      const deficit = minPx - calcPx;
      const rest = Math.max(1, nextInfoPx + nextExtraPx);
      nextInfoPx = Math.max(minPx, nextInfoPx - (deficit * (nextInfoPx / rest)));
      nextExtraPx = Math.max(minPx, nextExtraPx - (deficit * (nextExtraPx / rest)));
      calcPx = usableWidth - nextInfoPx - nextExtraPx;
    }

    return normalizeLayoutColumnProfile({
      count: 3,
      widths: {
        calc: (calcPx / usableWidth) * 100,
        info: (nextInfoPx / usableWidth) * 100,
        extra: (nextExtraPx / usableWidth) * 100
      }
    });
  }

  const resizerSpace = containerWidth <= 360 ? 6 : containerWidth <= 760 ? 8 : 12;
  const usableWidth = Math.max(1, containerWidth - resizerSpace);
  const infoPx = Math.min(460, Math.max(320, usableWidth * 0.34));
  const calcPercent = ((usableWidth - infoPx) / usableWidth) * 100;
  return normalizeLayoutColumnProfile({
    count: 2,
    widths: {
      calc: calcPercent,
      info: 100 - calcPercent,
      extra: 0
    }
  });
}

function applyLayoutColumnWidth(value) {
  const profile = normalizeLayoutColumnProfile(value);
  const { count, widths } = profile;
  const leftFr = `${widths.calc}fr`;
  const rightFr = `${widths.info}fr`;
  const thirdFr = `${count === 3 ? widths.extra : 0}fr`;
  const roundedLeft = roundLayoutWidth(widths.calc);
  const roundedRight = count === 3 ? roundLayoutWidth(widths.info) : Math.max(0, 100 - roundedLeft);
  const roundedThird = count === 3 ? Math.max(0, 100 - roundedLeft - roundedRight) : 0;

  document.documentElement.style.setProperty('--layout-left-fr', leftFr);
  document.documentElement.style.setProperty('--layout-right-fr', rightFr);
  document.documentElement.style.setProperty('--layout-third-fr', thirdFr);
  if (pageLayoutRoot) {
    pageLayoutRoot.style.setProperty('--layout-left-fr', leftFr);
    pageLayoutRoot.style.setProperty('--layout-right-fr', rightFr);
    pageLayoutRoot.style.setProperty('--layout-third-fr', thirdFr);
    pageLayoutRoot.dataset.columnWidth = String(widths.calc);
    pageLayoutRoot.dataset.columnCount = String(count);
    pageLayoutRoot.dataset.columnProfile = JSON.stringify(profile);
  }
  if (count === 2 && layoutGroups.extra && layoutGroups.info && layoutGroups.extra.children.length) {
    Array.from(layoutGroups.extra.children)
      .filter((child) => child.getAttribute('data-layout-item'))
      .forEach((child) => layoutGroups.info.appendChild(child));
  }
  updateLayoutColumnModeControls(profile);
  if (columnResizer) {
    columnResizer.setAttribute('aria-valuenow', String(roundedLeft));
    columnResizer.setAttribute('aria-valuemin', String(count === 3 ? MIN_THREE_COLUMN_WIDTH : MIN_LAYOUT_COLUMN_WIDTH));
    columnResizer.setAttribute('aria-valuemax', String(count === 3 ? 100 - (MIN_THREE_COLUMN_WIDTH * 2) : MAX_LAYOUT_COLUMN_WIDTH));
    columnResizer.setAttribute('aria-valuetext', count === 3
      ? `Lewa kolumna ${roundedLeft}%, środkowa kolumna ${roundedRight}%, trzecia kolumna ${roundedThird}%`
      : `Lewa kolumna ${roundedLeft}%, prawa kolumna ${roundedRight}%`);
  }
  if (columnResizerRight) {
    columnResizerRight.setAttribute('aria-valuenow', String(roundedLeft + roundedRight));
    columnResizerRight.setAttribute('aria-valuemin', String(count === 3 ? MIN_THREE_COLUMN_WIDTH * 2 : MIN_LAYOUT_COLUMN_WIDTH));
    columnResizerRight.setAttribute('aria-valuemax', String(count === 3 ? 100 - MIN_THREE_COLUMN_WIDTH : MAX_LAYOUT_COLUMN_WIDTH));
    columnResizerRight.setAttribute('aria-valuetext', `Środkowa kolumna ${roundedRight}%, trzecia kolumna ${roundedThird}%`);
  }
  if (layoutColumnRatioEl) {
    layoutColumnRatioEl.textContent = formatLayoutColumnRatio(profile);
  }
  return profile;
}

function getCurrentLayoutColumnWidth() {
  const raw = pageLayoutRoot?.dataset.columnProfile;
  if (raw) {
    try {
      return normalizeLayoutColumnProfile(JSON.parse(raw));
    } catch (_error) {
      return normalizeLayoutColumnProfile(pageLayoutRoot?.dataset.columnWidth);
    }
  }
  return normalizeLayoutColumnProfile(DEFAULT_LAYOUT_COLUMN_PROFILE);
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

function loadSavedLayoutVisibility() {
  const raw = localStorage.getItem(INDEX_LAYOUT_VISIBILITY_STORAGE_KEY) || layoutGetCookieValue(INDEX_LAYOUT_VISIBILITY_COOKIE_KEY);
  if (!raw) return null;
  try {
    return normalizeLayoutVisibility(JSON.parse(raw));
  } catch (error) {
    return null;
  }
}

function loadSavedLayoutColors() {
  const raw = localStorage.getItem(INDEX_LAYOUT_COLORS_STORAGE_KEY) || layoutGetCookieValue(INDEX_LAYOUT_COLORS_COOKIE_KEY);
  if (!raw) return null;
  try {
    return normalizeLayoutColors(JSON.parse(raw));
  } catch (_error) {
    return null;
  }
}

function loadSavedLayoutSpans() {
  const raw = localStorage.getItem(INDEX_LAYOUT_SPANS_STORAGE_KEY) || layoutGetCookieValue(INDEX_LAYOUT_SPANS_COOKIE_KEY);
  if (!raw) return null;
  try {
    return normalizeLayoutSpans(JSON.parse(raw));
  } catch (_error) {
    return null;
  }
}

function loadSavedLayoutColumnWidth() {
  const raw = localStorage.getItem(INDEX_LAYOUT_COLUMN_WIDTH_STORAGE_KEY) || layoutGetCookieValue(INDEX_LAYOUT_COLUMN_WIDTH_COOKIE_KEY);
  if (!raw) return null;
  try {
    return normalizeLayoutColumnProfile(JSON.parse(raw));
  } catch (_error) {
    return normalizeLayoutColumnProfile(raw);
  }
}

function loadSavedLayoutFromLocal() {
  const order = loadSavedLayoutOrder();
  const visibility = loadSavedLayoutVisibility();
  const colors = loadSavedLayoutColors();
  const spans = loadSavedLayoutSpans();
  const columnWidth = loadSavedLayoutColumnWidth();
  if (!order && !visibility && !colors && !spans && columnWidth === null) return null;
  return {
    order: order || getCurrentLayoutOrder(),
    visibility: visibility || getCurrentLayoutVisibility(),
    colors: colors || getCurrentLayoutColors(),
    spans: spans || getCurrentLayoutSpans(),
    columnWidth: columnWidth ?? getCurrentLayoutColumnWidth()
  };
}

function flattenLayoutOrder(order) {
  return LAYOUT_GROUP_KEYS.flatMap((groupKey) => order?.[groupKey] || []);
}

function diffLayoutChanges(beforeOrder, beforeVisibility, afterOrder, afterVisibility, beforeColumnWidth, afterColumnWidth, beforeSpans, afterSpans) {
  const allIds = Array.from(new Set([
    ...flattenLayoutOrder(beforeOrder),
    ...flattenLayoutOrder(afterOrder),
    ...Object.keys(beforeVisibility || {}),
    ...Object.keys(afterVisibility || {})
  ]));

  const beforeGroupById = {};
  const afterGroupById = {};
  Object.entries(beforeOrder || {}).forEach(([group, ids]) => (ids || []).forEach((id) => { beforeGroupById[id] = group; }));
  Object.entries(afterOrder || {}).forEach(([group, ids]) => (ids || []).forEach((id) => { afterGroupById[id] = group; }));

  const beforeFlat = flattenLayoutOrder(beforeOrder);
  const afterFlat = flattenLayoutOrder(afterOrder);

  const moved = [];
  const columnChanged = [];
  const shown = [];
  const hidden = [];
  const spanChanged = [];

  allIds.forEach((id) => {
    const beforeIdx = beforeFlat.indexOf(id);
    const afterIdx = afterFlat.indexOf(id);
    const beforeGroup = beforeGroupById[id] || null;
    const afterGroup = afterGroupById[id] || null;
    if (beforeIdx !== afterIdx) moved.push({ id, fromIndex: beforeIdx, toIndex: afterIdx });
    if (beforeGroup !== afterGroup) columnChanged.push({ id, from: beforeGroup, to: afterGroup });

    const beforeVisible = beforeVisibility?.[id] !== false;
    const afterVisible = afterVisibility?.[id] !== false;
    if (!beforeVisible && afterVisible) shown.push(id);
    if (beforeVisible && !afterVisible) hidden.push(id);

    if (LAYOUT_SPAN_ITEMS.has(id)) {
      const beforeSpan = normalizeLayoutSpans(beforeSpans)[id] || '1';
      const afterSpan = normalizeLayoutSpans(afterSpans)[id] || '1';
      if (beforeSpan !== afterSpan) spanChanged.push({ id, from: beforeSpan, to: afterSpan });
    }
  });

  const normalizedBeforeWidth = normalizeLayoutColumnProfile(beforeColumnWidth);
  const normalizedAfterWidth = normalizeLayoutColumnProfile(afterColumnWidth);
  const beforeWidthText = formatLayoutColumnRatio(normalizedBeforeWidth);
  const afterWidthText = formatLayoutColumnRatio(normalizedAfterWidth);
  const columnWidth = beforeWidthText !== afterWidthText || normalizedBeforeWidth.count !== normalizedAfterWidth.count
    ? { from: normalizedBeforeWidth, to: normalizedAfterWidth }
    : null;

  return { moved, columnChanged, shown, hidden, spanChanged, columnWidth };
}

function saveLayoutToLocal(orderMap, visibilityMap, colorMap, columnWidth, spanMap) {
  saveLayoutOrder(orderMap);
  saveLayoutVisibility(visibilityMap);
  saveLayoutColors(colorMap || getCurrentLayoutColors());
  saveLayoutColumnWidth(columnWidth ?? getCurrentLayoutColumnWidth());
  saveLayoutSpans(spanMap || getCurrentLayoutSpans());
}

function clearSavedLayoutLocal() {
  clearSavedLayoutOrder();
}

function normalizeGlobalLayoutPreset(rawPreset) {
  if (!rawPreset || typeof rawPreset !== 'object') return null;
  const id = String(rawPreset.id || '').trim();
  const name = String(rawPreset.name || '').trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    order: normalizeLayoutOrder(rawPreset.order || {}),
    visibility: normalizeLayoutVisibility(rawPreset.visibility || {}),
    spans: normalizeLayoutSpans(rawPreset.spans || {}),
    columnWidth: normalizeLayoutColumnProfile(rawPreset.columnWidth)
  };
}

async function loadGlobalLayoutPresets() {
  try {
    if (!window.PN_MAPPINGS_API?.request) return null;
    const response = await window.PN_MAPPINGS_API.request(`/notes?id=${encodeURIComponent(INDEX_LAYOUT_GLOBAL_PRESETS_NOTE_ID)}`);
    if (!response.ok) return null;
    const payload = await response.json();
    const parsed = payload?.note ? JSON.parse(payload.note) : [];
    const list = Array.isArray(parsed) ? parsed : [];
    return list.map(normalizeGlobalLayoutPreset).filter(Boolean);
  } catch (error) {
    return null;
  }
}

function renderGlobalLayoutPresetButtons() {
  if (!layoutGlobalPresetsEl) return;
  if (!globalLayoutPresets.length) {
    layoutGlobalPresetsEl.innerHTML = '';
    requestAnimationFrame(updateLayoutEditBarSpace);
    return;
  }
  layoutGlobalPresetsEl.innerHTML = globalLayoutPresets
    .map((preset) => `<button type="button" class="layout-global-preset-btn" data-preset-id="${preset.id}">${preset.name}</button>`)
    .join('');
  requestAnimationFrame(updateLayoutEditBarSpace);
}

function applyPresetSelectionVisual() {
  if (!layoutGlobalPresetsEl) return;
  const activeGlobalId = selectedLayoutPresetKey.startsWith('global:') ? selectedLayoutPresetKey.slice(7) : '';
  Array.from(layoutGlobalPresetsEl.querySelectorAll('.layout-global-preset-btn')).forEach((button) => {
    const buttonId = button.getAttribute('data-preset-id') || '';
    button.classList.toggle('is-active', !!activeGlobalId && activeGlobalId === buttonId);
  });
}

function updateLayoutEditBarSpace() {
  if (!layoutEditBar || layoutEditBar.hidden) {
    document.documentElement.style.removeProperty('--layout-edit-bar-space');
    return;
  }
  const barHeight = Math.ceil(layoutEditBar.getBoundingClientRect().height);
  document.documentElement.style.setProperty('--layout-edit-bar-space', `${barHeight}px`);
}

function watchLayoutEditBarSpace() {
  if (!layoutEditBar || layoutEditBarResizeObserver) return;
  if (typeof ResizeObserver === 'function') {
    layoutEditBarResizeObserver = new ResizeObserver(updateLayoutEditBarSpace);
    layoutEditBarResizeObserver.observe(layoutEditBar);
  }
  updateLayoutEditBarSpace();
}

function unwatchLayoutEditBarSpace() {
  if (layoutEditBarResizeObserver) {
    layoutEditBarResizeObserver.disconnect();
    layoutEditBarResizeObserver = null;
  }
  updateLayoutEditBarSpace();
}

function applyGlobalPresetById(presetId) {
  const preset = globalLayoutPresets.find((item) => item.id === presetId);
  if (!preset) return false;
  selectedLayoutPresetKey = `global:${preset.id}`;
  applyLayoutOrder(preset.order);
  applyLayoutVisibility(preset.visibility, { forceShowAll: isLayoutEditMode });
  applyLayoutSpans(preset.spans || {});
  applyLayoutColumnWidth(preset.columnWidth);
  if (isLayoutEditMode) {
    renderLayoutItemControls();
    updateLayoutDiffHighlight();
  } else {
    removeLayoutItemControls();
  }
  applyPresetSelectionVisual();
  return true;
}

function saveLayoutOrder(orderMap) {
  const normalized = normalizeLayoutOrder(orderMap);
  const payload = JSON.stringify(normalized);
  localStorage.setItem(INDEX_LAYOUT_STORAGE_KEY, payload);
  layoutSetCookieValue(INDEX_LAYOUT_COOKIE_KEY, payload);
}

function saveLayoutVisibility(visibilityMap) {
  const normalized = normalizeLayoutVisibility(visibilityMap);
  const payload = JSON.stringify(normalized);
  localStorage.setItem(INDEX_LAYOUT_VISIBILITY_STORAGE_KEY, payload);
  layoutSetCookieValue(INDEX_LAYOUT_VISIBILITY_COOKIE_KEY, payload);
}

function saveLayoutColors(colorMap) {
  const normalized = normalizeLayoutColors(colorMap);
  const payload = JSON.stringify(normalized);
  localStorage.setItem(INDEX_LAYOUT_COLORS_STORAGE_KEY, payload);
  layoutSetCookieValue(INDEX_LAYOUT_COLORS_COOKIE_KEY, payload);
}

function saveLayoutColumnWidth(columnWidth) {
  const normalized = normalizeLayoutColumnProfile(columnWidth);
  const payload = JSON.stringify(normalized);
  localStorage.setItem(INDEX_LAYOUT_COLUMN_WIDTH_STORAGE_KEY, payload);
  layoutSetCookieValue(INDEX_LAYOUT_COLUMN_WIDTH_COOKIE_KEY, payload);
}

function saveLayoutSpans(spanMap) {
  const normalized = normalizeLayoutSpans(spanMap);
  const payload = JSON.stringify(normalized);
  localStorage.setItem(INDEX_LAYOUT_SPANS_STORAGE_KEY, payload);
  layoutSetCookieValue(INDEX_LAYOUT_SPANS_COOKIE_KEY, payload);
}

function clearSavedLayoutOrder() {
  localStorage.removeItem(INDEX_LAYOUT_STORAGE_KEY);
  localStorage.removeItem(INDEX_LAYOUT_VISIBILITY_STORAGE_KEY);
  localStorage.removeItem(INDEX_LAYOUT_COLORS_STORAGE_KEY);
  localStorage.removeItem(INDEX_LAYOUT_COLUMN_WIDTH_STORAGE_KEY);
  localStorage.removeItem(INDEX_LAYOUT_SPANS_STORAGE_KEY);
  document.cookie = `${INDEX_LAYOUT_COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  document.cookie = `${INDEX_LAYOUT_VISIBILITY_COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  document.cookie = `${INDEX_LAYOUT_COLORS_COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  document.cookie = `${INDEX_LAYOUT_COLUMN_WIDTH_COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  document.cookie = `${INDEX_LAYOUT_SPANS_COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

function markLayoutAsCustomAfterWidthChange() {
  selectedLayoutPresetKey = 'custom';
  localStorage.setItem(INDEX_LAYOUT_ACTIVE_PRESET_KEY, selectedLayoutPresetKey);
  applyPresetSelectionVisual();
}

function bindColumnResizer() {
  if (!columnResizer || !pageLayoutRoot) return;
  applyLayoutColumnWidth(getCurrentLayoutColumnWidth());

  const updateFromPointer = (clientX, resizerKey = 'left') => {
    const rect = pageLayoutRoot.getBoundingClientRect();
    if (!rect.width) return getCurrentLayoutColumnWidth();
    const relative = ((clientX - rect.left) / rect.width) * 100;
    const current = getCurrentLayoutColumnWidth();
    let nextProfile;
    if (current.count === 3) {
      const widths = current.widths;
      if (resizerKey === 'right') {
        const boundary = Math.min(100 - MIN_THREE_COLUMN_WIDTH, Math.max(widths.calc + MIN_THREE_COLUMN_WIDTH, relative));
        nextProfile = {
          count: 3,
          widths: {
            calc: widths.calc,
            info: boundary - widths.calc,
            extra: 100 - boundary
          }
        };
      } else {
        const calc = Math.min(100 - (MIN_THREE_COLUMN_WIDTH * 2), Math.max(MIN_THREE_COLUMN_WIDTH, relative));
        const remaining = 100 - calc;
        const oldRest = Math.max(1, widths.info + widths.extra);
        nextProfile = {
          count: 3,
          widths: {
            calc,
            info: remaining * (widths.info / oldRest),
            extra: remaining * (widths.extra / oldRest)
          }
        };
      }
    } else {
      nextProfile = relative;
    }
    const width = applyLayoutColumnWidth(nextProfile);
    markLayoutAsCustomAfterWidthChange();
    if (isLayoutEditMode) updateLayoutDiffHighlight();
    return width;
  };

  const bindPointerResizer = (resizerEl, resizerKey) => {
    if (!resizerEl) return;
    resizerEl.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    document.body.classList.add('is-column-resizing');
    resizerEl.setPointerCapture?.(event.pointerId);
    updateFromPointer(event.clientX, resizerKey);

    const handleMove = (moveEvent) => {
      moveEvent.preventDefault();
      updateFromPointer(moveEvent.clientX, resizerKey);
    };

    const handleEnd = (endEvent) => {
      document.body.classList.remove('is-column-resizing');
      resizerEl.releasePointerCapture?.(endEvent.pointerId);
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleEnd);
      document.removeEventListener('pointercancel', handleEnd);
      if (!isLayoutEditMode) {
        saveLayoutColumnWidth(getCurrentLayoutColumnWidth());
      }
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleEnd);
    document.addEventListener('pointercancel', handleEnd);
    });

    resizerEl.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowLeft' ? -2 : 2;
    const current = getCurrentLayoutColumnWidth();
    let nextProfile;
    if (current.count === 3) {
      const widths = current.widths;
      if (resizerKey === 'right') {
        const nextInfo = Math.max(MIN_THREE_COLUMN_WIDTH, widths.info + delta);
        nextProfile = { count: 3, widths: { calc: widths.calc, info: nextInfo, extra: 100 - widths.calc - nextInfo } };
      } else {
        nextProfile = { count: 3, widths: { calc: widths.calc + delta, info: widths.info, extra: widths.extra - delta } };
      }
    } else {
      nextProfile = current.widths.calc + delta;
    }
    const width = applyLayoutColumnWidth(nextProfile);
    markLayoutAsCustomAfterWidthChange();
    if (!isLayoutEditMode) saveLayoutColumnWidth(width);
    if (isLayoutEditMode) updateLayoutDiffHighlight();
    });
  };

  bindPointerResizer(columnResizer, 'left');
  bindPointerResizer(columnResizerRight, 'right');
}

function updateLayoutDiffHighlight() {
  const baseline = normalizeLayoutOrder(preEditLayoutOrder || {});
  const baselineSpans = normalizeLayoutSpans(preEditLayoutSpans || {});
  const currentSpans = getCurrentLayoutSpans();
  const current = getCurrentLayoutOrder();
  const baselinePos = new Map();
  Object.entries(baseline).forEach(([groupKey, ids]) => {
    (ids || []).forEach((id, index) => {
      baselinePos.set(id, { groupKey, index });
    });
  });
  Object.entries(layoutGroups).forEach(([groupKey, groupEl]) => {
    if (!groupEl) return;
    const currOrder = Array.isArray(current[groupKey]) ? current[groupKey] : [];
    Array.from(groupEl.children).forEach((item) => {
      const id = item.getAttribute('data-layout-item');
      if (!id) return;
      const nowIndex = currOrder.indexOf(id);
      const prev = baselinePos.get(id);
      const spanChanged = LAYOUT_SPAN_ITEMS.has(id) && (baselineSpans[id] || '1') !== (currentSpans[id] || '1');
      const changed = !prev || prev.groupKey !== groupKey || prev.index !== nowIndex || spanChanged;
      item.classList.toggle('is-layout-modified', changed);
    });
  });
}

function removeLayoutItemControls() {
  document.querySelectorAll('.layout-item-controls').forEach((el) => el.remove());
  Object.values(layoutGroups).forEach((groupEl) => {
    if (!groupEl) return;
    groupEl.ondragover = null;
    groupEl.ondrop = null;
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

function preserveLayoutEditScroll(callback) {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  if (document.activeElement?.closest?.('.layout-item-controls')) {
    document.activeElement.blur();
  }
  callback();
  window.scrollTo(scrollX, scrollY);
  requestAnimationFrame(() => {
    window.scrollTo(scrollX, scrollY);
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
  preserveLayoutEditScroll(() => {
    selectedLayoutPresetKey = 'custom';
    applyPresetSelectionVisual();
    applyLayoutOrder(order);
    updateLayoutDiffHighlight();
  });
}

function moveLayoutItemToGroup(itemId, targetGroupKey) {
  if (!itemId || !targetGroupKey || !layoutGroups[targetGroupKey]) return;
  const order = getCurrentLayoutOrder();
  let currentGroupKey = null;
  Object.keys(order).forEach((groupKey) => {
    if ((order[groupKey] || []).includes(itemId)) currentGroupKey = groupKey;
  });
  if (!currentGroupKey || currentGroupKey === targetGroupKey) return;
  order[currentGroupKey] = (order[currentGroupKey] || []).filter((id) => id !== itemId);
  order[targetGroupKey] = [...(order[targetGroupKey] || []), itemId];
  preserveLayoutEditScroll(() => {
    selectedLayoutPresetKey = 'custom';
    applyPresetSelectionVisual();
    applyLayoutOrder(order);
    updateLayoutDiffHighlight();
  });
}

function getNextLayoutTint(currentTint) {
  const index = LAYOUT_TINTS.indexOf(currentTint);
  const safeIndex = index >= 0 ? index : 0;
  return LAYOUT_TINTS[(safeIndex + 1) % LAYOUT_TINTS.length];
}

function renderLayoutItemControls() {
  removeLayoutItemControls();
  Object.entries(layoutGroups).forEach(([groupKey, groupEl]) => {
    if (!groupEl) return;
    groupEl.ondragover = (event) => {
      if (!isLayoutEditMode || !currentDraggedEl) return;
      event.preventDefault();
      const overItem = event.target?.closest?.('.layout-item[data-layout-item]');
      if (overItem && overItem.parentElement === groupEl) return;
      const firstStatic = Array.from(groupEl.children).find((child) => !child.getAttribute('data-layout-item')) || null;
      if (currentDraggedEl.parentElement !== groupEl || currentDraggedEl.nextSibling !== firstStatic) {
        groupEl.insertBefore(currentDraggedEl, firstStatic);
        updateLayoutDiffHighlight();
      }
    };
    groupEl.ondrop = (event) => {
      if (!isLayoutEditMode || !currentDraggedEl) return;
      event.preventDefault();
      selectedLayoutPresetKey = 'custom';
      applyPresetSelectionVisual();
      renderLayoutItemControls();
      updateLayoutDiffHighlight();
    };
    const items = Array.from(groupEl.children).filter((child) => child.getAttribute('data-layout-item'));
    items.forEach((item, index) => {
      const itemId = item.getAttribute('data-layout-item');
      if (!itemId) return;
      item.classList.add('is-layout-draggable');
      item.ondragover = (event) => {
        if (!isLayoutEditMode || !currentDraggedEl) return;
        event.preventDefault();
        if (currentDraggedEl === item) return;
        item.classList.add('is-drop-target');
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
        if (!isLayoutEditMode || !currentDraggedEl) return;
        selectedLayoutPresetKey = 'custom';
        applyPresetSelectionVisual();
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
      const transferBtn = document.createElement('button');
      transferBtn.type = 'button';
      transferBtn.className = 'layout-item-move layout-item-transfer';
      const activeGroups = getCurrentLayoutColumnWidth().count === 3 ? LAYOUT_GROUP_KEYS : ['calc', 'info'];
      const groupIndex = activeGroups.indexOf(groupKey);
      const targetGroupKey = activeGroups[(Math.max(0, groupIndex) + 1) % activeGroups.length];
      const targetGroupLabel = targetGroupKey === 'calc' ? 'lewej kolumny' : targetGroupKey === 'info' ? 'środkowej kolumny' : 'trzeciej kolumny';
      transferBtn.textContent = targetGroupKey === 'calc' ? '←' : '→';
      transferBtn.setAttribute('aria-label', `Przenieś do ${targetGroupLabel}`);
      transferBtn.setAttribute('title', `Przenieś do ${targetGroupLabel}`);
      transferBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        moveLayoutItemToGroup(itemId, targetGroupKey);
      });
      const spanBtn = document.createElement('button');
      spanBtn.type = 'button';
      spanBtn.className = 'layout-item-move layout-item-span';
      const currentSpan = String(item.dataset.layoutSpan || DEFAULT_LAYOUT_SPANS[itemId] || '1');
      const safeSpan = LAYOUT_SPAN_VALUES.includes(currentSpan) ? currentSpan : '1';
      spanBtn.textContent = safeSpan === '2' ? '2x' : '1x';
      spanBtn.setAttribute('aria-label', safeSpan === '2' ? 'Zwiń do jednej kolumny' : 'Rozciągnij na dwie kolumny');
      spanBtn.setAttribute('title', safeSpan === '2' ? 'Zwiń do jednej kolumny' : 'Rozciągnij na dwie kolumny');
      spanBtn.hidden = !LAYOUT_SPAN_ITEMS.has(itemId);
      spanBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const spans = getCurrentLayoutSpans();
        spans[itemId] = spans[itemId] === '2' ? '1' : '2';
        preserveLayoutEditScroll(() => {
          selectedLayoutPresetKey = 'custom';
          applyPresetSelectionVisual();
          applyLayoutSpans(spans);
          renderLayoutItemControls();
          updateLayoutDiffHighlight();
        });
      });
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'layout-item-move layout-item-toggle-visibility';
      const isVisible = !item.classList.contains('is-user-hidden');
      toggleBtn.textContent = isVisible ? 'Ukryj' : 'Pokaż';
      toggleBtn.setAttribute('aria-label', isVisible ? 'Ukryj sekcję' : 'Pokaż sekcję');
      toggleBtn.setAttribute('title', isVisible ? 'Ukryj sekcję' : 'Pokaż sekcję');
      toggleBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const visibility = getCurrentLayoutVisibility();
        visibility[itemId] = !visibility[itemId];
        selectedLayoutPresetKey = 'custom';
        applyPresetSelectionVisual();
        applyLayoutVisibility(visibility, { forceShowAll: true });
        renderLayoutItemControls();
        updateLayoutDiffHighlight();
      });
      const colorBtn = document.createElement('button');
      colorBtn.type = 'button';
      colorBtn.className = 'layout-item-move layout-item-color';
      colorBtn.textContent = 'Tło';
      const currentTint = String(item.dataset.layoutTint || '');
      colorBtn.dataset.tint = currentTint;
      colorBtn.setAttribute('aria-label', 'Zmień kolor sekcji');
      colorBtn.setAttribute('title', `Kolor: ${LAYOUT_TINT_LABELS[currentTint] || LAYOUT_TINT_LABELS['']}`);
      colorBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const colors = getCurrentLayoutColors();
        const nextTint = getNextLayoutTint(colors[itemId] || '');
        colors[itemId] = nextTint;
        selectedLayoutPresetKey = 'custom';
        applyPresetSelectionVisual();
        applyLayoutColors(colors);
        renderLayoutItemControls();
        updateLayoutDiffHighlight();
      });
      controls.append(handle, upBtn, downBtn, transferBtn, spanBtn, toggleBtn, colorBtn);
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
  const wasEnabled = isLayoutEditMode;
  isLayoutEditMode = !!enabled;
  document.body.classList.toggle('layout-edit-mode', isLayoutEditMode);
  if (layoutEditBar) {
    layoutEditBar.hidden = !isLayoutEditMode;
  }
  if (isLayoutEditMode) {
    watchLayoutEditBarSpace();
  } else {
    unwatchLayoutEditBarSpace();
  }
  if (layoutCustomizeBtn) {
    layoutCustomizeBtn.classList.toggle('is-active', isLayoutEditMode);
  }
  if (isLayoutEditMode) {
    preEditLayoutOrder = getCurrentLayoutOrder();
    preEditLayoutVisibility = getCurrentLayoutVisibility();
    preEditLayoutColors = getCurrentLayoutColors();
    preEditLayoutSpans = getCurrentLayoutSpans();
    preEditLayoutColumnWidth = getCurrentLayoutColumnWidth();
    preEditLayoutPresetKey = selectedLayoutPresetKey;
    applyLayoutVisibility(preEditLayoutVisibility, { forceShowAll: true });
    renderLayoutItemControls();
    updateLayoutDiffHighlight();
    applyPresetSelectionVisual();
    showMainToast('Tryb edycji układu aktywny.', 'info');
    if (!wasEnabled) {
      logActivity('layout-edit', {
        action: 'enter',
        preset: selectedLayoutPresetKey || 'custom',
        order: preEditLayoutOrder,
        visibility: preEditLayoutVisibility,
        spans: preEditLayoutSpans,
        columnWidth: preEditLayoutColumnWidth
      });
    }
    return;
  }
  currentDraggedItem = null;
  removeLayoutItemControls();
  applyLayoutVisibility(getCurrentLayoutVisibility());
}

window.addEventListener('resize', () => {
  if (isLayoutEditMode) {
    updateLayoutEditBarSpace();
  }
});

function closeLayoutResetModal(result) {
  if (!layoutResetModal) return;
  layoutResetModal.style.display = 'none';
  if (layoutResetModalResolver) {
    layoutResetModalResolver(!!result);
    layoutResetModalResolver = null;
  }
}

function askLayoutResetConfirmation() {
  if (!layoutResetModal) return Promise.resolve(false);
  layoutResetModal.style.display = 'flex';
  return new Promise((resolve) => {
    layoutResetModalResolver = resolve;
  });
}

function getFieldElement(source) {
  const map = {
    netto: 'plnNetto',
    brutto: 'plnBrutto',
    ebayPrice: 'ebayPrice',
    vatRate: 'vatRate',
    exchangeRate: 'exchangeRate',
    commission: 'commission',
    purchaseAmount: 'purchaseAmount',
    currentBaseMultiplier: 'currentBaseMultiplier',
    minMarkup: 'minMarkup',
    targetSaleAmount: 'targetSaleAmount'
  };
  const id = map[source] || source;
  return document.getElementById(id);
}

function parseNumber(value) {
  return window.CalculatorCore?.parseNumber
    ? window.CalculatorCore.parseNumber(value)
    : (() => {
      const parsed = parseFloat(String(value ?? '').replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : NaN;
    })();
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

const autoLinkedFieldValues = {
  purchaseAmount: '',
  targetSaleAmount: ''
};
let lastPrimarySource = null;
let markupPriceSource = null;
let saleCalcSource = 'minMarkup';

function rememberMarkupSource(source) {
  if (source === 'minMarkup' || source === 'targetSaleAmount' || source === 'ebayPrice') {
    saleCalcSource = source;
  }
}

function canAutoUpdateField(inputId) {
  const inputEl = document.getElementById(inputId);
  if (!inputEl) return false;
  const value = inputEl.value || '';
  return value === '' || value === autoLinkedFieldValues[inputId];
}

function setAutoLinkedFieldValue(inputId, value) {
  const inputEl = document.getElementById(inputId);
  if (!inputEl) return false;
  const nextValue = value || '';
  if (!canAutoUpdateField(inputId)) return false;
  inputEl.value = nextValue;
  autoLinkedFieldValues[inputId] = nextValue;
  return true;
}

function getPurchaseBruttoForMarkup() {
  const purchase = parseNumber(document.getElementById('purchaseAmount')?.value);
  if (!Number.isFinite(purchase) || purchase <= 0) return NaN;
  return window.CalculatorCore.amountToBrutto(purchase, isPurchaseNetMode(), getClientVatRateFraction());
}

function formatSaleInputFromBrutto(saleBrutto) {
  if (!Number.isFinite(saleBrutto) || saleBrutto <= 0) return '';
  const saleValue = window.CalculatorCore.bruttoToInputAmount(saleBrutto, isMarkupSaleNetMode(), getClientVatRateFraction());
  return saleValue.toFixed(2);
}

function syncTargetSaleFromMinSale(minSalePlnBrutto, options = {}) {
  const inputEl = document.getElementById('targetSaleAmount');
  if (!inputEl) return false;
  if (document.activeElement === inputEl && options.allowActiveOverwrite !== true) return false;
  const formatted = formatSaleInputFromBrutto(minSalePlnBrutto);
  const updated = options.force
    ? (() => {
      inputEl.value = formatted;
      autoLinkedFieldValues.targetSaleAmount = formatted;
      window.CalculatorUI.flashRecalculatedField(inputEl);
      return true;
    })()
    : setAutoLinkedFieldValue('targetSaleAmount', formatted);
  return updated;
}

function getTargetSaleBrutto() {
  const sale = parseNumber(document.getElementById('targetSaleAmount')?.value);
  if (!Number.isFinite(sale) || sale < 0) return NaN;
  return window.CalculatorCore.amountToBrutto(sale, isMarkupSaleNetMode(), getClientVatRateFraction());
}

function setMarkupPercentFromSaleBrutto(saleBrutto) {
  const markupEl = document.getElementById('minMarkup');
  const purchaseBrutto = getPurchaseBruttoForMarkup();
  if (!markupEl || !Number.isFinite(purchaseBrutto) || purchaseBrutto <= 0 || !Number.isFinite(saleBrutto)) return false;
  const markupPercent = window.CalculatorCore.markupPercent(purchaseBrutto, saleBrutto);
  markupEl.value = markupPercent.toFixed(2);
  window.CalculatorUI.flashRecalculatedField(markupEl);
  return true;
}

function getSaleBruttoFromEbay() {
  const ebaySale = parseNumber(document.getElementById('ebayPrice')?.value);
  const exchangeRate = parseNumber(document.getElementById('exchangeRate')?.value);
  const commissionRaw = getActiveCommissionRate();
  const commission = Number.isFinite(commissionRaw) ? commissionRaw / 100 : NaN;
  return window.CalculatorCore.saleBruttoFromEbay(ebaySale, exchangeRate, commission);
}

function syncTargetSaleFromEbay(options = {}) {
  const saleBrutto = getSaleBruttoFromEbay();
  if (!Number.isFinite(saleBrutto)) return false;
  const formatted = formatSaleInputFromBrutto(saleBrutto);
  const inputEl = document.getElementById('targetSaleAmount');
  if (!inputEl) return false;
  if (document.activeElement === inputEl && options.allowActiveOverwrite !== true) return false;
  if (options.force !== true && !canAutoUpdateField('targetSaleAmount')) return false;
  inputEl.value = formatted;
  autoLinkedFieldValues.targetSaleAmount = formatted;
  window.CalculatorUI.flashRecalculatedField(inputEl);
  setMarkupPercentFromSaleBrutto(saleBrutto);
  return true;
}

function getSaleBruttoForCurrentSource() {
  const state = window.CalculatorUI.readMarkupState(document, getActiveCommissionRate);
  const source = window.CalculatorCore.resolveMarkupSource({
    ...state,
    lastSource: saleCalcSource
  });
  if (source) rememberMarkupSource(source);
  return window.CalculatorCore.calculateSaleBruttoFromMarkupSource(source, state);
}

function syncMarkupSourceFields() {
  const saleBrutto = getSaleBruttoForCurrentSource();
  if (!Number.isFinite(saleBrutto)) return;
  if (saleCalcSource === 'minMarkup') {
    syncTargetSaleFromMinSale(saleBrutto, { force: true });
    syncEbayPriceFromTargetSale({ force: true });
  } else if (saleCalcSource === 'targetSaleAmount') {
    setMarkupPercentFromSaleBrutto(saleBrutto);
    syncEbayPriceFromTargetSale({ force: true });
  } else if (saleCalcSource === 'ebayPrice') {
    syncTargetSaleFromEbay({ force: true });
  }
}

function getSaleBruttoFromTargetSale() {
  const saleBrutto = getTargetSaleBrutto();
  if (Number.isFinite(saleBrutto)) return saleBrutto;
  return NaN;
}

function getSaleBruttoDisplayText(saleBrutto) {
  return Number.isFinite(saleBrutto) && saleBrutto >= 0
    ? `${saleBrutto.toFixed(2)} PLN`
    : '';
}

function syncEbayPriceFromTargetSale(options = {}) {
  if (markupPriceSource !== 'targetSaleAmount' && options.force !== true) return false;
  const ebayPriceInput = document.getElementById('ebayPrice');
  const currencyEl = document.getElementById('currency');
  if (!ebayPriceInput || !currencyEl) return false;

  const saleBrutto = getSaleBruttoFromTargetSale();
  const exchangeRate = parseNumber(document.getElementById('exchangeRate')?.value);
  const commissionRaw = getActiveCommissionRate();
  const commission = Number.isFinite(commissionRaw) ? commissionRaw / 100 : NaN;
  if (!Number.isFinite(saleBrutto) || !Number.isFinite(exchangeRate) || exchangeRate <= 0 || !Number.isFinite(commission) || commission < 0) {
    return false;
  }

  const ebayPrice = window.CalculatorCore.ebayFromSaleBrutto(saleBrutto, exchangeRate, commission);
  ebayPriceInput.value = ebayPrice.toFixed(2);
  window.CalculatorUI.flashRecalculatedField(ebayPriceInput);
  originalEbayPrice = ebayPrice;
  originalCurrency = currencyEl.value;
  originalExchangeRate = exchangeRate;
  markupPriceSource = 'targetSaleAmount';
  return true;
}

function clearPrimaryPricingFields(source) {
  const sourceMap = {
    netto: 'plnNetto',
    brutto: 'plnBrutto',
    ebayPrice: 'ebayPrice'
  };
  const sourceId = sourceMap[source];
  const sourceEl = sourceId ? document.getElementById(sourceId) : null;
  if (!sourceEl || String(sourceEl.value || '').trim() !== '') return false;
  Object.values(sourceMap).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  originalEbayPrice = null;
  originalExchangeRate = null;
  updateMarkupCalculations();
  updateSummaryMetrics();
  return true;
}

function getActivePrimarySource() {
  if (document.activeElement === ebayPriceInputEl) return 'ebayPrice';
  if (document.activeElement === plnBruttoInput) return 'brutto';
  if (document.activeElement === plnNettoInput) return 'netto';
  return null;
}

function rememberPrimarySource(source) {
  if (source === 'netto' || source === 'brutto' || source === 'ebayPrice') {
    lastPrimarySource = source;
  }
}

function setInlineModeFromPreset(toggleId, toNetMode) {
  const toggleEl = document.getElementById(toggleId);
  if (!toggleEl || toggleEl.checked === toNetMode) return false;
  return applyAmountModeChange(toggleId, toNetMode, { history: false });
}

function applyPresetAmountModes(vat) {
  const vatValue = parseNumber(vat);
  const useNetMode = Number.isFinite(vatValue) && vatValue <= 0;
  const changed = [
    setInlineModeFromPreset('purchaseAmountNetToggle', useNetMode)
  ].some(Boolean);
  if (!changed) return;
  updatePurchaseAmountModeUI();
  updateMarkupAmountModeUI();
}

function isInlineModeNet(toggleId) {
  const toggleEl = document.getElementById(toggleId);
  return !!toggleEl?.checked;
}

function isPurchaseNetMode() {
  return isInlineModeNet('purchaseAmountNetToggle');
}

function getPurchaseAmountMode() {
  return isPurchaseNetMode() ? 'netto' : 'brutto';
}

function updateModeButton(toggleId, isNet) {
  const btn = document.querySelector(`.mode-inline-toggle[data-toggle="${toggleId}"]`);
  if (!btn) return;
  const labelEl = btn.querySelector('[data-mode-label]') || btn;
  labelEl.textContent = isNet ? 'netto' : 'brutto';
  btn.setAttribute('aria-pressed', isNet ? 'true' : 'false');
}

function updatePurchaseAmountModeUI() {
  const isNet = !!document.getElementById('purchaseAmountNetToggle')?.checked;
  updateModeButton('purchaseAmountNetToggle', isNet);
}

function getClientVatRateFraction() {
  const vatRateRaw = parseNumber(document.getElementById('vatRate')?.value);
  if (!Number.isFinite(vatRateRaw) || vatRateRaw < 0) return NaN;
  return vatRateRaw / 100;
}

function isMarkupPurchaseNetMode() {
  return isPurchaseNetMode();
}

function isMarkupSaleNetMode() {
  return isInlineModeNet('markupSaleNetToggle');
}

function getMarkupPurchaseMode() {
  return isMarkupPurchaseNetMode() ? 'netto' : 'brutto';
}

function getMarkupSaleMode() {
  return isMarkupSaleNetMode() ? 'netto' : 'brutto';
}

function applyAmountModeChange(toggleId, toNetMode, options = {}) {
  window.CalculatorUI.clearRecalculatedFields();
  const toggleEl = document.getElementById(toggleId);
  if (!toggleEl) return false;
  toggleEl.checked = !!toNetMode;

  if (toggleId === 'purchaseAmountNetToggle') {
    updatePurchaseAmountModeUI();
    updateMarkupAmountModeUI();
    updateMarkupCalculations();
    if (options.history !== false) addHistoryEntry('purchaseAmountMode');
    return true;
  }

  if (toggleId === 'markupSaleNetToggle') {
    updateMarkupAmountModeUI();
    const targetSaleValue = parseNumber(document.getElementById('targetSaleAmount')?.value);
    if (Number.isFinite(targetSaleValue) && !canAutoUpdateField('targetSaleAmount')) {
      rememberMarkupSource('targetSaleAmount');
      markupPriceSource = 'targetSaleAmount';
    }
    updateSaleMarkupOnly();
    if (options.history !== false) addHistoryEntry('markupAmountMode');
    return true;
  }

  return false;
}

function updateMarkupAmountModeUI() {
  const modeLabelEl = document.getElementById('markupAmountModeLabel');
  const purchaseIsNet = !!document.getElementById('purchaseAmountNetToggle')?.checked;
  const saleIsNet = !!document.getElementById('markupSaleNetToggle')?.checked;
  if (modeLabelEl) {
    modeLabelEl.textContent = `Tryb narzutu: zakup ${purchaseIsNet ? 'netto' : 'brutto'} / sprzedaż ${saleIsNet ? 'netto' : 'brutto'}`;
  }
  updateModeButton('markupSaleNetToggle', saleIsNet);
}

function normalizeCommissionRate(value, fallback = DEFAULT_COMMISSION_RATE) {
  const parsed = parseNumber(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(0, parsed));
}

function formatCommissionRate(value) {
  return normalizeCommissionRate(value).toFixed(1).replace(/\.0$/, '');
}

function getDefaultCommissionRate() {
  return normalizeCommissionRate(defaultCommissionRate);
}

function getActiveCommissionRate() {
  const commissionEl = document.getElementById('commission');
  return advancedOptionsToggle?.checked
    ? parseNumber(commissionEl?.value)
    : getDefaultCommissionRate();
}

function resetCommissionInputToDefault() {
  const commissionEl = document.getElementById('commission');
  if (!commissionEl) return;
  commissionEl.value = formatCommissionRate(getDefaultCommissionRate());
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
  const commissionRaw = getActiveCommissionRate();
  const commission = Number.isFinite(commissionRaw) ? commissionRaw / 100 : NaN;
  const currency = currencyEl.value || 'EUR';

  if (minSaleCurrencyLabelEl) minSaleCurrencyLabelEl.textContent = currency;

  if (!Number.isFinite(purchase) || purchase <= 0 || !Number.isFinite(markupPercent) || markupPercent <= -100) {
    minSalePlnEl.textContent = '—';
    minSaleEbayEl.textContent = '—';
    return;
  }

  const saleBrutto = getSaleBruttoForCurrentSource();
  if (!Number.isFinite(saleBrutto)) {
    minSalePlnEl.textContent = '—';
    minSaleEbayEl.textContent = '—';
    return;
  }

  minSalePlnEl.textContent = `${saleBrutto.toFixed(2)} PLN`;

  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0 || !Number.isFinite(commission) || commission < 0) {
    minSaleEbayEl.textContent = '—';
    return;
  }

  const minSaleEbay = window.CalculatorCore.ebayFromSaleBrutto(saleBrutto, exchangeRate, commission);
  minSaleEbayEl.textContent = `${minSaleEbay.toFixed(2)} ${currency}`;
}

function updateMarkupFromSale() {
  const resultEl = document.getElementById('calculatedMarkup');
  const netProfitEl = document.getElementById('calculatedNetProfit');
  const resultFromEbayEl = document.getElementById('calculatedMarkupFromEbay');
  const netProfitFromEbayEl = document.getElementById('calculatedNetProfitFromEbay');
  if (!resultEl) return;

  const state = window.CalculatorUI.readMarkupState(document, getActiveCommissionRate);
  if (!Number.isFinite(state.purchaseAmount) || state.purchaseAmount <= 0) {
    resultEl.textContent = '—';
    if (netProfitEl) netProfitEl.textContent = '—';
    if (resultFromEbayEl) resultFromEbayEl.textContent = '—';
    if (netProfitFromEbayEl) netProfitFromEbayEl.textContent = '—';
    return;
  }

  if (Number.isFinite(state.targetSaleAmount) && state.targetSaleAmount >= 0) {
    const saleSummary = window.CalculatorCore.calculateMarkupFromSale(
      state.purchaseAmount,
      state.targetSaleAmount,
      state.purchaseIsNet,
      state.saleIsNet,
      state.vatRate
    );
    resultEl.textContent = Number.isFinite(saleSummary.markupPercent) ? `${saleSummary.markupPercent.toFixed(2)}%` : '—';
    if (netProfitEl) {
      netProfitEl.textContent = Number.isFinite(saleSummary.profit) ? `${saleSummary.profit.toFixed(2)} PLN` : '—';
    }
  } else {
    resultEl.textContent = '—';
    if (netProfitEl) netProfitEl.textContent = '—';
  }

  if (resultFromEbayEl) {
    if (!Number.isFinite(state.ebayPrice) || state.ebayPrice < 0 || !Number.isFinite(state.exchangeRate) || state.exchangeRate <= 0 || !Number.isFinite(state.commission) || state.commission < 0) {
      resultFromEbayEl.textContent = '—';
      if (netProfitFromEbayEl) netProfitFromEbayEl.textContent = '—';
    } else {
      const ebaySummary = window.CalculatorCore.calculateMarkupFromEbay(
        state.purchaseAmount,
        state.ebayPrice,
        state.purchaseIsNet,
        state.exchangeRate,
        state.commission,
        state.vatRate
      );
      resultFromEbayEl.textContent = Number.isFinite(ebaySummary.markupPercent) ? `${ebaySummary.markupPercent.toFixed(2)}%` : '—';
      if (netProfitFromEbayEl) {
        netProfitFromEbayEl.textContent = Number.isFinite(ebaySummary.profit) ? `${ebaySummary.profit.toFixed(2)} PLN` : '—';
      }
    }
  }
}

function updateMarkupCalculations() {
  syncMarkupSourceFields();
  updateMinSaleByMarkup();
  updateMarkupFromSale();
  updateSummaryMetrics();
}

function updateSaleMarkupOnly() {
  syncMarkupSourceFields();
  updateMinSaleByMarkup();
  updateMarkupFromSale();
  updateSummaryMetrics();
}

function updateCommissionFromBaseMultiplier() {
  const baseMultiplierEl = document.getElementById('currentBaseMultiplier');
  const resultEl = document.getElementById('calculatedCommissionFromBase');
  if (!baseMultiplierEl || !resultEl) return;

  const baseState = window.CalculatorUI.readBaseState(document, getActiveCommissionRate);
  const baseMultiplier = baseState.currentBaseMultiplier;
  const exchangeRate = baseState.exchangeRate;
  const vatRate = baseState.vatRate;

  if (!Number.isFinite(baseMultiplier) || baseMultiplier <= 0 || !Number.isFinite(exchangeRate) || exchangeRate <= 0 || !Number.isFinite(vatRate) || vatRate < 0) {
    resultEl.textContent = '—';
    return;
  }

  const commission = window.CalculatorCore.commissionFromBaseMultiplier(baseMultiplier, exchangeRate, vatRate);
  if (!Number.isFinite(commission)) {
    resultEl.textContent = '—';
    return;
  }
  resultEl.textContent = `${(commission * 100).toFixed(2)}%`;
}

function setupAutoReplaceInput(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.addEventListener('focus', () => {
    requestAnimationFrame(() => {
      if (document.activeElement !== el) return;
      if ((el.value || '').trim().length === 0) return;
      try {
        el.select();
      } catch (_error) {
        // ignore
      }
    });
  });
}

function updateBaseMultiplier() {
  const multiplierEl = document.getElementById('baseMultiplierValue');
  const multiplierSummaryEl = document.getElementById('baseMultiplierSummaryValue');
  if (!multiplierEl) return;
  const baseState = window.CalculatorUI.readBaseState(document, getActiveCommissionRate);
  const exchangeRate = baseState.exchangeRate;
  const commission = baseState.commission;
  const vatRate = baseState.vatRate;

  if (!Number.isFinite(exchangeRate) || !Number.isFinite(commission) || !Number.isFinite(vatRate)) {
    multiplierEl.textContent = '—';
    multiplierEl.dataset.value = '';
    if (multiplierSummaryEl) multiplierSummaryEl.textContent = '—';
    updateCommissionFromBaseMultiplier();
    return;
  }

  const multiplierBrutto = window.CalculatorCore.baseMultiplier(exchangeRate, vatRate, commission);
  const formatted = multiplierBrutto.toFixed(4);
  multiplierEl.textContent = formatted;
  multiplierEl.dataset.value = formatted;
  if (multiplierSummaryEl) multiplierSummaryEl.textContent = formatted;
  updateCommissionFromBaseMultiplier();
}

function updateSummaryMetrics() {
  const primaryState = window.CalculatorUI.readPrimaryState(document, getActiveCommissionRate);
  const currency = primaryState.currency;
  const ebay = primaryState.ebayPrice;
  const brutto = primaryState.brutto;
  const netto = primaryState.netto;
  const exchangeRate = primaryState.exchangeRate;
  const minSaleEbayText = document.getElementById('minSaleEbay')?.textContent?.trim() || '—';
  const markupFromEbayText = document.getElementById('calculatedMarkupFromEbay')?.textContent?.trim() || '—';
  const directMarkupText = document.getElementById('calculatedMarkup')?.textContent?.trim() || '—';
  const markupText = markupFromEbayText !== '—' ? markupFromEbayText : directMarkupText;

  const summaryEbayPrice = document.getElementById('summaryEbayPrice');
  const summaryCurrency = document.getElementById('summaryCurrency');
  const summaryBruttoPrice = document.getElementById('summaryBruttoPrice');
  const summaryNettoPrice = document.getElementById('summaryNettoPrice');
  const summaryMinSale = document.getElementById('summaryMinSale');
  const summaryMarkup = document.getElementById('summaryMarkup');

  if (summaryEbayPrice) summaryEbayPrice.textContent = Number.isFinite(ebay) ? `${ebay.toFixed(2)} ${currency}` : '—';
  if (summaryCurrency) summaryCurrency.textContent = Number.isFinite(exchangeRate) ? `Kurs ${exchangeRate.toFixed(4)} ${currency}` : `Waluta ${currency}`;
  if (summaryBruttoPrice) summaryBruttoPrice.textContent = Number.isFinite(brutto) ? `${brutto.toFixed(2)} PLN` : '—';
  if (summaryNettoPrice) summaryNettoPrice.textContent = Number.isFinite(netto) ? `Netto ${netto.toFixed(2)} PLN` : 'Netto —';
  if (summaryMinSale) summaryMinSale.textContent = minSaleEbayText && minSaleEbayText !== '—' ? minSaleEbayText : '—';
  if (summaryMarkup) summaryMarkup.textContent = markupText && markupText !== '—' ? `Narzut eBay ${markupText}` : 'Narzut eBay —';
}

function openSearch(urlBase, query) {
  const trimmed = query.trim();
  if (!trimmed) return false;
  const url = `${urlBase}${encodeURIComponent(trimmed)}`;
  window.open(url, '_blank', 'noopener');
  return true;
}

function getDefaultSearchSourcesConfig() {
  return {
    version: 1,
    sources: [
      {
        id: 'google',
        name: 'Google',
        searchUrl: 'https://www.google.com/search?q={QUERY}',
        directUrl: '',
        directMode: 'off',
        variants: [{ id: 'default', label: 'Domyślnie', append: '', isDefault: true, resetAfterSearch: true }]
      },
      {
        id: 'allegro',
        name: 'Allegro',
        searchUrl: 'https://allegro.pl/kategoria/komputery?string={PN}',
        directUrl: '',
        directMode: 'off',
        variants: [{ id: 'default', label: 'Domyślnie', append: '', isDefault: true, resetAfterSearch: true }]
      },
      {
        id: 'ebay',
        name: 'eBay',
        searchUrl: 'https://www.ebay.com/sch/58058/i.html?_oac=1&_from=R40&_nkw={PN}',
        directUrl: '',
        directMode: 'off',
        variants: [
          { id: 'default', label: 'Domyślnie', append: '', isDefault: true, resetAfterSearch: true },
          { id: 'nearest', label: 'Nearest first', append: '&_sop=7', isDefault: false, resetAfterSearch: true }
        ]
      },
      {
        id: 'renewtech',
        name: 'Renewtech',
        icon: 'resources/icon-renewtech.webp',
        searchUrl: 'https://www.renewtech.pl/#{RENEWTECH_STATE}',
        directUrl: 'https://www.renewtech.pl/{VENDOR_SLUG}-{PN_SLUG}.html',
        directMode: 'auto',
        variants: [{ id: 'default', label: 'Domyślnie', append: '', isDefault: true, resetAfterSearch: true }]
      }
    ]
  };
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
  if (type === 'calc') {
    window.PN_MAPPINGS_API.log(type, meta);
    return;
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

function normalizeSearchText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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

function enforceFieldMax(inputEl) {
  if (!inputEl) return;
  const maxRaw = inputEl.getAttribute('max');
  if (!maxRaw) return;
  const maxValue = parseNumber(maxRaw);
  if (!Number.isFinite(maxValue)) return;
  const value = parseNumber(String(inputEl.value || '').replace(',', '.'));
  if (!Number.isFinite(value)) return;
  if (value > maxValue) {
    inputEl.value = String(maxValue);
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
defaultLayoutVisibility = getCurrentLayoutVisibility();
defaultLayoutColors = getCurrentLayoutColors();
defaultLayoutSpans = normalizeLayoutSpans(DEFAULT_LAYOUT_SPANS);
applyLayoutSpans(defaultLayoutSpans);
defaultLayoutColumnWidth = applyLayoutColumnWidth(DEFAULT_LAYOUT_COLUMN_PROFILE);
bindColumnResizer();
const savedLocalLayout = loadSavedLayoutFromLocal();
if (savedLocalLayout) {
  applyLayoutOrder(savedLocalLayout.order);
  applyLayoutVisibility(savedLocalLayout.visibility);
  applyLayoutColors(savedLocalLayout.colors);
  applyLayoutSpans(savedLocalLayout.spans);
  applyLayoutColumnWidth(savedLocalLayout.columnWidth);
}
loadGlobalLayoutPresets()
  .then((presets) => {
    globalLayoutPresets = Array.isArray(presets) ? presets : [];
    renderGlobalLayoutPresetButtons();
    const activeGlobalId = selectedLayoutPresetKey.startsWith('global:') ? selectedLayoutPresetKey.slice(7) : '';
    if (activeGlobalId) {
      const applied = applyGlobalPresetById(activeGlobalId);
      if (applied) {
        saveLayoutToLocal(getCurrentLayoutOrder(), getCurrentLayoutVisibility(), getCurrentLayoutColors(), getCurrentLayoutColumnWidth(), getCurrentLayoutSpans());
      }
    }
    applyPresetSelectionVisual();
  })
  .catch(() => {
    globalLayoutPresets = [];
    renderGlobalLayoutPresetButtons();
  });

if (layoutCustomizeBtn) {
  layoutCustomizeBtn.addEventListener('click', () => {
    if (topMenuLayoutGroup) {
      topMenuLayoutGroup.classList.remove('is-open');
    }
    if (isLayoutEditMode) {
      if (preEditLayoutOrder) {
        applyLayoutOrder(preEditLayoutOrder);
      }
      if (preEditLayoutVisibility) {
        applyLayoutVisibility(preEditLayoutVisibility);
      }
      if (preEditLayoutColors) {
        applyLayoutColors(preEditLayoutColors);
      }
      if (preEditLayoutSpans) {
        applyLayoutSpans(preEditLayoutSpans);
      }
      if (preEditLayoutColumnWidth !== null) {
        applyLayoutColumnWidth(preEditLayoutColumnWidth);
      }
      selectedLayoutPresetKey = preEditLayoutPresetKey || 'custom';
      applyPresetSelectionVisual();
      setLayoutEditMode(false);
      showMainToast('Anulowano zmiany układu.', 'info');
      return;
    }
    setLayoutEditMode(true);
  });
}

if (topMenuLayoutGroup && topMenuLayoutLink) {
  topMenuLayoutLink.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    topMenuLayoutGroup.classList.toggle('is-open');
  });

  document.addEventListener('click', (event) => {
    if (!topMenuLayoutGroup.classList.contains('is-open')) return;
    if (topMenuLayoutGroup.contains(event.target)) return;
    topMenuLayoutGroup.classList.remove('is-open');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    topMenuLayoutGroup.classList.remove('is-open');
  });
}

if (layoutSaveBtn) {
  layoutSaveBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const beforeOrder = preEditLayoutOrder || getCurrentLayoutOrder();
    const beforeVisibility = preEditLayoutVisibility || getCurrentLayoutVisibility();
    const beforeSpans = preEditLayoutSpans || getCurrentLayoutSpans();
    const beforeColumnWidth = preEditLayoutColumnWidth ?? getCurrentLayoutColumnWidth();
    const order = getCurrentLayoutOrder();
    const visibility = getCurrentLayoutVisibility();
    const colors = getCurrentLayoutColors();
    const spans = getCurrentLayoutSpans();
    const columnWidth = getCurrentLayoutColumnWidth();
    const changes = diffLayoutChanges(beforeOrder, beforeVisibility, order, visibility, beforeColumnWidth, columnWidth, beforeSpans, spans);
    saveLayoutToLocal(order, visibility, colors, columnWidth, spans);
    if (!selectedLayoutPresetKey) {
      selectedLayoutPresetKey = 'custom';
    }
    localStorage.setItem(INDEX_LAYOUT_ACTIVE_PRESET_KEY, selectedLayoutPresetKey);
    logActivity('layout-edit', {
      action: 'save',
      preset: selectedLayoutPresetKey || 'custom',
      before: { order: beforeOrder, visibility: beforeVisibility, spans: beforeSpans, columnWidth: beforeColumnWidth },
      after: { order, visibility, spans, columnWidth },
      changes
    });
    preEditLayoutOrder = order;
    preEditLayoutVisibility = visibility;
    preEditLayoutColors = colors;
    preEditLayoutSpans = spans;
    preEditLayoutColumnWidth = columnWidth;
    setLayoutEditMode(false);
    showMainToast('Układ zapisany lokalnie dla tego użytkownika.', 'ok');
  });
}

if (layoutResetBtn) {
  layoutResetBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const confirmed = await askLayoutResetConfirmation();
    if (!confirmed) return;
    if (!defaultLayoutOrder) return;
    applyLayoutOrder(defaultLayoutOrder);
    applyLayoutVisibility(defaultLayoutVisibility || {});
    applyLayoutColors(defaultLayoutColors || {});
    applyLayoutSpans(defaultLayoutSpans || {});
    applyLayoutColumnWidth(defaultLayoutColumnWidth);
    clearSavedLayoutLocal();
    selectedLayoutPresetKey = 'custom';
    localStorage.setItem(INDEX_LAYOUT_ACTIVE_PRESET_KEY, selectedLayoutPresetKey);
    preEditLayoutOrder = getCurrentLayoutOrder();
    preEditLayoutVisibility = getCurrentLayoutVisibility();
    preEditLayoutColors = getCurrentLayoutColors();
    preEditLayoutSpans = getCurrentLayoutSpans();
    preEditLayoutColumnWidth = getCurrentLayoutColumnWidth();
    setLayoutEditMode(false);
    showMainToast('Przywrócono domyślny układ.', 'ok');
  });
}

if (layoutResetModalClose) {
  layoutResetModalClose.addEventListener('click', () => closeLayoutResetModal(false));
}

if (layoutResetModalCancel) {
  layoutResetModalCancel.addEventListener('click', () => closeLayoutResetModal(false));
}

if (layoutResetModalConfirm) {
  layoutResetModalConfirm.addEventListener('click', () => closeLayoutResetModal(true));
}

if (layoutResetModal) {
  layoutResetModal.addEventListener('click', (event) => {
    if (event.target === layoutResetModal) closeLayoutResetModal(false);
  });
}

if (layoutGlobalPresetsEl) {
  layoutGlobalPresetsEl.addEventListener('click', (event) => {
    const button = event.target.closest('.layout-global-preset-btn');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const presetId = button.getAttribute('data-preset-id') || '';
    if (!presetId) return;
    const applied = applyGlobalPresetById(presetId);
    if (applied) {
      const presetName = globalLayoutPresets.find((item) => item.id === presetId)?.name || 'preset';
      showMainToast(`Zastosowano preset: ${presetName}.`, 'info');
    }
  });
}

if (layoutColumnModeBtn) {
  layoutColumnModeBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    preserveLayoutEditScroll(() => {
      const current = getCurrentLayoutColumnWidth();
      setLayoutColumnCount(current.count === 3 ? 2 : 3);
      selectedLayoutPresetKey = 'custom';
      localStorage.setItem(INDEX_LAYOUT_ACTIVE_PRESET_KEY, selectedLayoutPresetKey);
      applyPresetSelectionVisual();
      updateLayoutDiffHighlight();
      updateLayoutEditBarSpace();
    });
  });
}

if (layoutFitWindowBtn) {
  layoutFitWindowBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    preserveLayoutEditScroll(() => {
      const nextProfile = applyLayoutColumnWidth(getFitLayoutColumnProfile());
      selectedLayoutPresetKey = 'custom';
      localStorage.setItem(INDEX_LAYOUT_ACTIVE_PRESET_KEY, selectedLayoutPresetKey);
      applyPresetSelectionVisual();
      updateLayoutDiffHighlight();
      updateLayoutEditBarSpace();
      showMainToast(`${formatLayoutColumnRatio(nextProfile)} dopasowane do okna.`, 'info');
    });
  });
}

if (layoutExitBtn) {
  layoutExitBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (preEditLayoutOrder) {
      applyLayoutOrder(preEditLayoutOrder);
    }
    if (preEditLayoutVisibility) {
      applyLayoutVisibility(preEditLayoutVisibility);
    }
    if (preEditLayoutColors) {
      applyLayoutColors(preEditLayoutColors);
    }
    if (preEditLayoutSpans) {
      applyLayoutSpans(preEditLayoutSpans);
    }
    if (preEditLayoutColumnWidth !== null) {
      applyLayoutColumnWidth(preEditLayoutColumnWidth);
    }
    selectedLayoutPresetKey = preEditLayoutPresetKey || 'custom';
    applyPresetSelectionVisual();
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
  const primaryState = window.CalculatorUI.readPrimaryState(document, getActiveCommissionRate);
  const markupState = window.CalculatorUI.readMarkupState(document, getActiveCommissionRate);
  const netto = primaryState.netto;
  const brutto = primaryState.brutto;
  const ebayPrice = primaryState.ebayPrice;
  const purchaseAmount = markupState.purchaseAmount;
  const currentBaseMultiplier = parseNumber(document.getElementById('currentBaseMultiplier')?.value);
  const calculatedCommissionFromBaseText = document.getElementById('calculatedCommissionFromBase')?.textContent?.trim() || '—';
  const purchaseAmountMode = getPurchaseAmountMode();
  const vatRateRaw = parseNumber(document.getElementById('vatRate').value);
  const vatRate = markupState.vatRate;
  const purchaseAmountBrutto = window.CalculatorCore.amountToBrutto(purchaseAmount, markupState.purchaseIsNet, vatRate);
  const minMarkupPercent = markupState.markupPercent;
  const targetSaleAmount = markupState.targetSaleAmount;
  const targetSaleEbayAmount = markupState.ebayPrice;
  const markupPurchaseMode = getMarkupPurchaseMode();
  const markupSaleMode = getMarkupSaleMode();
  const markupAmountMode = `zakup: ${markupPurchaseMode}, sprzedaż: ${markupSaleMode}`;
  const markupPurchaseBrutto = purchaseAmountBrutto;
  const markupSaleBrutto = window.CalculatorCore.amountToBrutto(targetSaleAmount, markupState.saleIsNet, vatRate);
  const currency = primaryState.currency;
  const commissionRaw = getActiveCommissionRate();
  const exchangeRate = primaryState.exchangeRate;

  let sourceLabel = {
    netto: 'ERP netto',
    brutto: 'ERP brutto',
    vatRate: 'VAT',
    currency: 'Waluta',
    exchangeRate: 'Kurs',
    commission: 'Prowizja',
    purchaseAmount: 'Kwota zakupu',
    currentBaseMultiplier: 'Mnożnik Base → Prowizja',
    purchaseAmountMode: 'Tryb zakupu',
    minMarkup: 'Narzut',
    targetSaleAmount: 'Cena sprzedaży',
    ebayPrice: 'eBay',
    markupAmountMode: 'Tryb narzutu',
    preset: 'Preset'
  }[source] || 'Przeliczenie';

  const timestamp = new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const defaultDetails = [
    `Netto <span class="history-value">${formatCurrency(netto)}</span> PLN`,
    `Brutto <span class="history-value">${formatCurrency(brutto)}</span> PLN`,
    `eBay <span class="history-value">${formatCurrency(ebayPrice)}</span> ${currency}`
  ].join(' <span class="history-dot">•</span> ');
  const defaultMeta = [
    `VAT ${Number.isFinite(vatRateRaw) ? vatRateRaw.toFixed(1) : '-'}%`,
    `Prowizja ${Number.isFinite(commissionRaw) ? commissionRaw.toFixed(1) : '-'}%`,
    `Kurs 1 PLN = ${Number.isFinite(exchangeRate) ? exchangeRate.toFixed(4) : '-'} ${currency}`
  ].join(' <span class="history-dot">•</span> ');

  let details = defaultDetails;
  let meta = defaultMeta;

  const isMinMarkupSource = source === 'purchaseAmount' || source === 'minMarkup' || source === 'purchaseAmountMode';
  const isBaseCommissionSource = source === 'currentBaseMultiplier';
  const isSaleMarkupSource = source === 'targetSaleAmount' || source === 'ebayPrice' || source === 'markupAmountMode';
  if (isSaleMarkupSource) {
    sourceLabel = `${sourceLabel} (tryb: ${markupAmountMode})`;
  }

  if (isMinMarkupSource) {
    const minSalePlnText = document.getElementById('minSalePln')?.textContent?.trim() || '—';
    const minSaleEbayText = document.getElementById('minSaleEbay')?.textContent?.trim() || '—';
    details = [
      `Zakup (tryb: ${purchaseAmountMode}) <span class="history-value">${formatCurrency(purchaseAmount)}</span> PLN`,
      `Baza brutto <span class="history-value">${formatCurrency(purchaseAmountBrutto)}</span> PLN`,
      `Narzut <span class="history-value">${Number.isFinite(minMarkupPercent) ? minMarkupPercent.toFixed(2) : '-'}</span>%`,
      `Sprzedaż <span class="history-value">${minSalePlnText}</span>`
    ].join(' <span class="history-dot">•</span> ');
    meta = `eBay ${minSaleEbayText} <span class="history-dot">•</span> Kurs 1 PLN = ${Number.isFinite(exchangeRate) ? exchangeRate.toFixed(4) : '-'} ${currency} <span class="history-dot">•</span> Prowizja ${Number.isFinite(commissionRaw) ? commissionRaw.toFixed(1) : '-'}% <span class="history-dot">•</span> Tryb netto → brutto liczony wg VAT klienta`;
  } else if (isSaleMarkupSource) {
    const calculatedMarkupText = document.getElementById('calculatedMarkup')?.textContent?.trim() || '—';
    const calculatedNetProfitText = document.getElementById('calculatedNetProfit')?.textContent?.trim() || '—';
    const calculatedMarkupFromEbayText = document.getElementById('calculatedMarkupFromEbay')?.textContent?.trim() || '—';
    const calculatedNetProfitFromEbayText = document.getElementById('calculatedNetProfitFromEbay')?.textContent?.trim() || '—';
    details = [
      `Zakup (tryb: ${markupPurchaseMode}) <span class="history-value">${formatCurrency(purchaseAmount)}</span> PLN`,
      `Sprzedaż (tryb: ${markupSaleMode}) <span class="history-value">${formatCurrency(targetSaleAmount)}</span> PLN`,
      `Sprzedaż eBay <span class="history-value">${formatCurrency(targetSaleEbayAmount)}</span> ${currency}`,
      `Baza brutto <span class="history-value">${formatCurrency(markupPurchaseBrutto)}</span> / <span class="history-value">${formatCurrency(markupSaleBrutto)}</span> PLN`,
      `Narzut <span class="history-value">${calculatedMarkupText}</span>`,
      `Zysk <span class="history-value">${calculatedNetProfitText}</span>`,
      `Narzut z eBay <span class="history-value">${calculatedMarkupFromEbayText}</span>`,
      `Różnica z eBay <span class="history-value">${calculatedNetProfitFromEbayText}</span>`
    ].join(' <span class="history-dot">•</span> ');
    meta = `Wzór: (sprzedaż - zakup) / zakup × 100% <span class="history-dot">•</span> Konwersja netto/brutto wg VAT klienta`;
  } else if (isBaseCommissionSource) {
    details = [
      `Mnożnik Base <span class="history-value">${Number.isFinite(currentBaseMultiplier) ? currentBaseMultiplier.toFixed(4) : '-'}</span>`,
      `Wyliczona prowizja <span class="history-value">${calculatedCommissionFromBaseText}</span>`
    ].join(' <span class="history-dot">•</span> ');
    meta = `Kurs 1 PLN = ${Number.isFinite(exchangeRate) ? exchangeRate.toFixed(4) : '-'} ${currency} <span class="history-dot">•</span> VAT klienta ${Number.isFinite(vatRateRaw) ? vatRateRaw.toFixed(1) : '-'}%`;
  }

  const hasMainValues = Number.isFinite(netto) || Number.isFinite(brutto) || Number.isFinite(ebayPrice);
  const hasMinMarkupValues = Number.isFinite(purchaseAmount) || Number.isFinite(minMarkupPercent);
  const hasSaleMarkupValues = Number.isFinite(targetSaleAmount) || Number.isFinite(targetSaleEbayAmount);
  const hasBaseCommissionValues = Number.isFinite(currentBaseMultiplier);
  if (!hasMainValues && !hasMinMarkupValues && !hasSaleMarkupValues && !hasBaseCommissionValues) {
    return;
  }

  const signature = `${sourceLabel}|${details}|${meta}`;
  const signatureKey = String(source || 'default');
  if (signature === lastHistorySignatureBySource[signatureKey]) {
    return;
  }
  lastHistorySignature = signature;
  lastHistorySignatureBySource[signatureKey] = signature;
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
    purchaseAmount: Number.isFinite(purchaseAmount) ? purchaseAmount.toFixed(2) : null,
    currentBaseMultiplier: Number.isFinite(currentBaseMultiplier) ? currentBaseMultiplier.toFixed(4) : null,
    calculatedCommissionFromBase: calculatedCommissionFromBaseText,
    purchaseAmountMode,
    purchaseAmountBrutto: Number.isFinite(purchaseAmountBrutto) ? purchaseAmountBrutto.toFixed(2) : null,
    minMarkup: Number.isFinite(minMarkupPercent) ? minMarkupPercent.toFixed(2) : null,
    targetSaleAmount: Number.isFinite(targetSaleAmount) ? targetSaleAmount.toFixed(2) : null,
    targetSaleEbayAmount: Number.isFinite(targetSaleEbayAmount) ? targetSaleEbayAmount.toFixed(2) : null,
    markupAmountMode,
    markupPurchaseMode,
    markupSaleMode,
    markupPurchaseBrutto: Number.isFinite(markupPurchaseBrutto) ? markupPurchaseBrutto.toFixed(2) : null,
    markupSaleBrutto: Number.isFinite(markupSaleBrutto) ? markupSaleBrutto.toFixed(2) : null,
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

function scheduleHistoryLog(source, options = {}) {
  const force = !!options.force;
  if (!force && !hasValueChangedSinceLog(source)) return;
  if (historyTimers[source]) {
    clearTimeout(historyTimers[source]);
  }
  historyTimers[source] = setTimeout(() => {
    addHistoryEntry(source);
    historyTimers[source] = null;
  }, 700);
}

function flushHistoryLog(source, options = {}) {
  const force = !!options.force;
  if (historyTimers[source]) {
    clearTimeout(historyTimers[source]);
    historyTimers[source] = null;
  }
  if (!force && !hasFieldChanged(source)) return;
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
  if (!advancedOptionsToggle.checked) {
    resetCommissionInputToDefault();
    setFieldBaseline('commission');
  }
  hideSelfTestDetails();
  resyncPricingFromCurrentSource();
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
  const label = `${currency} (z VAT ${formatPercent(vatRateDisplay)}%)`
    .replace(/\s+/g, ' ')
    .trim();
  ebayCurrencyLabel.textContent = label;
}

// Clear button handler
document.getElementById('clearBtn').addEventListener('click', () => {
  window.CalculatorUI.clearRecalculatedFields();
  document.getElementById('plnNetto').value = '';
  document.getElementById('plnBrutto').value = '';
  document.getElementById('ebayPrice').value = '';
  document.getElementById('vatRate').value = '23';
  resetCommissionInputToDefault();
  document.getElementById('purchaseAmount').value = '';
  document.getElementById('currentBaseMultiplier').value = '';
  document.getElementById('calculatedCommissionFromBase').textContent = '—';
  autoLinkedFieldValues.purchaseAmount = '';
  const purchaseAmountNetToggle = document.getElementById('purchaseAmountNetToggle');
  if (purchaseAmountNetToggle) {
    purchaseAmountNetToggle.checked = false;
  }
  updatePurchaseAmountModeUI();
  document.getElementById('minMarkup').value = '';
  document.getElementById('targetSaleAmount').value = '';
  autoLinkedFieldValues.targetSaleAmount = '';
  const markupSaleNetToggle = document.getElementById('markupSaleNetToggle');
  if (markupSaleNetToggle) {
    markupSaleNetToggle.checked = false;
  }
  updateMarkupAmountModeUI();
  rememberMarkupSource('minMarkup');
  updateMarkupCalculations();
  document.getElementById('productId').value = '';
  document.getElementById('currency').value = 'EUR';
  document.getElementById('currencyLabel').innerText = 'EUR';
  updateEbayCurrencyLabel(); // Ensure label updates with default VAT 23%
  updateSummaryMetrics();
  advancedOptionsToggle.checked = false;
  advancedOptions.style.display = 'none';
  exchangeRateInput.disabled = true;
  lastChanged = null;
  lastPrimarySource = null;
  markupPriceSource = null;
  originalEbayPrice = null;
  originalCurrency = 'EUR';
  lastCurrency = 'EUR';
  hideSelfTestDetails();
  historyEntries.length = 0;
  renderHistory();
  fetchExchangeRate('EUR');
});

function syncFields(source) {
  window.CalculatorUI.clearRecalculatedFields();
  const vatRateInput = document.getElementById('vatRate');
  const resultDiv = document.getElementById('result');
  if (clearPrimaryPricingFields(source)) {
    resultDiv.innerHTML = '<span class="error">Wprowadź kwotę netto, brutto lub cenę na eBay, aby zobaczyć cenę końcową.</span>';
    resultDiv.classList.add('is-visible');
    return;
  }
  const primaryState = window.CalculatorUI.readPrimaryState(document, getActiveCommissionRate);
  const nettoValue = primaryState.netto;
  const bruttoValue = primaryState.brutto;
  const ebayValue = primaryState.ebayPrice;
  const vatInputValue = parseNumber(vatRateInput.value);
  const exchangeRate = primaryState.exchangeRate;
  const commission = primaryState.commission;
  const vatRate = primaryState.vatRate;

  // Validate negative inputs
  if (source === 'netto' && Number.isFinite(nettoValue) && nettoValue < 0) {
    resultDiv.innerHTML = '<span class="error">Kwota netto nie może być ujemna.</span>';
    updateSummaryMetrics();
    return;
  }
  if (source === 'brutto' && Number.isFinite(bruttoValue) && bruttoValue < 0) {
    resultDiv.innerHTML = '<span class="error">Kwota brutto nie może być ujemna.</span>';
    updateSummaryMetrics();
    return;
  }
  if (source === 'ebayPrice' && Number.isFinite(ebayValue) && ebayValue < 0) {
    resultDiv.innerHTML = '<span class="error">Cena na eBay nie może być ujemna.</span>';
    updateSummaryMetrics();
    return;
  }
  if (source === 'vatRate' && Number.isFinite(vatInputValue) && vatInputValue < 0) {
    resultDiv.innerHTML = '<span class="error">Stawka VAT nie może być ujemna.</span>';
    updateSummaryMetrics();
    return;
  }

  if (source === 'netto' && Number.isFinite(nettoValue)) {
    rememberPrimarySource(source);
    const { pricing } = window.CalculatorCore.calculatePrimaryFromSource(source, primaryState, exchangeRate, vatRate, commission);
    window.CalculatorUI.writePrimaryResult(document, pricing, { skip: ['netto', 'ebayPrice'] });
    if (validateInputs(exchangeRate, commission, vatRate, resultDiv)) {
      const finalPrice = pricing.ebay;
      window.CalculatorUI.writePrimaryResult(document, pricing, { skip: ['netto', 'brutto'] });
      originalEbayPrice = finalPrice;
      originalCurrency = document.getElementById('currency').value;
      originalExchangeRate = exchangeRate;
    }
  } else if (source === 'brutto' && Number.isFinite(bruttoValue)) {
    rememberPrimarySource(source);
    const { pricing } = window.CalculatorCore.calculatePrimaryFromSource(source, primaryState, exchangeRate, vatRate, commission);
    window.CalculatorUI.writePrimaryResult(document, pricing, { skip: ['brutto', 'ebayPrice'] });
    if (validateInputs(exchangeRate, commission, vatRate, resultDiv)) {
      const finalPrice = pricing.ebay;
      window.CalculatorUI.writePrimaryResult(document, pricing, { skip: ['netto', 'brutto'] });
      originalEbayPrice = finalPrice;
      originalCurrency = document.getElementById('currency').value;
      originalExchangeRate = exchangeRate;
    }
  } else if (source === 'ebayPrice' && Number.isFinite(ebayValue)) {
    rememberPrimarySource(source);
    if (validateInputs(exchangeRate, commission, vatRate, resultDiv)) {
      const { pricing } = window.CalculatorCore.calculatePrimaryFromSource(source, primaryState, exchangeRate, vatRate, commission);
      window.CalculatorUI.writePrimaryResult(document, pricing, { skip: ['ebayPrice'] });
      originalEbayPrice = ebayValue;
      originalCurrency = document.getElementById('currency').value;
      originalExchangeRate = exchangeRate;
    }
  } else if (source === 'vatRate' && Number.isFinite(vatInputValue)) {
    const vatRatePercent = Math.max(0, Math.min(100, vatInputValue));
    const nextVatRate = vatRatePercent / 100;
    vatRateInput.value = vatRatePercent.toString();
    updateEbayCurrencyLabel();
    if (validateInputs(exchangeRate, commission, nextVatRate, resultDiv)) {
      const sourceToSync = window.CalculatorCore.resolvePricingSource({
        netto: nettoValue,
        brutto: bruttoValue,
        ebayPrice: ebayValue,
        lastPrimarySource,
        activeSource: getActivePrimarySource()
      });
      const { pricing, skip } = window.CalculatorCore.calculatePrimaryFromSource(sourceToSync, primaryState, exchangeRate, nextVatRate, commission);
      if (!pricing) {
        resultDiv.innerHTML = '<span class="error">Wpisz kwotę netto, brutto lub eBay, aby przeliczyć cenę z nową stawką VAT.</span>';
        updateSummaryMetrics();
        return;
      }
      rememberPrimarySource(sourceToSync);
      window.CalculatorUI.writePrimaryResult(document, pricing, { skip });
      originalEbayPrice = Number.isFinite(pricing.ebay) ? pricing.ebay : ebayValue;
      originalCurrency = document.getElementById('currency').value;
      originalExchangeRate = exchangeRate;
    } else {
      resultDiv.innerHTML = '<span class="error">Wpisz poprawny kurs, prowizję i VAT, aby przeliczyć cenę.</span>';
      updateSummaryMetrics();
      return;
    }
  }

  calculatePrice();
}

function validateInputs(exchangeRate, commission, vatRate, resultDiv) {
  if (isNaN(exchangeRate) || exchangeRate <= 0) {
    resultDiv.innerHTML = '<span class="error">Kurs waluty musi być dodatni.</span>';
    updateSummaryMetrics();
    return false;
  }
  if (isNaN(commission) || commission < 0) {
    resultDiv.innerHTML = '<span class="error">Prowizja nie może być ujemna.</span>';
    updateSummaryMetrics();
    return false;
  }
  if (isNaN(vatRate) || vatRate < 0 || vatRate > 1) {
    resultDiv.innerHTML = '<span class="error">Stawka VAT musi być w przedziale 0-100%.</span>';
    updateSummaryMetrics();
    return false;
  }
  return true;
}

function calculatePrice() {
  const primaryState = window.CalculatorUI.readPrimaryState(document, getActiveCommissionRate);
  const { netto, brutto, ebayPrice, exchangeRate, commission, vatRate } = primaryState;
  const resultDiv = document.getElementById('result');

  if (!validateInputs(exchangeRate, commission, vatRate, resultDiv)) {
    return;
  }

  updateBaseMultiplier();
  updateMinSaleByMarkup();
  updateMarkupFromSale();
  updateSummaryMetrics();

  let resultHTML = ``;

  if (isNaN(netto) && isNaN(brutto) && isNaN(ebayPrice)) {
    resultDiv.innerHTML = `<span class="error">Wprowadź kwotę netto, brutto lub cenę na eBay, aby zobaczyć cenę końcową.</span>`;
    resultDiv.classList.add('is-visible');
    updateSummaryMetrics();
    return;
  }

  resultDiv.innerHTML = resultHTML;
  resultDiv.classList.toggle('is-visible', resultHTML.trim().length > 0);
}

function applyPreset(currency, vat) {
  isPresetApplied = true;
  const sourceBeforePreset = getSourceForPricingParamChange();
  applyPresetAmountModes(vat);
  document.getElementById('currency').value = currency;
  document.getElementById('vatRate').value = parseNumber(vat).toString();
  document.getElementById('currencyLabel').innerText = currency;
  const label = `${currency} (z VAT ${formatPercent(parseNumber(vat))}%)`
    .replace(/\s+/g, ' ')
    .trim();
  ebayCurrencyLabel.textContent = label;
  resyncPricingFromCurrentSource(sourceBeforePreset || 'vatRate');
  fetchExchangeRate(currency);
}

function convertEbayPrice(newRate) {
  if (originalEbayPrice === null || isNaN(originalEbayPrice) || originalExchangeRate === null) return null;
  return (originalEbayPrice / originalExchangeRate) * newRate;
}

function updateEbayPriceFromNettoOrBrutto() {
  const primaryState = window.CalculatorUI.readPrimaryState(document, getActiveCommissionRate);
  const { exchangeRate, commission, vatRate } = primaryState;
  const source = window.CalculatorCore.resolvePricingSource({
    ...primaryState,
    lastPrimarySource,
    lastChanged,
    activeSource: getActivePrimarySource()
  });

  if ((source === 'netto' || source === 'brutto') && validateInputs(exchangeRate, commission, vatRate, document.getElementById('result'))) {
    const { pricing, skip } = window.CalculatorCore.calculatePrimaryFromSource(source, primaryState, exchangeRate, vatRate, commission);
    window.CalculatorUI.writePrimaryResult(document, pricing, { skip });
    rememberPrimarySource(source);
  }
}

function fetchExchangeRate(currency, options = {}) {
  const exchangeInfo = document.getElementById('exchangeInfo');
  const exchangeRateTooltip = document.getElementById('exchangeRateTooltip');
  const exchangeRateInp = document.getElementById('exchangeRate');
  const ebayPriceInput = document.getElementById('ebayPrice');
  const rateSourceSelect = document.getElementById('rateSource');
  const providerKey = window.RateService.normalizeProviderKey(rateSourceSelect?.value || window.RateService.DEFAULT_PROVIDER);
  const provider = window.RateService.getProvider(providerKey).provider;
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
    updateMarkupCalculations();

    if (convertEbayPriceNeeded) {
      const newEbayPrice = convertEbayPrice(rate);
      if (newEbayPrice !== null) {
        ebayPriceInput.value = newEbayPrice.toFixed(2);
        if (originalCurrency === currency) {
          ebayPriceInput.value = originalEbayPrice.toFixed(2);
        }
        window.CalculatorUI.flashRecalculatedField(ebayPriceInput);
        lastChanged = 'ebayPrice';
        syncFields('ebayPrice');
      }
    } else if (updateFromNettoOrBrutto) {
      updateEbayPriceFromNettoOrBrutto();
      syncFields(lastChanged);
    } else if (Number.isFinite(ebayPriceValue) && lastChanged === 'ebayPrice') {
      syncFields('ebayPrice');
    } else if (isPresetApplied) {
      resyncPricingFromCurrentSource();
      addHistoryEntry('preset');
    } else if (lastChanged === 'vatRate') {
      syncFields('vatRate');
    } else {
      calculatePrice();
    }
    isPresetApplied = false;
  };

  const fetchRateFrom = window.RateService.createFetchRate(fetch);

  fetchRateFrom(providerKey, currency)
    .then(({ rate, label }) => {
      applyRate(rate, label, providerKey);
    })
    .catch(() => {
      const fallbackProviderKey = window.RateService.getFallbackProviderKey(providerKey);
      if (fallbackProviderKey) {
        fetchRateFrom(fallbackProviderKey, currency)
          .then(({ rate, label }) => {
            applyRate(rate, label, fallbackProviderKey);
            if (notify) {
              showMainToast(`Źródło ${provider.label} niedostępne. Użyto ${label}.`, 'warn');
            }
          })
          .catch(error => {
            console.error('Błąd pobierania kursu:', error);
            const fallbackRate = window.RateService.getDefaultRate(currency);
            const nowFallback = new Date();
            exchangeRateInp.value = fallbackRate.toFixed(4);
            currentExchangeRate = fallbackRate;
            exchangeInfo.innerText = `Błąd pobierania kursu. Użyto domyślnego kursu PLN/${currency}: ${fallbackRate.toFixed(4)}`;
            if (exchangeRateTooltip) {
              const inverse = 1 / fallbackRate;
              exchangeRateTooltip.setAttribute('data-tooltip', `Kurs ${currency}/PLN: ${inverse.toFixed(4)} • domyślny (${nowFallback.toLocaleString('pl-PL')})`);
            }
            if (notify) {
              showMainToast(`Błąd pobierania kursu. Użyto domyślnego.`, 'warn');
            }
            updateBaseMultiplier();
            updateMarkupCalculations();
            calculatePrice();
            isPresetApplied = false;
          });
        return;
      }
      const fallbackRate = window.RateService.getDefaultRate(currency);
      const nowFallback = new Date();
      exchangeRateInp.value = fallbackRate.toFixed(4);
      currentExchangeRate = fallbackRate;
      exchangeInfo.innerText = `Błąd pobierania kursu. Użyto domyślnego kursu PLN/${currency}: ${fallbackRate.toFixed(4)}`;
      if (exchangeRateTooltip) {
        const inverse = 1 / fallbackRate;
        exchangeRateTooltip.setAttribute('data-tooltip', `Kurs ${currency}/PLN: ${inverse.toFixed(4)} • domyślny (${nowFallback.toLocaleString('pl-PL')})`);
      }
      if (notify) {
        showMainToast(`Błąd pobierania kursu. Użyto domyślnego.`, 'warn');
      }
      updateBaseMultiplier();
      updateMarkupCalculations();
      calculatePrice();
      isPresetApplied = false;
    });
}

function applyRateProviderSelection(value, options = {}) {
  const rateSourceSelect = document.getElementById('rateSource');
  if (!rateSourceSelect) return;
  const providerKey = window.RateService.normalizeProviderKey(value);
  rateSourceSelect.value = providerKey;
  if (options.persist !== false) {
    localStorage.setItem(RATE_PROVIDER_DEFAULT_CACHE_KEY, providerKey);
  }
}

function renderRateProviderOptions() {
  const rateSourceSelect = document.getElementById('rateSource');
  const statusRow = document.getElementById('rateStatusRow');
  if (!rateSourceSelect || !window.RateService?.getProviderOptions) return;
  const current = rateSourceSelect.value || window.RateService.DEFAULT_PROVIDER;
  const options = window.RateService.getProviderOptions();
  rateSourceSelect.innerHTML = options
    .map((item) => `<option value="${item.id}">${item.label}</option>`)
    .join('');
  rateSourceSelect.value = window.RateService.normalizeProviderKey(current);
  if (statusRow) {
    statusRow.innerHTML = options
      .map((item) => `<span class="rate-status" data-provider="${item.id}"><span class="dot"></span>${item.label}</span>`)
      .join('');
  }
}

function normalizeRateProvidersConfig(raw) {
  const incoming = raw && typeof raw === 'object' ? raw : {};
  const providers = Array.isArray(incoming.providers) ? incoming.providers : [];
  return {
    version: Number(incoming.version) || 1,
    providers: providers.map((item) => ({
      id: String(item?.id || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, ''),
      label: String(item?.label || item?.name || '').trim(),
      enabled: item?.enabled !== false,
      url: String(item?.url || '').trim(),
      responsePath: String(item?.responsePath || '').trim(),
      transform: String(item?.transform || 'direct').trim().toLowerCase() === 'inverse' ? 'inverse' : 'direct'
    })).filter((item) => item.id && item.url && item.responsePath)
  };
}

async function loadCustomRateProviders() {
  let config = null;
  const fromLocal = localStorage.getItem(RATE_PROVIDERS_CONFIG_CACHE_KEY);
  if (fromLocal) {
    try {
      config = normalizeRateProvidersConfig(JSON.parse(fromLocal));
      window.RateService.registerCustomProviders(config.providers);
      renderRateProviderOptions();
    } catch (_error) {
      // ignore local parse error
    }
  }
  if (!window.PN_MAPPINGS_API?.request) return;
  try {
    const response = await window.PN_MAPPINGS_API.request(`/notes?id=${encodeURIComponent(RATE_PROVIDERS_CONFIG_NOTE_ID)}`, { method: 'GET' });
    if (!response.ok) return;
    const payload = await response.json();
    const parsed = payload?.note ? JSON.parse(payload.note) : null;
    if (!parsed) return;
    config = normalizeRateProvidersConfig(parsed);
    window.RateService.registerCustomProviders(config.providers);
    localStorage.setItem(RATE_PROVIDERS_CONFIG_CACHE_KEY, JSON.stringify(config));
    renderRateProviderOptions();
  } catch (_error) {
    // fallback to built-in/local providers
  }
}

async function loadDefaultRateProviderSelection() {
  const localDefault = localStorage.getItem(RATE_PROVIDER_DEFAULT_CACHE_KEY);
  if (localDefault) {
    applyRateProviderSelection(localDefault, { persist: false });
  }
  if (!window.PN_MAPPINGS_API?.request) return;
  try {
    const response = await window.PN_MAPPINGS_API.request(`/notes?id=${encodeURIComponent(RATE_PROVIDER_DEFAULT_NOTE_ID)}`, { method: 'GET' });
    if (!response.ok) return;
    const payload = await response.json();
    const note = String(payload?.note || '').trim();
    if (!note) return;
    applyRateProviderSelection(note);
  } catch (_error) {
    // fallback to local/default value
  }
}

async function loadDefaultCommissionRate() {
  resetCommissionInputToDefault();
  if (!window.PN_MAPPINGS_API?.request) return;
  try {
    const response = await window.PN_MAPPINGS_API.request(`/notes?id=${encodeURIComponent(COMMISSION_DEFAULT_NOTE_ID)}`, { method: 'GET' });
    if (!response.ok) return;
    const payload = await response.json();
    const note = String(payload?.note || '').trim();
    if (!note) return;
    defaultCommissionRate = normalizeCommissionRate(note);
    if (!advancedOptionsToggle?.checked) {
      resetCommissionInputToDefault();
      setFieldBaseline('commission');
    }
    updateBaseMultiplier();
    updateMarkupCalculations();
    calculatePrice();
  } catch (_error) {
    // fallback to default 15%
  }
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
  window.RateService.getProviderKeys().forEach((key) => {
    const cached = rateStatusCache[key];
    if (cached && now - cached.ts < 60000) {
      updateRateStatusBadge(key, cached.status);
      return;
    }
    updateRateStatusBadge(key, 'loading');
    const provider = window.RateService.getProvider(key).provider;
    fetchWithTimeout(provider.buildUrl(currency), 5000)
      .then((resp) => {
        if (!resp.ok) throw new Error('status');
        return resp.json();
      })
      .then((data) => {
        const rate = window.RateService.readProviderRate(key, data, currency);
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

function openStockFromInput() {
  const productInput = document.getElementById('productId');
  if (!productInput) return;
  const productId = productInput.value;
  if (/^\d{1,6}$/.test(productId)) {
    const url = `https://stock/product/product/details/${productId}`;
    logActivity('stock-open', { productId, url });
    window.open(url, '_blank');
    productInput.value = '';
  } else {
    document.getElementById('result').innerHTML = '<span class="error">ID produktu musi być liczbą od 1 do 6 cyfr.</span>';
  }
}

// STOCK URL button handler
document.getElementById('stockUrlBtn').addEventListener('click', () => {
  openStockFromInput();
});

document.getElementById('productId').addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  openStockFromInput();
});

const plnNettoInput = document.getElementById('plnNetto');
const plnBruttoInput = document.getElementById('plnBrutto');
const ebayPriceInputEl = document.getElementById('ebayPrice');
const vatRateInputEl = document.getElementById('vatRate');
const currencySelectEl = document.getElementById('currency');
plnNettoInput.addEventListener('input', () => {
  lastChanged = 'netto';
  markupPriceSource = null;
  hideSelfTestDetails();
  enforceTwoDecimals(plnNettoInput);
  syncFields('netto');
  scheduleHistoryLog('netto');
});
plnNettoInput.addEventListener('focus', () => {
  setFieldBaseline('netto');
});
plnNettoInput.addEventListener('blur', () => {
  flushHistoryLog('netto');
});

plnBruttoInput.addEventListener('input', () => {
  lastChanged = 'brutto';
  markupPriceSource = null;
  hideSelfTestDetails();
  enforceTwoDecimals(plnBruttoInput);
  syncFields('brutto');
  scheduleHistoryLog('brutto');
});
plnBruttoInput.addEventListener('focus', () => {
  setFieldBaseline('brutto');
});
plnBruttoInput.addEventListener('blur', () => {
  flushHistoryLog('brutto');
});

ebayPriceInputEl.addEventListener('input', () => {
  lastChanged = 'ebayPrice';
  markupPriceSource = 'ebayPrice';
  rememberMarkupSource('ebayPrice');
  hideSelfTestDetails();
  enforceTwoDecimals(ebayPriceInputEl);
  syncFields('ebayPrice');
  updateMarkupCalculations();
  scheduleHistoryLog('ebayPrice');
});
ebayPriceInputEl.addEventListener('focus', () => {
  setFieldBaseline('ebayPrice');
});
ebayPriceInputEl.addEventListener('blur', () => {
  flushHistoryLog('ebayPrice');
});

vatRateInputEl.addEventListener('input', () => {
  lastChanged = 'vatRate';
  hideSelfTestDetails();
  syncFields('vatRate');
  updateBaseMultiplier();
  updateMarkupCalculations();
  scheduleHistoryLog('vatRate');
});
vatRateInputEl.addEventListener('focus', () => {
  setFieldBaseline('vatRate');
});
vatRateInputEl.addEventListener('blur', () => {
  flushHistoryLog('vatRate');
});

function getSourceForPricingParamChange() {
  const bruttoValue = parseNumber(plnBruttoInput.value);
  const nettoValue = parseNumber(plnNettoInput.value);
  const ebayValue = parseNumber(ebayPriceInputEl.value);
  return window.CalculatorCore.resolvePricingSource({
    netto: nettoValue,
    brutto: bruttoValue,
    ebayPrice: ebayValue,
    lastPrimarySource,
    lastChanged,
    activeSource: getActivePrimarySource()
  });
}

function resyncPricingFromCurrentSource(preferredSource = null) {
  const bruttoValue = parseNumber(plnBruttoInput.value);
  const nettoValue = parseNumber(plnNettoInput.value);
  const ebayValue = parseNumber(ebayPriceInputEl.value);
  const sourceToSync = window.CalculatorCore.resolvePricingSource({
    netto: nettoValue,
    brutto: bruttoValue,
    ebayPrice: ebayValue,
    preferredSource,
    lastPrimarySource,
    lastChanged,
    activeSource: getActivePrimarySource()
  });

  if (sourceToSync) {
    lastChanged = sourceToSync;
    rememberPrimarySource(sourceToSync);
    syncFields(sourceToSync);
  } else if (lastChanged === 'vatRate' && !isNaN(parseInt(vatRateInputEl.value, 10))) {
    syncFields('vatRate');
  } else {
    calculatePrice();
  }
  updateBaseMultiplier();
  updateMarkupCalculations();
  updateCommissionFromBaseMultiplier();
}

['exchangeRate', 'commission'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    hideSelfTestDetails();
    resyncPricingFromCurrentSource();
    scheduleHistoryLog(id);
  });
  document.getElementById(id).addEventListener('focus', () => {
    setFieldBaseline(id);
  });
  document.getElementById(id).addEventListener('blur', () => {
    flushHistoryLog(id);
  });
});

currencySelectEl.addEventListener('change', () => {
  const selectedCurrency = currencySelectEl.value;
  document.getElementById('currencyLabel').innerText = selectedCurrency;
  updateEbayCurrencyLabel();
  hideSelfTestDetails();
  fetchExchangeRate(selectedCurrency, { notify: false });
  checkRateProvidersStatus(selectedCurrency);
  updateMarkupCalculations();
  addHistoryEntry('currency');
});

['purchaseAmount', 'minMarkup'].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => {
    window.CalculatorUI.clearRecalculatedFields();
    enforceTwoDecimals(el);
    enforceFieldMax(el);
    if (id === 'minMarkup') {
      rememberMarkupSource('minMarkup');
    }
    updateMarkupCalculations();
    scheduleHistoryLog(id, { force: true });
  });
  el.addEventListener('change', () => {
    window.CalculatorUI.clearRecalculatedFields();
    enforceFieldMax(el);
    if (id === 'minMarkup') {
      rememberMarkupSource('minMarkup');
    }
    updateMarkupCalculations();
    flushHistoryLog(id, { force: true });
  });
  el.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    window.CalculatorUI.clearRecalculatedFields();
    if (id === 'minMarkup') {
      rememberMarkupSource('minMarkup');
    }
    updateMarkupCalculations();
    flushHistoryLog(id, { force: true });
  });
  el.addEventListener('focus', () => {
    setFieldBaseline(id);
  });
  el.addEventListener('blur', () => {
    flushHistoryLog(id, { force: true });
  });
});

const currentBaseMultiplierEl = document.getElementById('currentBaseMultiplier');
if (currentBaseMultiplierEl) {
  currentBaseMultiplierEl.addEventListener('input', () => {
    window.CalculatorUI.clearRecalculatedFields();
    updateCommissionFromBaseMultiplier();
    scheduleHistoryLog('currentBaseMultiplier');
  });
  currentBaseMultiplierEl.addEventListener('change', () => {
    window.CalculatorUI.clearRecalculatedFields();
    updateCommissionFromBaseMultiplier();
    flushHistoryLog('currentBaseMultiplier');
  });
  currentBaseMultiplierEl.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    window.CalculatorUI.clearRecalculatedFields();
    updateCommissionFromBaseMultiplier();
    flushHistoryLog('currentBaseMultiplier');
  });
  currentBaseMultiplierEl.addEventListener('focus', () => {
    setFieldBaseline('currentBaseMultiplier');
  });
  currentBaseMultiplierEl.addEventListener('blur', () => {
    flushHistoryLog('currentBaseMultiplier');
  });
}

const purchaseAmountNetToggle = document.getElementById('purchaseAmountNetToggle');
if (purchaseAmountNetToggle) {
  purchaseAmountNetToggle.addEventListener('change', () => {
    applyAmountModeChange('purchaseAmountNetToggle', purchaseAmountNetToggle.checked);
  });
}

const markupSaleNetToggle = document.getElementById('markupSaleNetToggle');
if (markupSaleNetToggle) {
  markupSaleNetToggle.addEventListener('change', () => {
    applyAmountModeChange('markupSaleNetToggle', markupSaleNetToggle.checked);
  });
}

document.addEventListener('click', (event) => {
  const btn = event.target.closest('.mode-inline-toggle');
  if (!btn) return;
  event.preventDefault();
  event.stopPropagation();
  const toggleId = btn.getAttribute('data-toggle');
  if (
    toggleId !== 'purchaseAmountNetToggle' &&
    toggleId !== 'markupSaleNetToggle'
  ) return;
  const toggleEl = document.getElementById(toggleId);
  if (!toggleEl) return;
  applyAmountModeChange(toggleId, !toggleEl.checked);
});

['targetSaleAmount'].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => {
    window.CalculatorUI.clearRecalculatedFields();
    rememberMarkupSource('targetSaleAmount');
    autoLinkedFieldValues.targetSaleAmount = '';
    markupPriceSource = 'targetSaleAmount';
    updateMarkupCalculations();
    scheduleHistoryLog(id, { force: true });
  });
  el.addEventListener('change', () => {
    window.CalculatorUI.clearRecalculatedFields();
    enforceTwoDecimals(el);
    enforceFieldMax(el);
    rememberMarkupSource('targetSaleAmount');
    autoLinkedFieldValues.targetSaleAmount = '';
    markupPriceSource = 'targetSaleAmount';
    updateMarkupCalculations();
    flushHistoryLog(id, { force: true });
  });
  el.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    window.CalculatorUI.clearRecalculatedFields();
    enforceTwoDecimals(el);
    enforceFieldMax(el);
    rememberMarkupSource('targetSaleAmount');
    autoLinkedFieldValues.targetSaleAmount = '';
    markupPriceSource = 'targetSaleAmount';
    updateMarkupCalculations();
    flushHistoryLog(id, { force: true });
  });
  el.addEventListener('focus', () => {
    setFieldBaseline(id);
  });
  el.addEventListener('blur', () => {
    enforceTwoDecimals(el);
    enforceFieldMax(el);
    flushHistoryLog(id, { force: true });
  });
});

['purchaseAmount', 'minMarkup', 'currentBaseMultiplier', 'targetSaleAmount'].forEach(setupAutoReplaceInput);

const refreshRateBtn = document.getElementById('refreshRateBtn');
if (refreshRateBtn) {
  refreshRateBtn.addEventListener('click', () => {
    fetchExchangeRate(document.getElementById('currency').value, { notify: true });
    addHistoryEntry('exchangeRate');
  });
}

const rateSourceSelect = document.getElementById('rateSource');
if (rateSourceSelect) {
  rateSourceSelect.addEventListener('change', () => {
    applyRateProviderSelection(rateSourceSelect.value);
    fetchExchangeRate(document.getElementById('currency').value, { notify: true });
    checkRateProvidersStatus(document.getElementById('currency').value);
  });
}

updateEbayCurrencyLabel();
updatePurchaseAmountModeUI();
updateMarkupAmountModeUI();
renderHistory();
updateMarkupCalculations();
updateCommissionFromBaseMultiplier();
updateSummaryMetrics();

(async () => {
  renderRateProviderOptions();
  await loadCustomRateProviders();
  await loadDefaultRateProviderSelection();
  await loadDefaultCommissionRate();
  const currency = document.getElementById('currency').value;
  fetchExchangeRate(currency, { notify: false });
  checkRateProvidersStatus(currency);
})();

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
  Object.keys(lastHistorySignatureBySource).forEach((key) => {
    delete lastHistorySignatureBySource[key];
  });
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
  let lastOpenedPnKey = '';
  let openedSourcesCurrentPn = new Set();
  let samePnSearchAttempts = 0;
  let mappingsRefreshTimer = null;
  let mappingsRefreshSeq = 0;
  let mappingsAppliedSeq = 0;
  let lastSyncedPnKey = '';
  const SEARCH_SOURCES_STORAGE_KEY = 'searchSources';
  const SEARCH_SOURCES_COOKIE_KEY = 'searchSources';
  const SEARCH_SOURCE_VARIANTS_STORAGE_KEY = 'searchSourceVariantsV1';
  const SEARCH_SOURCE_VARIANTS_COOKIE_KEY = 'searchSourceVariantsV1';
  const searchStatus = document.getElementById('searchStatus');
  const pnSuggestion = document.getElementById('pnSuggestion');
  const reportMappingBtn = document.getElementById('reportMappingBtn');
  const reportModal = document.getElementById('reportModal');
  const reportModalClose = document.getElementById('reportModalClose');
  const reportModalCancel = document.getElementById('reportModalCancel');
  const reportModalSubmit = document.getElementById('reportModalSubmit');
  const reportPendingFlushBtn = document.getElementById('reportPendingFlushBtn');
  const reportModalInfo = document.getElementById('reportModalInfo');
  const reportReason = document.getElementById('reportReason');
  const reportNonMapping = document.getElementById('reportNonMapping');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const searchSourcesContainer = document.getElementById('searchSources');
  const sourceInputMap = new Map();
  let searchSourcesConfig = getDefaultSearchSourcesConfig();
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
  const getSourcesState = () => {
    const state = {};
    sourceInputMap.forEach((inputEl, sourceId) => {
      state[sourceId] = !!inputEl?.checked;
    });
    return state;
  };
  const applySourcesState = (state) => {
    if (!state || typeof state !== 'object') return;
    sourceInputMap.forEach((inputEl, sourceId) => {
      if (!inputEl) return;
      if (typeof state[sourceId] === 'boolean') {
        inputEl.checked = state[sourceId];
      }
    });
  };
  const persistSourcesState = () => {
    const state = getSourcesState();
    const payload = JSON.stringify(state);
    localStorage.setItem(SEARCH_SOURCES_STORAGE_KEY, payload);
    setCookieValue(SEARCH_SOURCES_COOKIE_KEY, payload);
  };
  const readSavedVariantsState = () => {
    const raw = localStorage.getItem(SEARCH_SOURCE_VARIANTS_STORAGE_KEY) || getCookieValue(SEARCH_SOURCE_VARIANTS_COOKIE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_error) {
      return {};
    }
  };
  const persistVariantsState = (state) => {
    const payload = JSON.stringify(state && typeof state === 'object' ? state : {});
    localStorage.setItem(SEARCH_SOURCE_VARIANTS_STORAGE_KEY, payload);
    setCookieValue(SEARCH_SOURCE_VARIANTS_COOKIE_KEY, payload);
  };
  const setSavedVariantForSource = (sourceId, variantId) => {
    const state = readSavedVariantsState();
    if (!sourceId) return;
    if (variantId) {
      state[sourceId] = String(variantId);
    } else {
      delete state[sourceId];
    }
    persistVariantsState(state);
  };
  const readSavedSourcesState = () => {
    const raw = localStorage.getItem(SEARCH_SOURCES_STORAGE_KEY) || getCookieValue(SEARCH_SOURCES_COOKIE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  };
  const clearSearchStatus = () => {
    if (!searchStatus) return;
    searchStatus.textContent = '';
    searchStatus.classList.remove('is-warn');
  };
  const getSourceConfig = (id) => {
    const list = Array.isArray(searchSourcesConfig?.sources) ? searchSourcesConfig.sources : [];
    return list.find((item) => item?.id === id) || null;
  };
  const defaultSourceIcons = {
    google: 'resources/icon-google.svg',
    allegro: 'resources/icon-allegro.svg',
    ebay: 'resources/icon-ebay.svg',
    renewtech: 'resources/icon-renewtech.webp'
  };
  const syncSourceIconTheme = (iconEl, lightSrc, darkSrc) => {
    if (!iconEl) return;
    const nextLight = String(lightSrc || '').trim();
    const nextDark = String(darkSrc || '').trim();
    if (nextLight) {
      iconEl.dataset.lightSrc = nextLight;
    }
    if (nextDark) {
      iconEl.dataset.darkSrc = nextDark;
    } else {
      iconEl.removeAttribute('data-dark-src');
    }
    const isDark = document.body?.classList.contains('dark-mode');
    const finalSrc = isDark && nextDark
      ? nextDark
      : (nextLight || iconEl.getAttribute('src') || '');
    if (finalSrc) {
      iconEl.setAttribute('src', finalSrc);
    }
  };
  const applySourceVisuals = () => {
    sourceInputMap.forEach((inputEl, sourceId) => {
      if (!inputEl || !searchSourcesContainer) return;
      const label = inputEl.closest('.source-option');
      if (!label) return;
      const iconEl = label.querySelector('.source-icon');
      if (!iconEl) return;
      let placeholderEl = label.querySelector('.source-icon-placeholder');
      if (!placeholderEl) {
        placeholderEl = document.createElement('span');
        placeholderEl.className = 'source-icon-placeholder';
        placeholderEl.setAttribute('aria-hidden', 'true');
        label.appendChild(placeholderEl);
      }
      const cfg = getSourceConfig(sourceId);
      const sourceName = String(cfg?.name || sourceId || '').trim() || sourceId.toUpperCase();
      const iconRaw = String(cfg?.icon || '').trim();
      const iconDarkRaw = String(cfg?.iconDark || '').trim();
      const isPlaceholder = iconRaw.toUpperCase() === 'PLACEHOLDER';
      if (isPlaceholder) {
        label.classList.add('source-option-has-placeholder');
        iconEl.classList.add('is-hidden');
        placeholderEl.textContent = sourceName;
        placeholderEl.title = sourceName;
        return;
      }
      label.classList.remove('source-option-has-placeholder');
      iconEl.classList.remove('is-hidden');
      placeholderEl.textContent = '';
      placeholderEl.title = '';
      const fallbackIcon = defaultSourceIcons[sourceId] || iconEl.getAttribute('src') || '';
      const nextIcon = iconRaw || fallbackIcon;
      const nextDark = iconDarkRaw;
      syncSourceIconTheme(iconEl, nextIcon, nextDark);
    });
  };
  const getSourceSubmenu = (sourceId) => searchSourcesContainer?.querySelector(`.source-option-wrap-${sourceId} .source-submenu`);
  const renderSourceVariants = (sourceId, submenuEl, cfg) => {
    if (!submenuEl) return;
    const variants = Array.isArray(cfg?.variants) && cfg.variants.length
      ? cfg.variants
      : [{ id: 'default', label: 'Domyślnie', append: '', isDefault: true, resetAfterSearch: true }];
    submenuEl.innerHTML = variants.map((variant, index) => {
      const id = `sourceSort-${sourceId}-${index + 1}`;
      const checked = variant.isDefault || (!variants.some((v) => v.isDefault) && index === 0);
      return `
        <label class="source-submenu-option">
          <input type="radio" id="${id}" name="sourceSort-${sourceId}" value="${String(variant.id || '').replace(/"/g, '&quot;')}" data-reset="${variant.resetAfterSearch !== false ? '1' : '0'}" ${checked ? 'checked' : ''}>
          <span>${String(variant.label || variant.id || 'Wariant').replace(/</g, '&lt;')}</span>
        </label>
      `;
    }).join('');
    const savedVariants = readSavedVariantsState();
    const inputEl = sourceInputMap.get(sourceId);
    if (inputEl?.checked) {
      const savedVariant = String(savedVariants[sourceId] || '');
      if (savedVariant) {
        const savedRadio = Array.from(submenuEl.querySelectorAll(`input[name="sourceSort-${sourceId}"]`))
          .find((el) => String(el.value) === savedVariant);
        if (savedRadio) savedRadio.checked = true;
      }
    }
    submenuEl.querySelectorAll(`input[name="sourceSort-${sourceId}"]`).forEach((radio) => {
      radio.addEventListener('change', () => {
        clearSearchStatus();
        if (radio.checked) {
          setSavedVariantForSource(sourceId, radio.value);
        }
      });
    });
  };
  const renderSearchSourcesUI = () => {
    if (!searchSourcesContainer) return;
    sourceInputMap.clear();
    searchSourcesContainer.innerHTML = '';
    const sourceList = Array.isArray(searchSourcesConfig?.sources)
      ? searchSourcesConfig.sources.filter((item) => item?.enabled !== false)
      : [];
    sourceList.forEach((cfg) => {
      const sourceId = String(cfg?.id || '').trim().toLowerCase();
      if (!sourceId) return;
      const wrap = document.createElement('div');
      wrap.className = `source-option-wrap source-option-wrap-${sourceId}`;

      const label = document.createElement('label');
      label.className = 'source-option';
      label.dataset.sourceId = sourceId;
      label.title = String(cfg?.name || sourceId).trim() || sourceId;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `source-${sourceId}`;
      checkbox.checked = true;
      checkbox.addEventListener('change', () => {
        clearSearchStatus();
        if (checkbox.checked) {
          resetSourceVariantMode(sourceId);
          setSavedVariantForSource(sourceId, '');
        } else {
          setSavedVariantForSource(sourceId, '');
        }
        persistSourcesState();
      });

      const icon = document.createElement('img');
      icon.className = 'source-icon';
      icon.src = String(cfg?.icon || defaultSourceIcons[sourceId] || '');
      icon.alt = '';
      icon.setAttribute('aria-hidden', 'true');
      if (cfg?.iconDark) {
        icon.setAttribute('data-dark-src', String(cfg.iconDark));
      } else {
        icon.removeAttribute('data-dark-src');
      }

      label.append(checkbox, icon);
      wrap.appendChild(label);
      sourceInputMap.set(sourceId, checkbox);

      const hasVariants = Array.isArray(cfg?.variants) && cfg.variants.length > 1;
      if (hasVariants) {
        wrap.classList.add('source-option-wrap-has-submenu');
        const submenu = document.createElement('div');
        submenu.className = 'source-submenu';
        submenu.setAttribute('role', 'group');
        submenu.setAttribute('aria-label', `Opcje ${String(cfg?.name || sourceId)}`);
        wrap.appendChild(submenu);
        renderSourceVariants(sourceId, submenu, cfg);
      }

      searchSourcesContainer.appendChild(wrap);
    });
    applySourcesState(readSavedSourcesState() || {});
    persistSourcesState();
    applySourceVisuals();
  };
  const normalizeSearchSourcesConfig = (rawConfig) => {
    const defaults = getDefaultSearchSourcesConfig();
    const incoming = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    const list = Array.isArray(incoming.sources) ? incoming.sources : defaults.sources;
    const normalized = list
      .map((item) => {
        const id = String(item?.id || '').trim().toLowerCase();
        if (!id) return null;
        const def = defaults.sources.find((src) => src.id === id) || {};
        const directUrl = String(item?.directUrl ?? def.directUrl ?? '').trim();
        const icon = String(item?.icon ?? def.icon ?? '').trim();
        const iconDark = String(item?.iconDark ?? def.iconDark ?? '').trim();
        const modeRaw = String(item?.directMode || '').trim().toLowerCase();
        const inferredMode = directUrl && id === 'renewtech' ? 'auto' : (def.directMode || 'off');
        const directMode = ['off', 'auto', 'always'].includes(modeRaw) ? modeRaw : inferredMode;
        return {
          ...def,
          ...item,
          id,
          icon,
          iconDark,
          directUrl,
          directMode
        };
      })
      .filter(Boolean);
    return {
      version: Number(incoming.version) || 1,
      sources: normalized.length ? normalized : defaults.sources
    };
  };
  const loadSearchSourcesConfig = async () => {
    const fromLocal = localStorage.getItem(SEARCH_SOURCES_CONFIG_CACHE_KEY);
    if (fromLocal) {
      try {
        const parsed = JSON.parse(fromLocal);
        if (parsed && Array.isArray(parsed.sources) && parsed.sources.length) {
          searchSourcesConfig = normalizeSearchSourcesConfig(parsed);
        }
      } catch (_error) {
        // ignore local parse error
      }
    }
    if (!window.PN_MAPPINGS_API?.request) return;
    try {
      const resp = await window.PN_MAPPINGS_API.request(`/notes?id=${encodeURIComponent(SEARCH_SOURCES_CONFIG_NOTE_ID)}`, { method: 'GET' });
      if (!resp.ok) return;
      const payload = await resp.json();
      const parsed = payload?.note ? JSON.parse(payload.note) : null;
      if (parsed && Array.isArray(parsed.sources) && parsed.sources.length) {
        searchSourcesConfig = normalizeSearchSourcesConfig(parsed);
        localStorage.setItem(SEARCH_SOURCES_CONFIG_CACHE_KEY, JSON.stringify(searchSourcesConfig));
      }
    } catch (_error) {
      // fallback to local/default
    }
  };
  const getSourceVariantMode = (sourceId) => {
    const checked = getSourceSubmenu(sourceId)?.querySelector(`input[name="sourceSort-${sourceId}"]:checked`);
    return checked?.value || 'default';
  };
  const resetSourceVariantMode = (sourceId) => {
    const submenu = getSourceSubmenu(sourceId);
    const defaultRadio = submenu?.querySelector(`input[name="sourceSort-${sourceId}"][data-reset="1"]`)
      || submenu?.querySelector(`input[name="sourceSort-${sourceId}"]`);
    if (defaultRadio) defaultRadio.checked = true;
  };
  const getSourceVariantConfig = (sourceId) => {
    const cfg = getSourceConfig(sourceId);
    const variants = Array.isArray(cfg?.variants) ? cfg.variants : [];
    const variantId = getSourceVariantMode(sourceId);
    const variant = variants.find((v) => String(v?.id) === String(variantId))
      || variants.find((v) => v?.isDefault)
      || variants[0]
      || null;
    return variant;
  };
  const buildUrlFromTemplate = (template, values = {}) => {
    if (!template) return '';
    return String(template).replace(/\{([A-Z_]+)\}/g, (_match, token) => String(values[token] ?? ''));
  };
  const resolveSourceUrl = (cfg, templateValues, options = {}) => {
    const searchTemplate = cfg?.searchUrl || options.fallbackSearchUrl || '';
    const directTemplate = cfg?.directUrl || '';
    const modeRaw = String(cfg?.directMode || '').trim().toLowerCase();
    const mode = ['off', 'auto', 'always'].includes(modeRaw) ? modeRaw : 'off';
    const canUseDirect = options.canUseDirect === true;
    const searchUrl = buildUrlFromTemplate(searchTemplate, templateValues);
    const directUrl = buildUrlFromTemplate(directTemplate, templateValues);
    if (mode === 'always' && directUrl) {
      return { url: directUrl, usedDirect: true };
    }
    if (mode === 'auto' && canUseDirect && directUrl) {
      return { url: directUrl, usedDirect: true };
    }
    return { url: searchUrl, usedDirect: false };
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
    const query = normalizeSearchText(partNumberInput.value);
    const sources = Array.from(sourceInputMap.entries())
      .filter(([, inputEl]) => !!inputEl?.checked)
      .map(([sourceId]) => sourceId);
    if (!sources.length) {
      showMainToast('Wybierz minimum jedno źródło wyszukiwania.', 'warn');
      return false;
    }
    if (!query) {
      showMainToast('Wpisz Part Number, aby wyszukać.', 'warn');
      return false;
    }
    lastSearchQuery = query;
    clearSearchStatus();
    const vendor = normalizeSearchText(partNumberInput.dataset.suggestionVendor || '');
    let pn = query;
    if (vendor && pn.toLowerCase().startsWith(`${vendor.toLowerCase()} `)) {
      pn = normalizeSearchText(pn.slice(vendor.length));
    }
    if (!pn) pn = query;
    const currentPnKey = normalizePnValue(pn || query);
    const googleQuery = vendor
      ? `${vendor} ${pn}`
      : pn;
    const vendorSlug = vendor.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const pnSlug = (pn || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9-]/g, '');
    const renewtechState = encodeURIComponent(JSON.stringify({
      'hr-search': {
        search_term: pn || query,
        filters: [],
        sorting: [],
        offsets: { product: 42 }
      }
    }));
    const queryPlus = googleQuery
      .replace(/"/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join('+');

    const templateValues = {
      PN: encodeURIComponent(pn || query),
      PN_RAW: encodeURIComponent(partNumberInput.value || ''),
      QUERY: encodeURIComponent(googleQuery),
      QUERY_PLUS: queryPlus,
      VENDOR: encodeURIComponent(vendor || ''),
      VENDOR_SLUG: vendorSlug,
      PN_SLUG: pnSlug,
      RENEWTECH_STATE: renewtechState
    };
    const sourceVariantsUsed = {};
    const calledUrls = {};
    if (currentPnKey !== lastOpenedPnKey) {
      openedSourcesCurrentPn = new Set();
      lastOpenedPnKey = currentPnKey;
      samePnSearchAttempts = 0;
    }
    samePnSearchAttempts += 1;
    const bypassDuplicateLock = samePnSearchAttempts >= 3;
    const openedForPn = openedSourcesCurrentPn;
    const sourcesToOpen = bypassDuplicateLock
      ? sources
      : sources.filter((sourceId) => !openedForPn.has(sourceId));
    const sourcesToOpenSet = new Set(sourcesToOpen);
    let openedCount = 0;
    sources.forEach((sourceId) => {
      if (!sourcesToOpenSet.has(sourceId)) {
        calledUrls[sourceId] = {
          url: '',
          mode: 'skipped',
          variant: String(getSourceVariantConfig(sourceId)?.id || 'default'),
          reason: 'already-opened-for-pn'
        };
        return;
      }
      const cfg = getSourceConfig(sourceId) || {};
      let fallbackSearchUrl = cfg.searchUrl || 'https://www.google.com/search?q={QUERY}';
      if (sourceId === 'google') fallbackSearchUrl = 'https://www.google.com/search?q={QUERY}';
      if (sourceId === 'ebay') fallbackSearchUrl = 'https://www.ebay.com/sch/58058/i.html?_oac=1&_from=R40&_nkw={PN}';
      if (sourceId === 'allegro') fallbackSearchUrl = 'https://allegro.pl/kategoria/komputery?string={PN}';
      if (sourceId === 'renewtech') fallbackSearchUrl = 'https://www.renewtech.pl/#{RENEWTECH_STATE}';

      const variant = getSourceVariantConfig(sourceId);
      sourceVariantsUsed[sourceId] = String(variant?.id || 'default');
      const resolved = resolveSourceUrl(cfg, templateValues, {
        fallbackSearchUrl,
        canUseDirect: !!(vendorSlug && pnSlug)
      });
      let url = resolved.url || '';
      const append = String(variant?.append || '');
      if (append) url = `${url}${append}`;
      calledUrls[sourceId] = {
        url,
        mode: resolved.usedDirect ? 'direct' : 'search',
        variant: String(variant?.id || 'default')
      };
      if (url) {
        window.open(url, '_blank', 'noopener');
        openedCount += 1;
        openedForPn.add(sourceId);
      }
    });
    if (!openedCount) {
      showMainToast('Ten PN ma już otwarte wybrane źródła. Dodaj nowe źródło, aby otworzyć nową kartę.', 'info');
      return false;
    }
    if (currentPnKey) {
      openedSourcesCurrentPn = openedForPn;
    }
    if (!bypassDuplicateLock && openedCount < sources.length) {
      showMainToast('Pominięto źródła już wcześniej otwarte dla tego PN.', 'info');
    }
    logActivity('search', {
      query,
      sources,
      variants: sourceVariantsUsed,
      calledUrls
    });
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
  let lastSourcesRefreshAt = 0;
  const refreshSearchSourcesConfig = () => {
    const now = Date.now();
    if (now - lastSourcesRefreshAt < 10_000) return;
    lastSourcesRefreshAt = now;
    loadSearchSourcesConfig().finally(() => {
      renderSearchSourcesUI();
    });
  };
  refreshSearchSourcesConfig();
  window.addEventListener('focus', refreshSearchSourcesConfig);
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
  if (window.PN_MAPPINGS_API?.load) {
    window.PN_MAPPINGS_API.load().then(() => {
      updatePnSuggestion();
    }).catch(() => {});
  }

  const PENDING_REPORTS_KEY = 'pendingMappingReports';
  const PENDING_REPORTS_MAX = 50;
  let reportQueueFlushInProgress = false;

  function loadPendingReports() {
    try {
      const stored = JSON.parse(localStorage.getItem(PENDING_REPORTS_KEY) || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch (error) {
      return [];
    }
  }

  function savePendingReports(items) {
    try {
      localStorage.setItem(PENDING_REPORTS_KEY, JSON.stringify(items.slice(-PENDING_REPORTS_MAX)));
      return true;
    } catch (error) {
      // localStorage can fail in private mode; the submit flow still reports failure.
      return false;
    }
  }

  function queueReportPayload(payload) {
    const pending = loadPendingReports();
    const reportId = payload?.reportId || '';
    const exists = reportId && pending.some((item) => item?.payload?.reportId === reportId);
    if (!exists) {
      pending.push({ payload, queuedAt: new Date().toISOString() });
      return savePendingReports(pending);
    }
    return true;
  }

  async function sendReportPayload(payload) {
    if (!window.PN_MAPPINGS_API?.request) {
      throw new Error('Worker niedostępny');
    }
    const response = await window.PN_MAPPINGS_API.request('/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'mapping-report', meta: payload })
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}${text ? `: ${text}` : ''}`);
    }
  }

  async function flushPendingReports({ silent = false } = {}) {
    if (reportQueueFlushInProgress) return;
    const pending = loadPendingReports();
    if (!pending.length) return;
    reportQueueFlushInProgress = true;
    const remaining = [];
    let sent = 0;
    try {
      for (const item of pending) {
        const payload = item?.payload;
        if (!payload) continue;
        try {
          await sendReportPayload(payload);
          sent += 1;
        } catch (error) {
          remaining.push(item);
        }
      }
      savePendingReports(remaining);
      if (!silent && sent) {
        showMainToast(`Wysłano zaległe zgłoszenia: ${sent}.`, 'ok');
      }
      if (!silent && remaining.length) {
        showMainToast(`Nie wysłano ${remaining.length} zaległych zgłoszeń. Zostają lokalnie.`, 'warn');
      }
    } finally {
      reportQueueFlushInProgress = false;
    }
  }

  function updatePendingReportButton() {
    if (!reportPendingFlushBtn) return;
    const pendingCount = loadPendingReports().length;
    reportPendingFlushBtn.hidden = pendingCount === 0;
    reportPendingFlushBtn.textContent = pendingCount > 0 ? `Wyślij zaległe (${pendingCount})` : 'Wyślij zaległe';
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
      const pendingCount = loadPendingReports().length;
      reportModalInfo.innerHTML = `
        <div><strong>PN:</strong> ${query || '—'}</div>
        <div><strong>Sugestia:</strong> ${vendor || '—'} ${detail ? `(${detail})` : ''}</div>
        <div><strong>Źródło:</strong> ${source || '—'}</div>
        ${pendingCount ? `<div><strong>Zaległe lokalnie:</strong> ${pendingCount}</div>` : ''}
      `;
    }
    updatePendingReportButton();
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
  if (reportPendingFlushBtn) {
    reportPendingFlushBtn.addEventListener('click', async () => {
      reportPendingFlushBtn.disabled = true;
      try {
        await flushPendingReports({ silent: false });
        updatePendingReportButton();
      } finally {
        reportPendingFlushBtn.disabled = false;
      }
    });
  }
  if (reportModalSubmit) {
    reportModalSubmit.addEventListener('click', async () => {
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
      reportModalSubmit.disabled = true;
      try {
        await sendReportPayload(payload);
        showMainToast('Zgłoszenie wysłane do admina.', 'ok');
        closeReportModal();
      } catch (error) {
        const queued = queueReportPayload(payload);
        const pendingCount = loadPendingReports().length;
        if (queued) {
          showMainToast(`Nie udało się wysłać teraz. Zapisano lokalnie do ponowienia (${pendingCount}).`, 'warn');
          updatePendingReportButton();
        } else {
          showMainToast('Nie udało się wysłać zgłoszenia ani zapisać go lokalnie.', 'warn');
        }
        closeReportModal();
      } finally {
        reportModalSubmit.disabled = false;
      }
    });
  }
}
