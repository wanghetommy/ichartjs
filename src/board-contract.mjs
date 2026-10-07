/** JSON-safe Board validation and discovery, sharing runtime text fitting. */
import { validateSpec } from './spec.mjs';
import { boardTextLayout, fontPixels } from './layout.mjs';

export const boardEditableFields = {
  common: ['zIndex', 'opacity', 'visible', 'style'],
  itemTypes: {
    image: ['position', 'size', 'assetId', 'fit'],
    text: ['position', 'size', 'text', 'fontSize', 'fontFamily', 'fontWeight', 'lineHeight', 'padding', 'textAlign', 'verticalAlign', 'wrap', 'maxLines', 'minFontSize', 'background'],
    shape: ['position', 'size', 'shape', 'startAngle', 'endAngle', 'innerRadius', 'points'],
    path: ['position', 'size', 'curve', 'closed', 'points'],
    connector: ['from', 'to', 'routing'],
    chart: ['position', 'size', 'spec']
  },
  asset: ['src', 'mime', 'alt', 'width', 'height', 'bytes']
};

export const boardCapabilities = {
  version: '1.0',
  api: ['createBoard', 'validateBoardSpec', 'planCanvas', 'validateBoardCommand'],
  incrementalBuilding: {
    commands: ['addItem', 'updateItem', 'removeItem', 'addAsset', 'updateAsset', 'removeAsset'],
    commandFields: { addItem: ['item'], updateItem: ['itemId', 'changes'], removeItem: ['itemId', 'policy?'], addAsset: ['asset'], updateAsset: ['assetId', 'changes'], removeAsset: ['assetId', 'policy?'] },
    editableFields: boardEditableFields,
    type: 'board-edit', activation: ['editing.enabled', 'editing.allowStructuralChanges (add/remove)', 'issued preview', 'host confirmation'],
    methods: ['previewEdit', 'applyEdit', 'subscribe', 'undo', 'redo'],
    atomic: true, automaticReflow: false, layout: 'preserve-explicit-positions',
    changes: 'Shallow field replacement; updateItem.changes.position/size for explicit layout, changes.spec for a complete embedded ChartSpec.',
    lockedItems: 'Agent commands cannot modify/remove locked items or their assets.',
    removal: { default: 'reject', cascade: 'Explicitly remove referenced images/connectors; never delete unrelated items.' },
    readiness: 'await ready(); inspect assets, assetsReady and health; previews never load images',
    recipe: '@taylorwong/ichartjs/recipes/boards/incremental-board'
  },
  items: ['image', 'text', 'shape', 'path', 'connector', 'chart'],
  shapes: ['rectangle', 'ellipse', 'diamond', 'hexagon', 'polygon', 'arc', 'sector'],
  geometry: { primitives: ['rectangle', 'ellipse', 'diamond', 'hexagon', 'polygon', 'arc', 'sector'], paths: ['linear', 'cubic'], coordinateSpace: 'normalized-item-local', angles: 'degrees', maxPoints: 64 },
  text: { wrapping: true, hardBreaks: true, fontPrecedence: 'style.font then fontSize/fontWeight/fontFamily; fitting resizes the effective font', alignment: ['start', 'center', 'end'], verticalAlignment: ['top', 'middle', 'bottom'], overflow: ['scale', 'wrap', 'truncate'], defaultMaxLines: 3, minFontSize: 8 },
  renderers: ['svg', 'canvas', 'auto'],
  exports: ['json', 'svg', 'png', 'jpeg'],
  imageMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
  limits: { maxAssetBytes: 10485760, maxImageDimension: 8192, minItemSize: 16, maxBoardDimension: 16384, maxItems: 2000 },
  defaults: { editing: false, zoom: false, pan: false, drag: false },
  persistence: 'host-owned JSON and asset adapter',
  grid: ['dots', 'lines', 'cross'],
  interactions: ['selection', 'multi-selection', 'drag', 'resize', 'keyboard', 'zoom', 'pan'],
  constraints: ['grid-snap', 'object-snap', 'alignment-guides', 'bounds', 'locked-items'],
  history: ['undo', 'redo'],
  headless: { json: true, svg: 'inline images or explicitly linked assets', raster: 'browser-only' }
};

export function cloneBoard(value) { return JSON.parse(JSON.stringify(value)); }
function diagnostic(code, path, message, suggestion) { return { code, path, message, ...(suggestion ? { suggestion } : {}) }; }
export function safeImageSource(source) {
  if (typeof source !== 'string' || !source.trim() || /[\u0000-\u0020]/.test(source)) return false;
  if (/^data:/i.test(source)) return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(source);
  if (/^[a-z][a-z0-9+.-]*:/i.test(source)) return /^https?:\/\//i.test(source);
  return !source.startsWith('//');
}

