/**
 * Chart-level edit transaction coordinator.
 * Connects preview, confirmation, commit, revision checks, audit, and history.
 */
import { copyJSON, issue } from './schema.mjs';
import { normalizeCommand } from './command.mjs';
import { previewEdit, commitPreview } from './edit.mjs';

let chartSequence = 0;

export class EditController {
  constructor(chart) {
    this.chart = chart;
    this.id = ++chartSequence;
    this.sequence = 0;
    this.pending = new Map();
    this.busy = false;
  }

  invalidate() {
    if (this.busy) throw new Error('Cannot replace data during an edit transaction.');
    this.chart._revision += 1;
    this.chart._history.clear();
    this.chart._lastChangeSet = null;
    this.pending.clear();
  }

  context(command) {
    const spec = this.chart.spec;
    const diagram = ['flow', 'swimlane'].includes(spec.type);
    const edgeEdit = diagram && command.operations?.some(operation => operation?.op === 'updateEdge');
    const field = diagram ? edgeEdit ? 'edges' : 'nodes' : 'values';
    const root = diagram && spec[field] !== undefined;
    const nodes = spec.nodes ?? spec.data.nodes ?? [];
    const lanes = spec.lanes ?? spec.data.lanes ?? [];
    const options = {
      values: (root ? spec[field] : spec.data[field]) ?? [],
      schema: edgeEdit ? spec.data.edgeSchema : spec.data.schema ?? spec.schema,
      validationOptions: { ...spec.validationOptions, references: { ...spec.validationOptions?.references, ...(diagram ? { 'flow-node': nodes.map(row => row.id), swimlane: lanes.map(row => row.id) } : {}) } },
      requireConfirmation: spec.editing?.requireConfirmation,
      grid: spec.diagram?.grid || 8,
      allowStructuralChanges: spec.editing?.allowStructuralChanges === true
    };
    return { options, field, root, signature: JSON.stringify([options, spec.editing, spec.type]) };
  }

  preview(input) {
    let command;
    try { command = normalizeCommand(input); } catch { return previewEdit(input); }
    const context = this.context(command);
    const preview = previewEdit(command, context.options);
    preview.revision = this.chart._revision;
    if (preview.valid) {
      preview.id = `chart-${this.id}-preview-${++this.sequence}`;
      this.pending.set(preview.id, { command: copyJSON(command), revision: preview.revision, signature: context.signature });
      if (this.pending.size > 50) this.pending.delete(this.pending.keys().next().value);
    }
    return preview;
  }

  failure(code, message) {
    const result = { valid: false, errors: [issue(code, 'editing', message)], warnings: [] };
    this.notify('editerror', { chart: this.chart, result });
    return result;
  }

  notify(type, event) {
    try { this.chart.emit(type, event); } catch (error) { return issue('EDIT_LISTENER', type, error.message); }
    return null;
  }

