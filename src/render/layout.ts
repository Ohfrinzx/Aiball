import { TABLE_OUTER } from '../shared';
import type { Orientation, ScreenRect, Vec2, Viewport, ViewTransform } from '../shared';

/** Space reserved around the table for HUD elements, as fractions of the viewport. */
export interface HudInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/**
 * Portrait (phones): table stands vertically; player bar on top, power slider strip on
 * the left, fine-aim wheel strip on the right.
 * Landscape (desktop): table lies horizontally; same arrangement around it.
 */
export const HUD_INSETS: Record<Orientation, HudInsets> = {
  portrait: { top: 0.12, right: 0.1, bottom: 0.03, left: 0.1 },
  landscape: { top: 0.11, right: 0.08, bottom: 0.04, left: 0.08 },
};

export interface Layout extends ViewTransform {
  readonly viewport: Viewport;
  /** Screen position (CSS px) of the table center. */
  readonly center: Vec2;
  /** On-screen bounding box of the whole table (including rails), CSS px. */
  readonly tableRect: ScreenRect;
  /** Rotation applied when drawing table space onto the screen, radians. */
  readonly rotation: number;
}

export function orientationFor(viewport: Viewport): Orientation {
  return viewport.height > viewport.width ? 'portrait' : 'landscape';
}

/**
 * Fit the table into the viewport without distortion. In portrait the table is
 * rotated so that its length runs vertically; the foot (+x) points to the top
 * of the screen, so the breaking player shoots "up" the table.
 */
export function computeLayout(viewport: Viewport): Layout {
  const orientation = orientationFor(viewport);
  const insets = HUD_INSETS[orientation];

  const availX = viewport.width * insets.left;
  const availY = viewport.height * insets.top;
  const availW = Math.max(1, viewport.width * (1 - insets.left - insets.right));
  const availH = Math.max(1, viewport.height * (1 - insets.top - insets.bottom));

  const portrait = orientation === 'portrait';
  // On-screen extents of the table in meters after rotation.
  const screenMetersW = portrait ? TABLE_OUTER.width : TABLE_OUTER.length;
  const screenMetersH = portrait ? TABLE_OUTER.length : TABLE_OUTER.width;

  const scale = Math.min(availW / screenMetersW, availH / screenMetersH);
  const width = screenMetersW * scale;
  const height = screenMetersH * scale;
  const center = { x: availX + availW / 2, y: availY + availH / 2 };

  // Portrait: rotate -90°, mapping table +x to screen up (-y) and table +y to screen +x.
  const rotation = portrait ? -Math.PI / 2 : 0;

  const tableToScreen = (p: Vec2): Vec2 =>
    portrait
      ? { x: center.x + p.y * scale, y: center.y - p.x * scale }
      : { x: center.x + p.x * scale, y: center.y + p.y * scale };

  const screenToTable = (s: Vec2): Vec2 => {
    const dx = (s.x - center.x) / scale;
    const dy = (s.y - center.y) / scale;
    return portrait ? { x: -dy, y: dx } : { x: dx, y: dy };
  };

  return {
    viewport,
    orientation,
    scale,
    center,
    rotation,
    tableRect: { x: center.x - width / 2, y: center.y - height / 2, width, height },
    tableToScreen,
    screenToTable,
  };
}
