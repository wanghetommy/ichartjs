/**
 * Chart-level edit transaction coordinator.
 * Connects preview, confirmation, commit, revision checks, audit, and history.
 */
import { copyJSON, issue } from './schema.mjs';
import { normalizeCommand } from './command.mjs';
import { validateEdit, previewEdit, commitPreview } from './edit.mjs';
import { validateSpec } from './spec.mjs';
import { buildScene } from './charts.mjs';
import { diagramConnectionPoints, reconnectOrthogonalWaypoints } from './diagram.mjs';

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

  targetEntries(command) {
    const spec = this.chart.spec;
    const diagram = ['flow', 'swimlane', 'architecture', 'mindmap'].includes(spec.type);
    if (!diagram) return [{ field: 'values', root: false }];
    const operations = command.operations || [];
    const wantsGroups = operations.some(operation => ['toggleGroupCollapse', 'duplicateGroup', 'deleteGroup'].includes(operation?.op));
    const wantsEdges = operations.some(operation => ['removeNode', 'updateEdge', 'removeEdge', 'addEdge', 'duplicateSelection', 'pasteSelection', 'duplicateGroup'].includes(operation?.op) || ['updateField', 'updateRecord'].includes(operation?.op) && operation.edgeId || operation?.op === 'deleteGroup' && operation.policy === 'delete-members');
    const wantsNodes = operations.some(operation => ['addNode', 'removeNode', 'moveNode', 'moveNodes', 'moveNodeToLane', 'resizeNode', 'alignNodes', 'snapNodes', 'moveGroup', 'resizeGroup', 'assignNodesToGroup', 'duplicateGroup', 'deleteGroup', 'duplicateSelection', 'pasteSelection'].includes(operation?.op) || ['updateField', 'updateRecord'].includes(operation?.op) && !operation.edgeId);
    const entries = [];
    if (wantsNodes || !wantsEdges && !wantsGroups) entries.push({ field: 'nodes', root: spec.nodes !== undefined });
    if (wantsEdges) entries.push({ field: 'edges', root: spec.edges !== undefined });
    if (wantsGroups) entries.push({ field: 'groups', root: spec.groups !== undefined });
    return entries;
  }

  context(command) {
    const spec = this.chart.spec;
    const diagram = ['flow', 'swimlane', 'architecture', 'mindmap'].includes(spec.type);
    const entries = this.targetEntries(command);
    const primary = entries[0];
    const nodes = spec.nodes ?? spec.data.nodes ?? [];
    const edges = spec.edges ?? spec.data.edges ?? [];
    const groups = spec.groups ?? spec.data.groups ?? [];
    const lanes = spec.lanes ?? spec.data.lanes ?? [];
    const options = {
      values: primary ? (primary.root ? spec[primary.field] : spec.data[primary.field]) ?? [] : [],
      nodes,
      edges,
      groups,
      lanes,
      layers: spec.layers ?? [],
      boundaries: spec.boundaries ?? [],
      nodeSchema: spec.data.schema ?? spec.schema,
      schema: primary?.field === 'edges' ? spec.data.edgeSchema : spec.data.schema ?? spec.schema,
      edgeSchema: spec.data.edgeSchema,
      type: spec.type,
      nodeModel: spec.type === 'architecture' ? 'architecture-node' : spec.type === 'mindmap' ? 'mindmap-node' : 'flow-node',
      edgeModel: spec.type === 'architecture' ? 'architecture-edge' : spec.type === 'mindmap' ? 'mindmap-edge' : 'flow-edge',
      validationOptions: { ...spec.validationOptions, references: { ...spec.validationOptions?.references, ...(diagram ? { 'flow-node': nodes.map(row => row.id), swimlane: lanes.map(row => row.id) } : {}) } },
      requireConfirmation: spec.editing?.requireConfirmation,
      grid: spec.diagram?.grid || 8,
      diagram: spec.diagram,
      allowStructuralChanges: spec.editing?.allowStructuralChanges === true
    };
    return { options, entries, signature: JSON.stringify([options, spec.editing, spec.type]) };
  }

  validate(input) {
    let command;
    try { command = normalizeCommand(input); } catch { return validateEdit(input); }
    const { preview } = this.prepare(command);
    return { valid: preview.valid, errors: preview.errors, warnings: preview.warnings, affectedRecords: preview.affectedRecords, requiresConfirmation: preview.requiresConfirmation };
  }

  preview(input) {
    let command;
    try { command = normalizeCommand(input); } catch { return previewEdit(input); }
    const { context, preview } = this.prepare(command);
    preview.revision = this.chart._revision;
    if (preview.valid) {
      preview.id = `chart-${this.id}-preview-${++this.sequence}`;
      this.pending.set(preview.id, { command: copyJSON(preview.command), revision: preview.revision, signature: context.signature });
      if (this.pending.size > 50) this.pending.delete(this.pending.keys().next().value);
    }
    return preview;
  }

  prepare(command, beforeModel = null) {
    let context = this.context(command), preview = previewEdit(command, context.options);
    if (preview.valid && preview.targets?.nodes) {
      const explicit = new Set(command.operations.filter(operation => operation.op === 'updateEdge' && ['waypoints', 'routingMode', 'routing', 'from', 'to', 'fromPort', 'toPort'].some(field => Object.hasOwn(operation.changes || {}, field))).map(operation => operation.edgeId));
      const manual = new Map(context.options.edges.map((edge, index) => [edge.id || `edge-${index}`, edge]).filter(([edgeId, edge]) => !explicit.has(edgeId) && (edge.routingMode === 'manual' || edge.routingMode !== 'auto' && edge.waypoints?.length) && ['auto', 'orthogonal'].includes(edge.routing || this.chart.spec.diagram?.routing)));
      if (manual.size) {
        const withTargets = targets => {
          let spec = this.chart.spec;
          Object.entries(targets).forEach(([field, rows]) => { spec = spec[field] !== undefined ? { ...spec, [field]: rows } : { ...spec, data: { ...spec.data, [field]: rows } }; });
          return spec;
        };
        const before = beforeModel || buildScene(this.chart.spec), next = buildScene(withTargets(preview.targets)), nextNodes = new Map(preview.targets.nodes.map(node => [node.id, node]));
        const nodeBox = nodeId => {
          const node = nextNodes.get(nodeId), bounds = next.scene.find(`node-${nodeId}`)?.bounds, view = next.state.view;
          return bounds && node ? { x: node.position?.x ?? (bounds.x - view.offsetX) / view.scale, y: node.position?.y ?? (bounds.y - view.offsetY) / view.scale, width: node.size?.width ?? bounds.width / view.scale, height: node.size?.height ?? bounds.height / view.scale } : null;
        };
        const updates = [];
        before.scene.walk(node => {
          const reference = node.dataRef;
          if (!reference?.edgeId || reference.edgeHandle || reference.routingMode !== 'manual') return;
          const edge = manual.get(reference.edgeId);
          if (!edge || !(preview.targets.edges || context.options.edges).some(candidate => candidate.id === edge.id)) return;
          const from = nodeBox(edge.from), to = nodeBox(edge.to);
          if (!from || !to) return;
          const { start, end } = diagramConnectionPoints(from, to, reference.fromPortDefinition, reference.toPortDefinition);
          const waypoints = reconnectOrthogonalWaypoints(reference.diagramPoints, start, end, edge.waypoints);
          if (JSON.stringify(waypoints) !== JSON.stringify(edge.waypoints)) updates.push({ op: 'updateEdge', edgeId: reference.edgeId, changes: { waypoints } });
        });
        if (updates.length) {
          const proposedEdges = (preview.targets.edges || context.options.edges).map((edge, index) => {
            const update = updates.find(operation => operation.edgeId === (edge.id || `edge-${index}`));
            return update ? { ...edge, ...update.changes } : edge;
          });
          const candidate = buildScene(withTargets({ ...preview.targets, edges: proposedEdges }));
          const valid = new Set(candidate.state.edgeRoutes.filter(route => route.effectiveRoutingMode === 'manual' && route.visible).map(route => route.edgeId));
          const accepted = updates.filter(operation => valid.has(operation.edgeId));
          if (accepted.length) {
            command = { ...command, operations: [...command.operations, ...accepted] };
            context = this.context(command);
            preview = previewEdit(command, context.options);
          }
        }
      }
    }
    let model;
    if (preview.valid && ['flow', 'swimlane', 'architecture', 'mindmap'].includes(this.chart.spec.type)) {
      let spec = this.chart.spec;
      Object.entries(preview.targets || {}).forEach(([field, rows]) => { spec = spec[field] !== undefined ? { ...spec, [field]: rows } : { ...spec, data: { ...spec.data, [field]: rows } }; });
      model = buildScene(spec);
      preview.layout = copyJSON(model.state.diagramLayout);
      preview.warnings.push(...model.data.warnings.filter(warning => !preview.warnings.some(existing => JSON.stringify(existing) === JSON.stringify(warning))));
    }
    preview.errors = preview.errors.map(error => error.code === 'STRUCTURAL_EDIT_DISABLED' ? { ...error, suggestion: 'The host must explicitly enable editing.enabled and editing.allowStructuralChanges in the ChartSpec, then request a fresh preview and confirm before committing. Generated commands cannot grant permission.' } : error);
    return { command, context, preview: this.validateRoutes(preview, model) };
  }

  validateRoutes(preview, preparedModel = null) {
    if (!preview.valid || !preview.targets?.edges) return preview;
    const edited = new Set(preview.command.operations.filter(operation => operation.op === 'updateEdge' && ['waypoints', 'routingMode', 'routing', 'from', 'to', 'fromPort', 'toPort'].some(field => Object.hasOwn(operation.changes || {}, field))).map(operation => operation.edgeId));
    const manual = preview.targets.edges.filter((edge, index) => edited.has(edge.id || `edge-${index}`) && (edge.routingMode === 'manual' || edge.routingMode !== 'auto' && edge.waypoints?.length));
    if (!manual.length) return preview;
    let spec = this.chart.spec;
    Object.entries(preview.targets).forEach(([field, rows]) => { spec = spec[field] !== undefined ? { ...spec, [field]: rows } : { ...spec, data: { ...spec.data, [field]: rows } }; });
    const model = preparedModel || buildScene(spec);
    const errors = manual.flatMap(edge => {
      const edgeId = edge.id || `edge-${preview.targets.edges.indexOf(edge)}`;
      const warning = model.state.routingWarnings?.find(item => item.edgeId === edgeId && item.code === 'EDGE_MANUAL_ROUTE_INVALID');
      if (warning) return [{ ...warning, message: `Manual connector edit rejected (${warning.reason}); the previously committed route is unchanged.` }];
      if (!model.state.edgeRoutes?.some(item => item.edgeId === edgeId && item.visible && item.effectiveRoutingMode === 'manual')) return [issue('EDGE_MANUAL_ROUTE_UNAVAILABLE', 'edges', 'The manual connector is not visible; expand its group before editing its route.')];
      return [];
    });
    return errors.length ? { ...preview, valid: false, errors: [...preview.errors, ...errors], targets: {}, changes: [], patches: [], after: preview.before } : preview;
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
    const prepared = this.prepare(command);
    command = prepared.command;
    const { context, preview } = prepared;
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
      const snapshots = context.entries.map(entry => ({ ...entry, before: copyJSON(entry.root ? chart.spec[entry.field] : chart.spec.data[entry.field]) }));
      const error = this.publish(committed.targets || {}, context.entries);
      if (error) return this.failure('EDIT_RENDER_FAILED', error.message);
      chart._revision += 1;
      committed.revision = chart._revision;
      committed.target = context.entries.map(entry => entry.root ? entry.field : `data.${entry.field}`).join(',');
      committed.audit.operationId = `chart-${this.id}-operation-${chart._revision}`;
      committed.audit.affectedRecords = [...committed.affectedRecords];
      chart._history.push({
        targets: context.entries.map(entry => ({
          field: entry.field,
          root: entry.root,
          before: snapshots.find(snapshot => snapshot.field === entry.field && snapshot.root === entry.root)?.before,
          after: copyJSON(entry.root ? chart.spec[entry.field] : chart.spec.data[entry.field])
        })),
        changeSet: committed
      });
      chart._lastChangeSet = copyJSON(committed);
      this.pending.clear();
      this.notify('edit', { chart, changeSet: copyJSON(committed) });
      return copyJSON(committed);
    } finally { this.busy = false; }
  }

  publish(targets, entries) {
    const chart = this.chart, previousSpec = chart.spec, previousModel = chart.model, previousDiagnostics = chart._specDiagnostics;
    let nextSpec = chart.spec;
    entries.forEach(entry => {
      const rows = targets[entry.field];
      if (!rows) return;
      nextSpec = entry.root ? { ...nextSpec, [entry.field]: copyJSON(rows) } : { ...nextSpec, data: { ...nextSpec.data, [entry.field]: copyJSON(rows) } };
    });
    try {
      const validation = validateSpec(nextSpec);
      if (!validation.valid) throw new Error(validation.errors.map(error => `${error.code}: ${error.message}`).join(' '));
      chart.spec = nextSpec;
      chart._specDiagnostics = { warnings: validation.warnings, normalizations: validation.normalizations };
      chart.render();
      return null;
    } catch (error) {
      chart.spec = previousSpec;
      chart.model = previousModel;
      chart._specDiagnostics = previousDiagnostics;
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
    const stale = entry.targets.some(target => {
      const current = target.root ? chart.spec[target.field] : chart.spec.data[target.field];
      return JSON.stringify(current) !== JSON.stringify(direction === 'undo' ? target.after : target.before);
    });
    if (stale) return this.failure('STALE_HISTORY', 'Data changed outside the edit history.');
    this.busy = true;
    try {
      const targets = Object.fromEntries(entry.targets.map(target => [target.field, direction === 'undo' ? target.before : target.after]));
      const error = this.publish(targets, entry.targets);
      if (error) return this.failure('EDIT_RENDER_FAILED', error.message);
      chart._history[direction]();
      chart._revision += 1;
      const result = { valid: true, direction, revision: chart._revision, rows: copyJSON(targets[entry.targets[0]?.field]), targets: copyJSON(targets), target: entry.changeSet.target, affectedRecords: entry.changeSet.affectedRecords, audit: { operationId: `chart-${this.id}-operation-${chart._revision}`, originalOperationId: entry.changeSet.audit.operationId, actor: options.actor || 'host', source: 'history', timestamp: new Date().toISOString(), reason: direction, affectedRecords: entry.changeSet.affectedRecords } };
      chart._lastChangeSet = copyJSON(result);
      this.pending.clear();
      this.notify('undoredo', { chart, ...copyJSON(result) });
      return copyJSON(result);
    } finally { this.busy = false; }
  }
}
