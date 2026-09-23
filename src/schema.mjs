/**
 * JSON-safe schema utilities and built-in Agent business data contracts.
 * Defines editable fields, validation constraints, and structured issues.
 */
export const schemaVersion = '1.0';
export const fieldTypes = ['string', 'number', 'boolean', 'date', 'enum', 'array', 'object'];
const forbiddenKeys = new Set(['__proto__', 'prototype', 'constructor']);

export function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

export function copyJSON(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if ((!Array.isArray(value) && !isRecord(value)) || seen.has(value)) throw new Error('Expected finite, acyclic JSON data.');
  seen.add(value);
  const result = Array.isArray(value) ? [] : {};
  for (const key of Object.keys(value)) {
    if (forbiddenKeys.has(key)) throw new Error(`Unsafe key: ${key}`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!Object.hasOwn(descriptor, 'value')) throw new Error('Accessors are not JSON data.');
    result[key] = copyJSON(descriptor.value, seen);
  }
  seen.delete(value);
  return result;
}

export function issue(code, path, message, suggestion = 'Correct the input and validate again.', rule = null) {
  return { code, path, rule, message, suggestion };
}

const identifier = { type: 'string', required: true, editable: false };
const status = { type: 'enum', values: ['todo', 'active', 'blocked', 'done'], default: 'todo', editable: true };
const position = { type: 'object', editable: true, properties: { x: { type: 'number', required: true }, y: { type: 'number', required: true } } };
const dependency = { anyOf: [
  { type: 'string' },
  { type: 'object', properties: {
    id: { type: 'string', required: true },
    type: { type: 'enum', values: ['finish-to-start', 'start-to-start', 'finish-to-finish', 'start-to-finish'] },
    lag: { type: 'number' },
    lead: { type: 'number' }
  } }
] };
const schema = (name, fields, rules = []) => ({ name, version: schemaVersion, key: 'id', fields: { id: identifier, ...fields }, rules });
const models = {
  'project-task': schema('project-task', {
    name: { type: 'string', required: true, editable: true },
    start: { type: 'date', required: true, editable: true },
    end: { type: 'date', required: true, editable: true },
    baselineStart: { type: 'date', editable: true },
    baselineEnd: { type: 'date', editable: true },
    actualStart: { type: 'date', editable: true },
    actualEnd: { type: 'date', editable: true },
    baselineDate: { type: 'date', editable: true },
    actualDate: { type: 'date', editable: true },
    progress: { type: 'number', min: 0, max: 100, default: 0, editable: true },
    status,
    owner: { type: 'string', editable: true },
    resource: { type: 'string', editable: true },
    capacity: { type: 'number', min: 0, editable: true },
    load: { type: 'number', min: 0, editable: true },
    points: { type: 'number', min: 0, editable: true },
    sprint: { type: 'string', editable: true },
    priority: { type: 'enum', values: ['low', 'medium', 'high', 'critical'], editable: true },
    labels: { type: 'array', items: { type: 'string' }, default: [], editable: true },
    dependencies: { type: 'array', items: dependency, default: [], unique: true, references: 'self', acyclic: true, editable: true }
  }, [
    { id: 'end-after-start', kind: 'compare', left: 'end', op: 'gte', right: 'start', message: 'End must not precede start.' },
    { id: 'done-progress', kind: 'implies', if: { field: 'status', equals: 'done' }, then: { field: 'progress', equals: 100 }, message: 'Completed tasks require 100% progress.' }
  ]),
  'timeline-event': schema('timeline-event', { title: { type: 'string', required: true, editable: true }, date: { type: 'date', required: true, editable: true }, description: { type: 'string', editable: true }, status }),
  milestone: schema('milestone', { title: { type: 'string', required: true, editable: true }, date: { type: 'date', required: true, editable: true }, status }),
  'burndown-sample': schema('burndown-sample', { date: { type: 'date', required: true, editable: true }, remaining: { type: 'number', min: 0, required: true, editable: true }, scopeChange: { type: 'number', default: 0, editable: true }, forecast: { type: 'date', nullable: true, editable: false } }),
  'flow-node': schema('flow-node', { label: { type: 'string', required: true, editable: true }, position, size: { type: 'object', editable: true, properties: { width: { type: 'number', required: true, min: 1 }, height: { type: 'number', required: true, min: 1 } } }, laneId: { type: 'string', references: 'swimlane', editable: true }, groupId: { type: 'string', editable: false }, ports: { type: 'array', editable: false, items: { type: 'object', properties: { id: { type: 'string', required: true }, side: { type: 'enum', values: ['left', 'right', 'top', 'bottom'] }, offset: { type: 'number', min: 0, max: 1 } } } }, description: { type: 'string', editable: true }, status }),
  'flow-edge': schema('flow-edge', {
    from: { type: 'string', references: 'flow-node', required: true, editable: true },
    to: { type: 'string', references: 'flow-node', required: true, editable: true },
    fromPort: { type: 'string', editable: true },
    toPort: { type: 'string', editable: true },
    label: { type: 'string', editable: true },
    status,
    routing: { type: 'enum', values: ['straight', 'orthogonal', 'curved'], editable: true },
    curveTension: { type: 'number', min: 0.2, max: 0.8, editable: true },
    waypoints: { type: 'array', editable: true, items: { type: 'object', properties: { x: { type: 'number', required: true }, y: { type: 'number', required: true } } } }
  }),
  swimlane: schema('swimlane', { label: { type: 'string', required: true, editable: true } }),
  'architecture-node': schema('architecture-node', { label: { type: 'string', required: true, editable: true }, layerId: { type: 'string', editable: true }, boundaryId: { type: 'string', editable: true }, position, size: { type: 'object', editable: true, properties: { width: { type: 'number', required: true, min: 1 }, height: { type: 'number', required: true, min: 1 } } }, ports: { type: 'array', editable: false, items: { type: 'object', properties: { id: { type: 'string', required: true }, side: { type: 'enum', values: ['left', 'right', 'top', 'bottom'] }, offset: { type: 'number', min: 0, max: 1 } } } }, description: { type: 'string', editable: true }, status }),
  'architecture-edge': schema('architecture-edge', { from: { type: 'string', required: true, editable: true }, to: { type: 'string', required: true, editable: true }, label: { type: 'string', editable: true }, relation: { type: 'string', editable: true }, routing: { type: 'enum', values: ['straight', 'orthogonal', 'curved'], editable: true }, curveTension: { type: 'number', min: 0.2, max: 0.8, editable: true }, waypoints: { type: 'array', editable: true, items: { type: 'object', properties: { x: { type: 'number', required: true }, y: { type: 'number', required: true } } } }, status }),
  'mindmap-edge': schema('mindmap-edge', { from: { type: 'string', required: true, editable: true }, to: { type: 'string', required: true, editable: true }, label: { type: 'string', editable: true }, routing: { type: 'enum', values: ['straight', 'orthogonal', 'curved'], editable: true }, curveTension: { type: 'number', min: 0.2, max: 0.8, editable: true }, waypoints: { type: 'array', editable: true, items: { type: 'object', properties: { x: { type: 'number', required: true }, y: { type: 'number', required: true } } } }, status }),
  'mindmap-node': schema('mindmap-node', { label: { type: 'string', required: true, editable: true }, parentId: { type: 'string', editable: true }, position, size: { type: 'object', editable: true, properties: { width: { type: 'number', required: true, min: 1 }, height: { type: 'number', required: true, min: 1 } } }, branch: { type: 'string', editable: true }, description: { type: 'string', editable: true }, status })
};

