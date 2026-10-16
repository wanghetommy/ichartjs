/** Sixteen original 24-unit decorative glyphs; no fonts, SVG parsing or network. */
const glyphs = {
  user: [['circle', 12, 7, 4], ['path', 3, 22, 3, 19, 6, 15, 18, 15, 21, 19, 21, 22, 3, 22]],
  agent: [['path', 4, 20, 16, 8, 19, 11, 7, 23, 4, 20], ['path', 6, 2, 6, 8], ['path', 3, 5, 9, 5], ['path', 19, 1, 19, 5], ['path', 17, 3, 21, 3]],
  shield: [['path', 12, 2, 21, 6, 20, 16, 12, 22, 4, 16, 3, 6, 12, 2], ['path', 7, 12, 11, 16, 17, 9]],
  bolt: [['path', 14, 2, 5, 14, 11, 14, 10, 22, 20, 10, 13, 10, 14, 2]],
  check: [['path', 4, 12, 10, 18, 21, 5]],
  edit: [['path', 3, 21, 5, 14, 17, 2, 22, 7, 10, 19, 3, 21], ['path', 14, 5, 19, 10]],
  close: [['path', 5, 5, 19, 19], ['path', 19, 5, 5, 19]],
  'arrow-up-right': [['path', 5, 19, 19, 5], ['path', 7, 5, 19, 5, 19, 17]],
  document: [['path', 5, 2, 14, 2, 20, 8, 20, 22, 5, 22, 5, 2], ['path', 14, 2, 14, 8, 20, 8], ['path', 9, 12, 16, 12], ['path', 9, 17, 16, 17]],
  database: [['ellipse', 12, 5, 9, 3], ['path', 3, 5, 3, 19, 7, 22, 17, 22, 21, 19, 21, 5], ['path', 3, 12, 7, 15, 17, 15, 21, 12]],
  server: [['rect', 3, 3, 18, 7], ['rect', 3, 14, 18, 7], ['circle', 7, 6.5, 0.7], ['circle', 7, 17.5, 0.7], ['path', 12, 6.5, 17, 6.5], ['path', 12, 17.5, 17, 17.5]],
  cloud: [['curve', 5, 19, 0, 19, 0, 10, 6, 10], ['curve', 6, 10, 3, 1, 20, 0, 20, 10], ['curve', 20, 10, 24, 10, 24, 19, 19, 19], ['path', 19, 19, 5, 19]],
  globe: [['circle', 12, 12, 10], ['ellipse', 12, 12, 4, 10], ['path', 2, 12, 22, 12]],
  folder: [['path', 2, 20, 2, 4, 9, 4, 12, 7, 22, 7, 22, 20, 2, 20]],
  lock: [['rect', 5, 10, 14, 12], ['path', 7, 10, 7, 5, 10, 2, 14, 2, 17, 5, 17, 10], ['path', 12, 15, 12, 18]],
  clock: [['circle', 12, 12, 10], ['path', 12, 5, 12, 12, 17, 15]]
};
export const iconNames = Object.keys(glyphs);
export function iconNodes(name, box, color, prefix) {
  const scale = Math.min(box.width, box.height) / 24;
  return (Object.hasOwn(glyphs, name) ? glyphs[name] : []).map(([type, ...values], index) => {
    const geometry = type === 'path' || type === 'curve' ? { ...(type === 'curve' ? { curve: 'cubic' } : {}), points: Array.from({ length: values.length / 2 }, (_, offset) => ({ x: box.x + values[offset * 2] * scale, y: box.y + values[offset * 2 + 1] * scale })) }
      : type === 'rect' ? { x: box.x + values[0] * scale, y: box.y + values[1] * scale, width: values[2] * scale, height: values[3] * scale }
        : { cx: box.x + values[0] * scale, cy: box.y + values[1] * scale, ...(type === 'circle' ? { r: values[2] * scale } : { rx: values[2] * scale, ry: values[3] * scale }) };
    return { id: `${prefix}-${index}`, type: type === 'curve' ? 'path' : type, geometry, decorative: true, style: { fill: 'none', stroke: color, strokeWidth: Math.max(1, 1.8 * scale), lineCap: 'round', lineJoin: 'round' }, zIndex: 4 };
  });
}