export function validateBoardSpec(input = {}) {
  const errors = [], warnings = [];
  const fail = (path, message, code = 'INVALID_BOARD_SPEC') => errors.push(diagnostic(code, path, message));
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { valid: false, errors: [diagnostic('INVALID_BOARD_SPEC', '', 'BoardSpec must be an object.')], warnings, spec: null };
  let spec;
  try { spec = cloneBoard(input); } catch { return { valid: false, errors: [diagnostic('INVALID_BOARD_SPEC', '', 'BoardSpec must be JSON serializable; pass File/Blob through addImage().')], warnings, spec: null }; }
  spec = { version: '1.0', renderer: 'auto', width: 1280, height: 720, background: '#ffffff', assets: [], items: [], ...spec };
  spec.grid = { visible: false, size: 16, variant: 'dots', color: '#dbe2ea', ...spec.grid };
  spec.snap = { enabled: false, grid: true, objects: true, guides: true, threshold: 8, ...spec.snap };
  spec.interaction = { zoom: false, pan: false, drag: false, ...spec.interaction };
  spec.editing = { enabled: false, allowStructuralChanges: false, ...spec.editing };
  if (spec.version !== '1.0') fail('version', 'Use BoardSpec version 1.0.');
  if (!['svg', 'canvas', 'auto'].includes(spec.renderer)) fail('renderer', 'Use svg, canvas, or auto.');
  ['width', 'height'].forEach(key => { if (!Number.isFinite(spec[key]) || spec[key] < 32 || spec[key] > boardCapabilities.limits.maxBoardDimension) fail(key, 'Board dimensions must be between 32 and 16384.'); });
  if (!Number.isFinite(spec.grid.size) || spec.grid.size < 8 || spec.grid.size > 256) fail('grid.size', 'Grid size must be between 8 and 256.');
  if (!boardCapabilities.grid.includes(spec.grid.variant)) fail('grid.variant', 'Use dots, lines, or cross.');
  if (!Number.isFinite(spec.snap.threshold) || spec.snap.threshold < 0 || spec.snap.threshold > 32) fail('snap.threshold', 'Snap threshold must be between 0 and 32 screen pixels.');
  for (const section of ['grid', 'snap', 'interaction', 'editing']) for (const key of { grid: ['visible'], snap: ['enabled', 'grid', 'objects', 'guides'], interaction: ['zoom', 'pan', 'drag'], editing: ['enabled', 'allowStructuralChanges'] }[section]) if (typeof spec[section][key] !== 'boolean') fail(`${section}.${key}`, 'Expected a boolean.');
  if (!Array.isArray(spec.assets)) { fail('assets', 'Assets must be an array.'); spec.assets = []; }
  if (!Array.isArray(spec.items)) { fail('items', 'Items must be an array.'); spec.items = []; }
  if (spec.items.length > boardCapabilities.limits.maxItems) fail('items', 'A board supports at most 2000 items.');
  const assetIds = new Set(), itemIds = new Set();
  spec.assets.forEach((asset, index) => {
    const path = `assets[${index}]`;
    if (!asset || typeof asset !== 'object') { fail(path, 'Expected an image asset.'); return; }
    if (typeof asset.id !== 'string' || !asset.id || assetIds.has(asset.id)) fail(`${path}.id`, 'Asset IDs must be unique nonempty strings.');
    assetIds.add(asset.id);
    if (asset.type !== 'image') fail(`${path}.type`, 'Only image assets are supported.');
    if (!safeImageSource(asset.src)) fail(`${path}.src`, 'Use an HTTP(S), relative, or PNG/JPEG/WebP base64 image source.', 'UNSAFE_IMAGE_SOURCE');
    if (asset.mime !== undefined && !boardCapabilities.imageMimeTypes.includes(asset.mime)) fail(`${path}.mime`, 'Use PNG, JPEG, or WebP.', 'UNSUPPORTED_IMAGE_TYPE');
    if (asset.bytes !== undefined && (!Number.isFinite(asset.bytes) || asset.bytes < 0 || asset.bytes > boardCapabilities.limits.maxAssetBytes)) fail(`${path}.bytes`, 'Image assets must not exceed 10 MiB.');
    if (asset.src?.startsWith('data:') && asset.src.length * 0.75 > boardCapabilities.limits.maxAssetBytes + 64) fail(`${path}.src`, 'Inline image assets must not exceed 10 MiB.');
    for (const key of ['width', 'height']) if (asset[key] !== undefined && (!Number.isFinite(asset[key]) || asset[key] <= 0 || asset[key] > 8192)) fail(`${path}.${key}`, 'Image dimensions must be between 1 and 8192.');
    if (!asset.alt) warnings.push(diagnostic('IMAGE_ALT_MISSING', `${path}.alt`, 'Add alt text describing the image.'));
  });
  spec.items.forEach((item, index) => {
    const path = `items[${index}]`;
    if (!item || typeof item !== 'object') { fail(path, 'Expected a board item.'); return; }
    if (typeof item.id !== 'string' || !item.id || itemIds.has(item.id)) fail(`${path}.id`, 'Item IDs must be unique nonempty strings.');
    itemIds.add(item.id);
    if (!boardCapabilities.items.includes(item.kind)) fail(`${path}.kind`, 'Use image, text, shape, path, connector, or chart.');
    item.visible ??= true; item.locked ??= false; item.opacity ??= 1; item.zIndex ??= item.kind === 'connector' ? -1 : index;
    if (typeof item.visible !== 'boolean' || typeof item.locked !== 'boolean') fail(path, 'visible and locked must be boolean.');
    if (!Number.isFinite(item.zIndex)) fail(`${path}.zIndex`, 'zIndex must be finite.');
    if (!Number.isFinite(item.opacity) || item.opacity < 0 || item.opacity > 1) fail(`${path}.opacity`, 'Opacity must be between 0 and 1.');
    if (item.kind === 'connector') {
      if (!['straight', 'orthogonal'].includes(item.routing || 'orthogonal')) fail(`${path}.routing`, 'Use straight or orthogonal.');
      return;
    }
    if (!Number.isFinite(item.position?.x) || !Number.isFinite(item.position?.y)) fail(`${path}.position`, 'Provide finite x and y.');
    if (!Number.isFinite(item.size?.width) || !Number.isFinite(item.size?.height) || item.size.width < 16 || item.size.height < 16) fail(`${path}.size`, 'Item width and height must be at least 16.');
    if (item.position?.x < 0 || item.position?.y < 0 || item.position?.x + item.size?.width > spec.width || item.position?.y + item.size?.height > spec.height) warnings.push(diagnostic('BOARD_ITEM_OUT_OF_BOUNDS', path, 'This item extends beyond the board.'));
    if (item.kind === 'image') {
      if (!assetIds.has(item.assetId)) fail(`${path}.assetId`, 'Reference an existing image asset.', 'MISSING_ASSET');
      if (!['contain', 'cover', 'stretch'].includes(item.fit || 'contain')) fail(`${path}.fit`, 'Use contain, cover, or stretch.');
    }
    if (item.kind === 'text') {
      if (typeof item.text !== 'string') fail(`${path}.text`, 'Text must be a string.');
      if (item.style?.font !== undefined && (typeof item.style.font !== 'string' || !/\d+(?:\.\d+)?px\s+\S/.test(item.style.font) || fontPixels(item.style.font, 0) < 8 || fontPixels(item.style.font, 0) > 160)) fail(`${path}.style.font`, 'Use a CSS font with a pixel size between 8 and 160.');
      if (item.fontSize !== undefined && (!Number.isFinite(item.fontSize) || item.fontSize < 8 || item.fontSize > 160)) fail(`${path}.fontSize`, 'Font size must be between 8 and 160.');
      if (item.fontWeight !== undefined && !['normal', 'bold', 'lighter', 'bolder', 100, 200, 300, 400, 500, 600, 700, 800, 900].includes(item.fontWeight)) fail(`${path}.fontWeight`, 'Use a CSS font weight.');
      if (item.lineHeight !== undefined && (!Number.isFinite(item.lineHeight) || item.lineHeight < 1 || item.lineHeight > 3)) fail(`${path}.lineHeight`, 'Line height must be between 1 and 3.');
      if (item.padding !== undefined && (!Number.isFinite(item.padding) || item.padding < 0 || item.padding > 80)) fail(`${path}.padding`, 'Text padding must be between 0 and 80 pixels.');
      if (item.textAlign !== undefined && !['start', 'center', 'end', 'left', 'right'].includes(item.textAlign)) fail(`${path}.textAlign`, 'Use start, center, end, left, or right.');
      if (item.verticalAlign !== undefined && !['top', 'middle', 'bottom'].includes(item.verticalAlign)) fail(`${path}.verticalAlign`, 'Use top, middle, or bottom.');
      if (item.wrap !== undefined && typeof item.wrap !== 'boolean') fail(`${path}.wrap`, 'wrap must be a boolean.');
      if (item.maxLines !== undefined && (!Number.isInteger(item.maxLines) || item.maxLines < 1 || item.maxLines > 12)) fail(`${path}.maxLines`, 'maxLines must be an integer between 1 and 12.');
      if (item.minFontSize !== undefined && (!Number.isFinite(item.minFontSize) || item.minFontSize < 8 || item.minFontSize > fontPixels(item.style?.font, item.fontSize || 16))) fail(`${path}.minFontSize`, 'minFontSize must be between 8 and the effective font size.');
      if (typeof item.text === 'string' && item.text.length && Number.isFinite(item.size?.width) && Number.isFinite(item.size?.height)) {
        const layout = boardTextLayout(item);
        if (layout.truncated) warnings.push(diagnostic('TEXT_TRUNCATED', `${path}.text`, 'Text does not fit its item box and will be truncated after wrapping and font scaling.', 'Increase the item size, allow more lines, or shorten the text.'));
        if (layout.overflowed) warnings.push(diagnostic('TEXT_OVERFLOW', `${path}.text`, 'Text exceeds the item height even at the minimum font size.', 'Increase item height or reduce padding/minFontSize.'));
      }
    }
    if (item.kind === 'shape' && !boardCapabilities.shapes.includes(item.shape || 'rectangle')) fail(`${path}.shape`, 'Use rectangle, ellipse, diamond, hexagon, polygon, arc, or sector.');
    if (item.kind === 'shape' && item.shape === 'polygon' && (!Array.isArray(item.points) || item.points.length < 3 || item.points.length > 64 || item.points.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1))) fail(`${path}.points`, 'Provide 3 to 64 normalized points with x and y between 0 and 1.');
    if (item.kind === 'shape' && ['arc', 'sector'].includes(item.shape)) {
      if (!Number.isFinite(item.startAngle) || !Number.isFinite(item.endAngle)) fail(`${path}.startAngle`, 'Arc and sector shapes require finite startAngle and endAngle in degrees.');
      if (Number.isFinite(item.startAngle) && Number.isFinite(item.endAngle) && item.endAngle === item.startAngle) fail(`${path}.endAngle`, 'startAngle and endAngle must not be equal.');
      if (item.innerRadius !== undefined && (!Number.isFinite(item.innerRadius) || item.innerRadius < 0 || item.innerRadius >= 1)) fail(`${path}.innerRadius`, 'innerRadius must be between 0 and less than 1.');
    }
    if (item.kind === 'path') {
      if (!['linear', 'cubic'].includes(item.curve || 'linear')) fail(`${path}.curve`, 'Use linear or cubic.');
      if (!Array.isArray(item.points) || item.points.length < 2 || item.points.length > boardCapabilities.geometry.maxPoints || item.points.some(point => !Number.isFinite(point?.x) || !Number.isFinite(point?.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) fail(`${path}.points`, 'Provide 2 to 64 normalized points with x and y between 0 and 1.');
      if (item.curve === 'cubic' && item.points?.length !== 4) fail(`${path}.points`, 'A cubic path requires exactly 4 normalized points: start, two controls, and end.');
    }
    if (item.kind === 'chart') {
      const result = validateSpec(item.spec || {});
      for (const error of result.errors) errors.push({ ...error, path: `${path}.spec.${error.path || ''}` });
      for (const warning of result.warnings) warnings.push({ ...warning, path: `${path}.spec.${warning.path || ''}` });
      if (item.size?.width < 240 || item.size?.height < 180) warnings.push(diagnostic('BOARD_CHART_SMALL', path, 'Embedded charts are easier to read at 240 × 180 or larger.'));
    }
  });
  spec.items.filter(item => item?.kind === 'connector').forEach(item => {
    for (const endpoint of ['from', 'to']) if (!spec.items.some(target => target?.id === item[endpoint] && target.kind !== 'connector')) fail(`items.${item.id}.${endpoint}`, 'Connectors must reference existing non-connector items.', 'BOARD_EDGE_ENDPOINT');
    if (item.from === item.to) fail(`items.${item.id}`, 'Self connectors are not supported.', 'BOARD_SELF_EDGE');
  });
  return { valid: errors.length === 0, errors, warnings, spec };
}

export function planCanvas(items = [], options = {}) {
  const width = options.width || 1280, height = options.height || 720, gap = 24, columns = Math.max(1, Math.ceil(Math.sqrt(items.length * width / height))), rows = Math.max(1, Math.ceil(items.length / columns));
  const cellWidth = (width - gap * (columns + 1)) / columns, cellHeight = (height - gap * (rows + 1)) / rows;
  const planned = items.map((item, index) => ({ ...item, id: item.id || `item-${index + 1}`, position: item.position || { x: gap + index % columns * (cellWidth + gap), y: gap + Math.floor(index / columns) * (cellHeight + gap) }, size: item.size || { width: cellWidth, height: cellHeight } }));
  const result = validateBoardSpec({ ...options, width, height, items: planned });
  return { ...result, assumptions: ['Grid composition; supplied positions and sizes are preserved.'], nextActions: result.valid ? ['Create board, await ready(), inspect health, then export.'] : ['Repair validation errors before createBoard().'] };
}
