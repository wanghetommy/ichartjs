/**
 * Optional, framework-neutral quick settings popover for browser hosts.
 * It stays outside the SVG/Canvas surface and is never part of exports.
 */
import { getPreferenceCapabilities } from './capabilities.mjs';
import { contrastRatio } from './theme.mjs';

const styleId = 'ichart-preferences-ui-style';
const messages = {
  'zh-CN': { title: '图表快捷设置' },
  en: { title: 'Chart quick settings' }
};
const placements = ['right', 'top', 'bottom'];
let panelSequence = 0;

function option(label, value) { return `<option value="${value}">${label}</option>`; }
function optionMarkup(field) { return field.options.map(item => option(item.label, item.value == null ? 'auto' : item.value)).join(''); }
function safe(value) { return value == null ? '' : String(value); }
function localeKey(locale) {
  const requested = locale && locale !== 'auto' ? locale : document.documentElement.lang || navigator.language || 'en';
  const normalized = String(requested).toLowerCase();
  if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh-CN';
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  return 'en';
}

export function resolveChartSettingsPlacement(anchor, panel, viewport, preferredPlacements = placements, gap = 10, margin = 8) {
  const boundary = { left: (viewport.left || 0) + margin, top: (viewport.top || 0) + margin, right: (viewport.left || 0) + viewport.width - margin, bottom: (viewport.top || 0) + viewport.height - margin };
  const candidates = Object.fromEntries(placements.map(value => [value, chartSettingsPlacementCoordinates(anchor, panel, value, gap)]));
  const order = [...new Set(preferredPlacements.filter(value => placements.includes(value)))];
  if (!order.length) order.push(...placements);
  const fits = candidate => candidate.left >= boundary.left && candidate.top >= boundary.top && candidate.left + panel.width <= boundary.right && candidate.top + panel.height <= boundary.bottom;
  const selected = order.find(value => fits(candidates[value]));
  if (selected) return { placement: selected, ...candidates[selected], maxHeight: Math.max(120, boundary.bottom - candidates[selected].top), constrained: false };
  const placement = order.at(-1), candidate = candidates[placement], maximumLeft = Math.max(boundary.left, boundary.right - panel.width), maximumTop = Math.max(boundary.top, boundary.bottom - panel.height);
  const left = Math.max(boundary.left, Math.min(maximumLeft, candidate.left)), top = Math.max(boundary.top, Math.min(maximumTop, candidate.top));
  return { placement, left, top, maxHeight: Math.max(120, boundary.bottom - top), constrained: true };
}

export function chartSettingsPlacementCoordinates(anchor, panel, placement, gap = 10) {
  if (placement === 'right') return { left: anchor.right + gap, top: anchor.top };
  if (placement === 'top') return { left: anchor.right - panel.width, top: anchor.top - panel.height - gap };
  return { left: anchor.right - panel.width, top: anchor.bottom + gap };
}

export function isChartSettingsAnchorVisible(anchor, host, viewport) {
  const boundary = { left: viewport.left || 0, top: viewport.top || 0, right: (viewport.left || 0) + viewport.width, bottom: (viewport.top || 0) + viewport.height };
  const intersects = rect => rect && rect.right > boundary.left && rect.left < boundary.right && rect.bottom > boundary.top && rect.top < boundary.bottom;
  return intersects(host) && intersects(anchor);
}

