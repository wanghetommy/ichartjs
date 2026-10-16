/** Opt-in diagram visuals; palette and business semantics remain host choices. */
import { iconNames } from './icons.mjs';
export const diagramTones = ['accent', 'secondary', 'neutral', 'success', 'warning', 'danger'];
export const diagramVisualContract = { appearances: ['classic', 'soft'], icons: iconNames, iconPosition: ['left', 'top'], tones: diagramTones, fields: ['appearance', 'cornerRadius', 'arrow', 'iconPosition', 'iconBadge'], defaults: { appearance: 'classic', cornerRadius: 0, arrow: 'filled', iconPosition: 'left', iconBadge: false }, soft: { cornerRadius: 10, arrow: 'open', iconBadge: true }, activation: 'diagram.appearance; theme.palette independently; nodes[].icon/tone and edges[].tone are explicit' };

export function diagramVisuals(spec) {
  const input = spec.diagram || {}, soft = input.appearance === 'soft';
  return { soft, radius: input.cornerRadius ?? (soft ? 10 : 0), arrow: input.arrow ?? (soft ? 'open' : 'filled'), iconPosition: input.iconPosition || 'left', iconBadge: input.iconBadge ?? soft };
}
export function toneColor(theme, colors, tone) { return tone === 'neutral' ? theme.axis : tone === 'secondary' ? colors[1 % colors.length] : theme.status[tone] || colors[0]; }
export function tintedFill(color, theme, amount = 0.12) {
  if (theme.resolvedMode === 'contrast' || !/^#[\da-f]{6}$/i.test(color) || !/^#[\da-f]{6}$/i.test(theme.background)) return theme.surface;
  return '#' + [1, 3, 5].map(index => Math.round(parseInt(color.slice(index, index + 2), 16) * amount + parseInt(theme.background.slice(index, index + 2), 16) * (1 - amount)).toString(16).padStart(2, '0')).join('');
}
