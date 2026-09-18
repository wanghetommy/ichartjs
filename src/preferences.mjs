/**
 * Small, renderer-neutral preference contract shared by the Chart API,
 * interactive settings UI, and Agent integrations.
 */
import { themeModes, themePalettes, themePresets } from './theme.mjs';

export const preferenceVersion = '1.0';
export const preferenceDensities = ['compact', 'comfortable', 'spacious'];
export const preferenceTriStates = ['auto', true, false];
export const preferenceMotions = ['auto', 'full', 'reduced', 'off'];

export const defaultPreferences = Object.freeze({
  version: preferenceVersion,
  theme: Object.freeze({ mode: null, preset: null, palette: null }),
  typography: Object.freeze({ scale: 1 }),
  density: 'comfortable',
  components: Object.freeze({ legend: 'auto', labels: 'auto', grid: 'auto' }),
  branding: Object.freeze({ enabled: 'auto' }),
  motion: 'auto'
});

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

function merge(base, extra) {
  const result = clone(base) || {};
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) result[key] = merge(result[key], value);
    else if (value !== undefined) result[key] = clone(value);
  });
  return result;
}

function isPlainObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }

function diagnostic(code, path, message, expected, suggestion) {
  return { code, path, message, ...(expected === undefined ? {} : { expected }), ...(suggestion ? { suggestion } : {}) };
}

export function validatePreferences(input = {}, { partial = true } = {}) {
  const errors = [];
  if (!isPlainObject(input)) return { valid: false, errors: [diagnostic('INVALID_PREFERENCES', '', 'Preferences must be an object.', 'an object', 'Pass a preferences object.')], value: clone(defaultPreferences) };
  const theme = input.theme;
  if (theme !== undefined) {
    if (!isPlainObject(theme)) errors.push(diagnostic('INVALID_PREFERENCE_THEME', 'theme', 'Preferences theme must be an object.', 'an object'));
    else {
      if (theme.mode !== undefined && theme.mode !== null && !themeModes.includes(theme.mode)) errors.push(diagnostic('INVALID_PREFERENCE_THEME_MODE', 'theme.mode', `Unsupported preference theme mode: ${theme.mode}.`, themeModes));
      if (theme.preset !== undefined && theme.preset !== null && !themePresets.includes(theme.preset)) errors.push(diagnostic('INVALID_PREFERENCE_THEME_PRESET', 'theme.preset', `Unsupported preference theme preset: ${theme.preset}.`, themePresets));
      if (theme.palette !== undefined && theme.palette !== null && !themePalettes.includes(theme.palette)) errors.push(diagnostic('INVALID_PREFERENCE_THEME_PALETTE', 'theme.palette', `Unsupported preference theme palette: ${theme.palette}.`, themePalettes));
    }
  }
  const scale = input.typography?.scale;
  if (scale !== undefined && (!(Number.isFinite(Number(scale))) || Number(scale) < 0.75 || Number(scale) > 1.5)) errors.push(diagnostic('INVALID_PREFERENCE_SCALE', 'typography.scale', 'Typography scale must be between 0.75 and 1.5.', '0.75..1.5', 'Use 1 for the default size.'));
  if (input.density !== undefined && !preferenceDensities.includes(input.density)) errors.push(diagnostic('INVALID_PREFERENCE_DENSITY', 'density', `Unsupported density: ${input.density}.`, preferenceDensities));
  ['legend', 'labels', 'grid'].forEach(name => {
    const value = input.components?.[name];
    if (value !== undefined && !preferenceTriStates.includes(value)) errors.push(diagnostic('INVALID_PREFERENCE_COMPONENT', `components.${name}`, `${name} must be auto, true, or false.`, preferenceTriStates));
  });
  if (input.branding?.enabled !== undefined && !preferenceTriStates.includes(input.branding.enabled)) errors.push(diagnostic('INVALID_PREFERENCE_BRANDING', 'branding.enabled', 'branding.enabled must be auto, true, or false.', preferenceTriStates));
  if (input.motion !== undefined && !preferenceMotions.includes(input.motion)) errors.push(diagnostic('INVALID_PREFERENCE_MOTION', 'motion', `Unsupported motion preference: ${input.motion}.`, preferenceMotions));
  if (!partial && input.version !== undefined && input.version !== preferenceVersion) errors.push(diagnostic('UNSUPPORTED_PREFERENCE_VERSION', 'version', `Unsupported preference version: ${input.version}.`, preferenceVersion));
  return { valid: errors.length === 0, errors, value: normalizePreferences(input, { partial }) };
}

