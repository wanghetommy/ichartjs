/** Renderer-independent chart lifecycle cleanup. */
export function destroyChart(chart) {
  if (chart._destroyed) return;
  chart._destroyed = true;
  chart._preferencesUnsubscribe?.();
  chart._resizeObserver?.disconnect();
  chart._colorSchemeQuery?.removeEventListener?.('change', chart._colorSchemeHandler);
  if (chart._eventsBound) {
    const { target, handler, start, move, end, leave, touchStart, touchMove, touchEnd, wheel } = chart._eventsBound;
    target.removeEventListener('mousemove', handler);
    target.removeEventListener('click', handler);
    target.removeEventListener('pointerdown', start);
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', end);
    target.removeEventListener('pointercancel', end);
    target.removeEventListener('pointerleave', leave);
    target.removeEventListener('touchstart', touchStart);
    target.removeEventListener('touchmove', touchMove);
    target.removeEventListener('touchend', touchEnd);
    target.removeEventListener('wheel', wheel);
  }
  const target = chart.renderer.svg || chart.renderer.canvas;
  if (chart._keyboardHandler) target?.removeEventListener('keydown', chart._keyboardHandler);
  chart._tooltip?.remove();
  chart.plugins.destroy();
  chart.renderer.destroy();
  chart.listeners.clear();
  chart._eventsBound = null;
  chart._selected.clear();
  chart._clipboard = { nodes: [], edges: [] };
}
