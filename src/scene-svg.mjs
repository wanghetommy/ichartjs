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
export function sceneToSvgString(scene, spec = {}) {
  const w = Number(scene?.width ?? spec?.width ?? 640);
  const h = Number(scene?.height ?? spec?.height ?? 360);
  const bg = spec.background ?? '#ffffff';
  const lines = [`<?xml version="1.0" encoding="UTF-8"?>`, `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`];
  if (bg) lines.push(`  <rect x="0" y="0" width="${w}" height="${h}" fill="${_svgEscape(bg, 'attr')}"/>`);
  const renderNode = (node, indent = '  ') => {
    if (!node || !node.visible) return;
    if (node.type === 'root') {
      const kids = [...node.children].sort((a, b) => a.zIndex - b.zIndex);
      kids.forEach(k => renderNode(k, indent));
      return;
    }
    const g = node.geometry || {}; const s = node.style || {};
    const attrs = [];
    if (node.id) attrs.push(`id="${_svgEscape(node.id, 'attr')}" data-node-id="${_svgEscape(node.id, 'attr')}"`);
    if (node.dataRef) attrs.push(`data-data-ref="${_svgEscape(JSON.stringify(node.dataRef), 'attr')}"`);
    const css = [];
    let tag = node.type;
    if (node.type === 'image') {
      attrs.push(`x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" href="${_svgEscape(g.src, 'attr')}" preserveAspectRatio="${g.fit === 'stretch' ? 'none' : g.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}" aria-label="${_svgEscape(g.alt || '', 'attr')}"`);
    } else if (node.type === 'rect') {
      attrs.push(`x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}"`);
    } else if (node.type === 'line') {
      attrs.push(`x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}"`);
    } else if (node.type === 'circle') {
      attrs.push(`cx="${g.cx}" cy="${g.cy}" r="${g.r}"`);
    } else if (node.type === 'ellipse') {
      attrs.push(`cx="${g.cx}" cy="${g.cy}" rx="${g.rx}" ry="${g.ry}"`);
    } else if (node.type === 'arc') {
      tag = 'path';
      const large = g.end - g.start > Math.PI ? 1 : 0;
      const outerStart = `${g.cx + g.r * Math.cos(g.start)} ${g.cy + g.r * Math.sin(g.start)}`;
      const outerEnd = `${g.cx + g.r * Math.cos(g.end)} ${g.cy + g.r * Math.sin(g.end)}`;
      let d;
      if (g.sector === false) {
        d = [`M ${outerStart}`, `A ${g.r} ${g.r} 0 ${large} 1 ${outerEnd}`].join(' ');
      } else if (g.innerR > 0) {
        d = [`M ${outerStart}`, `A ${g.r} ${g.r} 0 ${large} 1 ${outerEnd}`, `L ${g.cx + g.innerR * Math.cos(g.end)} ${g.cy + g.innerR * Math.sin(g.end)}`, `A ${g.innerR} ${g.innerR} 0 ${large} 0 ${g.cx + g.innerR * Math.cos(g.start)} ${g.cy + g.innerR * Math.sin(g.start)}`, 'Z'].join(' ');
      } else {
        d = [`M ${g.cx} ${g.cy}`, `L ${outerStart}`, `A ${g.r} ${g.r} 0 ${large} 1 ${outerEnd}`, 'Z'].join(' ');
      }
      attrs.push(`d="${_svgEscape(d, 'attr')}"`);
    } else if (node.type === 'path') {
      const points = g.renderPoints || g.points;
      const d = g.curve === 'cubic' && points?.length === 4
        ? `M ${points[0].x} ${points[0].y} C ${points[1].x} ${points[1].y} ${points[2].x} ${points[2].y} ${points[3].x} ${points[3].y}`
        : `${(points || []).map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')}${g.closed ? ' Z' : ''}`;
      attrs.push(`d="${_svgEscape(d, 'attr')}"`);
    } else if (node.type === 'text') {
      attrs.push(`x="${g.x}" y="${g.y}"`);
      if (Number.isFinite(Number(s.rotation)) && Number(s.rotation) !== 0) attrs.push(`transform="rotate(${Number(s.rotation)} ${g.x} ${g.y})"`);
      const anchor = s.textAnchor || (s.textAlign === 'end' ? 'end' : s.textAlign === 'center' ? 'middle' : s.textAlign === 'right' ? 'end' : s.textAlign === 'left' ? 'start' : 'start');
      if (anchor) attrs.push(`text-anchor="${anchor}"`);
      const baseline = s.textBaseline || s.baseline || 'alphabetic';
      if (baseline === 'top') { attrs.push(`dominant-baseline="text-before-edge"`); attrs.push(`alignment-baseline="before-edge"`); }
      else if (baseline === 'middle' || baseline === 'central') { attrs.push(`dominant-baseline="middle"`); attrs.push(`alignment-baseline="middle"`); }
      else if (baseline === 'bottom' || baseline === 'hanging') { attrs.push(`dominant-baseline="text-after-edge"`); attrs.push(`alignment-baseline="after-edge"`); }
      else { attrs.push(`dominant-baseline="alphabetic"`); attrs.push(`alignment-baseline="alphabetic"`); }
      if (s.font) {
        const rawFont = String(s.font).trim();
        attrs.push(`font="${_svgEscape(rawFont, 'attr')}"`);
        const { size, weight, family } = _svgStyleFontParts(rawFont);
        if (size) css.push(`font-size:${size}`);
        if (weight) css.push(`font-weight:${weight}`);
        if (family) css.push(`font-family:${family}`);
      }
    } else {
      tag = 'g';
    }
    if (['path', 'circle', 'ellipse', 'rect', 'arc'].includes(node.type)) attrs.push(`fill="${node.type === 'arc' && g.sector === false ? 'none' : hasPaint(s, 'fill') ? _svgEscape(s.fill, 'attr') : 'none'}"`);
    else if (node.type === 'text') attrs.push(`fill="${hasPaint(s, 'fill') ? _svgEscape(s.fill, 'attr') : '#0f172a'}"`);
    if (hasPaint(s, 'stroke')) attrs.push(`stroke="${_svgEscape(s.stroke, 'attr')}"`);
    else if (s.stroke != null) attrs.push('stroke="none"');
    if (s.strokeWidth) attrs.push(`stroke-width="${s.strokeWidth}"`);
    if (s.opacity != null) {
      const opacity = (node.highlighted || node.selected) ? 1 : s.opacity;
      attrs.push(`opacity="${opacity}"`);
    }
    if (node.highlighted || node.selected) attrs.push(`filter="brightness(1.2)"`);
    if (node.interactive) css.push('cursor:pointer');
    if (s.pointerEvents === 'none') css.push('pointer-events:none');
    if (s.ariaHidden === 'true') attrs.push(`aria-hidden="true"`);
    if (s.role === 'presentation') attrs.push(`role="presentation"`);
    if (node.decorative) {
      attrs.push(`aria-hidden="true"`);
      attrs.push(`role="presentation"`);
      css.push('pointer-events:none', 'user-select:none');
    }
    if (css.length) attrs.push(`style="${_svgEscape(css.join(';'), 'attr')}"`);
    if (node.type === 'text') {
      lines.push(`${indent}<${tag} ${attrs.join(' ')}>${_svgEscape(g.text ?? '')}</${tag}>`);
    } else {
      lines.push(`${indent}<${tag} ${attrs.join(' ')}/>`);
    }
    const kids = [...(node.children || [])].sort((a, b) => a.zIndex - b.zIndex);
    kids.forEach(k => renderNode(k, indent + '  '));
  };
  renderNode(scene.root);
  lines.push(`</svg>`);
  return lines.join('\n');
}
