/**
 * Renderer-neutral visual style presets, palettes, and resolution helpers.
 */

export const themeModes = ['auto', 'light', 'dark', 'contrast'];
export const themePresets = ['auto', 'analysis', 'dashboard', 'report', 'presentation', 'project', 'diagram'];
export const themePalettes = ['auto', 'categorical', 'sequential', 'diverging', 'status'];

const fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const modes = {
  light: {
    background: '#ffffff', surface: '#ffffff', text: '#172033', muted: '#536274', axis: '#667085', grid: '#d9e0ea', border: '#c5cfdb', focus: '#1d4ed8', selection: '#1d4ed8', missing: '#d7dee8',
    categorical: ['#6929c4', '#0072c3', '#007d79', '#9f1853', '#a2191f', '#198038', '#002d9c', '#8a3800'],
    sequential: ['#edf5ff', '#d0e2ff', '#a6c8ff', '#78a9ff', '#4589ff', '#0f62fe', '#0043ce', '#002d9c'],
    diverging: ['#491d8b', '#8a3ffc', '#be95ff', '#e8daff', '#f8fafc', '#d9fbfb', '#3ddbd9', '#009d9a', '#005d5d'],
    status: { success: '#198038', warning: '#b28600', danger: '#da1e28', info: '#0072c3', neutral: '#697586' }
  },
  dark: {
    background: '#0f172a', surface: '#172033', text: '#f8fafc', muted: '#cbd5e1', axis: '#c2cad6', grid: '#344054', border: '#475467', focus: '#84adff', selection: '#84adff', missing: '#475467',
    categorical: ['#be95ff', '#33b1ff', '#3ddbd9', '#ff7eb6', '#fa4d56', '#6fdc8c', '#78a9ff', '#ffb784'],
    sequential: ['#001141', '#001d6c', '#002d9c', '#0043ce', '#0f62fe', '#4589ff', '#78a9ff', '#d0e2ff'],
    diverging: ['#be95ff', '#a56eff', '#8a3ffc', '#6929c4', '#344054', '#007d79', '#009d9a', '#3ddbd9', '#9ef0f0'],
    status: { success: '#42be65', warning: '#f1c21b', danger: '#ff8389', info: '#33b1ff', neutral: '#98a2b3' }
  },
  contrast: {
    background: '#000000', surface: '#000000', text: '#ffffff', muted: '#ffffff', axis: '#ffffff', grid: '#8c8c8c', border: '#ffffff', focus: '#ffff00', selection: '#ffff00', missing: '#666666',
    categorical: ['#ffff00', '#00ffff', '#ff7eb6', '#ffffff', '#7fff00', '#ff8c00'],
    sequential: ['#1a1a1a', '#4d4d4d', '#808080', '#b3b3b3', '#e6e6e6', '#ffffff'],
    diverging: ['#ff00ff', '#ff7eb6', '#ffffff', '#00ffff', '#007fff'],
    status: { success: '#7fff00', warning: '#ffff00', danger: '#ff4d4d', info: '#00ffff', neutral: '#ffffff' }
  }
};

const presets = {
  analysis: {
    typography: { title: [16, 600, 1.25], subtitle: [13, 400, 1.4], axis: [12, 400, 1.4], legend: [12, 500, 1.4], label: [12, 500, 1.35], tooltip: [12, 400, 1.45], metric: [24, 600, 1.15] },
    layout: { padding: { top: 48, right: 24, bottom: 48, left: 56 }, spacing: 8, legendGap: 12, axisGap: 10, density: 'comfortable', minimumTargetSize: 24 },
    marks: { lineWidth: 2, selectedLineWidth: 3, radius: 5, opacity: 1, gridWidth: 1, dashPatterns: [[], [6, 4], [2, 3]] }
  },
  dashboard: {
    typography: { title: [15, 600, 1.25], subtitle: [12, 400, 1.4], axis: [12, 400, 1.35], legend: [12, 500, 1.35], label: [12, 500, 1.3], tooltip: [12, 400, 1.4], metric: [24, 650, 1.1] },
    layout: { padding: { top: 42, right: 18, bottom: 42, left: 50 }, spacing: 6, legendGap: 8, axisGap: 8, density: 'compact', minimumTargetSize: 24 },
    marks: { lineWidth: 2, selectedLineWidth: 3, radius: 4, opacity: 1, gridWidth: 1, dashPatterns: [[], [5, 3], [2, 2]] }
  },
  report: {
    typography: { title: [17, 650, 1.25], subtitle: [13, 400, 1.45], axis: [12, 400, 1.45], legend: [12, 500, 1.4], label: [12, 500, 1.4], tooltip: [12, 400, 1.45], metric: [24, 650, 1.15] },
    layout: { padding: { top: 54, right: 28, bottom: 52, left: 60 }, spacing: 8, legendGap: 14, axisGap: 12, density: 'comfortable', minimumTargetSize: 24 },
    marks: { lineWidth: 2, selectedLineWidth: 3, radius: 4, opacity: 1, gridWidth: 1, dashPatterns: [[], [7, 4], [2, 3]] }
  },
  presentation: {
    typography: { title: [20, 650, 1.2], subtitle: [14, 400, 1.45], axis: [13, 450, 1.4], legend: [13, 550, 1.4], label: [13, 550, 1.35], tooltip: [13, 400, 1.45], metric: [28, 650, 1.1] },
    layout: { padding: { top: 62, right: 34, bottom: 58, left: 66 }, spacing: 10, legendGap: 16, axisGap: 14, density: 'spacious', minimumTargetSize: 28 },
    marks: { lineWidth: 3, selectedLineWidth: 4, radius: 6, opacity: 1, gridWidth: 1, dashPatterns: [[], [8, 5], [3, 4]] }
  },
  project: {
    typography: { title: [16, 650, 1.25], subtitle: [13, 400, 1.4], axis: [12, 450, 1.4], legend: [12, 550, 1.4], label: [12, 500, 1.35], tooltip: [12, 400, 1.45], metric: [24, 650, 1.15] },
    layout: { padding: { top: 50, right: 26, bottom: 52, left: 64 }, spacing: 8, legendGap: 12, axisGap: 10, density: 'comfortable', minimumTargetSize: 24 },
    marks: { lineWidth: 2, selectedLineWidth: 3, radius: 5, opacity: 1, gridWidth: 1, dashPatterns: [[], [6, 4], [2, 3]] }
  },
  diagram: {
    typography: { title: [16, 650, 1.25], subtitle: [13, 400, 1.4], axis: [12, 400, 1.4], legend: [12, 500, 1.4], label: [12, 550, 1.35], tooltip: [12, 400, 1.45], metric: [24, 650, 1.15] },
    layout: { padding: { top: 50, right: 28, bottom: 44, left: 58 }, spacing: 8, legendGap: 12, axisGap: 10, density: 'comfortable', minimumTargetSize: 24 },
    marks: { lineWidth: 1.75, selectedLineWidth: 3, radius: 6, opacity: 1, gridWidth: 1, dashPatterns: [[], [6, 4], [2, 3]] }
  }
};

