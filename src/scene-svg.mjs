/** Shared Scene Graph SVG export with unique semantic attributes. */
import { pathString } from './path.mjs';
function _svgEscape(value, mode = 'text') {
  const raw = value == null ? '' : String(value);
  let out = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (mode === 'attr') out = out.replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  return out;
}
function _svgStyleFontParts(raw = '') {
  const str = String(raw).trim();
  let size = '', weight = '', family = '';
  const sizeMatch = str.match(/\b(\d+(?:\.\d+)?)\s*(px|em|rem|pt|%)/i);
  if (sizeMatch) size = `${sizeMatch[1]}${sizeMatch[2].toLowerCase()}`;
  const weightMatch = str.match(/^\s*(\d{3}|normal|bold|lighter|bolder)\b/i);
  if (weightMatch) weight = weightMatch[1];
  family = str
    .replace(/^\s*(?:(?:normal|italic|oblique)(?:\s+[^0-9\s]+)?\s+)?(?:\d{3}|normal|bold|lighter|bolder)\s+/i, '')
    .replace(/\b\d+(?:\.\d+)?\s*(?:px|em|rem|pt|%)(?:\s*\/\s*\S+)?\s*/i, '')
    .trim();
  return { size, weight, family };
}
const NO_PAINT_TOKENS = new Set(['none', 'transparent', '']);
function hasPaint(style, key) {
  const value = style?.[key];
  if (value == null) return false;
  return typeof value !== 'string' || !NO_PAINT_TOKENS.has(value.trim().toLowerCase());
}
function svgArcPath(geometry) {
  const large = geometry.end - geometry.start > Math.PI ? 1 : 0;
  const start = `${geometry.cx + geometry.r * Math.cos(geometry.start)} ${geometry.cy + geometry.r * Math.sin(geometry.start)}`;
  const end = `${geometry.cx + geometry.r * Math.cos(geometry.end)} ${geometry.cy + geometry.r * Math.sin(geometry.end)}`;
  if (geometry.sector === false) return `M ${start} A ${geometry.r} ${geometry.r} 0 ${large} 1 ${end}`;
  if (geometry.innerR > 0) return [`M ${start}`, `A ${geometry.r} ${geometry.r} 0 ${large} 1 ${end}`, `L ${geometry.cx + geometry.innerR * Math.cos(geometry.end)} ${geometry.cy + geometry.innerR * Math.sin(geometry.end)}`, `A ${geometry.innerR} ${geometry.innerR} 0 ${large} 0 ${geometry.cx + geometry.innerR * Math.cos(geometry.start)} ${geometry.cy + geometry.innerR * Math.sin(geometry.start)}`, 'Z'].join(' ');
  return [`M ${geometry.cx} ${geometry.cy}`, `L ${start}`, `A ${geometry.r} ${geometry.r} 0 ${large} 1 ${end}`, 'Z'].join(' ');
}


