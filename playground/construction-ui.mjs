export function mountConstructionUI({ root, prefix, getRuntime, clearPreview, output }) {
  const panel = document.createElement('section');
  panel.className = 'construction-status';
  panel.innerHTML = `<h3>Agent-driven Incremental Construction</h3><p id="${prefix}-construction-status" role="status" aria-live="polite"></p><p id="${prefix}-construction-summary"></p><div class="toolbar"><button id="${prefix}-cancel" disabled>Cancel preview</button><button id="${prefix}-review">Review delivery</button></div><p>Templates are starting points, not an autonomous task. Review requirements before saving JSON and exporting SVG or PNG. Renderable does not mean task complete.</p>`;
  (root.querySelector(`label[for="${prefix}-command"]`) || root.querySelector('textarea')).before(panel);
  const status = panel.querySelector('[role="status"]');
  const summary = panel.querySelector(`#${prefix}-construction-summary`);
  const cancel = panel.querySelector(`#${prefix}-cancel`);
  let observedRuntime = getRuntime(), observedRevision = observedRuntime.getState().revision;
  let observedSpec = JSON.stringify(observedRuntime.getSpec());
  let reviewSequence = 0;
  const show = (phase, message, result = {}) => {
    reviewSequence += 1;
    observedRuntime = getRuntime();
    const state = observedRuntime.getState();
    observedRevision = state.revision;
    observedSpec = JSON.stringify(observedRuntime.getSpec());
    status.dataset.phase = phase;
    status.textContent = `${message} · revision ${state.revision}`;
    const affected = [...(result.affectedRecords || result.affectedItems || []), ...(result.affectedAssets || [])];
    const diagnostics = [...(result.errors || []), ...(result.warnings || [])];
    summary.textContent = [result.command ? `Operations: ${result.command.operations.length}` : '', affected.length ? `Affected IDs: ${affected.join(', ')}` : '', ...diagnostics.map(entry => `${entry.code}: ${entry.message}`)].filter(Boolean).join(' · ') || 'No diagnostics for this step. Final task acceptance remains with the host.';
    cancel.disabled = phase !== 'preview';
  };
  const invalidate = message => { clearPreview(); show('changed', message); };
  cancel.onclick = () => { clearPreview(); show('cancelled', 'Preview cancelled; committed state and history are unchanged.'); };
  panel.querySelector(`#${prefix}-review`).onclick = async () => {
    clearPreview();
    const runtime = getRuntime(), revision = runtime.getState().revision, specSignature = JSON.stringify(runtime.getSpec()), sequence = ++reviewSequence;
    try {
      await runtime.ready?.();
      if (sequence !== reviewSequence) return;
      if (runtime !== getRuntime() || runtime.getState().revision !== revision || JSON.stringify(runtime.getSpec()) !== specSignature) {
        invalidate('State changed during review; review the current revision again.');
        return;
      }
      const state = runtime.getState(), spec = runtime.getSpec(), explanation = runtime.explain();
      const review = { kind: 'delivery-review', revision, health: state.health, warnings: explanation.warnings || state.warnings || [], assumptions: explanation.assumptions, assets: state.assets, assetsReady: state.assetsReady, layout: state.layout, recordIds: (spec.items || spec.nodes || []).map(item => item.id), taskAcceptance: 'host-review-required', checklist: ['Check requested steps, labels and relationships.', 'Inspect warnings, layout and image readiness.', 'Save JSON and export SVG or PNG with artifact paths.'] };
      output.textContent = JSON.stringify(review, null, 2);
      const diagnosticsPanel = output.closest('details');
      if (diagnosticsPanel) diagnosticsPanel.open = true;
      show('review', 'Delivery review; check task requirements before saving/exporting.', review);
    } catch (error) { show('rejected', error.message); }
  };
  return {
    show,
    synchronize() {
      if (getRuntime() !== observedRuntime || getRuntime().getState().revision !== observedRevision || JSON.stringify(getRuntime().getSpec()) !== observedSpec) invalidate('Committed state changed; any pending preview was discarded. Preview the next step again.');
    }
  };
}
