/** Shared title Scene nodes and diagnostics; renderers only draw fitted text. */
import { SceneNode } from './scene.mjs';
import { fontAtSize } from './layout.mjs';

export function addTitleText(scene, spec, layout, warnings = []) {
  for (const [id, role, block, firstY] of [['title', 'title', layout.titleBlock, layout.titleY], ['subtitle', 'subtitle', layout.subtitleBlock, layout.subtitleY]]) {
    if (!block) continue;
    block.lines.forEach((line, index) => scene.add(new SceneNode({ id: index ? `${id}-line-${index}` : id, type: 'text', geometry: { text: line, x: spec.width / 2, y: firstY + index * block.lineHeight }, style: { fill: role === 'title' ? spec.theme.text : spec.theme.muted, font: fontAtSize(spec.theme.typography[role].font, block.size), textAnchor: 'middle', textBaseline: 'middle', baseline: 'middle' } })));
    if (block.truncated || block.overflowed) warnings.push({ code: 'TITLE_TRUNCATED', path: `title.${role === 'title' ? 'text' : 'subtitle'}`, message: 'Title text exceeds the available chart chrome space.', suggestion: 'Increase chart size or shorten the heading.' });
  }
}
