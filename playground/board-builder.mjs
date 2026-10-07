import { createBoard } from './runtime.mjs';
import { mountConstructionUI } from './construction-ui.mjs';

export async function mountBoardBuilder({ getBoard, replaceBoard, refresh }) {
  const response = await fetch('../agent-recipes/boards/incremental-board.json');
  if (!response.ok) throw new Error('The incremental Board recipe could not be loaded.');
  const recipe = await response.json();
  const root = document.querySelector('#board-builder'), template = document.querySelector('#board-template'), commandText = document.querySelector('#board-command'), output = document.querySelector('#board-builder-output'), apply = document.querySelector('#board-apply');
  let preview = null, previewBoard = null, saved = null, previewTitle = '';
  const clearPreview = () => { preview = null; previewBoard?.destroy(); previewBoard = null; document.querySelector('#board-preview').replaceChildren(); apply.disabled = true; };
  const ui = mountConstructionUI({ root, prefix: 'board', getRuntime: getBoard, clearPreview, output });
  const loadTemplate = () => { clearPreview(); commandText.value = JSON.stringify(recipe.commands[Number(template.value)], null, 2); output.textContent = 'Template only. Preview, inspect, then confirm.'; ui.show('ready', `Selected template ${Number(template.value) + 1}/${recipe.commands.length}; no change submitted.`); };
  template.innerHTML = recipe.commands.map((command, index) => `<option value="${index}">${index + 1}. ${['Add trend chart', 'Add explanation', 'Add regional chart', 'Add goal and connector', 'Explicitly adjust the note'][index]}</option>`).join('');
  template.onchange = loadTemplate;
  commandText.oninput = () => { clearPreview(); ui.show('ready', 'Command changed; preview again before confirming.'); };
  document.querySelector('#board-start').onclick = () => {
    clearPreview();
    replaceBoard({ ...recipe.spec, renderer: getBoard().getSpec().renderer });
    template.value = '0'; loadTemplate();
    refresh('Incremental Board started. Previous composition and history were explicitly replaced.');
  };
  document.querySelector('#board-preview-command').onclick = () => {
    clearPreview();
    try {
      preview = getBoard().previewEdit(JSON.parse(commandText.value));
      previewTitle = `template ${template.selectedOptions[0].textContent} (editable command)`;
      output.textContent = JSON.stringify(preview, null, 2);
      ui.show(preview.valid ? 'preview' : 'rejected', preview.valid ? `Awaiting host confirmation: ${previewTitle}` : 'Invalid step; committed state unchanged.', preview);
      if (!preview.valid) return;
      const previewItems = preview.spec.items.map(item => item.kind === 'image' ? { id: item.id, kind: 'shape', shape: 'rectangle', position: item.position, size: item.size, visible: item.visible, zIndex: item.zIndex, style: { fill: '#e2e8f0', stroke: '#64748b', strokeWidth: 1 } } : item);
      previewBoard = createBoard({ ...preview.spec, assets: [], items: previewItems, editing: { enabled: false, allowStructuralChanges: false }, interaction: { zoom: false, pan: false, drag: false } }).mount('#board-preview');
      apply.disabled = false;
      refresh('Preview only. Committed composition, revision and history are unchanged.');
    } catch (error) { clearPreview(); output.textContent = error.message; ui.show('rejected', error.message); }
  };
  apply.onclick = async () => {
    if (!preview) return;
    const board = getBoard(), pending = preview;
    const reason = previewTitle;
    const result = board.applyEdit(pending.command, { preview: pending, confirmed: true, source: 'board-builder-host' });
    clearPreview();
    output.textContent = JSON.stringify(result, null, 2);
    if (result.valid) {
      await board.ready();
      if (board !== getBoard() || board.getState().revision !== result.revision) { ui.synchronize(); refresh('State changed while assets settled; preview the next step from the current composition.'); return; }
      if (Number(template.value) < recipe.commands.length - 1) { template.value = String(Number(template.value) + 1); commandText.value = JSON.stringify(recipe.commands[Number(template.value)], null, 2); }
    }
    ui.show(result.valid ? 'committed' : 'rejected', result.valid ? `Committed: ${reason}. Preview the next step or review delivery.` : 'Step rejected; preview the current state again.', result);
    refresh(result.valid ? 'Complete turn committed. Other positions are preserved.' : result.errors.map(error => `${error.code}: ${error.message}`).join(' '));
  };
  for (const direction of ['undo', 'redo']) document.querySelector(`#board-${direction}`).onclick = async () => { clearPreview(); getBoard()[direction](); await getBoard().ready(); refresh(direction); };
  document.querySelector('#board-save').onclick = () => {
    saved = getBoard().export({ type: 'json', as: 'string' });
    try { localStorage.setItem('ichartjs.incremental-board.demo', saved); refresh('BoardSpec saved by the host. Images remain references; history is not persisted.'); }
    catch { refresh('Storage unavailable; BoardSpec saved in memory for this page.'); }
  };
  document.querySelector('#board-reload').onclick = () => {
    try {
      let value = saved;
      try { value ||= localStorage.getItem('ichartjs.incremental-board.demo'); } catch {}
      if (!value) { refresh('Save a BoardSpec first.'); return; }
      clearPreview(); replaceBoard(JSON.parse(value)); refresh('BoardSpec reloaded. A new instance starts with empty history.');
    } catch (error) { output.textContent = error.message; }
  };
  loadTemplate();
  if (new URLSearchParams(location.search).get('scenario') === 'advanced') root.open = true;
  window.addEventListener('pagehide', clearPreview, { once: true });
  return { clearPreview, synchronize: ui.synchronize };
}
