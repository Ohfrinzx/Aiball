import { computeLayout, drawTable } from '../render';
import type { Layout } from '../render';

export interface App {
  /** Current layout (exposed for debugging and tests). */
  readonly layout: Layout;
  destroy(): void;
}

/**
 * Wires the canvas to the renderer and keeps it sized to its container.
 * Phase 0: draws the empty table only. Later phases add the game loop here.
 */
export function startApp(canvas: HTMLCanvasElement): App {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  let layout = computeLayout({ width: 1, height: 1 });

  const resize = (): void => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    layout = computeLayout({ width: rect.width, height: rect.height });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTable(ctx, layout);

    canvas.dataset.orientation = layout.orientation;
    const t = layout.tableRect;
    canvas.dataset.tableRect = [t.x, t.y, t.width, t.height].map((n) => n.toFixed(1)).join(',');
  };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  return {
    get layout() {
      return layout;
    },
    destroy: () => observer.disconnect(),
  };
}
