const flowSteps = [
  { en: 'Add Start', zh: '添加开始节点', command: { type: 'layout-edit', operations: [{ op: 'addNode', node: { id: 'start', kind: 'start', label: 'Start', size: { width: 120, height: 44 } } }] } },
  { en: 'Add Submit request', zh: '添加提交申请，并连接开始', command: { type: 'layout-edit', operations: [
    { op: 'addNode', node: { id: 'submit', kind: 'process', label: 'Submit request', size: { width: 160, height: 48 } } },
    { op: 'addEdge', id: 'start-submit', from: 'start', to: 'submit' }
  ] } },
  { en: 'Add Approved?', zh: '添加审批判断', command: { type: 'layout-edit', operations: [
    { op: 'addNode', node: { id: 'approved', kind: 'decision', label: 'Approved?', size: { width: 140, height: 80 } } },
    { op: 'addEdge', id: 'submit-approved', from: 'submit', to: 'approved' }
  ] } },
  { en: 'Add Yes / No outcomes', zh: '添加通过和拒绝两个结果', command: { type: 'layout-edit', operations: [
    { op: 'addNode', node: { id: 'accepted', kind: 'end', label: 'Accepted', size: { width: 128, height: 44 } } },
    { op: 'addNode', node: { id: 'rejected', kind: 'end', label: 'Rejected', size: { width: 128, height: 44 } } },
    { op: 'addEdge', id: 'approved-accepted', from: 'approved', to: 'accepted', label: 'Yes' },
    { op: 'addEdge', id: 'approved-rejected', from: 'approved', to: 'rejected', label: 'No' }
  ] } }
];

function boardSteps(composition) {
  const chartIds = ['title', 'subtitle', 'charts-card', 'charts-title', 'line', 'bar', 'area'];
  const drawingIds = ['art-card', 'art-title', 'animal-body', 'animal-face', 'ear-left', 'ear-right', 'eye-left', 'eye-right', 'nose', 'animal-caption'];
  const items = composition.items.map((item, index) => ({ ...item, zIndex: item.zIndex ?? index }));
  return [
    { en: 'Add chart composition', zh: '添加图表组合', items: items.filter(item => chartIds.includes(item.id)) },
    { en: 'Add iChart.js logo', zh: '添加 iChart.js Logo', items: items.filter(item => item.id.startsWith('logo-')) },
    { en: 'Draw a cat', zh: '绘制小猫简笔画', items: items.filter(item => drawingIds.includes(item.id)) },
    { en: 'Add arc, sector and Bezier examples', zh: '添加弧线、扇形和贝塞尔曲线', items: items.filter(item => !chartIds.includes(item.id) && !drawingIds.includes(item.id) && !item.id.startsWith('logo-')) }
  ].map(({ en, zh, items }) => ({ en, zh, command: { type: 'board-edit', operations: items.map(item => ({ op: 'addItem', item })) } }));
}

export function getConstructionExample(kind, composition) {
  if (!['flow', 'board'].includes(kind)) throw new Error('Unknown construction example.');
  if (kind === 'board' && !composition?.items?.length) throw new Error('The Board example requires the original composition.');
  return structuredClone({
    spec: kind === 'flow' ? {
      type: 'flow', width: 1000, height: 440, nodes: [], edges: [], groups: [],
      data: { values: [] }, diagram: { layout: 'layered', routing: 'auto' }, branding: { enabled: false },
      title: { text: '' }, view: { scale: 1, offsetX: 0, offsetY: 0 },
      editing: { enabled: true, allowStructuralChanges: true, requireConfirmation: true },
      interaction: { tooltip: false, hover: false, click: false, zoom: false, pan: false, drag: false, edgeDrag: false, portConnect: false, brush: false, keyboard: false }
    } : {
      ...composition, items: [],
      editing: { enabled: true, allowStructuralChanges: true }, interaction: { zoom: false, pan: false, drag: false }
    },
    steps: kind === 'flow' ? flowSteps : boardSteps(composition)
  });
}