export function getBusinessSchema(name) {
  if (!Object.hasOwn(models, name)) throw new Error(`Unknown business model: ${name}`);
  return copyJSON(models[name]);
}

export function validateDataSchema(input) {
  const errors = [];
  let result;
  try { result = copyJSON(input); } catch (error) { return { valid: false, errors: [issue('INVALID_JSON', 'schema', error.message)], schema: null }; }
  if (!isRecord(result)) return { valid: false, errors: [issue('INVALID_SCHEMA', 'schema', 'Schema must be an object.')], schema: null };
  if (result.version !== schemaVersion) errors.push(issue('SCHEMA_VERSION', 'schema.version', 'Unsupported schema version.', 'Use 1.0; migration is not automatic.'));
  if (typeof result.name !== 'string' || !result.name) errors.push(issue('SCHEMA_NAME', 'schema.name', 'Schema name is required.'));
  const fields = isRecord(result.fields) ? result.fields : {};
  if (typeof result.key !== 'string' || fields[result.key]?.type !== 'string' || !fields[result.key]?.required || fields[result.key]?.editable !== false) errors.push(issue('SCHEMA_KEY', 'schema.key', 'The primary key must be a required read-only string field.'));
  const allowed = ['type', 'anyOf', 'required', 'editable', 'agentEditable', 'nullable', 'default', 'min', 'max', 'values', 'items', 'properties', 'references', 'acyclic', 'unique'];
  const checkField = (field, path, depth = 0) => {
    if (!isRecord(field) || depth > 12) { errors.push(issue('INVALID_FIELD', path, 'Invalid or excessively nested field definition.')); return; }
    Object.keys(field).filter(key => !allowed.includes(key)).forEach(key => errors.push(issue('UNSUPPORTED_CONSTRAINT', `${path}.${key}`, `Constraint ${key} is not implemented; it will not be ignored.`)));
    if (field.anyOf !== undefined) {
      if (!Array.isArray(field.anyOf) || field.anyOf.length < 2) errors.push(issue('FIELD_UNION', path, 'anyOf requires at least two field definitions.'));
      else field.anyOf.forEach((option, index) => checkField(option, `${path}.anyOf.${index}`, depth + 1));
    } else if (!fieldTypes.includes(field.type)) errors.push(issue('FIELD_TYPE', path, 'Unsupported field type.'));
    for (const key of ['required', 'editable', 'agentEditable', 'nullable', 'acyclic', 'unique']) if (field[key] !== undefined && typeof field[key] !== 'boolean') errors.push(issue('FIELD_FLAG', `${path}.${key}`, 'Expected a boolean.'));
    for (const key of ['min', 'max']) if (field[key] !== undefined && (field.type !== 'number' || typeof field[key] !== 'number')) errors.push(issue('FIELD_RANGE', `${path}.${key}`, 'Numeric limits apply to number fields only.'));
    if (field.min > field.max) errors.push(issue('FIELD_RANGE', path, 'min exceeds max.'));
    if (field.type === 'enum' && (!Array.isArray(field.values) || !field.values.length || !field.values.every(value => typeof value === 'string'))) errors.push(issue('ENUM_VALUES', path, 'Enum values must be a nonempty string array.'));
    if (field.type === 'array') checkField(field.items, `${path}.items`, depth + 1);
    if (field.type === 'object') {
      if (!isRecord(field.properties)) errors.push(issue('OBJECT_PROPERTIES', path, 'Object fields need explicit properties.'));
      else Object.entries(field.properties).forEach(([key, child]) => checkField(child, `${path}.properties.${key}`, depth + 1));
    }
    const referenceItem = field.type === 'array' && (field.items?.type === 'string' || field.items?.anyOf?.some(option => option.type === 'string'));
    if (field.references !== undefined && (typeof field.references !== 'string' || !field.references || !(field.type === 'string' || referenceItem))) errors.push(issue('REFERENCE_SCHEMA', path, 'References require string IDs or arrays containing string IDs.'));
    if (field.acyclic && (field.type !== 'array' || field.references !== 'self')) errors.push(issue('ACYCLIC_SCHEMA', path, 'Cycle checks require self-referencing arrays.'));
  };
  Object.entries(fields).forEach(([name, field]) => checkField(field, `schema.fields.${name}`));
  const rules = result.rules ?? [], ruleIds = new Set();
  if (!Array.isArray(rules)) errors.push(issue('INVALID_RULES', 'schema.rules', 'Rules must be declarative objects, not executable expressions.'));
  else rules.forEach((rule, index) => {
    const path = `schema.rules.${index}`;
    if (!isRecord(rule) || typeof rule.id !== 'string' || !rule.id || ruleIds.has(rule.id)) { errors.push(issue('INVALID_RULE', path, 'Each rule requires a unique string ID.')); return; }
    ruleIds.add(rule.id);
    if (rule.kind === 'compare') {
      if (!['gte', 'gt', 'lte', 'lt', 'eq'].includes(rule.op) || !fields[rule.left] || !fields[rule.right] || fields[rule.left].type !== fields[rule.right].type || !['date', 'number'].includes(fields[rule.left].type)) errors.push(issue('INVALID_RULE', path, 'Comparisons need matching number or date fields and a supported operator.'));
    } else if (rule.kind === 'implies') {
      if (![rule.if, rule.then].every(term => isRecord(term) && fields[term.field] && Object.hasOwn(term, 'equals'))) errors.push(issue('INVALID_RULE', path, 'Implications require if/then field and equals objects.'));
    } else errors.push(issue('UNSUPPORTED_RULE', path, 'Only compare and implies rules are implemented.'));
  });
  return { valid: errors.length === 0, errors, schema: result };
}

export function inspectDataSchema(input) {
  const result = validateDataSchema(input);
  return { ...result, models: Object.keys(models), fieldTypes: [...fieldTypes], rules: ['compare', 'implies'], normalization: 'explicit-only', progressUnit: 'percent-0-100' };
}
