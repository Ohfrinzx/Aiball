import type { Vec2 } from '../shared';

/** Movement (CSS px) below which a press counts as a tap rather than a drag. */
export const TAP_SLOP_PX = 8;
/** Fine-aim wheel: radians of aim per CSS pixel dragged (≈0.03°/px). */
export const FINE_AIM_RAD_PER_PX = 0.0005;
/** Mouse wheel: radians of aim per wheel delta unit (≈0.6° per notch of 100). */
export const WHEEL_RAD_PER_UNIT = 0.0001;
/** Spin pad: offsets closer than this to the center snap to no spin. */
export const SPIN_SNAP = 0.12;

/**
 * Aim rotation for a drag step from `prev` to `next` (screen px), rotating around the
 * cue ball at `pivot` like grabbing the cue/guide line. The tangential part of the move
 * is divided by the distance to the pivot, but never by less than `minRadius`, so drags
 * right next to the cue ball don't spin the aim wildly. Positive = clockwise on screen,
 * which is also positive in table space (the view transform is a pure rotation).
 */
export function aimDeltaFromDrag(pivot: Vec2, prev: Vec2, next: Vec2, minRadius: number): number {
  const rx = prev.x - pivot.x;
  const ry = prev.y - pivot.y;
  const r = Math.hypot(rx, ry);
  if (r === 0) return 0;
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const tangential = (rx * dy - ry * dx) / r;
  return tangential / Math.max(r, minRadius);
}

/** Power for a pull-back drag: 0 at the press point, 1 after `travel` px downward. */
export function powerFromPull(startY: number, y: number, travel: number): number {
  if (travel <= 0) return 0;
  return Math.max(0, Math.min(1, (y - startY) / travel));
}

/**
 * Spin from a point on the spin pad (a circle at `center` with `radius`, screen px):
 * right of center is right english, above center is follow. Clamped to the unit
 * circle; tiny offsets snap to center so "no spin" is easy to pick.
 */
export function spinFromPad(center: Vec2, radius: number, p: Vec2): Vec2 {
  let x = (p.x - center.x) / radius;
  let y = -(p.y - center.y) / radius;
  const len = Math.hypot(x, y);
  if (len < SPIN_SNAP) return { x: 0, y: 0 };
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}

/** Normalizes an angle to (−π, π]. */
export function wrapAngle(a: number): number {
  const twoPi = 2 * Math.PI;
  let r = a % twoPi;
  if (r <= -Math.PI) r += twoPi;
  if (r > Math.PI) r -= twoPi;
  return r;
}
