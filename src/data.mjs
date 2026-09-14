/**
 * Data inspection, normalization, and immutable transformation pipeline.
 * Provides the common row model consumed by chart and Agent APIs.
 */
function typeOf(values) {
  const usable = values.filter(value => value !== null && value !== undefined && value !== '');
  if (!usable.length) return 'unknown';
  if (usable.every(value => typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))))) return 'quantitative';
  if (usable.every(value => !Number.isNaN(Date.parse(value)) && typeof value === 'string')) return 'temporal';
  return 'category';
}

export function normalizeData(input) {
  let values = [];
  if (Array.isArray(input)) {
    if (input.every(row => Array.isArray(row))) values = input.map(row => ({ name: row[0], value: row[1] }));
    else values = input.map(row => ({ ...row }));
  } else if (input && Array.isArray(input.values)) {
    values = input.values.map(row => ({ ...row }));
  } else if (input && Array.isArray(input.categories) && Array.isArray(input.series)) {
    input.series.forEach(series => input.categories.forEach((category, index) => values.push({ name: category, series: series.name, value: series.data[index] })));
  }
  const fields = [];
  values.forEach(row => Object.keys(row).forEach(field => { if (!fields.includes(field)) fields.push(field); }));
  const warnings = [];
  const normalized = values.map((row, rowIndex) => {
    const copy = { ...row };
    fields.forEach(field => {
      if (copy[field] !== null && copy[field] !== undefined && copy[field] !== '' && typeof copy[field] === 'string' && Number.isFinite(Number(copy[field]))) copy[field] = Number(copy[field]);
    });
    if (Object.values(copy).some(value => value === null || value === undefined || value === '')) warnings.push({ code: 'MISSING_VALUE', row: rowIndex, message: 'Row contains a missing value.' });
    return copy;
  });
  const fieldInfo = fields.map(name => {
    const valuesForField = normalized.map(row => row[name]);
    const numbers = valuesForField.filter(value => typeof value === 'number' && Number.isFinite(value));
    return { name, type: typeOf(valuesForField), nullCount: valuesForField.length - valuesForField.filter(value => value !== null && value !== undefined && value !== '').length, min: numbers.length ? Math.min(...numbers) : undefined, max: numbers.length ? Math.max(...numbers) : undefined };
  });
  return { rows: normalized, fields: fieldInfo, warnings };
}

export function inspectData(input) {
  const data = normalizeData(input);
  const dimensions = data.fields.filter(field => field.type === 'category' || field.type === 'temporal').map(field => field.name);
  const measures = data.fields.filter(field => field.type === 'quantitative').map(field => field.name);
  return { rows: data.rows.length, fields: data.fields, dimensions, measures, warnings: data.warnings };
}

export class DataPipeline {
  constructor(input) { this._rows = normalizeData(input).rows; }
  filter(predicate) { this._rows = this._rows.filter(predicate); return this; }
  sortBy(field, direction = 'asc') { this._rows = [...this._rows].sort((a, b) => { const left = a[field], right = b[field]; const result = left === right ? 0 : left > right ? 1 : -1; return direction === 'desc' ? -result : result; }); return this; }
  groupBy(field) { this._groupField = field; return this; }
  sum(field, output = field) { if (!this._groupField) return this; const groups = new Map(); this._rows.forEach(row => { const key = row[this._groupField]; const item = groups.get(key) || { [this._groupField]: key, [output]: 0 }; item[output] += Number(row[field]) || 0; groups.set(key, item); }); this._rows = [...groups.values()]; return this; }
  average(field, output = field) { if (!this._groupField) return this; const groups = new Map(); this._rows.forEach(row => { const key = row[this._groupField]; const item = groups.get(key) || { [this._groupField]: key, [output]: 0, __count: 0 }; item[output] += Number(row[field]) || 0; item.__count += 1; groups.set(key, item); }); this._rows = [...groups.values()].map(row => { row[output] /= row.__count; delete row.__count; return row; }); return this; }
  topN(field, count) { this._rows = [...this._rows].sort((a, b) => (Number(b[field]) || 0) - (Number(a[field]) || 0)).slice(0, count); return this; }
  percentage(field, output = field) { const total = this._rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0) || 1; this._rows = this._rows.map(row => ({ ...row, [output]: (Number(row[field]) || 0) / total })); return this; }
  toArray() { return this._rows.map(row => ({ ...row })); }
}

export function data(input) { return new DataPipeline(input); }
