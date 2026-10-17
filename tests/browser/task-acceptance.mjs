export async function verifyAgentTasks(entries) {
  const root = await import(entries.root), standard = await import(entries.standard);
  const reports = [], host = document.createElement('div');
  host.style.width = '960px';
  document.body.append(host);
  const artifacts = chart => ({ svg: chart.export({ type: 'svg' }), png: chart.export({ type: 'png' }), json: chart.export({ type: 'json', as: 'object' }) });
  const ensure = (condition, message) => { if (!condition) throw new Error(message); };
  const rows = [{ id: 'jan', month: '一月', sales: 120 }, { id: 'feb', month: '二月', sales: 180 }, { id: 'mar', month: '三月', sales: 150 }, { id: 'apr', month: '四月', sales: 210 }];
  try {
    ensure(root.getCapabilities().chartTypes.includes('flow'), 'Root discovery unavailable');
    for (const renderer of ['svg', 'canvas']) {
      const inspection = root.inspectData(rows), plan = root.planChart(rows, { intent: 'trend' });
      ensure(inspection.quality.status === 'ready' && !plan.requiredFields.length && plan.primary === 'line' && !plan.fallbackUsed, 'Trend planning failed');
      const checked = root.validateSpec({ type: plan.primary, renderer, container: host, width: 960, height: 400, locale: 'zh-CN', data: { values: rows }, encoding: { x: { field: plan.suggestedEncodings.dimension }, y: { field: plan.suggestedEncodings.measure } }, title: { text: '月度收入趋势' }, yAxis: { title: '收入（万元）' }, legend: { visible: false }, labels: { enabled: true } });
      ensure(checked.valid, JSON.stringify(checked.errors));
      const trend = standard.createChart(checked.spec);
      try {
        const output = artifacts(trend), xml = new DOMParser().parseFromString(output.svg, 'image/svg+xml');
        const ids = trend.explain().lineage.recordIds;
        const checks = { planned: true, renderable: trend.getState().health.renderable, lineage: JSON.stringify(ids) === JSON.stringify(rows.map(row => row.id)), title: xml.documentElement.textContent.includes('月度收入趋势'), units: xml.documentElement.textContent.includes('收入（万元）'), png: output.png.startsWith('data:image/png;'), json: output.json.spec.type === 'line' };
        reports.push({ task: 'trend', renderer, checks, warnings: trend.getState().warnings, assumptions: plan.assumptions, artifacts: output });
      } finally { trend.destroy(); }

      ensure(root.getChartContract('flow').incrementalBuilding.atomic, 'Flow contract unavailable');
      const checkedFlow = root.validateSpec({ type: 'flow', renderer, container: host, width: 960, height: 480, locale: 'zh-CN', title: { text: '业务申请审核流程' }, nodes: [], edges: [], diagram: { layout: 'layered', routing: 'auto', appearance: 'soft' }, editing: { enabled: true, allowStructuralChanges: true } });
      ensure(checkedFlow.valid, JSON.stringify(checkedFlow.errors));
      const flow = root.createChart(checkedFlow.spec), view = JSON.stringify(flow.getState().view), steps = [];
      try {
        const commands = [
          { type: 'layout-edit', reason: 'Start and submit the application', operations: [
            { op: 'addNode', node: { id: 'start', kind: 'start', label: '开始', size: { width: 96, height: 36 } } },
            { op: 'addNode', node: { id: 'submit', kind: 'process', label: '填写业务申请并提交审核', size: { width: 224, height: 64 } } },
            { op: 'addEdge', id: 'start-submit', from: 'start', to: 'submit' }
          ] },
          { type: 'layout-edit', reason: 'Approval branch and correction loop', operations: [
            { op: 'addNode', node: { id: 'review', kind: 'decision', label: '是否通过审核？', size: { width: 144, height: 64 } } },
            { op: 'addNode', node: { id: 'done', kind: 'end', label: '完成', size: { width: 112, height: 36 } } },
            { op: 'addEdge', id: 'submit-review', from: 'submit', to: 'review' },
            { op: 'addEdge', id: 'yes', from: 'review', to: 'done', label: '是' },
            { op: 'addEdge', id: 'no', from: 'review', to: 'submit', label: '否' }
          ] },
          { type: 'layout-edit', reason: 'Clarify the application step', operations: [{ op: 'updateRecord', nodeId: 'submit', changes: { label: '补充业务申请并提交审核' } }] }
        ];
        for (const command of commands) {
          const before = flow.getSpec(), preview = flow.previewEdit(command);
          ensure(preview.valid, JSON.stringify(preview.errors));
          ensure(JSON.stringify(flow.getSpec()) === JSON.stringify(before), 'Preview mutated the live Spec');
          const result = flow.applyEdit(preview.command, { preview, confirmed: true, source: 'test-host' });
          ensure(result.valid, JSON.stringify(result.errors));
          steps.push({ revision: flow.getState().revision, warnings: flow.getState().warnings.map(warning => warning.code) });
        }
        const renamed = flow.getSpec().nodes.find(node => node.id === 'submit').label;
        flow.undo();
        ensure(flow.getSpec().nodes.find(node => node.id === 'submit').label !== renamed, 'Flow undo failed');
        flow.redo();
        ensure(flow.getSpec().nodes.find(node => node.id === 'submit').label === renamed, 'Flow redo failed');
        const sizes = [];
        for (const width of [390, 768, 1280]) {
          flow.resize(width, 480);
          const state = flow.getState();
          sizes.push({ width, warnings: state.warnings.map(warning => warning.code), labels: state.layout.labels.diagram });
          ensure(JSON.stringify(state.view) === view, 'Resize changed the Flow viewport');
          ensure(flow.getSpec().nodes.find(node => node.id === 'submit').size.width === 224, 'Resize shrank nodes');
        }
        ensure(sizes[0].warnings.includes('FLOW_LAYOUT_OVERFLOW'), 'Narrow Flow must diagnose physical limits');
        ensure(!sizes[1].warnings.length && !sizes[2].warnings.length, 'Usable Flow sizes have unresolved warnings');
        flow.resize(960, 480);
        const state = flow.getState(), output = artifacts(flow);
        const restored = root.createChart(output.json.spec);
        try { ensure(JSON.stringify(restored.getState().layout.diagram.nodes) === JSON.stringify(state.layout.diagram.nodes), 'Flow JSON reconstruction changed layout'); } finally { restored.destroy(); }
        const nodes = state.layout.diagram.nodes;
        const gaps = [['start', 'submit'], ['submit', 'review'], ['review', 'done']].map(([from, to]) => nodes[to].x - nodes[from].x - nodes[from].width);
        const checks = { renderable: state.health.renderable, healthy: state.health.status === 'ready', complete: flow.getSpec().nodes.length === 4 && flow.getSpec().edges.length === 4, automatic: flow.getSpec().nodes.every(node => !node.position), compact: gaps.every(gap => gap <= 48.001 && gap >= 16), labels: state.layout.labels.diagram.truncated === 0 && state.layout.labels.diagram.suppressed === 0, png: output.png.startsWith('data:image/png;'), history: flow.getState().history.undo === 3 };
        const xml = new DOMParser().parseFromString(output.svg, 'image/svg+xml');
        const routes = [...xml.querySelectorAll('path[data-data-ref]')].map(path => JSON.parse(path.getAttribute('data-data-ref')));
        const forward = routes.find(route => route.edgeId === 'submit-review')?.diagramPoints;
        const backward = routes.find(route => route.edgeId === 'no')?.diagramPoints;
        const limitations = forward && backward && JSON.stringify(forward) === JSON.stringify([...backward].reverse()) ? ['Reciprocal automatic edges share a path; this case has not passed visual routing acceptance.'] : [];
        checks.separateReturnRoute = Boolean(forward?.length && backward?.length && !limitations.length);
        checks.readableReturnChannel = backward?.some((point, index) => index > 0 && point.y === backward[index - 1].y && Math.abs(point.x - backward[index - 1].x) >= 24 && (point.y < nodes.submit.y || point.y > nodes.submit.y + nodes.submit.height)) === true;
        reports.push({ task: 'incremental-flow', renderer, checks, steps, sizes, warnings: state.warnings, limitations, artifacts: output });
      } finally { flow.destroy(); }
    }
  } finally { host.remove(); }
  return reports;
}
