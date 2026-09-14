import { SceneNode } from './scene.mjs';

export class PluginHost {
  constructor(chart, plugins = []) { this.chart = chart; this.plugins = []; plugins.forEach(plugin => this.use(plugin)); }
  use(plugin) { if (!plugin || this.plugins.includes(plugin)) return this; this.plugins.push(plugin); plugin.install?.(this.chart); return this; }
  beforeRender(model) { this.plugins.forEach(plugin => plugin.beforeRender?.(this.chart, model)); }
  afterRender(model) { this.plugins.forEach(plugin => plugin.afterRender?.(this.chart, model)); }
  destroy() { this.plugins.slice().reverse().forEach(plugin => plugin.destroy?.(this.chart)); this.plugins = []; }
}

export function annotationPlugin(annotations = []) { return { name: 'annotation', beforeRender(chart, model) { annotations.forEach((annotation, index) => { if (annotation.type === 'line') model.scene.add(new SceneNode({ id: `annotation-line-${index}`, type: 'line', geometry: annotation.geometry, style: { stroke: annotation.color || '#dc2626', strokeWidth: annotation.width || 1 } })); }); } }; }
export function dataZoomPlugin(options = {}) { return { name: 'dataZoom', install(chart) { chart.spec.interaction = { ...chart.spec.interaction, zoom: true }; chart.zoomOptions = { minSpan: options.minSpan || 2 }; } }; }
export function dataLabelsPlugin(options = {}) { return { name: 'dataLabels', beforeRender(chart, model) { const additions = []; model.scene.walk(node => { if (!node.dataRef || !node.geometry) return; const datum = model.data.rows[node.dataRef.dataIndex]; const yEncoding = Array.isArray(chart.spec.encoding.y) ? chart.spec.encoding.y[node.dataRef.seriesIndex] : chart.spec.encoding.y; const valueField = node.dataRef.field || yEncoding?.field || chart.spec.encoding.value?.field || 'value'; const value = datum?.[valueField]; if (value === undefined) return; const x = node.geometry.x ?? node.geometry.cx; const y = node.geometry.y ?? node.geometry.cy; if (x === undefined || y === undefined) return; additions.push(new SceneNode({ id: `${node.id}-label`, type: 'text', geometry: { x, y: y - 6, text: options.formatter ? options.formatter(value, datum) : String(value) }, style: { fill: options.color || '#334155', font: options.font || '11px system-ui', textAnchor: 'middle' } })); }); additions.forEach(node => model.scene.add(node)); } }; }
export function accessibilityPlugin(options = {}) { return { name: 'accessibility', install(chart) { chart.spec.accessibility = { ...chart.spec.accessibility, enabled: true, ...options }; } }; }
