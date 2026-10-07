import { createChart } from './runtime.mjs';
import { mountConstructionUI } from './construction-ui.mjs';

export async function mountFlowBuilder(getChart, refresh) {
  const response = await fetch('../agent-recipes/diagrams/incremental-flow.json');
  if (!response.ok) throw new Error('The incremental Flow recipe could not be loaded.');
  const recipe = await response.json();
  const root = document.querySelector('#flow-builder'), templates = document.querySelector('#builder-template'), commandText = document.querySelector('#builder-command'), report = document.querySelector('#builder-output');
  let preview = null, previewChart = null;
  const clearPreview = () => {
    previewChart?.destroy();
    previewChart = null;
    preview = null;
    document.querySelector('#builder-apply').disabled = true;
    document.querySelector('#builder-preview').replaceChildren();
  };
  const ui = mountConstructionUI({ root, prefix: 'builder', getRuntime: getChart, clearPreview, output: report });
  templates.replaceChildren(...recipe.commands.map((command, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = `${index + 1}. ${command.reason}`;
    return option;
  }));
  const loadTemplate = () => {
    clearPreview();
    commandText.value = JSON.stringify(recipe.commands[Number(templates.value)], null, 2);
    report.textContent = 'Template loaded. Preview before applying; edit IDs and labels for your own workflow.';
    ui.show('ready', `Selected template ${Number(templates.value) + 1}/${recipe.commands.length}; no change submitted.`);
  };
  templates.onchange = loadTemplate;
  commandText.oninput = () => { clearPreview(); ui.show('ready', 'Command changed; preview again before confirming.'); };
  document.querySelector('#builder-start').onclick = () => {
    clearPreview();
    getChart().update({ ...recipe.spec, renderer: getChart().getSpec().renderer, width: getChart().getSpec().width, groups: [], view: { scale: 1, offsetX: 0, offsetY: 0 }, interaction: { zoom: false, pan: false, drag: false, edgeDrag: false, portConnect: false, brush: false } });
    templates.value = '0';
    loadTemplate();
    refresh('Incremental Flow started; the previous diagram and history were replaced explicitly.');
  };
  document.querySelector('#builder-preview-command').onclick = () => {
    clearPreview();
    try {
      const chart = getChart();
      preview = chart.previewEdit(JSON.parse(commandText.value));
      report.textContent = JSON.stringify({ valid: preview.valid, errors: preview.errors, warnings: preview.warnings, changes: preview.changes, layout: preview.layout, requiresConfirmation: preview.requiresConfirmation }, null, 2);
      ui.show(preview.valid ? 'preview' : 'rejected', preview.valid ? `Awaiting host confirmation: ${preview.command.reason || 'edited command'}` : 'Invalid step; committed state unchanged.', preview);
      if (!preview.valid) return;
      previewChart = createChart({ ...chart.getSpec(), ...preview.after, container: '#builder-preview', width: chart.getSpec().width, renderer: chart.getSpec().renderer, editing: { enabled: false }, interaction: { drag: false, edgeDrag: false, portConnect: false, zoom: false, pan: false, brush: false } });
      document.querySelector('#builder-apply').disabled = false;
      refresh('Preview only; committed chart and edit history are unchanged.');
    } catch (error) { clearPreview(); report.textContent = error.message; ui.show('rejected', error.message); }
  };
  document.querySelector('#builder-apply').onclick = () => {
    if (!preview) return;
    const chart = getChart();
    const reason = preview.command.reason || 'edited command';
    const result = chart.applyEdit(preview.command, { preview, confirmed: true, source: 'flow-builder-host' });
    report.textContent = JSON.stringify({ valid: result.valid, errors: result.errors || [], warnings: result.warnings, audit: result.audit, layout: chart.getState().layout.diagram }, null, 2);
    clearPreview();
    ui.show(result.valid ? 'committed' : 'rejected', result.valid ? `Committed: ${reason}. Preview the next step or review delivery.` : 'Step rejected; preview the current state again.', result);
    refresh(result.valid ? 'Building step committed as one undoable transaction.' : result.errors.map(error => `${error.code}: ${error.message}`).join(' '), result);
    if (result.valid && Number(templates.value) < recipe.commands.length - 1) {
      templates.value = String(Number(templates.value) + 1);
      commandText.value = JSON.stringify(recipe.commands[Number(templates.value)], null, 2);
    }
  };
  loadTemplate();
  if (new URLSearchParams(location.search).get('scenario') === 'advanced') root.open = true;
  window.addEventListener('pagehide', clearPreview, { once: true });
  return { synchronize: ui.synchronize };
}
