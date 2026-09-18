/**
 * Optional, framework-neutral quick settings popover for browser hosts.
 * It stays outside the SVG/Canvas surface and is never part of exports.
 */
import { getChartCapability } from './capabilities.mjs';
import { contrastRatio, themeModes, themePalettes } from './theme.mjs';

const styleId = 'ichart-preferences-ui-style';
const messages = {
  'zh-CN': {
    title: '图表快捷设置', mode: '主题', palette: '配色', scale: '字号', automatic: '自动', defaultSize: '默认', small: '小', large: '大', extraLarge: '特大', legend: '图例', labels: '数据标签', grid: '网格线'
  },
  en: {
    title: 'Chart quick settings', mode: 'Theme', palette: 'Palette', scale: 'Font size', automatic: 'Auto', defaultSize: 'Default', small: 'Small', large: 'Large', extraLarge: 'Extra large', legend: 'Legend', labels: 'Data labels', grid: 'Grid lines'
  }
};

function option(label, value) { return `<option value="${value}">${label}</option>`; }
function safe(value) { return value == null ? '' : String(value); }
function localeKey(locale) {
  const requested = locale && locale !== 'auto' ? locale : document.documentElement.lang || navigator.language || 'en';
  const normalized = String(requested).toLowerCase();
  if (normalized === 'zh' || normalized.startsWith('zh-')) return 'zh-CN';
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  return 'en';
}

function ensureStyle() {
  if (typeof document === 'undefined' || document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `.ichart-preferences{position:absolute;top:8px;right:8px;left:8px;height:32px;z-index:20;pointer-events:none;font:12px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033}.ichart-preferences__button{position:absolute;top:0;right:0;display:grid;place-items:center;width:32px;height:32px;min-width:32px;min-height:32px;border:0;background:transparent;color:var(--ichart-preferences-icon-color,#172033);border-radius:7px;padding:0;pointer-events:auto;cursor:pointer;font-size:22px;line-height:1;text-shadow:0 1px 2px #0004}.ichart-preferences__panel{display:none;position:absolute;top:38px;right:0;width:min(320px,100%);padding:12px;border:0;border-radius:10px;background:#fff;pointer-events:auto;box-shadow:0 12px 30px #1720332b}.ichart-preferences[data-open="true"] .ichart-preferences__panel{display:block}.ichart-preferences__grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.ichart-preferences__field{display:grid;min-width:0;gap:3px;margin:0}.ichart-preferences__field>span{color:#475467}.ichart-preferences__field select{width:100%;min-width:0;height:32px;border:1px solid #c5cfdb;border-radius:6px;padding:4px 7px;background:#fff;color:inherit}.ichart-preferences__toggles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0}.ichart-preferences__toggle{display:flex;align-items:center;justify-content:center;gap:5px;min-height:32px;padding:5px 6px;color:#344054;cursor:pointer}.ichart-preferences__toggle input{width:auto;min-height:auto;margin:0;accent-color:#2563eb}@media(max-width:420px){.ichart-preferences__panel{width:min(288px,100%)}.ichart-preferences__grid,.ichart-preferences__toggles{grid-template-columns:1fr}.ichart-preferences__toggle{justify-content:flex-start}}`;
  document.head.appendChild(style);
}

export function mountChartSettings(chart, { container = chart?.container, locale = 'auto', title } = {}) {
  if (typeof document === 'undefined' || !chart || !container) return { valid: false, code: 'PREFERENCES_UI_UNAVAILABLE', message: 'Chart settings require a browser container.' };
  ensureStyle();
  const text = messages[localeKey(locale)], accessibleTitle = title || text.title, host = container;
  const capability = getChartCapability(chart.getSpec().type), supported = name => capability?.features?.[name] === 'supported';
  const visibleComponents = ['legend', 'labels', 'grid'].filter(supported);
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const root = document.createElement('div');
  root.className = 'ichart-preferences';
  root.dataset.open = 'false';
  const componentMarkup = visibleComponents.map(name => `<label class="ichart-preferences__toggle"><input type="checkbox" data-key="${name}"><span>${text[name]}</span></label>`).join('');
  root.innerHTML = `<button class="ichart-preferences__button" type="button" aria-expanded="false"><span aria-hidden="true">≡</span></button><div class="ichart-preferences__panel" role="dialog"><div class="ichart-preferences__grid"><label class="ichart-preferences__field"><span>${text.mode}</span><select data-key="mode">${themeModes.map(value => option(value === 'auto' ? text.automatic : value, value)).join('')}</select></label><label class="ichart-preferences__field"><span>${text.palette}</span><select data-key="palette">${themePalettes.map(value => option(value === 'auto' ? text.automatic : value, value)).join('')}</select></label><label class="ichart-preferences__field"><span>${text.scale}</span><select data-key="scale">${option(text.defaultSize, '1')}${option(text.small, '0.85')}${option(text.large, '1.15')}${option(text.extraLarge, '1.3')}</select></label></div>${componentMarkup ? `<div class="ichart-preferences__toggles">${componentMarkup}</div>` : ''}</div>`;
  const button = root.querySelector('.ichart-preferences__button'), panel = root.querySelector('.ichart-preferences__panel');
  button.setAttribute('aria-label', accessibleTitle); button.title = accessibleTitle; panel.setAttribute('aria-label', accessibleTitle);
  host.appendChild(root);
  const values = key => root.querySelector(`[data-key="${key}"]`);
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
  const close = () => { root.dataset.open = 'false'; button.setAttribute('aria-expanded', 'false'); };
  const updateIconColor = () => { const theme = chart.getTheme(), background = chart.getSpec().background || theme.background, darkRatio = contrastRatio('#172033', background), lightRatio = contrastRatio('#ffffff', background), color = darkRatio == null || lightRatio == null ? theme.text || '#172033' : darkRatio >= lightRatio ? '#172033' : '#ffffff'; button.style.setProperty('--ichart-preferences-icon-color', color); };
  const onPreferencesChange = () => { sync(); updateIconColor(); };
  const applyField = key => { try { chart.setPreferences(readField(key), { source: 'ui' }); } catch {} };
  const onToggle = () => { const open = root.dataset.open !== 'true'; root.dataset.open = String(open); button.setAttribute('aria-expanded', String(open)); if (open) sync(); };
  const onDocumentPointer = event => { if (!root.contains(event.target)) close(); };
  const onDocumentKey = event => { if (event.key === 'Escape') { close(); button.focus(); } };
  button.addEventListener('click', onToggle);
  root.querySelectorAll('select,input[data-key]').forEach(control => control.addEventListener('change', () => applyField(control.dataset.key)));
  document.addEventListener('pointerdown', onDocumentPointer);
  document.addEventListener('keydown', onDocumentKey);
  chart.on('preferenceschange', onPreferencesChange);
  chart.on('themechange', updateIconColor);
  sync();
  updateIconColor();
  return { valid: true, element: root, locale: localeKey(locale), destroy() { chart.off('preferenceschange', onPreferencesChange); chart.off('themechange', updateIconColor); document.removeEventListener('pointerdown', onDocumentPointer); document.removeEventListener('keydown', onDocumentKey); root.remove(); } };
}
