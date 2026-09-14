export class SceneNode {
  constructor(config = {}) {
    Object.assign(this, { id: '', type: 'group', geometry: {}, style: {}, children: [], dataRef: null, bounds: null, zIndex: 0, visible: true, interactive: false, selected: false, highlighted: false }, config);
  }
  add(node) { this.children.push(node instanceof SceneNode ? node : new SceneNode(node)); return node; }
}

export class Scene {
  constructor(width, height) { this.width = width; this.height = height; this.root = new SceneNode({ id: 'root', type: 'group' }); }
  add(node) { return this.root.add(node); }
  walk(fn, node = this.root) { fn(node); node.children.forEach(child => this.walk(fn, child)); }
  find(id) { let found; this.walk(node => { if (node.id === id) found = node; }); return found; }
  hit(x, y) { const hits = []; this.walk(node => { if (node.visible && node.interactive && node.bounds && x >= node.bounds.x && x <= node.bounds.x + node.bounds.width && y >= node.bounds.y && y <= node.bounds.y + node.bounds.height) hits.push(node); }); return hits.sort((a, b) => b.zIndex - a.zIndex)[0] || null; }
}