const projectTypes = new Set(['gantt', 'timeline', 'milestone', 'burndown']);
const diagramTypes = new Set(['flow', 'swimlane', 'architecture', 'mindmap']);
const structuredKeys = new Set(['preset', 'mode', 'palette', 'tokens']);

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

function merge(base, extra) {
  const result = clone(base) || {};
  Object.entries(extra || {}).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) result[key] = merge(result[key], value);
    else if (value !== undefined) result[key] = clone(value);
  });
  return result;
}

function role(values) {
  const [size, weight, lineHeight] = values;
  return { size, weight, lineHeight, font: `${weight} ${size}px ${fontFamily}` };
}

function requestedTheme(theme) {
  if (typeof theme === 'string') {
    if (themeModes.includes(theme)) return { mode: theme, preset: 'auto', palette: 'auto', overrides: {} };
    if (themePresets.includes(theme)) return { mode: 'auto', preset: theme, palette: 'auto', overrides: {} };
  }
  if (theme && typeof theme === 'object') {
    const overrides = Object.fromEntries(Object.entries(theme).filter(([key]) => !structuredKeys.has(key)));
    return { mode: theme.mode || 'auto', preset: theme.preset || 'auto', palette: theme.palette || 'auto', overrides: merge(overrides, theme.tokens || {}) };
  }
  return { mode: 'auto', preset: 'auto', palette: 'auto', overrides: {} };
}

