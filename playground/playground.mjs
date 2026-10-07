export const runtimeVersion = '2.0.27';

export const playgroundPages = [
  { href: 'index.html', label: '首页', description: '统一的 Playground 入口、页面状态和验收地址。', kind: 'entry' },
  { href: 'github-promo.html', label: 'GitHub Promo', description: '用于 README/GitHub 展示的英文 16:9 宣传页。', kind: 'promo', nav: false, homeGroup: 'validation' },
  { href: 'project-gallery.html', label: '完整 Gallery', description: '全部 18 类图表的一类一例视觉与渲染冒烟入口。', kind: 'catalog', homeGroup: 'featured' },
  { href: 'profile-loading.html', label: '按需加载', description: '四个公开 Profile 入口的独立加载、渲染和健康状态验收。', kind: 'runtime', homeGroup: 'validation' },
  { href: 'foundational-gallery.html', label: '基础能力', description: 'Stack、Donut、Combo、Bin、Heatmap、Radar 专项回归。', kind: 'catalog', homeGroup: 'validation' },
  { href: 'theme-gallery.html', label: '主题样式', description: '模式、预设、配色、对比度与实时切换验收。', kind: 'catalog', homeGroup: 'featured' },
  { href: 'preferences-lab.html', label: '页面设置', description: '全局主题、布局、显示内容、localStorage 和 Agent 调整。', kind: 'lab', homeGroup: 'validation' },
  { href: 'agent-workbench.html', label: 'Agent 工作台', description: '检查数据、规划图表、验证 Spec、解释结果和导出。', kind: 'workbench', homeGroup: 'featured' },
  { href: 'canvas-board.html', label: 'Freeform Board', description: '四步生成图表、Logo、小猫和曲线示例；开发者工具提供预览确认和导出。', kind: 'workbench', homeGroup: 'featured' },
  { href: 'project-intelligence.html', label: '项目分析', description: '进度、关键路径、容量、风险和联动状态。', kind: 'workbench', homeGroup: 'featured' },
  { href: 'editing.html', label: '业务编辑', description: '预览、确认、提交、审计和撤销/重做。', kind: 'workbench', homeGroup: 'validation' },
  { href: 'diagram-editor.html', label: 'Diagram', description: '四步构建审批流程；开发者工具提供节点、组、Port、线路编辑。', kind: 'workbench', homeGroup: 'featured' },
  { href: 'interaction-lab.html', label: '交互', description: 'Tooltip、选择、缩放、平移、键盘和事件状态。', kind: 'lab', homeGroup: 'validation' },
  { href: 'accessibility-lab.html', label: '无障碍', description: '语义、键盘、焦点、对比度和 reduced motion。', kind: 'lab', homeGroup: 'validation' },
  { href: 'performance-lab.html', label: '性能', description: '渲染、更新、缩放、导出和生命周期测量。', kind: 'lab', homeGroup: 'validation' }
];

export function pageNav(active = '') {
  return `<nav class="nav" aria-label="Playground 导航">${playgroundPages.filter(page => page.nav !== false).map(({ href, label }) => `<a href="./${href}"${href === active ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
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
