/** Shared chart chrome and bounded stroke sizing; no renderer or chart-family imports. */
import { SceneNode } from './scene.mjs';
import { resolveTheme } from './theme.mjs';

export function markWidth(spec, plot) {
  const width = Math.max(0.5, Number(spec.theme?.marks?.lineWidth) || 2);
  if (!plot || spec.theme?.automaticLineWidth !== width) return width;
  const nodes = (spec.nodes || []).filter(node => node.kind !== 'connector');
  const nodeScale = nodes.length ? nodes.reduce((sum, node) => sum + (node.size?.height || 36), 0) / nodes.length / 36 : Infinity;
  return width * Math.max(0.8, Math.min(1.35, Math.sqrt(Math.max(0, Math.min(plot.width / 560, plot.height / 280, nodeScale)))));
}
export function markRadius(spec) { return Math.max(2, Number(spec.theme?.marks?.radius) || 5); }
export function markOpacity(spec) { return Math.max(0, Math.min(1, Number(spec.theme?.marks?.opacity ?? 1))); }
export function markStyle(spec, style = {}) { return { ...style, opacity: style.opacity ?? markOpacity(spec) }; }

export function prepareChartChrome(input) {
  const theme = input.theme?.typography ? input.theme : resolveTheme(input.theme, input);
  const padding = input.padding || theme.layout.padding;
  const branding = input.branding?.enabled === true;
  const effectivePadding = { top: Number(padding.top), right: Number(padding.right) + (branding ? 2 : 0), bottom: Number(padding.bottom) + (branding ? 18 : 0), left: Number(padding.left) };
  const custom = Object.keys(effectivePadding).some(key => Number(padding[key]) !== Number(theme.layout.padding[key]));
  return { spec: { ...input, theme, colors: input.colors || theme.colors, background: input.background || theme.background, padding: effectivePadding }, axisFreeBottomPadding: custom ? effectivePadding.bottom : Math.max(28, Math.min(34, Number(theme.layout.padding.bottom))) };
}

export function addBranding(scene, spec) {
  if (spec.branding?.enabled !== true) return;
  const family = String(spec.theme.typography.axis.font).split(/px\s*/).slice(1).join('px ').trim() || 'system-ui';
  scene.add(new SceneNode({ id: 'branding-watermark', type: 'text', geometry: { text: 'Powered by iChart.js', x: Math.max(12, spec.width - 8), y: Math.max(12, spec.height - 4) }, style: { fill: spec.theme.muted, opacity: 0.35, font: `500 9px ${family}`, textAnchor: 'end', textAlign: 'end', textBaseline: 'bottom', baseline: 'bottom', pointerEvents: 'none', ariaHidden: 'true', role: 'presentation' }, interactive: false, zIndex: 9999, decorative: true }));
}

export function addEmptyState(scene, spec, plot, reason = 'empty', idPrefix = 'empty') {
  const chinese = String(spec.locale).toLowerCase().startsWith('zh');
  const messages = chinese ? { empty: '暂无数据', filtered: '暂无匹配数据', positive: '暂无正值' } : { empty: 'No data', filtered: 'No matching data', positive: 'No positive values' };
  const size = spec.theme.typography.subtitle.size || 13, text = String(spec.emptyText || messages[reason]);
  scene.add(new SceneNode({ id: idPrefix, type: 'text', geometry: { text, x: plot.x + plot.width / 2, y: plot.y + plot.height / 2 }, style: { fill: spec.theme.muted, font: spec.theme.typography.subtitle.font, fontSize: size, textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle' } }));
}
