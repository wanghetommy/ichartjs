/** Strict delivery formats and detached scene replay; never mutate live surfaces. */
import { CanvasRenderer } from './renderer.mjs';

export const exportContract = {
  representations: { svg: ['string', 'dataurl', 'blob'], json: ['string', 'object', 'dataurl', 'blob'], png: ['dataurl', 'string', 'blob'], jpeg: ['dataurl', 'string', 'blob'] },
  browserRaster: 'Spec pixel size; independent of display, DPR and mounting',
  nodeRaster: 'root exportAsync only; optional canvas',
  assets: 'await board.ready(); reject unavailable/tainted images',
  defaults: 'root: renderer-based; Profiles/Board: SVG; JSON: Chart string, Board bare Spec object'
};

export function exportError(code, message, suggestion = 'Inspect export.delivery and retry.') { return { valid: false, code, message, suggestion }; }

export function resolveExport(options = {}, fallback = 'svg') {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return exportError('EXPORT_TYPE_UNSUPPORTED', 'Export options must be an object.');
  const aliases = { svg: 'svg', 'image/svg+xml': 'svg', json: 'json', 'application/json': 'json', png: 'png', 'image/png': 'png', jpeg: 'jpeg', jpg: 'jpeg', 'image/jpeg': 'jpeg', 'image/jpg': 'jpeg' };
  const raw = options.type === undefined ? fallback : options.type;
  const key = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  const kind = Object.hasOwn(aliases, key) ? aliases[key] : null;
  if (!kind) return exportError('EXPORT_TYPE_UNSUPPORTED', 'Use svg, json, png or jpeg, or their MIME types.');
  const as = options.as === undefined ? (kind === 'png' || kind === 'jpeg' ? 'dataurl' : 'string') : options.as;
  if (!exportContract.representations[kind].includes(as)) return exportError('EXPORT_TYPE_UNSUPPORTED', `Unsupported ${kind} representation.`, `Use ${exportContract.representations[kind].join(', ')}.`);
  return { kind, as, mime: kind === 'json' ? 'application/json' : kind === 'svg' ? 'image/svg+xml' : `image/${kind}` };
}

export function encodeExport(value, request) {
  if (request.as === 'object') return JSON.parse(JSON.stringify(value));
  const raster = request.kind === 'png' || request.kind === 'jpeg';
  const string = request.kind === 'json' ? JSON.stringify(value, null, 2) : value;
  if (request.as === 'string' && !raster) return string;
  const url = raster ? string : `data:${request.mime};charset=utf-8,${encodeURIComponent(string)}`;
  if (request.as !== 'blob') return url;
  if (typeof Blob === 'undefined' || request.kind === 'svg' && typeof document === 'undefined') return exportError('BLOB_HEADLESS', 'Blob is unavailable here; use string/dataurl.');
  const comma = url.indexOf(','), payload = url.slice(comma + 1);
  return new Blob([raster ? Uint8Array.from(atob(payload), character => character.charCodeAt(0)) : string], { type: request.mime });
}

export function exportRaster(spec, scene, request, createCanvas) {
  if (!createCanvas && typeof document === 'undefined') return exportError('HEADLESS_EXPORT_UNSUPPORTED', 'Raster export requires a browser or the root optional async canvas adapter.', 'Use SVG/JSON; root charts can use exportAsync() with the optional canvas package.');
  let renderer;
  try {
    let missing;
    const inspect = node => { if (!node.visible) return; if (node.type === 'image' && !node.geometry.image) missing = node.id; node.children.forEach(inspect); };
    inspect(scene.root);
    if (missing) return exportError('EXPORT_ASSET_UNAVAILABLE', `Image ${missing} is not loaded.`, 'Await board.ready(), inspect asset status and repair failed sources before retrying.');
    renderer = new CanvasRenderer(spec);
    renderer.canvas = createCanvas ? createCanvas(spec.width, spec.height) : document.createElement('canvas');
    renderer.ctx = renderer.canvas.getContext('2d');
    if (!renderer.ctx) return exportError('EXPORT_CONTEXT_UNAVAILABLE', 'A 2D export context is unavailable.', 'Use SVG or retry in a browser with Canvas support.');
    renderer.resize(spec.width, spec.height, 1);
    renderer.render(scene);
    if (request.kind === 'jpeg') { const context = renderer.ctx; context.save(); context.globalCompositeOperation = 'destination-over'; context.fillStyle = '#ffffff'; context.fillRect(0, 0, spec.width, spec.height); context.restore(); }
    const url = renderer.exportImage(request.mime);
    if (!url.startsWith(`data:${request.mime};`)) return exportError('EXPORT_TYPE_UNSUPPORTED', 'The browser did not encode the requested format.');
    return encodeExport(url, request);
  } catch (error) {
    return exportError(error?.name === 'SecurityError' ? 'EXPORT_TAINTED_CANVAS' : 'EXPORT_FAILED', String(error?.message || error), 'Check image CORS permissions and browser resources; retry or deliver SVG.');
  } finally {
    if (renderer) { if (renderer.canvas) renderer.canvas.width = renderer.canvas.height = 0; renderer.canvas = renderer.ctx = null; }
  }
}
