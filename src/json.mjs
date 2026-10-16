/** JSON-only cloning and merging for portable Specs and visual preferences. */
export function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
export function merge(base, extra) {
  const result = clone(base) || {};
  for (const [key, value] of Object.entries(extra || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) result[key] = merge(result[key], value);
    else if (value !== undefined) result[key] = clone(value);
  }
  return result;
}
