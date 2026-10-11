import { TABLE } from '../shared';
import type {
  BallNumber,
  PocketId,
  Quat,
  SceneBall,
  ShotResult,
  TableState,
  Vec2,
} from '../shared';

const POCKET_CENTERS = new Map<PocketId, Vec2>(TABLE.pockets.map((p) => [p.id, p.position]));

/** Seconds a pocketed ball takes to drop out of sight. */
export const SINK_TIME = 0.2;

/** How long the shot animation runs, seconds. */
export function playbackLength(result: ShotResult): number {
  const lastPocket = result.events.reduce(
    (t, e) => (e.kind === 'pocket' ? Math.max(t, e.time) : t),
    0,
  );
  return Math.max(result.duration, lastPocket + SINK_TIME);
}

/**
 * Visible balls `t` seconds into a recorded shot: positions and orientations are
 * interpolated between samples, and pocketed balls slide into the hole and shrink.
 */
export function sceneBallsAt(start: TableState, result: ShotResult, t: number): SceneBall[] {
  const pb = result.playback;
  if (!pb || pb.sampleCount === 0) return staticScene(result.final);
  const n = pb.ballCount;
  const s = Math.max(0, Math.min(pb.sampleCount - 1, t / pb.sampleInterval));
  const i0 = Math.floor(s);
  const i1 = Math.min(pb.sampleCount - 1, i0 + 1);
  const f = s - i0;

  const pocketTime = new Map<BallNumber, number>();
  for (const e of result.events) if (e.kind === 'pocket') pocketTime.set(e.ball, e.time);

  const out: SceneBall[] = [];
  start.balls.forEach((ball, i) => {
    if (ball.isPocketed) return;
    const p0 = (i0 * n + i) * 2;
    const p1 = (i1 * n + i) * 2;
    let x = lerp(pb.positions[p0] ?? 0, pb.positions[p1] ?? 0, f);
    let y = lerp(pb.positions[p0 + 1] ?? 0, pb.positions[p1 + 1] ?? 0, f);
    const orientation = nlerp(pb.orientations, (i0 * n + i) * 4, (i1 * n + i) * 4, f);
    let size = 1;
    const tp = pocketTime.get(ball.id);
    if (tp !== undefined && t >= tp) {
      const k = (t - tp) / SINK_TIME;
      if (k >= 1) return;
      const pocketId = result.final.balls[i]?.pocketId;
      const hole = pocketId ? POCKET_CENTERS.get(pocketId) : undefined;
      if (hole) {
        x = lerp(x, hole.x, k);
        y = lerp(y, hole.y, k);
      }
      size = 1 - 0.55 * k;
    }
    out.push({ id: ball.id, position: { x, y }, orientation, size });
  });
  return out;
}

export function staticScene(table: TableState): SceneBall[] {
  return table.balls
    .filter((b) => !b.isPocketed)
    .map((b) => ({ id: b.id, position: b.position, orientation: b.orientation, size: 1 }));
}

const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;

function nlerp(q: Float32Array, a: number, b: number, f: number): Quat {
  const aw = q[a] ?? 1;
  const ax = q[a + 1] ?? 0;
  const ay = q[a + 2] ?? 0;
  const az = q[a + 3] ?? 0;
  let bw = q[b] ?? 1;
  let bx = q[b + 1] ?? 0;
  let by = q[b + 2] ?? 0;
  let bz = q[b + 3] ?? 0;
  // Take the short way round (q and −q are the same rotation).
  if (aw * bw + ax * bx + ay * by + az * bz < 0) {
    bw = -bw;
    bx = -bx;
    by = -by;
    bz = -bz;
  }
  const w = lerp(aw, bw, f);
  const x = lerp(ax, bx, f);
  const y = lerp(ay, by, f);
  const z = lerp(az, bz, f);
  const len = Math.hypot(w, x, y, z) || 1;
  return { w: w / len, x: x / len, y: y / len, z: z / len };
}
