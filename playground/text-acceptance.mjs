import { createBoard, createChart, validateSpec } from './runtime.mjs';
import { json } from './playground.mjs';

const template = await fetch(new URL('../agent-recipes/text-annotations.json', import.meta.url)).then(response => response.json());

export function mountTextAcceptance(renderer, theme, width) {
  const section = document.querySelector('#text-acceptance');
  section.innerHTML = '<h2>Text & Annotation</h2><p>双行标题、参考线、稳定 ID 标注；画板显式换行与字号自适应。普通数值标签不加背景。</p><div class="grid"><div class="chart" id="text-chart"></div><div class="chart" id="text-board"></div></div><button id="text-update">更新 April 数据</button> <button id="text-reload">JSON 保存/重建</button><details><summary>文本 / 标注状态</summary><pre id="text-output"></pre></details>';
  const spec = { ...template, container: '#text-chart', renderer, theme, width, height: 320 };
  let chart = createChart(validateSpec(spec).spec);
  const board = createBoard({ renderer, width, height: 260, items: [
    { id: 'note', kind: 'text', text: 'Explicit line breaks\n中文说明 / English caption', position: { x: 16, y: 24 }, size: { width: width - 32, height: 100 }, fontSize: 24, background: '#f1f5f9', padding: 12 },
    { id: 'fitted', kind: 'text', text: '80px font fits a 24px box', position: { x: 16, y: 156 }, size: { width: width - 32, height: 24 }, fontSize: 80, wrap: false }
  ] }).mount('#text-board');
  Object.assign((board.renderer.canvas || board.renderer.svg).style, { width: '100%', height: 'auto' });
  const refresh = () => { document.querySelector('#text-output').textContent = json({ annotations: chart.getState().layout.annotations, chartWarnings: chart.getState().warnings, boardText: board.getState().layout.text, boardWarnings: board.explain().warnings }); };
  document.querySelector('#text-update').onclick = () => { chart.update({ data: template.data.values.map(row => row.id === 'apr' ? { ...row, revenue: 35 } : row), annotations: template.annotations.map(item => item.id === 'peak' ? { ...item, text: 'April revised\n35 units' } : item) }); refresh(); };
  document.querySelector('#text-reload').onclick = () => { const saved = chart.export({ type: 'json', as: 'object' }).spec; chart.destroy(); document.querySelector('#text-chart').replaceChildren(); chart = createChart({ ...saved, container: '#text-chart' }); refresh(); };
  refresh();
  return { destroy() { chart.destroy(); board.destroy(); } };
}
