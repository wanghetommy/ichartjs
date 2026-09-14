import { copyJSON, getBusinessSchema, issue, validateDataSchema } from './schema.mjs';
import { validateData } from './validation.mjs';
import { commandCapabilities, normalizeCommand, validateCommand } from './command.mjs';

const day = 86400000;
const plusDays = (value, days) => { const date = new Date(`${value}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
const equality = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const recordId = operation => operation.recordId ?? operation.taskId ?? operation.nodeId ?? operation.edgeId;

export function businessModelForType(type) {
  return { gantt: 'project-task', timeline: 'timeline-event', milestone: 'milestone', burndown: 'burndown-sample', flow: 'flow-node', swimlane: 'flow-node' }[type] || type;
}

function change(before, after, path, operation) { return { path, before: copyJSON(before), after: copyJSON(after), operation: operation.op }; }

export function previewEdit(input, options = {}) {
  let command;
  try { command = normalizeCommand(input); } catch (error) { return { valid: false, errors: [issue('INVALID_COMMAND', 'command', error.message)], changes: [], patches: [], affectedRecords: [], warnings: [], requiresConfirmation: false }; }
  const commandResult = validateCommand(command), schemaResult = validateDataSchema(options.schema), errors = [...commandResult.errors, ...schemaResult.errors], warnings = [], changes = [], patches = [], affected = new Set();
  if (!commandResult.valid || !schemaResult.valid) return result({ valid: false, errors, command, changes, patches, affectedRecords: [], warnings, requiresConfirmation: false });
  if (command.type === 'layout-edit' && !['flow-node', 'flow-edge'].includes(schemaResult.schema.name)) errors.push(issue('COMMAND_MODEL', 'command.type', 'layout-edit only supports diagram models.'));
  const inputRows = copyJSON(options.values || []), validation = validateData(inputRows, schemaResult.schema, options.validationOptions), rows = validation.rows;
  errors.push(...validation.errors); warnings.push(...validation.warnings);
  const key = schemaResult.schema.key, index = new Map(rows.map((row, rowIndex) => [row[key], { row, rowIndex }])), editable = name => schemaResult.schema.fields[name]?.editable !== false && schemaResult.schema.fields[name]?.agentEditable !== false;
  const target = operation => index.get(recordId(operation));
  const requireTarget = (operation, opIndex) => { const hit = target(operation); if (!hit) errors.push(issue('RECORD_NOT_FOUND', `command.operations.${opIndex}`, `Record ${recordId(operation)} was not found.`)); return hit; };
  const setField = (hit, field, value, operation, opIndex) => {
    if (!Object.hasOwn(schemaResult.schema.fields, field)) { errors.push(issue('UNKNOWN_FIELD', `command.operations.${opIndex}.changes.${field}`, 'Field is not declared in the schema.')); return; }
    if (!editable(field)) { errors.push(issue('READ_ONLY_FIELD', `command.operations.${opIndex}.changes.${field}`, `Field ${field} is not editable by an Agent.`)); return; }
    const before = hit.row[field]; hit.row[field] = copyJSON(value); changes.push(change(before, hit.row[field], `values.${hit.rowIndex}.${field}`, operation)); patches.push({ op: 'replace', path: `/values/${hit.rowIndex}/${field}`, value: copyJSON(value) }); affected.add(hit.row[key]);
  };
  command.operations.forEach((operation, opIndex) => {
    const hit = requireTarget(operation, opIndex); if (!hit) return;
    if (operation.op === 'updateField') setField(hit, operation.field, operation.value, operation, opIndex);
    if (['updateRecord', 'updateTask', 'updateMilestone'].includes(operation.op)) Object.entries(operation.changes || {}).forEach(([field, value]) => setField(hit, field, value, operation, opIndex));
    if (operation.op === 'updateProgress') { setField(hit, 'progress', operation.progress, operation, opIndex); if (operation.status !== undefined) setField(hit, 'status', operation.status, operation, opIndex); }
    if (operation.op === 'shiftTask') {
      if (!equality(hit.row.status, 'done') || operation.allowCompleted) { setField(hit, 'start', plusDays(hit.row.start, operation.days), operation, opIndex); setField(hit, 'end', plusDays(hit.row.end, operation.days), operation, opIndex); }
      else warnings.push(issue('COMPLETED_TASK', `command.operations.${opIndex}`, 'Completed task schedule change requires explicit allowCompleted.'));
      if (operation.shiftDependents) rows.filter(row => (row.dependencies || []).includes(hit.row[key])).forEach(row => { const dependent = index.get(row[key]); if (dependent) { const days = operation.days; setField(dependent, 'start', plusDays(dependent.row.start, days), operation, opIndex); setField(dependent, 'end', plusDays(dependent.row.end, days), operation, opIndex); } });
    }
    if (['addDependency', 'removeDependency'].includes(operation.op)) {
      const current = Array.isArray(hit.row.dependencies) ? [...hit.row.dependencies] : [], next = operation.op === 'addDependency' ? [...new Set([...current, operation.dependencyId])] : current.filter(id => id !== operation.dependencyId); setField(hit, 'dependencies', next, operation, opIndex);
    }
    if (operation.op === 'moveNode') setField(hit, 'position', operation.position, operation, opIndex);
    if (operation.op === 'moveNodeToLane') setField(hit, 'laneId', operation.laneId, operation, opIndex);
    if (operation.op === 'updateEdge') Object.entries(operation.changes || {}).forEach(([field, value]) => setField(hit, field, value, operation, opIndex));
  });
  const finalValidation = validateData(rows, schemaResult.schema, options.validationOptions); errors.push(...finalValidation.errors); warnings.push(...finalValidation.warnings);
  if (errors.length) return result({ valid: false, errors, command, changes: [], patches: [], affectedRecords: [...affected], warnings, requiresConfirmation: false, before: inputRows, after: inputRows });
  const requiresConfirmation = options.requireConfirmation !== false || command.operations.some(operation => ['addRecord', 'removeRecord', 'addDependency', 'removeDependency', 'updateEdge'].includes(operation.op));
  return result({ valid: true, errors: [], command, changes, patches, affectedRecords: [...affected], warnings, requiresConfirmation, before: inputRows, after: rows, normalized: finalValidation.rows, capabilities: commandCapabilities(schemaResult.schema) });
}

function result(value) { return { ...value, id: value.id || `preview-${JSON.stringify(value.command || {}).length}-${(value.changes || []).length}`, revision: value.revision ?? null, assumptions: ['Only declared editable fields may change.', 'Preview operates on a copied local dataset.', 'External persistence and authorization remain the host application responsibility.'] }; }

export function validateEdit(input, options = {}) { const preview = previewEdit(input, options); return { valid: preview.valid, errors: preview.errors, warnings: preview.warnings, affectedRecords: preview.affectedRecords, requiresConfirmation: preview.requiresConfirmation }; }

export function getEditCapabilities(schema) { return commandCapabilities(validateDataSchema(schema).schema || {}); }

export function commitPreview(preview, options = {}) {
  if (!preview?.valid) return { valid: false, errors: [issue('INVALID_PREVIEW', 'preview', 'Only a valid preview can be committed.')], warnings: [] };
  if (preview.requiresConfirmation && options.confirmed !== true && !options.approval) return { valid: false, errors: [issue('CONFIRMATION_REQUIRED', 'approval', 'This edit requires explicit host confirmation.')], warnings: preview.warnings || [] };
  if (options.previewId !== undefined && options.previewId !== preview.id) return { valid: false, errors: [issue('PREVIEW_MISMATCH', 'previewId', 'Approval does not match this preview.')], warnings: [] };
  if (options.expectedRevision !== undefined && options.expectedRevision !== preview.revision) return { valid: false, errors: [issue('STALE_PREVIEW', 'expectedRevision', 'The preview was created from a stale data revision.')], warnings: [] };
  return { valid: true, rows: copyJSON(preview.normalized || preview.after), changes: copyJSON(preview.changes), patches: copyJSON(preview.patches), affectedRecords: copyJSON(preview.affectedRecords), warnings: copyJSON(preview.warnings || []), command: copyJSON(preview.command), audit: { actor: options.actor || 'host', timestamp: options.timestamp || new Date().toISOString(), reason: preview.command?.reason || options.reason || 'business edit', source: options.source || 'agent', previewId: preview.id } };
}