function preferredMode(mode, options = {}) {
  if (mode !== 'auto') return themeModes.includes(mode) ? mode : 'light';
  if (options.preferredColorScheme === 'dark') return 'dark';
  if (options.preferredColorScheme === 'light') return 'light';
  if (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function sourceRows(spec = {}) {
  const data = Array.isArray(spec.data) ? spec.data : spec.data?.values;
  return Array.isArray(data) ? data : Array.isArray(spec.nodes) ? spec.nodes : [];
}

function automaticPreset(spec = {}, options = {}) {
  const context = options.context || spec.context || spec.intent;
  if (themePresets.includes(context) && context !== 'auto') return context;
  if (['print', 'export', 'weekly-report', 'reporting'].includes(context)) return 'report';
  if (['slides', 'story', 'presentation'].includes(context)) return 'presentation';
  if (['monitoring', 'dashboard'].includes(context)) return 'dashboard';
  if (projectTypes.has(spec.type)) return 'project';
  if (diagramTypes.has(spec.type)) return 'diagram';
  return 'analysis';
}

function automaticPalette(spec = {}) {
  const rows = sourceRows(spec);
  const fields = new Set(rows.flatMap(row => Object.keys(row || {})).map(field => field.toLowerCase()));
  if (['status', 'risk', 'priority', 'severity', 'health'].some(field => fields.has(field))) return 'status';
  if (spec.type === 'heatmap' || spec.encoding?.color?.type === 'quantitative') return 'sequential';
  const inferredMeasures = Object.keys(rows[0] || {}).filter(field => rows.some(row => row?.[field] != null && row?.[field] !== '' && Number.isFinite(Number(row[field])))).map(field => ({ field }));
  const measures = Array.isArray(spec.encoding?.y) ? spec.encoding.y : [spec.encoding?.y || spec.encoding?.value].filter(Boolean);
  if (!measures.length) measures.push(...inferredMeasures);
  const values = rows.flatMap(row => measures.map(encoding => Number(row?.[encoding?.field])).filter(Number.isFinite));
  if (values.some(value => value < 0) && values.some(value => value > 0)) return 'diverging';
  return 'categorical';
}

function categoryCount(spec = {}) {
  const rows = sourceRows(spec);
  const field = spec.encoding?.x?.field || spec.encoding?.category?.field || 'name';
  return new Set(rows.map(row => row?.[field]).filter(value => value != null)).size;
}

export function planStyle(spec = {}, options = {}) {
  const request = requestedTheme(options.theme ?? spec.theme);
  const preset = request.preset === 'auto' ? automaticPreset(spec, options) : request.preset;
  const palette = request.palette === 'auto' ? automaticPalette(spec) : request.palette;
  const mode = themeModes.includes(request.mode) ? request.mode : 'auto';
  const resolvedMode = preferredMode(mode, options);
  const reasons = [`${preset} matches the ${spec.type || 'general'} visualization context.`, `${palette} matches the detected data semantics.`, `${resolvedMode} is the resolved color mode.`];
  const warnings = [];
  const categories = categoryCount(spec);
  if (palette === 'categorical' && categories > 6) warnings.push({ code: 'HIGH_CARDINALITY_COLOR', path: 'theme.palette', message: `${categories} categories exceed the recommended six-color comparison set.`, suggestion: 'Group categories or add labels, shapes, or line patterns.' });
  return { version: '1.0', preset, mode, resolvedMode, palette, reasons, warnings, userOverride: request.preset !== 'auto' || request.mode !== 'auto' || request.palette !== 'auto' };
}

function channel(value) {
  const text = String(value || '').trim();
  const hex = text.replace('#', '');
  const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i.exec(text);
  const values = /^[0-9a-f]{6}$/i.test(hex) ? [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16)) : rgb ? rgb.slice(1, 4).map(Number) : null;
  if (!values || values.some(value => value < 0 || value > 255)) return null;
  return values.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
}

function luminance(value) {
  const rgb = channel(value);
  return rgb ? 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] : null;
}

export function contrastRatio(foreground, background) {
  const first = luminance(foreground), second = luminance(background);
  if (first == null || second == null) return null;
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function validateThemeContrast(theme) {
  const checks = [['text', theme.text, 4.5], ['muted', theme.muted, 4.5], ['axis', theme.axis, 3], ['focus', theme.focus, 3]];
  return checks.flatMap(([token, color, minimum]) => {
    const ratio = contrastRatio(color, theme.background);
    return ratio != null && ratio < minimum ? [{ code: 'INSUFFICIENT_THEME_CONTRAST', path: `theme.${token}`, message: `${token} contrast ${ratio.toFixed(2)}:1 is below ${minimum}:1.`, expected: minimum }] : [];
  });
}

export function resolveTheme(theme, options = {}) {
  const request = requestedTheme(theme);
  const plan = planStyle({ ...options, theme }, { ...options, theme });
  const mode = modes[plan.resolvedMode] || modes.light;
  const preset = presets[plan.preset] || presets.analysis;
  const typography = Object.fromEntries(Object.entries(preset.typography).map(([key, value]) => [key, role(value)]));
  const colors = plan.palette === 'sequential' ? mode.sequential : plan.palette === 'diverging' ? mode.diverging : plan.palette === 'status' ? Object.values(mode.status) : mode.categorical;
  const resolved = {
    name: `${plan.preset}-${plan.resolvedMode}`,
    mode: plan.mode,
    resolvedMode: plan.resolvedMode,
    preset: plan.preset,
    palette: plan.palette,
    background: mode.background,
    surface: mode.surface,
    text: mode.text,
    muted: mode.muted,
    axis: mode.axis,
    grid: mode.grid,
    border: mode.border,
    focus: mode.focus,
    selection: mode.selection,
    colors: [...colors],
    palettes: { categorical: [...mode.categorical], sequential: [...mode.sequential], diverging: [...mode.diverging], status: { ...mode.status }, missing: mode.missing },
    status: { ...mode.status },
    typography,
    layout: clone(preset.layout),
    marks: clone(preset.marks),
    reasons: [...plan.reasons],
    warnings: [...plan.warnings]
  };
  const output = merge(resolved, request.overrides);
  output.warnings = [...(output.warnings || []), ...validateThemeContrast(output)];
  return output;
}

export const themes = {
  light: resolveTheme('light'),
  dark: resolveTheme('dark'),
  contrast: resolveTheme('contrast')
};

export const styleCapabilities = {
  modes: [...themeModes],
  presets: [...themePresets],
  palettes: [...themePalettes],
  switchable: true,
  automatic: true,
  contrast: { normalText: 4.5, largeText: 3, essentialGraphics: 3 },
  minimumTextSize: 12,
  recommendedCategoricalColors: 6
};