export function mountSimpleConstruction({ kind, composition, getRuntime, reset, refresh }) {
  const params = new URLSearchParams(location.search);
  const language = (params.get('lang') || navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  const chinese = language === 'zh';
  const root = document.querySelector('#simple-construction');
  const developerTools = document.querySelector('#developer-tools');
  const advanced = ['advanced', 'editor', 'composition'].includes(params.get('scenario'));
  developerTools.open = advanced;
  developerTools.querySelector('summary').textContent = chinese ? '开发者工具' : 'Developer tools';
  root.hidden = advanced;
  if (advanced) return { synchronize() {} };
  document.documentElement.lang = chinese ? 'zh-CN' : 'en';
  const example = getConstructionExample(kind, composition);
  root.innerHTML = `<h2>${chinese ? '一步一步构建' : 'Build one step at a time'}</h2><p>${chinese ? '点击下一步，逐步生成' : 'Click Next to build'} ${kind === 'flow' ? (chinese ? '审批流程。' : 'an approval flow.') : (chinese ? '图表、Logo 和小猫简笔画组合。' : 'charts, a logo and a cat drawing.')}</p><p id="simple-progress"></p><p id="simple-prompt"></p><div class="simple-actions"><button class="primary" id="simple-next"></button><button id="simple-back">${chinese ? '上一步' : 'Previous step'}</button><button id="simple-restart">${chinese ? '重新开始' : 'Restart'}</button></div><p id="simple-status" role="status" aria-live="polite"></p><p class="muted">${chinese ? '预设指令演示，不解析自然语言。点击下一步即授权当前步骤；示例完成不等于业务任务验收通过。' : 'Preset instructions, not a natural-language parser. Next authorizes the displayed step; finishing the example is not business-task acceptance.'}</p>`;
  const next = root.querySelector('#simple-next'), back = root.querySelector('#simple-back'), restart = root.querySelector('#simple-restart');
  const status = root.querySelector('#simple-status');
  let step = 0, busy = false, changed = false, runtime, revision, signature;
  const specSignature = current => {
    const spec = current.getSpec();
    if (kind === 'flow') { delete spec.width; delete spec.height; }
    return JSON.stringify(spec);
  };
  const observe = () => { runtime = getRuntime(); revision = runtime.getState().revision; signature = specSignature(runtime); };
  const render = () => {
    root.dataset.step = String(step);
    root.dataset.changed = String(changed);
    root.querySelector('#simple-progress').textContent = chinese ? `已完成 ${step} / ${example.steps.length} 步` : `${step} / ${example.steps.length} steps completed`;
    const instruction = example.steps[step]?.[language];
    root.querySelector('#simple-prompt').textContent = changed ? (chinese ? '开发者工具已更改画布，请重新开始示例。' : 'Developer tools changed the canvas. Restart the example to continue.') : instruction ? `${chinese ? '示例指令：' : 'Example instruction: '}${instruction}` : (chinese ? '示例构建完成。可以返回上一步或重新开始。' : 'Example complete. Go back a step or restart.');
    next.textContent = instruction ? `${chinese ? '下一步：' : 'Next: '}${instruction}` : (chinese ? '示例构建完成' : 'Example complete');
    next.disabled = busy || changed || step === example.steps.length;
    back.disabled = busy || changed || step === 0;
    restart.disabled = busy;
  };
  const synchronize = () => {
    if (busy || changed) return;
    if (runtime !== getRuntime() || revision !== getRuntime().getState().revision || signature !== specSignature(getRuntime())) {
      changed = true;
      render();
    }
  };
  const act = async action => {
    synchronize();
    busy = true;
    status.textContent = chinese ? '正在处理…' : 'Working…';
    status.dataset.phase = 'working';
    render();
    try {
      action();
      const current = getRuntime(), committedRevision = current.getState().revision, committedSignature = specSignature(current);
      await current.ready?.();
      if (current !== getRuntime() || committedRevision !== current.getState().revision || committedSignature !== specSignature(current)) {
        changed = true;
        throw new Error(chinese ? '画布已更改，请重新开始示例。' : 'Canvas changed. Restart the example.');
      }
      observe();
      const warnings = current.explain().warnings || [];
      const warningText = warnings.length ? (chinese ? ` ${warnings.length} 条诊断见开发者工具；未完成流程可能有缺少结束节点或分支的提示。` : ` ${warnings.length} diagnostics in Developer tools; unfinished flows may report missing end nodes or branches.`) : '';
      status.textContent = (step === 0 ? (chinese ? '画布为空，点击下一步开始。' : 'Empty canvas. Click Next to begin.') : (chinese ? '当前步骤已提交，可返回上一步。' : 'Step committed. You can go back.')) + warningText;
      status.dataset.phase = 'ready';
    } catch (error) {
      status.textContent = error.message;
      status.dataset.phase = 'error';
    } finally {
      busy = false;
      render();
      refresh(status.textContent);
    }
  };
  next.onclick = () => {
    synchronize();
    if (busy || changed || step === example.steps.length) return;
    return act(() => {
      const current = getRuntime(), preview = current.previewEdit(example.steps[step].command);
      if (!preview.valid) throw new Error(preview.errors.map(error => `${error.code}: ${error.message}`).join(' '));
      const result = current.applyEdit(preview.command, { preview, confirmed: true, source: 'simple-construction-host' });
      if (!result.valid) throw new Error(result.errors.map(error => `${error.code}: ${error.message}`).join(' '));
      step += 1;
    });
  };
  back.onclick = () => {
    synchronize();
    if (busy || changed || step === 0) return;
    return act(() => {
      if (!getRuntime().getState().history.undo) throw new Error(chinese ? '没有可撤销的步骤，请重新开始。' : 'No step to undo. Restart the example.');
      const result = getRuntime().undo();
      if (result.valid === false) throw new Error(result.errors.map(error => `${error.code}: ${error.message}`).join(' '));
      step -= 1;
    });
  };
  const start = () => act(() => { reset(structuredClone(example.spec)); step = 0; changed = false; });
  restart.onclick = start;
  start();
  return { synchronize };
}
