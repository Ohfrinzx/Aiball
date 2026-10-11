import type { PlacementArea, TableGeometry, TableState, Vec2 } from '../shared';
import { CUE_BALL, TABLE } from '../shared';

/** Small clearance so a placed ball never starts touching another or a cushion. */
const CLEARANCE = 0.0005;

function clampToArea(p: Vec2, area: PlacementArea, table: TableGeometry): Vec2 {
  const R = table.ballRadius + CLEARANCE;
  const halfL = table.length / 2;
  const halfW = table.width / 2;
  const maxX = area === 'kitchen' ? table.headStringX : halfL - R;
  return {
    x: Math.max(-halfL + R, Math.min(maxX, p.x)),
    y: Math.max(-halfW + R, Math.min(halfW - R, p.y)),
  };
}

function overlapsBall(p: Vec2, state: TableState, table: TableGeometry): boolean {
  const minDist = 2 * table.ballRadius + CLEARANCE;
  return state.balls.some(
    (b) =>
      b.id !== CUE_BALL &&
      !b.isPocketed &&
      Math.hypot(b.position.x - p.x, b.position.y - p.y) < minDist,
  );
}

export function isValidCuePlacement(
  p: Vec2,
  state: TableState,
  area: PlacementArea,
  table: TableGeometry = TABLE,
): boolean {
  const c = clampToArea(p, area, table);
  return c.x === p.x && c.y === p.y && !overlapsBall(p, state, table);
}

/**
 * Closest legal cue ball spot to `desired`: clamped into the area and pushed out of any
 * ball it would overlap. Returns null if no legal spot is found nearby (crowded area).
 */
export function findCuePlacement(
  desired: Vec2,
  state: TableState,
  area: PlacementArea,
  table: TableGeometry = TABLE,
): Vec2 | null {
  let p = clampToArea(desired, area, table);
  const minDist = 2 * table.ballRadius + CLEARANCE * 2;
  for (let iter = 0; iter < 8; iter++) {
    if (!overlapsBall(p, state, table)) return p;
    for (const b of state.balls) {
      if (b.id === CUE_BALL || b.isPocketed) continue;
      const dx = p.x - b.position.x;
      const dy = p.y - b.position.y;
      const d = Math.hypot(dx, dy);
      if (d >= minDist) continue;
      const ux = d > 1e-9 ? dx / d : 1;
      const uy = d > 1e-9 ? dy / d : 0;
      p = clampToArea(
        { x: b.position.x + ux * minDist, y: b.position.y + uy * minDist },
        area,
        table,
      );
    }
  }
  return overlapsBall(p, state, table) ? null : p;
}