export function svgNode(node) {
  const geometry = node.geometry || {}, style = node.style || {}, attributes = {}, css = [];
  const tag = node.type === 'group' ? 'g' : node.type === 'arc' ? 'path' : node.type;
  if (node.id) { attributes.id = node.id; attributes['data-node-id'] = node.id; }
  if (node.dataRef) attributes['data-data-ref'] = JSON.stringify(node.dataRef);
  const keys = { rect: ['x', 'y', 'width', 'height'], line: ['x1', 'y1', 'x2', 'y2'], circle: ['cx', 'cy', 'r'], ellipse: ['cx', 'cy', 'rx', 'ry'], image: ['x', 'y', 'width', 'height'] };
  for (const key of keys[node.type] || []) attributes[key] = geometry[key];
  if (node.type === 'rect' && geometry.radius > 0) attributes.rx = Math.min(geometry.radius, geometry.width / 2, geometry.height / 2);
  if (node.type === 'image') { attributes.href = geometry.src; attributes.preserveAspectRatio = geometry.fit === 'stretch' ? 'none' : geometry.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'; attributes['aria-label'] = geometry.alt || ''; }
  if (node.type === 'path') attributes.d = pathString(geometry);
  if (node.type === 'arc') attributes.d = svgArcPath(geometry);
  if (node.type === 'text') {
    attributes.x = geometry.x; attributes.y = geometry.y;
    if (Number(style.rotation)) attributes.transform = 'rotate(' + Number(style.rotation) + ' ' + geometry.x + ' ' + geometry.y + ')';
    attributes['text-anchor'] = style.textAnchor || (['center', 'middle'].includes(style.textAlign) ? 'middle' : ['right', 'end'].includes(style.textAlign) ? 'end' : 'start');
    const baseline = style.textBaseline || style.baseline || 'alphabetic';
    attributes['dominant-baseline'] = baseline === 'middle' || baseline === 'central' ? 'middle' : baseline === 'top' ? 'text-before-edge' : baseline === 'bottom' ? 'text-after-edge' : 'alphabetic';
    if (style.font) {
      const font = _svgStyleFontParts(style.font); attributes.font = style.font;
      css.push('font:' + style.font);
      if (font.size) { attributes['font-size'] = font.size; css.push('font-size:' + font.size); }
      if (font.weight) { attributes['font-weight'] = font.weight; css.push('font-weight:' + font.weight); }
      if (font.family) { attributes['font-family'] = font.family; css.push('font-family:' + font.family); }
    }
  }
  if (['path', 'arc', 'rect', 'circle', 'ellipse', 'text'].includes(node.type)) attributes.fill = node.type === 'arc' && geometry.sector === false ? 'none' : hasPaint(style, 'fill') ? style.fill : node.type === 'text' ? '#0f172a' : 'none';
  for (const [key, attribute] of [['stroke', 'stroke'], ['strokeWidth', 'stroke-width'], ['lineCap', 'stroke-linecap'], ['lineJoin', 'stroke-linejoin']]) if (style[key] != null) attributes[attribute] = style[key];
  if (style.lineDash?.length) attributes['stroke-dasharray'] = style.lineDash.join(' ');
  if (style.opacity != null) attributes.opacity = node.highlighted || node.selected ? 1 : style.opacity;
  if (node.highlighted || node.selected) attributes.filter = 'brightness(1.2)';
  if (node.interactive) css.push('cursor:pointer');
  if (style.pointerEvents === 'none' || node.decorative) css.push('pointer-events:none');
  if (style.ariaHidden === 'true' || node.decorative) attributes['aria-hidden'] = 'true';
  if (style.role === 'presentation' || node.decorative) attributes.role = 'presentation';
  if (css.length) attributes.style = css.join(';');
  return { tag, attributes, text: node.type === 'text' ? geometry.text ?? '' : null };
}

export function sceneToSvgString(scene, spec = {}) {
  const width = Number(scene?.width ?? spec.width ?? 640), height = Number(scene?.height ?? spec.height ?? 360);
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">'];
  const attributeText = attributes => Object.entries(attributes).map(([key, value]) => key + '="' + _svgEscape(value, 'attr') + '"').join(' ');
  if (spec.background ?? '#ffffff') lines.push('  <rect ' + attributeText({ x: 0, y: 0, width, height, fill: spec.background ?? '#ffffff' }) + '/>');
  const draw = node => {
    if (!node.visible) return;
    if (node.id !== 'root') {
      const { tag, attributes, text } = svgNode(node);
      lines.push('  <' + tag + ' ' + attributeText(attributes) + (text === null ? '/>' : '>' + _svgEscape(text) + '</' + tag + '>'));
    }
    node.children.slice().sort((first, second) => first.zIndex - second.zIndex).forEach(draw);
  };
  draw(scene.root); lines.push('</svg>'); return lines.join('\n');
}
