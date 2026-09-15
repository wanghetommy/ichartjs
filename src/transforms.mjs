/**
 * Deterministic standalone transforms used by Specs and data pipelines.
 */
function rowsFrom(input) {
  if (Array.isArray(input)) return input.map(row => ({ ...row }));
  if (input && Array.isArray(input.values)) return input.values.map(row => ({ ...row }));
  return [];
}

export function binData(input, options = {}) {
  const rows = rowsFrom(input), field = options.field || 'value', output = options.output || 'count';
  const valid = [], warnings = [];
  rows.forEach((row, index) => { const value = Number(row[field]); if (Number.isFinite(value)) valid.push({ value, index }); else warnings.push({ code: 'INVALID_BIN_VALUE', path: `rows.${index}.${field}`, message: 'Bin input must be numeric.' }); });
  if (!valid.length) return { rows: [], warnings, assumptions: ['Bins include the lower bound and exclude the upper bound, except the final bin.'] };
  const sourceMin = Math.min(...valid.map(item => item.value)), sourceMax = Math.max(...valid.map(item => item.value));
  const extent = Array.isArray(options.extent) && options.extent.length === 2 ? options.extent.map(Number) : [sourceMin, sourceMax];
  const min = extent[0], max = extent[1];
  const thresholdCount = Math.max(1, Math.round(Number(options.thresholds) || Math.ceil(Math.sqrt(valid.length))));
  const step = Number(options.step) > 0 ? Number(options.step) : (max - min || 1) / thresholdCount;
  const count = Math.max(1, Math.ceil((max - min || step) / step));
  const bins = Array.from({ length: count }, (_, index) => ({ binStart: min + index * step, binEnd: index === count - 1 ? max : min + (index + 1) * step, [output]: 0, sourceIndices: [] }));
  valid.forEach(item => { if (item.value < min || item.value > max) return; const index = Math.min(count - 1, Math.max(0, Math.floor((item.value - min) / step))); bins[index][output] += 1; bins[index].sourceIndices.push(item.index); });
  return { rows: bins.map(bin => ({ ...bin, name: `${Number(bin.binStart.toFixed(6))}–${Number(bin.binEnd.toFixed(6))}`, value: bin[output] })), warnings, assumptions: ['Bins include the lower bound and exclude the upper bound, except the final bin.'] };
}

export function applyTransforms(input, transforms = []) {
  let rows = rowsFrom(input), warnings = [], assumptions = [];
  for (const transform of Array.isArray(transforms) ? transforms : [transforms]) {
    if (transform?.type !== 'bin') continue;
    const result = binData(rows, transform);
    rows = result.rows; warnings = warnings.concat(result.warnings); assumptions = assumptions.concat(result.assumptions);
  }
  return { rows, warnings, assumptions };
}