export function normalizePreferences(input = {}, { partial = false } = {}) {
  const source = isPlainObject(input) ? input : {};
  const normalized = partial ? {} : clone(defaultPreferences);
  if (source.theme && isPlainObject(source.theme)) {
    normalized.theme = merge(normalized.theme || {}, {
      mode: source.theme.mode === undefined ? (partial ? undefined : null) : source.theme.mode,
      preset: source.theme.preset === undefined ? (partial ? undefined : null) : source.theme.preset,
      palette: source.theme.palette === undefined ? (partial ? undefined : null) : source.theme.palette
    });
  }
  if (source.typography && isPlainObject(source.typography) && source.typography.scale !== undefined) normalized.typography = merge(normalized.typography || {}, { scale: Number(source.typography.scale) });
  if (source.density !== undefined) normalized.density = source.density;
  if (source.components && isPlainObject(source.components)) normalized.components = merge(normalized.components || {}, Object.fromEntries(['legend', 'labels', 'grid'].filter(name => source.components[name] !== undefined).map(name => [name, source.components[name]])));
  if (source.branding && isPlainObject(source.branding) && source.branding.enabled !== undefined) normalized.branding = merge(normalized.branding || {}, { enabled: source.branding.enabled });
  if (source.motion !== undefined) normalized.motion = source.motion;
  normalized.version = preferenceVersion;
  return normalized;
}

export function mergePreferences(...values) {
  return normalizePreferences(values.reduce((result, value) => merge(result, normalizePreferences(value, { partial: true })), {}));
}

function resolveStorage(storage) {
  if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') return storage;
  if (storage === 'localStorage' && typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
  return null;
}

function readState(storage, key) {
  if (!storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(key) || 'null');
    if (!isPlainObject(parsed)) return null;
    return { version: preferenceVersion, global: normalizePreferences(parsed.global), charts: isPlainObject(parsed.charts) ? Object.fromEntries(Object.entries(parsed.charts).map(([id, value]) => [id, normalizePreferences(value, { partial: true })])) : {} };
  } catch { return null; }
}