function ensureStyle() {
  if (typeof document === 'undefined' || document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `.ichart-preferences{position:absolute;top:8px;right:8px;left:8px;height:32px;z-index:20;pointer-events:none;font:12px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033}.ichart-preferences__button{position:absolute;top:0;right:0;display:grid;place-items:center;width:32px;height:32px;min-width:32px;min-height:32px;border:0;background:transparent;color:var(--ichart-preferences-icon-color,#172033);border-radius:7px;padding:0;pointer-events:auto;cursor:pointer;font-size:22px;line-height:1;text-shadow:0 1px 2px #0004}.ichart-preferences__panel{display:none;position:fixed;z-index:10000;width:min(320px,calc(100vw - 16px));padding:12px;border:0;border-radius:10px;background:#fff;color:#172033;pointer-events:auto;overflow-y:auto;box-shadow:0 12px 30px #1720332b;font:12px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.ichart-preferences__panel[data-open="true"]{display:block}.ichart-preferences__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.ichart-preferences__field{display:grid;min-width:0;gap:3px;margin:0}.ichart-preferences__field>span{color:#475467}.ichart-preferences__field select{width:100%;min-width:0;height:32px;border:1px solid #c5cfdb;border-radius:6px;padding:4px 7px;background:#fff;color:inherit}.ichart-preferences__toggles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0}.ichart-preferences__toggle{display:flex;align-items:center;justify-content:center;gap:5px;min-height:32px;padding:5px 6px;color:#344054;cursor:pointer}.ichart-preferences__toggle input{width:auto;min-height:auto;margin:0;accent-color:#2563eb}@media(max-width:420px){.ichart-preferences__panel{width:min(288px,calc(100vw - 16px))}.ichart-preferences__grid,.ichart-preferences__toggles{grid-template-columns:1fr}.ichart-preferences__toggle{justify-content:flex-start}}`;
  document.head.appendChild(style);
}

export function mountChartSettings(chart, { container = chart?.container, locale = 'auto', title, placement = 'auto', preferredPlacements = placements } = {}) {
  if (typeof document === 'undefined' || !chart || !container) return { valid: false, code: 'PREFERENCES_UI_UNAVAILABLE', message: 'Chart settings require a browser container.' };
  ensureStyle();
  const resolvedLocale = localeKey(locale), text = messages[resolvedLocale], accessibleTitle = title || text.title, host = container;
  const capabilities = getPreferenceCapabilities(chart.getSpec().type, { locale: resolvedLocale }), fields = new Map(capabilities.fields.map(field => [field.path, field]));
  const modeField = fields.get('theme.mode'), paletteField = fields.get('theme.palette'), scaleField = fields.get('typography.scale');
  const visibleComponents = ['legend', 'labels', 'grid'].filter(name => fields.get(`components.${name}`)?.menu.visible);
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const root = document.createElement('div');
  root.className = 'ichart-preferences';
  root.dataset.open = 'false';
  const componentMarkup = visibleComponents.map(name => `<label class="ichart-preferences__toggle"><input type="checkbox" data-key="${name}"><span>${fields.get(`components.${name}`).label}</span></label>`).join('');
  root.innerHTML = `<button class="ichart-preferences__button" type="button" aria-expanded="false"><span aria-hidden="true">≡</span></button>`;
  const panel = document.createElement('div');
  panel.className = 'ichart-preferences__panel'; panel.id = `ichart-preferences-panel-${++panelSequence}`; panel.dataset.open = 'false'; panel.setAttribute('role', 'dialog');
  panel.innerHTML = `<div class="ichart-preferences__grid"><label class="ichart-preferences__field"><span>${modeField.label}</span><select data-key="mode">${optionMarkup(modeField)}</select></label><label class="ichart-preferences__field"><span>${paletteField.label}</span><select data-key="palette">${optionMarkup(paletteField)}</select></label><label class="ichart-preferences__field"><span>${scaleField.label}</span><select data-key="scale">${optionMarkup(scaleField)}</select></label></div>${componentMarkup ? `<div class="ichart-preferences__toggles">${componentMarkup}</div>` : ''}`;
  const button = root.querySelector('.ichart-preferences__button');
  button.setAttribute('aria-label', accessibleTitle); button.setAttribute('aria-controls', panel.id); button.title = accessibleTitle; panel.setAttribute('aria-label', accessibleTitle);
  host.appendChild(root);
  document.body.appendChild(panel);
  const values = key => panel.querySelector(`[data-key="${key}"]`);
  const readField = key => {
    const control = values(key), value = control?.type === 'checkbox' ? control.checked : control?.value;
    if (['mode', 'palette'].includes(key)) return { theme: { [key]: value === 'auto' ? null : value } };
    if (key === 'scale') return { typography: { scale: Number(value) } };
    if (visibleComponents.includes(key)) return { components: { [key]: Boolean(value) } };
    return {};
  };
  const sync = () => {
    const prefs = chart.getPreferences(), spec = chart.getSpec(), set = (key, value) => { if (values(key)) values(key).value = safe(value); };
    set('mode', prefs.theme?.mode || 'auto'); set('palette', prefs.theme?.palette || 'auto');
    const scaleControl = values('scale'), scale = Number(prefs.typography?.scale || 1), scaleValue = String(scale);
    scaleControl.querySelector('option[data-current]')?.remove();
    if (![...scaleControl.options].some(currentOption => currentOption.value === scaleValue)) { const currentOption = document.createElement('option'); currentOption.value = scaleValue; currentOption.textContent = `${Math.round(scale * 100)}%`; currentOption.dataset.current = 'true'; scaleControl.appendChild(currentOption); }
    scaleControl.value = scaleValue;
    if (values('legend')) values('legend').checked = spec.legend?.visible !== false;
    if (values('labels')) values('labels').checked = Boolean(spec.labels?.enabled);
    if (values('grid')) values('grid').checked = spec.grid?.visible !== false;
  };
  const close = () => { root.dataset.open = 'false'; panel.dataset.open = 'false'; button.setAttribute('aria-expanded', 'false'); };
  const placementOrder = placement === 'auto' ? preferredPlacements : [placement, ...preferredPlacements.filter(value => value !== placement)];
  const positionPanel = ({ preservePlacement = false } = {}) => {
    if (panel.dataset.open !== 'true') return;
    const visual = globalThis.visualViewport, viewport = { left: visual?.offsetLeft || 0, top: visual?.offsetTop || 0, width: visual?.width || globalThis.innerWidth, height: visual?.height || globalThis.innerHeight };
    const anchorRect = button.getBoundingClientRect();
    if (!isChartSettingsAnchorVisible(anchorRect, host.getBoundingClientRect(), viewport)) { close(); return; }
    const currentPlacement = panel.dataset.placement;
    if (preservePlacement && placements.includes(currentPlacement)) {
      const coordinates = chartSettingsPlacementCoordinates(anchorRect, panel.getBoundingClientRect(), currentPlacement);
      panel.style.left = `${Math.round(coordinates.left)}px`; panel.style.top = `${Math.round(coordinates.top)}px`;
      return;
    }
    panel.style.visibility = 'hidden'; panel.style.left = '0px'; panel.style.top = '0px'; panel.style.maxHeight = '';
    const result = resolveChartSettingsPlacement(anchorRect, panel.getBoundingClientRect(), viewport, placementOrder);
    panel.dataset.placement = result.placement; panel.dataset.constrained = String(result.constrained); panel.style.left = `${Math.round(result.left)}px`; panel.style.top = `${Math.round(result.top)}px`; panel.style.maxHeight = `${Math.floor(result.maxHeight)}px`; panel.style.visibility = 'visible';
  };
  const updateIconColor = () => { const theme = chart.getTheme(), background = chart.getSpec().background || theme.background, darkRatio = contrastRatio('#172033', background), lightRatio = contrastRatio('#ffffff', background), color = darkRatio == null || lightRatio == null ? theme.text || '#172033' : darkRatio >= lightRatio ? '#172033' : '#ffffff'; button.style.setProperty('--ichart-preferences-icon-color', color); };
  const onPreferencesChange = () => { sync(); updateIconColor(); positionPanel(); };
  const applyField = key => { try { chart.setPreferences(readField(key), { source: 'ui' }); } catch {} };
  const onToggle = () => { const open = root.dataset.open !== 'true'; root.dataset.open = String(open); panel.dataset.open = String(open); button.setAttribute('aria-expanded', String(open)); if (open) { sync(); positionPanel(); } };
  const onDocumentPointer = event => { if (!root.contains(event.target) && !panel.contains(event.target)) close(); };
  const onDocumentKey = event => { if (event.key === 'Escape') { close(); button.focus(); } };
  const onViewportResize = () => positionPanel();
  const onViewportScroll = () => positionPanel({ preservePlacement: true });
  button.addEventListener('click', onToggle);
  panel.querySelectorAll('select,input[data-key]').forEach(control => control.addEventListener('change', () => applyField(control.dataset.key)));
  document.addEventListener('pointerdown', onDocumentPointer);
  document.addEventListener('keydown', onDocumentKey);
  globalThis.addEventListener?.('resize', onViewportResize); globalThis.addEventListener?.('scroll', onViewportScroll, true); globalThis.visualViewport?.addEventListener?.('resize', onViewportResize); globalThis.visualViewport?.addEventListener?.('scroll', onViewportScroll);
  chart.on('preferenceschange', onPreferencesChange);
  chart.on('themechange', updateIconColor);
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onViewportResize); resizeObserver?.observe(host);
  sync();
  updateIconColor();
  return { valid: true, element: root, panel, locale: resolvedLocale, capabilities, destroy() { chart.off('preferenceschange', onPreferencesChange); chart.off('themechange', updateIconColor); document.removeEventListener('pointerdown', onDocumentPointer); document.removeEventListener('keydown', onDocumentKey); globalThis.removeEventListener?.('resize', onViewportResize); globalThis.removeEventListener?.('scroll', onViewportScroll, true); globalThis.visualViewport?.removeEventListener?.('resize', onViewportResize); globalThis.visualViewport?.removeEventListener?.('scroll', onViewportScroll); resizeObserver?.disconnect(); panel.remove(); root.remove(); } };
}
