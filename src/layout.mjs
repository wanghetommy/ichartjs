/** Shared chart chrome layout for titles and font-aware spacing. */
export function fontSize(spec, role, fallback) {
  if (role === 'label' && spec.labels?.font) return fontPixels(spec.labels.font, fallback);
  const configured = Number(spec.theme?.typography?.[role]?.size);
  if (Number.isFinite(configured) && configured > 0) return configured;
  const raw = spec.theme?.typography?.[role]?.font || `${fallback}px`;
  const match = String(raw).match(/(?:^|\s)(\d+(?:\.\d+)?)px(?:\s|$)/i);
  return match ? Number(match[1]) : fallback;
}

export function fontPixels(font, fallback = 12) {
  return Number(String(font || '').match(/(?:^|\s)(\d+(?:\.\d+)?)px(?:\s|\/|$)/i)?.[1]) || fallback;
}

export function fontAtSize(font, size) {
  return String(font || '12px system-ui').replace(/\d+(?:\.\d+)?px/i, `${size}px`);
}

export function labelFont(spec) { return spec.labels?.font || spec.theme?.typography?.label?.font || '12px system-ui'; }

const graphemeSegmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
function graphemes(value) {
  if (graphemeSegmenter) return Array.from(graphemeSegmenter.segment(value), part => part.segment);
  return value.match(/\P{Mark}(?:\p{Mark}|[\ufe0e\ufe0f]|\u200d\P{Mark})*|\p{Mark}+/gu) || [];
}

export function titleLayout(spec) {
  const hasTitle = Boolean(spec.title?.text), hasSubtitle = Boolean(spec.title?.subtitle);
  if (!hasTitle && !hasSubtitle) return { titleY: null, subtitleY: null, bottom: 0 };
  const titleSize = fontSize(spec, 'title', 16), subtitleSize = fontSize(spec, 'subtitle', 13);
  const top = Math.max(12, Math.min(24, Number(spec.padding?.top || 0) / 2));
  const maxWidth = Math.max(1, spec.width - Math.max(12, spec.padding?.left || 0) - Math.max(12, spec.padding?.right || 0));
  const maxHeight = Math.max(12, Math.min(96, spec.height * .25));
  const fit = (value, size, role) => fitTextBlock(value, { maxWidth, maxHeight: maxHeight / (hasTitle && hasSubtitle ? 2 : 1), size, minSize: Math.min(size, 10), maxLines: 2, wordWrap: true, font: spec.theme?.typography?.[role]?.font });
  const titleBlock = hasTitle ? fit(spec.title.text, titleSize, 'title') : null;
  const subtitleBlock = hasSubtitle ? fit(spec.title.subtitle, subtitleSize, 'subtitle') : null;
  const blockHeight = block => block ? block.lines.length === 1 ? block.size : block.height : 0;
  const titleY = titleBlock ? top + titleBlock.size / 2 : null;
  const titleBottom = top + blockHeight(titleBlock);
  const subtitleY = subtitleBlock ? titleBottom + 6 + subtitleBlock.size / 2 : null;
  const bottom = subtitleBlock ? titleBottom + 6 + blockHeight(subtitleBlock) : titleBottom;
  return { titleY, subtitleY, bottom, titleBlock, subtitleBlock };
}

