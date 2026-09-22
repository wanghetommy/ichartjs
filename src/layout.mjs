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
