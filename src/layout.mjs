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

export function estimateTextWidth(text, size = 12) {
  return Math.max(size, String(text ?? '').length * size * 0.58);
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