function characterWidth(character) {
  if (/[\p{Mark}\u200d\ufe0e\ufe0f]/u.test(character)) return 0;
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Extended_Pictographic}]/u.test(character)) return 1;
  if (/\s/u.test(character)) return 0.33;
  if (/[ilI1|.,:;'`!]/u.test(character)) return 0.32;
  if (/[MW@#%&]/u.test(character)) return 0.82;
  return 0.58;
}

let measurementContext;
export function estimateTextWidth(text, size = 12, font = null) {
  const value = String(text ?? '');
  if (font && typeof document !== 'undefined') {
    measurementContext ??= document.createElement('canvas').getContext?.('2d');
    if (measurementContext) { measurementContext.font = fontAtSize(font, size); return Math.max(size, ...value.split(/\r?\n/).map(line => measurementContext.measureText(line).width)); }
  }
  if (font && /monospace/i.test(font)) return Math.max(size, ...value.split(/\r?\n/).map(line => graphemes(line).length * size * .62));
  const width = Array.from(value).reduce((sum, character) => sum + characterWidth(character), 0) * size;
  return Math.max(size, width);
}

export function truncateText(text, maxWidth, size = 12, font = null) {
  const value = String(text ?? '');
  if (!(maxWidth > 0) || estimateTextWidth(value, size, font) <= maxWidth) return value;
  const suffix = '…', suffixWidth = estimateTextWidth(suffix, size, font);
  if (suffixWidth > maxWidth) return '';
  const characters = graphemes(value);
  let low = 0, high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (estimateTextWidth(`${characters.slice(0, middle).join('')}${suffix}`, size, font) <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return `${characters.slice(0, low).join('')}${suffix}`;
}

function wrapText(text, maxWidth, size, wordWrap = false, font = null, wrap = true) {
  const value = String(text ?? '');
  if (/\r?\n/.test(value)) return value.split(/\r?\n/).flatMap(line => wrapText(line, maxWidth, size, wordWrap, font, wrap));
  if (!wrap) return [value];
  const characters = [], word = token => /^[\p{Script=Latin}\p{N}\p{Mark}_'’]+$/u.test(token);
  for (const cluster of graphemes(value)) {
    const previous = characters.at(-1);
    if (wordWrap && previous && (word(cluster) && word(previous) || /^\s+$/u.test(cluster) && /^\s+$/u.test(previous))) characters[characters.length - 1] += cluster;
    else characters.push(cluster);
  }
  if (!characters.length) return [''];
  const lines = [];
  let line = '';
  characters.forEach(character => {
    const candidate = `${line}${character}`;
    if (line && estimateTextWidth(candidate, size, font) > maxWidth) {
      lines.push(line.trimEnd());
      line = character.trimStart();
    } else line = candidate;
  });
  if (line || !lines.length) lines.push(line.trimEnd());
  return lines;
}

export function fitTextBlock(text, options = {}) {
  const value = String(text ?? ''), maxWidth = Math.max(1, Number(options.maxWidth) || 1), maxHeight = Math.max(1, Number(options.maxHeight) || 1);
  const baseSize = Math.max(1, Number(options.size) || 12), minSize = Math.max(1, Math.min(baseSize, Number(options.minSize) || 10));
  const maxLines = Math.max(1, Math.floor(Number(options.maxLines) || 2)), lineHeightRatio = Math.max(1, Number(options.lineHeight) || 1.2);
  for (let size = baseSize; size >= minSize; size -= 1) {
    const lines = wrapText(value, maxWidth, size, options.wordWrap, options.font, options.wrap !== false);
    if (lines.length <= maxLines && lines.every(line => estimateTextWidth(line, size, options.font) <= maxWidth) && lines.length * size * lineHeightRatio <= maxHeight) {
      return { lines, size, lineHeight: size * lineHeightRatio, width: Math.max(size, ...lines.map(line => estimateTextWidth(line, size, options.font))), height: lines.length * size * lineHeightRatio, wrapped: lines.length > 1, scaled: size < baseSize, truncated: false, overflowed: false };
    }
  }
  const wrapped = wrapText(value, maxWidth, minSize, options.wordWrap, options.font, options.wrap !== false), visibleLines = Math.max(1, Math.min(maxLines, Math.floor(maxHeight / (minSize * lineHeightRatio)))), lines = wrapped.slice(0, visibleLines);
  const last = lines.length - 1;
  for (let index = 0; index <= last; index += 1) lines[index] = truncateText(lines[index], maxWidth, minSize, options.font);
  if (wrapped.length > lines.length && !lines[last].endsWith('…')) lines[last] = truncateText(`${lines[last]}…`, maxWidth, minSize, options.font);
  const height = lines.length * minSize * lineHeightRatio;
  return { lines, size: minSize, lineHeight: minSize * lineHeightRatio, width: Math.max(minSize, ...lines.map(line => estimateTextWidth(line, minSize, options.font))), height, wrapped: lines.length > 1, scaled: minSize < baseSize, truncated: wrapped.length > lines.length || lines.some((line, index) => line !== wrapped[index]), overflowed: height > maxHeight };
}

export function boardTextLayout(item) {
  const padding = Math.max(0, Number(item.padding) || 0), font = item.style?.font || `${item.fontWeight || 'normal'} ${item.fontSize || 16}px ${item.fontFamily || 'system-ui'}`, size = fontPixels(font, item.fontSize || 16);
  return { ...fitTextBlock(item.text, { maxWidth: Math.max(1, item.size.width - padding * 2), maxHeight: Math.max(1, item.size.height - padding * 2), size, minSize: item.minFontSize || 8, maxLines: item.maxLines || 3, lineHeight: item.lineHeight || 1.2, wordWrap: true, wrap: item.wrap, font }), padding, font };
}

export function polarLabelLayout(text, options = {}) {
  const value = String(text ?? ''), baseSize = Math.max(1, Number(options.size) || 12), minSize = Math.max(1, Math.min(baseSize, Number(options.minSize) || 10));
  const padding = Math.max(0, Number(options.padding) || 4), lineHeight = Math.max(1, Number(options.lineHeight) || 1.2), cx = Number(options.cx) || 0, cy = Number(options.cy) || 0;
  const outerRadius = Math.max(1, Number(options.outerRadius) || 1), innerRadius = Math.max(0, Math.min(outerRadius, Number(options.innerRadius) || 0));
  let size = baseSize, width = estimateTextWidth(value, size, options.font), maxWidth = Infinity, maxHeight = Infinity, x = cx, y = cy, angle = 0, radius = 0;
  if (options.position === 'center') {
    maxWidth = Math.max(1, Number(options.maxWidth) || outerRadius * 1.25);
    maxHeight = Math.max(1, outerRadius * 0.68);
    while (size > minSize && (width > maxWidth || size * lineHeight > maxHeight)) {
      size -= 1;
      width = estimateTextWidth(value, size, options.font);
    }
    const height = size * lineHeight;
    const desiredY = cy - outerRadius * Number(options.offsetRatio ?? 0.36);
    y = Math.max(cy - outerRadius + height / 2 + padding, Math.min(cy - height / 2 - padding, desiredY));
    return { x, y, angle: -Math.PI / 2, radius: Math.abs(cy - y), size, width, height, scaled: size < baseSize, overflowed: width > maxWidth || height > maxHeight };
  }
  const startAngle = Number(options.startAngle) || 0, endAngle = Number(options.endAngle) || startAngle, sweep = Math.max(0, endAngle - startAngle), halfSweep = Math.min(Math.PI / 2, sweep / 2), centerAngle = startAngle + sweep / 2;
  const preferredRadius = Number(options.preferredRadius) || (innerRadius > 0 ? (innerRadius + outerRadius) / 2 : outerRadius * 0.68);
  radius = Math.max(innerRadius + padding + baseSize / 2, Math.min(outerRadius - padding - baseSize / 2, preferredRadius));
  maxWidth = Math.max(1, 2 * radius * Math.sin(halfSweep) - padding * 2);
  maxHeight = Math.max(1, outerRadius - innerRadius - padding * 2);
  while (size > minSize && (width > maxWidth || size * lineHeight > maxHeight)) {
    size -= 1;
    width = estimateTextWidth(value, size, options.font);
  }
  const height = size * lineHeight;
  radius = Math.max(innerRadius + padding + height / 2, Math.min(outerRadius - padding - height / 2, radius));
  angle = centerAngle;
  x = cx + Math.cos(angle) * radius;
  y = cy + Math.sin(angle) * radius;
  return { x, y, angle, radius, size, width, height, scaled: size < baseSize, overflowed: width > maxWidth || height > maxHeight };
}

export function axisLabelLayout(spec, labels = [], availableWidth = 0) {
  const size = fontSize(spec, 'axis', 12), count = Math.max(1, labels.length);
  const slot = Math.max(1, availableWidth / count), maxWidth = Math.max(size, ...labels.map(label => estimateTextWidth(label, size)));
  const rotation = maxWidth > slot * 1.45 ? -45 : maxWidth > slot * 0.92 ? -30 : 0;
  const radians = Math.abs(rotation) * Math.PI / 180;
  const projectedWidth = rotation ? maxWidth * Math.cos(radians) + size * Math.sin(radians) : maxWidth;
  const projectedHeight = rotation ? maxWidth * Math.sin(radians) + size * Math.cos(radians) : size;
  const step = Math.max(1, Math.ceil(projectedWidth / Math.max(1, slot * 0.9)));
  return { rotation, step, size, maxWidth, projectedHeight };
}

export function boxesOverlap(left, right, gap = 0) {
  return left.x < right.x + right.width + gap && left.x + left.width + gap > right.x && left.y < right.y + right.height + gap && left.y + left.height + gap > right.y;
}
