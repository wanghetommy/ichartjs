/** Shared chart chrome layout for titles and font-aware spacing. */
export function fontSize(spec, role, fallback) {
  const configured = Number(spec.theme?.typography?.[role]?.size);
  if (Number.isFinite(configured) && configured > 0) return configured;
  const raw = spec.theme?.typography?.[role]?.font || `${fallback}px`;
  const match = String(raw).match(/(?:^|\s)(\d+(?:\.\d+)?)px(?:\s|$)/i);
  return match ? Number(match[1]) : fallback;
}

export function titleLayout(spec) {
  const hasTitle = Boolean(spec.title?.text), hasSubtitle = Boolean(spec.title?.subtitle);
  if (!hasTitle && !hasSubtitle) return { titleY: null, subtitleY: null, bottom: 0 };
  const titleSize = fontSize(spec, 'title', 16), subtitleSize = fontSize(spec, 'subtitle', 13);
  const top = Math.max(12, Math.min(24, Number(spec.padding?.top || 0) / 2));
  const titleY = hasTitle ? top + titleSize / 2 : null;
  const titleBottom = hasTitle ? top + titleSize : top;
  const subtitleY = hasSubtitle ? titleBottom + 6 + subtitleSize / 2 : null;
  const bottom = hasSubtitle ? subtitleY + subtitleSize / 2 : titleBottom;
  return { titleY, subtitleY, bottom };
}

function characterWidth(character) {
  if (/[\p{Mark}\u200d\ufe0e\ufe0f]/u.test(character)) return 0;
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Extended_Pictographic}]/u.test(character)) return 1;
  if (/\s/u.test(character)) return 0.33;
  if (/[ilI1|.,:;'`!]/u.test(character)) return 0.32;
  if (/[MW@#%&]/u.test(character)) return 0.82;
  return 0.58;
}

export function estimateTextWidth(text, size = 12) {
  const width = Array.from(String(text ?? '')).reduce((sum, character) => sum + characterWidth(character), 0) * size;
  return Math.max(size, width);
}

export function truncateText(text, maxWidth, size = 12) {
  const value = String(text ?? '');
  if (!(maxWidth > 0) || estimateTextWidth(value, size) <= maxWidth) return value;
  const suffix = '…', suffixWidth = estimateTextWidth(suffix, size);
  if (suffixWidth > maxWidth) return '';
  const characters = Array.from(value);
  let low = 0, high = characters.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (estimateTextWidth(`${characters.slice(0, middle).join('')}${suffix}`, size) <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return `${characters.slice(0, low).join('')}${suffix}`;
}

function wrapText(text, maxWidth, size) {
  const characters = Array.from(String(text ?? ''));
  if (!characters.length) return [''];
  const lines = [];
  let line = '';
  characters.forEach(character => {
    const candidate = `${line}${character}`;
    if (line && estimateTextWidth(candidate, size) > maxWidth) {
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
    const lines = wrapText(value, maxWidth, size);
    if (lines.length <= maxLines && lines.every(line => estimateTextWidth(line, size) <= maxWidth) && lines.length * size * lineHeightRatio <= maxHeight) {
      return { lines, size, lineHeight: size * lineHeightRatio, width: Math.max(size, ...lines.map(line => estimateTextWidth(line, size))), height: lines.length * size * lineHeightRatio, wrapped: lines.length > 1, scaled: size < baseSize, truncated: false };
    }
  }
  const lines = wrapText(value, maxWidth, minSize).slice(0, maxLines);
  const visibleHeight = maxLines * minSize * lineHeightRatio;
  if (visibleHeight > maxHeight) lines.splice(1);
  const last = lines.length - 1;
  lines[last] = truncateText(lines[last], maxWidth, minSize);
  return { lines, size: minSize, lineHeight: minSize * lineHeightRatio, width: Math.max(minSize, ...lines.map(line => estimateTextWidth(line, minSize))), height: Math.min(maxHeight, Math.max(minSize, lines.length * minSize * lineHeightRatio)), wrapped: lines.length > 1, scaled: minSize < baseSize, truncated: lines.join('') !== value };
}

export function polarLabelLayout(text, options = {}) {
  const value = String(text ?? ''), baseSize = Math.max(1, Number(options.size) || 12), minSize = Math.max(1, Math.min(baseSize, Number(options.minSize) || 10));
  const padding = Math.max(0, Number(options.padding) || 4), lineHeight = Math.max(1, Number(options.lineHeight) || 1.2), cx = Number(options.cx) || 0, cy = Number(options.cy) || 0;
  const outerRadius = Math.max(1, Number(options.outerRadius) || 1), innerRadius = Math.max(0, Math.min(outerRadius, Number(options.innerRadius) || 0));
  let size = baseSize, width = estimateTextWidth(value, size), maxWidth = Infinity, maxHeight = Infinity, x = cx, y = cy, angle = 0, radius = 0;
  if (options.position === 'center') {
    maxWidth = Math.max(1, Number(options.maxWidth) || outerRadius * 1.25);
    maxHeight = Math.max(1, outerRadius * 0.68);
    while (size > minSize && (width > maxWidth || size * lineHeight > maxHeight)) {
      size -= 1;
      width = estimateTextWidth(value, size);
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
    width = estimateTextWidth(value, size);
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