  apply(input, options = {}) {
    const chart = this.chart;
    if (this.busy) return { valid: false, errors: [issue('EDIT_IN_PROGRESS', 'editing', 'An edit transaction is already running.')], warnings: [] };
    if (chart.spec.editing?.enabled !== true) return this.failure('EDITING_DISABLED', 'Business editing is disabled for this chart.');
    let command;
    try { command = normalizeCommand(input); } catch (error) { return this.failure('INVALID_COMMAND', error.message); }
    const context = this.context(command);
    const preview = previewEdit(command, context.options);
    preview.revision = chart._revision;
    if (!preview.valid) { this.notify('editerror', { chart, result: preview }); return preview; }
    if (preview.requiresConfirmation && options.confirmed !== true) return this.failure('CONFIRMATION_REQUIRED', 'Host confirmation is required; an Agent flag is not authorization.');
    const previewId = options.previewId ?? options.preview?.id;
    const expectedRevision = options.expectedRevision ?? options.preview?.revision;
    if (expectedRevision !== undefined && expectedRevision !== chart._revision) return this.failure('STALE_PREVIEW', 'The data revision changed after preview.');
    if (preview.requiresConfirmation && !previewId) return this.failure('PREVIEW_REQUIRED', 'Confirm a preview issued by this chart before committing.');
    if (preview.requiresConfirmation && !options.preview) return this.failure('PREVIEW_REQUIRED', 'Pass the exact preview returned by chart.previewEdit() before committing.');
    if (previewId) {
      const stored = this.pending.get(previewId);
      if (!stored || stored.revision !== chart._revision || stored.signature !== context.signature) return this.failure('STALE_PREVIEW', 'The preview expired or its source data or policy changed.');
      if (JSON.stringify(stored.command) !== JSON.stringify(command)) return this.failure('PREVIEW_MISMATCH', 'The command does not match the confirmed preview.');
      preview.id = previewId;
    }
    const committed = commitPreview(preview, { ...options, expectedRevision: chart._revision, previewId: preview.id });
    if (!committed.valid) return committed;
    this.busy = true;
    try {
      let cancelled = false;
      const listenerError = this.notify('beforeedit', { chart, command: copyJSON(command), preview: copyJSON(preview), preventDefault: () => { cancelled = true; } });
      if (cancelled || listenerError) return this.failure('EDIT_CANCELLED', listenerError?.message || 'The host cancelled this edit.');
      if (this.context(command).signature !== context.signature) return this.failure('STALE_PREVIEW', 'Source data changed during confirmation.');
      const before = copyJSON(context.options.values);
      const error = this.publish(committed.rows, context);
      if (error) return this.failure('EDIT_RENDER_FAILED', error.message);
      chart._revision += 1;
      committed.revision = chart._revision;
      committed.target = context.root ? context.field : `data.${context.field}`;
      committed.audit.operationId = `chart-${this.id}-operation-${chart._revision}`;
      committed.audit.affectedRecords = [...committed.affectedRecords];
      chart._history.push({ before, after: committed.rows, field: context.field, root: context.root, changeSet: committed });
      chart._lastChangeSet = copyJSON(committed);
      this.pending.clear();
      this.notify('edit', { chart, changeSet: copyJSON(committed) });
      return copyJSON(committed);
    } finally { this.busy = false; }
  }

  publish(rows, context) {
    const chart = this.chart, previousSpec = chart.spec, previousModel = chart.model;
    chart.spec = context.root ? { ...chart.spec, [context.field]: copyJSON(rows) } : { ...chart.spec, data: { ...chart.spec.data, [context.field]: copyJSON(rows) } };
    try { chart.render(); return null; } catch (error) {
      chart.spec = previousSpec;
      chart.model = previousModel;
      try { if (chart.renderer.container) chart.renderer.render(previousModel.scene); } catch {}
      return error;
    }
  }

  restore(direction, options = {}) {
    const chart = this.chart;
    if (this.busy) return { valid: false, errors: [issue('EDIT_IN_PROGRESS', 'editing', 'An edit transaction is already running.')], warnings: [] };
    if (chart.spec.editing?.enabled !== true) return this.failure('EDITING_DISABLED', 'Business editing is disabled for this chart.');
    if (options.expectedRevision !== undefined && options.expectedRevision !== chart._revision) return this.failure('STALE_PREVIEW', 'The history revision changed.');
    const entry = chart._history[`${direction}Stack`].at(-1);
    if (!entry) return this.failure(`NO_${direction.toUpperCase()}`, `There is no edit to ${direction}.`);
    const current = entry.root ? chart.spec[entry.field] : chart.spec.data[entry.field];
    if (JSON.stringify(current) !== JSON.stringify(direction === 'undo' ? entry.after : entry.before)) return this.failure('STALE_HISTORY', 'Data changed outside the edit history.');
    this.busy = true;
    try {
      const rows = direction === 'undo' ? entry.before : entry.after;
      const error = this.publish(rows, entry);
      if (error) return this.failure('EDIT_RENDER_FAILED', error.message);
      chart._history[direction]();
      chart._revision += 1;
      const result = { valid: true, direction, revision: chart._revision, rows: copyJSON(rows), target: entry.changeSet.target, affectedRecords: entry.changeSet.affectedRecords, audit: { operationId: `chart-${this.id}-operation-${chart._revision}`, originalOperationId: entry.changeSet.audit.operationId, actor: options.actor || 'host', source: 'history', timestamp: new Date().toISOString(), reason: direction, affectedRecords: entry.changeSet.affectedRecords } };
      chart._lastChangeSet = copyJSON(result);
      this.pending.clear();
      this.notify('undoredo', { chart, ...copyJSON(result) });
      return copyJSON(result);
    } finally { this.busy = false; }
  }
}
