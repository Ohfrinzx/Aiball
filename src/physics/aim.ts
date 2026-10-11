import type { AimHit, AimPrediction, BallNumber, TableGeometry, TableState, Vec2 } from '../shared';
import { CUE_BALL, TABLE } from '../shared';
import {
  timeToEnterCircle,
  timeToPoint,
  timeToReach,
  timeToSegment,
  type Mover,
} from './collisions';

/** Longer than any straight path on the table, meters. */
const MAX_RAY = 5;

/**
 * Guide line: sweeps the cue ball along `angle` and reports the first thing it touches
 * (ball, cushion or pocket), the ghost-ball position, and for a ball hit the object
 * ball's direction (line of centers) and the cue ball's no-spin deflection (tangent line).
 * Returns null when the cue ball is not on the table.
 */
export function predictAim(
  state: TableState,
  angle: number,
  table: TableGeometry = TABLE,
): AimPrediction | null {
  const cue = state.balls.find((b) => b.id === CUE_BALL && !b.isPocketed);
  if (!cue) return null;
  const R = table.ballRadius;
  const origin = cue.position;
  const direction: Vec2 = { x: Math.cos(angle), y: Math.sin(angle) };
  // A unit-speed mover: time along the sweep equals distance travelled.
  const ray: Mover = { px: origin.x, py: origin.y, vx: direction.x, vy: direction.y };

  let best = MAX_RAY;
  let hit: AimHit = { kind: 'cushion', normal: { x: -direction.x, y: -direction.y } };

  for (const b of state.balls) {
    if (b === cue || b.isPocketed) continue;
    const t = timeToReach(
      b.position.x - origin.x,
      b.position.y - origin.y,
      -direction.x,
      -direction.y,
      2 * R,
      best,
    );
    if (t < best) {
      best = t;
      const cx = origin.x + direction.x * t;
      const cy = origin.y + direction.y * t;
      hit = ballHit(b.id, b.position, cx, cy, direction);
    }
  }
  for (const s of table.cushions) {
    const t = timeToSegment(ray, s, R, best);
    if (t < best) {
      best = t;
      hit = { kind: 'cushion', normal: s.normal };
    }
  }
  for (const p of table.jawTips) {
    const t = timeToPoint(ray, p, R, best);
    if (t < best) {
      best = t;
      const cx = origin.x + direction.x * t;
      const cy = origin.y + direction.y * t;
      const len = Math.hypot(cx - p.x, cy - p.y) || 1;
      hit = { kind: 'cushion', normal: { x: (cx - p.x) / len, y: (cy - p.y) / len } };
    }
  }
  for (const p of table.pockets) {
    const t = timeToEnterCircle(ray, p.position, p.radius, best);
    if (t < best) {
      best = t;
      hit = { kind: 'pocket', pocket: p.id };
    }
  }

  return {
    origin,
    direction,
    contact: { x: origin.x + direction.x * best, y: origin.y + direction.y * best },
    hit,
  };
}

function ballHit(ball: BallNumber, position: Vec2, cx: number, cy: number, d: Vec2): AimHit {
  const nx0 = position.x - cx;
  const ny0 = position.y - cy;
  const len = Math.hypot(nx0, ny0) || 1;
  const n = { x: nx0 / len, y: ny0 / len };
  const fullness = Math.max(0, Math.min(1, d.x * n.x + d.y * n.y));
  const tx = d.x - fullness * n.x;
  const ty = d.y - fullness * n.y;
  const tlen = Math.hypot(tx, ty);
  // Dead-full hit: the tangent is undefined; any perpendicular works (its length is 0).
  const cueDirection = tlen > 1e-9 ? { x: tx / tlen, y: ty / tlen } : { x: -n.y, y: n.x };
  return { kind: 'ball', ball, ballPosition: position, objectDirection: n, cueDirection, fullness };
}
