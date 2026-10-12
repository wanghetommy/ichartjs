import { formatValue } from './format.mjs';

export function formatChartTooltip(spec, datum) {
  const encoding = spec.encoding || {};
  const y = Array.isArray(encoding.y) ? encoding.y : [encoding.y];
  const entries = [
    [encoding.x, spec.xAxis?.format],
    ...y.map(item => [item, spec.yAxis?.format]),
    [encoding.category],
    [encoding.value, spec.labels?.format],
    [encoding.color]
  ].filter(([item]) => item?.field).map(([item, fallback]) => [item.field, item.format || fallback]);
  const fields = entries.length ? entries : Object.keys(datum).filter(field => field !== 'id').map(field => [field]);
  return fields
    .filter(([field]) => Object.prototype.hasOwnProperty.call(datum, field))
    .map(([field, format]) => `${field}: ${formatValue(datum[field], format, spec.locale)}`)
    .join(' · ');
}
