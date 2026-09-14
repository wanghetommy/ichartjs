/**
 * Business data validation against declared schemas and cross-field rules.
 * Returns normalized rows plus structured errors and warnings.
 */
import { copyJSON, isRecord, issue, validateDataSchema } from './schema.mjs';

export function isDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export function cyclicIds(rows, key, field) {
  const degree = new Map(rows.map(row => [row[key], 0])), next = new Map(rows.map(row => [row[key], []]));
  rows.forEach(row => (row[field] || []).forEach(id => { if (degree.has(id)) { degree.set(row[key], degree.get(row[key]) + 1); next.get(id).push(row[key]); } }));
  const queue = [...degree.keys()].filter(id => degree.get(id) === 0);
  for (let index = 0; index < queue.length; index += 1) next.get(queue[index]).forEach(id => { degree.set(id, degree.get(id) - 1); if (degree.get(id) === 0) queue.push(id); });
  return [...degree.keys()].filter(id => degree.get(id) > 0);
}

export function validateData(input, schema, options = {}) {
  const contract = validateDataSchema(schema), errors = [...contract.errors], warnings = [], normalizations = [];
  let original = [], rows = [], references = {};
  if (!contract.valid) return { valid: false, errors, warnings, normalizations, original, rows };
  try {
    original = copyJSON(input);
    references = copyJSON(options.references ?? {});
    if (!Array.isArray(original) || !isRecord(references)) throw new Error('Data must be a row array; references must be a table object.');
    rows = copyJSON(original);
  } catch (error) { return { valid: false, errors: [issue('INVALID_DATA', 'values', error.message)], warnings, normalizations, original: [], rows: [] }; }
  if (options.progressUnit !== undefined && !['ratio', 'percent'].includes(options.progressUnit)) errors.push(issue('PROGRESS_UNIT', 'options.progressUnit', 'Use ratio or percent explicitly.'));
  const normalizeField = (object, name, field, path) => {
    if (!Object.hasOwn(object, name)) {
      if (Object.hasOwn(field, 'default')) {
        object[name] = copyJSON(field.default);
        normalizations.push({ path, beforePresent: false, after: copyJSON(object[name]), reason: 'default' });
      } else { if (field.required) errors.push(issue('REQUIRED', path, 'Required field is missing.')); return; }
    }
    const value = object[name];
    if (value === null && field.nullable) return;
    const correctType = field.type === 'string' ? typeof value === 'string' && (!field.required || value.length > 0)
      : field.type === 'number' ? typeof value === 'number' && Number.isFinite(value)
        : field.type === 'boolean' ? typeof value === 'boolean'
          : field.type === 'date' ? isDateOnly(value)
            : field.type === 'enum' ? field.values.includes(value)
              : field.type === 'array' ? Array.isArray(value) : isRecord(value);
    if (!correctType) { errors.push(issue('FIELD_VALUE', path, `Expected ${field.type}.`, field.type === 'date' ? 'Use a real calendar date YYYY-MM-DD; timestamps are not date-only values.' : 'Use the declared type; automatic string/number coercion is disabled.')); return; }
    if (field.type === 'number' && ((field.min !== undefined && value < field.min) || (field.max !== undefined && value > field.max))) errors.push(issue('OUT_OF_RANGE', path, 'Value is outside the declared limits.'));
    if (field.type === 'array') {
      if (field.unique && new Set(value.map(item => JSON.stringify(item))).size !== value.length) errors.push(issue('DUPLICATE_VALUE', path, 'Array values must be unique.'));
      value.forEach((item, index) => normalizeField(value, index, field.items, `${path}.${index}`));
    }
    if (field.type === 'object') {
      Object.keys(value).filter(key => !Object.hasOwn(field.properties, key)).forEach(key => errors.push(issue('UNKNOWN_FIELD', `${path}.${key}`, 'Object property is not declared.')));
      Object.entries(field.properties).forEach(([key, child]) => normalizeField(value, key, child, `${path}.${key}`));
    }
  };
  const ids = new Set();
  rows.forEach((row, index) => {
    const path = `values.${index}`;
    if (!isRecord(row)) { errors.push(issue('INVALID_RECORD', path, 'Each row must be an object.')); return; }
    if (options.progressUnit === 'ratio' && schema.name === 'project-task' && Object.hasOwn(row, 'progress')) {
      if (typeof row.progress !== 'number' || row.progress < 0 || row.progress > 1) errors.push(issue('PROGRESS_UNIT', `${path}.progress`, 'Ratio progress must be between 0 and 1.'));
      else { const before = row.progress; row.progress *= 100; normalizations.push({ path: `${path}.progress`, beforePresent: true, before, after: row.progress, reason: 'ratio-to-percent' }); }
    }
    Object.keys(row).filter(key => !Object.hasOwn(schema.fields, key)).forEach(key => errors.push(issue('UNKNOWN_FIELD', `${path}.${key}`, 'Field is not declared in the business schema.')));
    Object.entries(schema.fields).forEach(([name, field]) => normalizeField(row, name, field, `${path}.${name}`));
    if (ids.has(row[schema.key])) errors.push(issue('DUPLICATE_ID', `${path}.${schema.key}`, 'Primary keys must be unique.'));
    ids.add(row[schema.key]);
  });
  if (!errors.length) {
    rows.forEach((row, index) => {
      for (const [name, field] of Object.entries(schema.fields)) {
        if (!field.references || row[name] == null) continue;
        let targets = ids;
        if (field.references !== 'self') {
          const table = references[field.references];
          if (!Array.isArray(table) || table.some(id => typeof id !== 'string')) { errors.push(issue('REFERENCE_CONTEXT', `references.${field.references}`, 'Supply the trusted related record IDs before validating references.')); continue; }
          targets = new Set(table);
        }
        const values = Array.isArray(row[name]) ? row[name] : [row[name]];
        values.forEach(id => { if (!targets.has(id)) errors.push(issue('MISSING_REFERENCE', `values.${index}.${name}`, `Unknown referenced ID: ${id}`)); });
      }
      for (const rule of schema.rules || []) {
        let valid = true;
        if (rule.kind === 'compare' && row[rule.left] != null && row[rule.right] != null) {
          const left = row[rule.left], right = row[rule.right];
          valid = { gte: left >= right, gt: left > right, lte: left <= right, lt: left < right, eq: left === right }[rule.op];
        } else if (rule.kind === 'implies') valid = JSON.stringify(row[rule.if.field]) !== JSON.stringify(rule.if.equals) || JSON.stringify(row[rule.then.field]) === JSON.stringify(rule.then.equals);
        if (!valid) errors.push(issue('BUSINESS_RULE', `values.${index}`, rule.message || `Rule ${rule.id} failed.`, 'Update related fields together.', rule.id));
      }
    });
    for (const [name, field] of Object.entries(schema.fields)) if (field.acyclic) {
      const blocked = cyclicIds(rows, schema.key, name);
      if (blocked.length) errors.push(issue('CYCLIC_DEPENDENCY', `values.*.${name}`, `Cycle blocks records: ${blocked.join(', ')}`));
    }
  }
  if (normalizations.length) warnings.push(issue('NORMALIZED_DATA', 'values', 'Explicit conversions/defaults were applied to the returned copy; input is unchanged.', 'Use the normalized rows as the preview baseline.'));
  return { valid: errors.length === 0, errors, warnings, normalizations, original, rows };
}
