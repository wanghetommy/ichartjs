export const themes = {
  light: { background: '#ffffff', colors: ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2'], text: '#0f172a', muted: '#475569', axis: '#94a3b8' },
  dark: { background: '#0f172a', colors: ['#60a5fa', '#4ade80', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee'], text: '#f8fafc', muted: '#cbd5e1', axis: '#64748b' },
  contrast: { background: '#000000', colors: ['#ffff00', '#00ffff', '#ff00ff', '#ffffff'], text: '#ffffff', muted: '#ffffff', axis: '#ffffff' }
};

export function resolveTheme(theme) { return typeof theme === 'string' ? (themes[theme] || themes.light) : { ...themes.light, ...(theme || {}) }; }
