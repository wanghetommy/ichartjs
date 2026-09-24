export const runtimeVersion = '2.0.15';

export function pageNav(active = '') {
  const pages = [
    ['index.html', '首页'], ['github-promo.html', 'GitHub Promo'], ['project-gallery.html', '完整 Gallery'], ['theme-gallery.html', '主题样式'], ['preferences-lab.html', '页面设置'], ['agent-workbench.html', 'Agent 工作台'], ['project-intelligence.html', '项目分析'], ['editing.html', '业务编辑'], ['diagram-editor.html', 'Diagram'], ['interaction-lab.html', '交互'], ['accessibility-lab.html', '无障碍'], ['performance-lab.html', '性能']
  ];
  return `<nav class="nav" aria-label="Playground 导航">${pages.map(([href, label]) => `<a href="./${href}"${href === active ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
}

export function setStatus(element, state, text) {
  if (!element) return;
  element.className = `status ${state}`;
  element.textContent = text;
}

export function json(value) { return JSON.stringify(value, null, 2); }

export function downloadJSON(filename, value) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([json(value)], { type: 'application/json' }));
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

export function queryOptions(allowed = []) {
  const params = new URLSearchParams(location.search), values = {}, warnings = [];
  params.forEach((value, key) => { if (allowed.includes(key)) values[key] = value; else warnings.push({ code: 'UNKNOWN_QUERY_PARAMETER', path: key, message: `Unknown query parameter: ${key}` }); });
  return { values, warnings };
}

export function measure(label, operation) {
  const start = performance.now();
  const value = operation();
  return { label, durationMs: Number((performance.now() - start).toFixed(3)), value };
}