export function createPreferencesStore(options = {}) {
  const storage = resolveStorage(options.storage);
  const storageKey = options.storageKey || 'ichartjs:preferences:v1';
  const loaded = readState(storage, storageKey);
  let state = loaded || {
    version: preferenceVersion,
    global: normalizePreferences(options.global || {}),
    charts: Object.fromEntries(Object.entries(options.charts || {}).map(([id, value]) => [id, normalizePreferences(value, { partial: true })]))
  };
  const listeners = new Set();
  const persist = () => {
    if (!storage) return false;
    try { storage.setItem(storageKey, JSON.stringify(state)); return true; } catch { return false; }
  };
  const snapshot = () => clone(state);
  const notify = (scope, chartId, source, persisted) => {
    const payload = { type: 'change', scope, chartId: chartId || null, source: source || 'user', persisted, preferences: chartId ? getEffective(chartId) : clone(state.global), state: snapshot() };
    listeners.forEach(listener => listener(payload));
  };
  const getGlobal = () => clone(state.global);
  const getChart = chartId => clone(state.charts[String(chartId)] || {});
  const getEffective = chartId => mergePreferences(defaultPreferences, state.global, chartId == null ? {} : state.charts[String(chartId)] || {});
  const update = (scope, chartId, patch, { source = 'user', persist: shouldPersist = true } = {}) => {
    const checked = validatePreferences(patch, { partial: true });
    if (!checked.valid) { const error = new Error(checked.errors.map(item => item.message).join(' ')); error.code = 'INVALID_PREFERENCES'; error.details = checked.errors; throw error; }
    if (scope === 'global') state.global = mergePreferences(state.global, patch);
    else {
      const key = String(chartId || 'default');
      state.charts[key] = merge(state.charts[key] || {}, checked.value);
    }
    const persisted = shouldPersist ? persist() : false;
    notify(scope, chartId, source, persisted);
    return scope === 'global' ? getGlobal() : getEffective(chartId);
  };
  return {
    version: preferenceVersion,
    storageKey,
    getState: snapshot,
    getGlobal,
    getChart,
    getEffective,
    setGlobal(patch, options = {}) { return update('global', null, patch, options); },
    setChart(chartId, patch, options = {}) { return update('chart', chartId, patch, options); },
    reset({ scope = 'all', chartId, persist: shouldPersist = true, source = 'user' } = {}) {
      if (scope === 'all' || scope === 'global') state.global = normalizePreferences({});
      if (scope === 'all') state.charts = {};
      if (scope === 'chart' && chartId != null) delete state.charts[String(chartId)];
      const persisted = shouldPersist ? persist() : false;
      notify(scope, chartId, source, persisted);
      return chartId != null ? getEffective(chartId) : getGlobal();
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    persist,
    storage: storage ? 'localStorage' : 'memory'
  };
}

export function mergeThemePreference(theme, preferenceTheme = {}) {
  const patch = Object.fromEntries(['mode', 'preset', 'palette'].filter(key => preferenceTheme?.[key] != null).map(key => [key, preferenceTheme[key]]));
  if (!Object.keys(patch).length) return theme;
  if (typeof theme === 'string') {
    const base = themeModes.includes(theme) ? { mode: theme } : themePresets.includes(theme) ? { preset: theme } : {};
    return { ...base, ...patch };
  }
  return { ...(isPlainObject(theme) ? theme : {}), ...patch };
}

function scaledFont(font, scale) {
  return String(font || '').replace(/(\d+(?:\.\d+)?)px/, (_, value) => `${Number((Number(value) * scale).toFixed(2))}px`);
}

export function applyPreferencesToSpec(spec, preferences = {}) {
  const result = clone(spec) || {};
  const prefs = mergePreferences(preferences);
  result.theme = clone(result.theme) || {};
  const scale = prefs.typography.scale;
  if (scale !== 1 && result.theme.typography) {
    result.theme.typography = Object.fromEntries(Object.entries(result.theme.typography).map(([key, value]) => [key, { ...value, size: Number((Number(value.size) * scale).toFixed(2)), font: scaledFont(value.font, scale) }]));
  }
  if (prefs.density !== 'comfortable') {
    const factor = prefs.density === 'compact' ? 0.82 : 1.2;
    const padding = result.theme.layout?.padding || result.padding;
    if (padding) result.padding = Object.fromEntries(Object.entries(padding).map(([key, value]) => [key, Math.max(0, Math.round(Number(value) * factor))]));
    if (result.theme.layout) result.theme.layout = { ...result.theme.layout, density: prefs.density, spacing: Number((Number(result.theme.layout.spacing || 8) * factor).toFixed(2)) };
  }
  const component = (path, value) => value === 'auto' ? undefined : value;
  const legend = component('legend', prefs.components.legend), labels = component('labels', prefs.components.labels), grid = component('grid', prefs.components.grid);
  if (legend !== undefined) result.legend = { ...(result.legend || {}), visible: legend };
  if (labels !== undefined) result.labels = { ...(result.labels || {}), enabled: labels };
  if (grid !== undefined) result.grid = { ...(result.grid || {}), visible: grid };
  if (prefs.branding.enabled !== 'auto') result.branding = { ...(result.branding || {}), enabled: prefs.branding.enabled };
  return result;
}
