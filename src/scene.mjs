/**
 * Renderer-independent Scene Graph nodes, traversal, lookup, and hit testing.
 * Scene nodes carry geometry, style, data references, and interaction state.
 */
export class SceneNode {
  constructor(config = {}) {
    Object.assign(this, { id: '', type: 'group', geometry: {}, style: {}, children: [], dataRef: null, bounds: null, zIndex: 0, visible: true, interactive: false, selected: false, highlighted: false }, config);
  }
  add(node) { this.children.push(node instanceof SceneNode ? node : new SceneNode(node)); return node; }
}

export function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x, dy = end.y - start.y;
  if (!dx && !dy) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + ratio * dx), point.y - (start.y + ratio * dy));
}

export function cubicBezierPoint(points, t) {
  if (!Array.isArray(points) || points.length !== 4) return points?.[0] || { x: 0, y: 0 };
  const ratio = Math.max(0, Math.min(1, Number(t) || 0)), inverse = 1 - ratio;
  return {
    x: inverse ** 3 * points[0].x + 3 * inverse ** 2 * ratio * points[1].x + 3 * inverse * ratio ** 2 * points[2].x + ratio ** 3 * points[3].x,
    y: inverse ** 3 * points[0].y + 3 * inverse ** 2 * ratio * points[1].y + 3 * inverse * ratio ** 2 * points[2].y + ratio ** 3 * points[3].y
  };
}

export function sampleCubicBezier(points, segments = 20) {
  const count = Math.max(4, Math.round(Number(segments) || 20));
  return Array.from({ length: count + 1 }, (_, index) => cubicBezierPoint(points, index / count));
}

function geometryHit(node, x, y) {
  const geometry = node.geometry || {}, tolerance = Number(node.hitTolerance) || Math.max(6, Number(node.style?.strokeWidth) + 4 || 6);
  if (node.type === 'line') return pointToSegmentDistance({ x, y }, { x: geometry.x1, y: geometry.y1 }, { x: geometry.x2, y: geometry.y2 }) <= tolerance;
  if (node.type === 'path' && Array.isArray(geometry.points)) {
    const points = geometry.curve === 'cubic' ? sampleCubicBezier(geometry.points) : geometry.points;
    return points.some((point, index) => index > 0 && pointToSegmentDistance({ x, y }, points[index - 1], point) <= tolerance);
  }
  return Boolean(node.bounds && x >= node.bounds.x && x <= node.bounds.x + node.bounds.width && y >= node.bounds.y && y <= node.bounds.y + node.bounds.height);
}

export class Scene {
  constructor(width, height) { this.width = width; this.height = height; this.root = new SceneNode({ id: 'root', type: 'group' }); }
  add(node) { return this.root.add(node); }
  walk(fn, node = this.root) { fn(node); node.children.forEach(child => this.walk(fn, child)); }
  find(id) { let found; this.walk(node => { if (node.id === id) found = node; }); return found; }
  hit(x, y) { const hits = []; this.walk(node => { if (node.visible && node.interactive && geometryHit(node, x, y)) hits.push(node); }); return hits.sort((a, b) => b.zIndex - a.zIndex)[0] || null; }
}
