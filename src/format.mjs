/**
 * JSON-safe value formatting shared by renderers and Agent descriptions.
 */
export function formatValue(value, format, locale = 'en-US') {
  if (value == null || value === '') return '';
  if (!format) return typeof value === 'number' ? String(Number(value.toFixed(6))) : String(value);
  const options = typeof format === 'string' ? { style: format } : format;
  const prefix = options.prefix || '', suffix = options.suffix || '';
  if (options.style === 'date') {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${prefix}${new Intl.DateTimeFormat(options.locale || locale, options.options || { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)}${suffix}`;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  if (options.style === 'percent') return `${prefix}${new Intl.NumberFormat(options.locale || locale, { style: 'percent', maximumFractionDigits: options.maximumFractionDigits ?? 1 }).format(options.ratio === false ? numeric / 100 : numeric)}${suffix}`;
  if (options.style === 'currency') return `${prefix}${new Intl.NumberFormat(options.locale || locale, { style: 'currency', currency: options.currency || 'USD', maximumFractionDigits: options.maximumFractionDigits ?? 2 }).format(numeric)}${suffix}`;
  return `${prefix}${new Intl.NumberFormat(options.locale || locale, { maximumFractionDigits: options.maximumFractionDigits ?? 2, minimumFractionDigits: options.minimumFractionDigits }).format(numeric)}${suffix}`;
}
