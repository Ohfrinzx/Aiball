import type { CushionSegment, Vec2 } from '../shared';
import { PHYSICS } from './params';
import type { Body } from './world';

const NONE = Number.POSITIVE_INFINITY;

/** Anything with a center and a constant velocity over the sweep window. */
export interface Mover {
  readonly px: number;
  readonly py: number;
  readonly vx: number;
  readonly vy: number;
}

/**
 * Earliest t in [0, tMax] at which two circles whose centers are d apart and closing
 * at relative velocity w reach `reach` (sum of radii), or Infinity. Overlapping and
 * approaching counts as t = 0; separating pairs never collide.
 */
export function timeToReach(
  dx: number,
  dy: number,
  wx: number,
  wy: number,
  reach: number,
  tMax: number,
): number {
  const b = dx * wx + dy * wy;
  if (b >= 0) return NONE;
  const c = dx * dx + dy * dy - reach * reach;
  if (c <= 0) return 0;
  const a = wx * wx + wy * wy;
  const disc = b * b - a * c;
  if (disc < 0) return NONE;
  // Numerically stable smaller root of a·t² + 2b·t + c = 0.
  const t = c / (-b + Math.sqrt(disc));
  return t <= tMax ? t : NONE;
}

export function timeToBall(a: Mover, b: Mover, radius: number, tMax: number): number {
  return timeToReach(b.px - a.px, b.py - a.py, b.vx - a.vx, b.vy - a.vy, 2 * radius, tMax);
}

/** Time until the ball touches the segment's face (not its endpoints), or Infinity. */
export function timeToSegment(b: Mover, s: CushionSegment, radius: number, tMax: number): number {
  const vn = b.vx * s.normal.x + b.vy * s.normal.y;
  if (vn >= 0) return NONE;
  const dist = (b.px - s.a.x) * s.normal.x + (b.py - s.a.y) * s.normal.y;
  // Behind the face: the ball is on the far side (only possible for one-sided jaws).
  if (dist < 0) return NONE;
  const t = dist <= radius ? 0 : (dist - radius) / -vn;
  if (t > tMax) return NONE;
  const ex = s.b.x - s.a.x;
  const ey = s.b.y - s.a.y;
  const proj = (b.px + b.vx * t - s.a.x) * ex + (b.py + b.vy * t - s.a.y) * ey;
  if (proj < 0 || proj > ex * ex + ey * ey) return NONE;
  return t;
}

export function timeToPoint(b: Mover, p: Vec2, radius: number, tMax: number): number {
  return timeToReach(p.x - b.px, p.y - b.py, -b.vx, -b.vy, radius, tMax);
}

/** Time until the ball center enters a circle (pocket capture), or Infinity. */
export function timeToEnterCircle(b: Mover, c: Vec2, r: number, tMax: number): number {
  const dx = b.px - c.x;
  const dy = b.py - c.y;
  const cc = dx * dx + dy * dy - r * r;
  if (cc <= 0) return 0;
  const bb = dx * b.vx + dy * b.vy;
  if (bb >= 0) return NONE;
  const a = b.vx * b.vx + b.vy * b.vy;
  const disc = bb * bb - a * cc;
  if (disc < 0) return NONE;
  const t = cc / (-bb + Math.sqrt(disc));
  return t <= tMax ? t : NONE;
}

/**
 * Equal-mass ball–ball impulse along the line of centers. Balls are treated as
 * frictionless against each other, so spin is untouched: that is what makes stun,
 * draw and follow behave correctly after contact. Returns the closing speed.
 */
export function resolveBalls(a: Body, b: Body): number {
  let nx = b.px - a.px;
  let ny = b.py - a.py;
  const len = Math.sqrt(nx * nx + ny * ny);
  if (len === 0) return 0;
  nx /= len;
  ny /= len;
  const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (closing <= 0) return 0;
  const j = 0.5 * (1 + PHYSICS.ballRestitution) * closing;
  a.vx -= j * nx;
  a.vy -= j * ny;
  b.vx += j * nx;
  b.vy += j * ny;
  return closing;
}

/**
 * Bounce off a cushion whose face has unit normal (nx, ny) pointing toward the ball.
 * Side spin grips the rail through friction (limited by μ·normal impulse), which bends
 * the rebound and uses up spin — running english widens the angle, reverse narrows it. Part of the roll
 * component into the rail is reversed, as real rails contact above the equator.
 * Returns the speed into the cushion.
 */
export function resolveCushion(
  b: Body,
  nx: number,
  ny: number,
  restitution: number,
  radius: number,
): number {
  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) return 0;
  // Tangent t = ẑ × (−n). Only the side spin's surface speed (R·wz along t) grips the
  // rail; the ball's own sliding along the rail is ignored, which keeps plain banks
  // mirror-like and predictable as in mobile pool, while english still bends them.
  const tx = ny;
  const ty = -nx;
  const slip = radius * b.wz;
  const normalImpulse = (1 + restitution) * -vn;
  const limit = PHYSICS.cushionFriction * normalImpulse;
  const jt = Math.max(-limit, Math.min(limit, -slip / 3.5));

  b.vx += -(1 + restitution) * vn * nx + jt * tx;
  b.vy += -(1 + restitution) * vn * ny + jt * ty;
  b.wz += (2.5 * jt) / radius;

  const rn = b.rx * nx + b.ry * ny;
  if (rn < 0) {
    const k = 1 + PHYSICS.cushionRollReversal;
    b.rx -= k * rn * nx;
    b.ry -= k * rn * ny;
  }
  return -vn;
}
