import type {
  BallNumber,
  PocketId,
  ShotEvent,
  ShotPlayback,
  ShotResult,
  TableGeometry,
  TableState,
} from '../shared';
import { TABLE } from '../shared';
import {
  resolveBalls,
  resolveCushion,
  timeToBall,
  timeToEnterCircle,
  timeToPoint,
  timeToSegment,
} from './collisions';
import { resolveCluster, touchingCluster } from './cluster';
import { applyFriction, integrateOrientation } from './motion';
import { PHYSICS } from './params';
import { bodiesFromTable, isMoving, tableFromBodies, type Body } from './world';

/** Initial motion given to one ball at t = 0 (index into TableState.balls). */
export interface InitialMotion {
  readonly index: number;
  readonly vx: number;
  readonly vy: number;
  readonly rx: number;
  readonly ry: number;
  readonly wz: number;
}

export interface SimulateOptions {
  /** Record a trajectory for animation (costs memory; the AI leaves it off). */
  readonly record?: boolean;
  readonly maxTime?: number;
  readonly table?: TableGeometry;
}

type Hit =
  | { kind: 'ball'; a: Body; b: Body }
  | { kind: 'segment'; a: Body; nx: number; ny: number; jaw: boolean }
  | { kind: 'tip'; a: Body; x: number; y: number }
  | { kind: 'pocket'; a: Body; pocket: PocketId };

/** Distance from the cushion line inside which a ball may touch a cushion or pocket. */
const EDGE_ZONE = 0.075;

/**
 * Runs the deterministic simulation until every ball stops. Fixed timestep: each step
 * applies friction, then sweeps all moving balls forward resolving collisions in exact
 * time order (continuous detection — fast balls never tunnel). No wall-clock time, no
 * randomness: identical inputs give bit-identical results.
 */
export function simulate(
  start: TableState,
  motions: readonly InitialMotion[],
  options: SimulateOptions = {},
): ShotResult {
  const table = options.table ?? TABLE;
  const maxTime = options.maxTime ?? PHYSICS.maxTime;
  const R = table.ballRadius;
  const bodies = bodiesFromTable(start);
  for (const m of motions) {
    const b = bodies[m.index];
    if (!b || !b.onTable) continue;
    b.vx = m.vx;
    b.vy = m.vy;
    b.rx = m.rx;
    b.ry = m.ry;
    b.wz = m.wz;
  }

  const events: ShotEvent[] = [];
  const pocketed: BallNumber[] = [];
  let firstContact: BallNumber | null = null;
  const recorder = options.record ? createRecorder(bodies) : null;
  const stepsPerSample = Math.max(1, Math.round(PHYSICS.sampleInterval / PHYSICS.dt));
  const dt = PHYSICS.dt;
  const halfL = table.length / 2;
  const halfW = table.width / 2;
  /** Indices (into bodies) of balls still moving, in ascending order. */
  const moving: number[] = [];

  const collectMoving = (): void => {
    moving.length = 0;
    bodies.forEach((b, i) => {
      if (isMoving(b)) moving.push(i);
    });
  };

  /** Earliest collision among moving balls within `window` seconds. */
  const findHit = (window: number): { t: number; hit: Hit | null } => {
    let best = window;
    let hit: Hit | null = null;
    for (const ia of moving) {
      const a = bodies[ia] as Body;
      for (let ib = 0; ib < bodies.length; ib++) {
        const b = bodies[ib] as Body;
        if (ib === ia || !b.onTable) continue;
        // A pair of moving balls is tested once, from the lower index.
        if (ib < ia && isMoving(b)) continue;
        const t = timeToBall(a, b, R, best);
        if (t < best) {
          best = t;
          hit = { kind: 'ball', a, b };
        }
      }
      // Cushions and pockets only matter near the edge of the playing surface.
      const reachX = Math.abs(a.px) + Math.abs(a.vx) * window;
      const reachY = Math.abs(a.py) + Math.abs(a.vy) * window;
      if (reachX < halfL - EDGE_ZONE && reachY < halfW - EDGE_ZONE) continue;
      for (const s of table.cushions) {
        const t = timeToSegment(a, s, R, best);
        if (t < best) {
          best = t;
          hit = { kind: 'segment', a, nx: s.normal.x, ny: s.normal.y, jaw: s.kind === 'jaw' };
        }
      }
      for (const p of table.jawTips) {
        const t = timeToPoint(a, p, R, best);
        if (t < best) {
          best = t;
          hit = { kind: 'tip', a, x: p.x, y: p.y };
        }
      }
      for (const p of table.pockets) {
        const t = timeToEnterCircle(a, p.position, p.radius, best);
        if (t < best) {
          best = t;
          hit = { kind: 'pocket', a, pocket: p.id };
        }
      }
    }
    return { t: best, hit };
  };

  const advance = (t: number): void => {
    if (t === 0) return;
    for (const i of moving) {
      const b = bodies[i] as Body;
      b.px += b.vx * t;
      b.py += b.vy * t;
    }
  };

  let time = 0;
  let step = 0;
  collectMoving();
  while (moving.length > 0 && time < maxTime) {
    for (const b of bodies) {
      if (!b.onTable) continue;
      applyFriction(b, dt);
      integrateOrientation(b, R, dt);
    }

    let remaining = dt;
    for (let n = 0; n < PHYSICS.maxEventsPerStep && remaining > 0; n++) {
      collectMoving();
      if (moving.length === 0) break;
      const { t, hit } = findHit(remaining);
      advance(t);
      remaining -= t;
      if (!hit) break;
      const now = time + (dt - remaining);
      const a = hit.a;
      if (hit.kind === 'ball') {
        const b = hit.b;
        const cluster = touchingCluster(bodies, a, b, R);
        if (cluster.length === 2) {
          const speed = resolveBalls(a, b);
          events.push({ kind: 'ball', time: now, a: a.id, b: b.id, speed });
        } else {
          // The ~1 ms soft-contact exchange is treated as instantaneous on the timeline.
          for (const c of resolveCluster(cluster, R)) {
            events.push({ kind: 'ball', time: now, a: c.a, b: c.b, speed: c.speed });
          }
        }
        if (firstContact === null && (a.id === 0 || b.id === 0)) {
          firstContact = a.id === 0 ? b.id : a.id;
        }
      } else if (hit.kind === 'segment') {
        const e = hit.jaw ? PHYSICS.jawRestitution : PHYSICS.cushionRestitution;
        const speed = resolveCushion(a, hit.nx, hit.ny, e, R);
        const cushion = hit.jaw ? 'jaw' : 'rail';
        events.push({ kind: 'cushion', time: now, ball: a.id, cushion, speed });
      } else if (hit.kind === 'tip') {
        const dx = a.px - hit.x;
        const dy = a.py - hit.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const speed = resolveCushion(a, dx / len, dy / len, PHYSICS.jawRestitution, R);
        events.push({ kind: 'cushion', time: now, ball: a.id, cushion: 'jaw', speed });
      } else {
        a.onTable = false;
        a.pocket = hit.pocket;
        a.vx = a.vy = a.rx = a.ry = a.wz = 0;
        pocketed.push(a.id);
        events.push({ kind: 'pocket', time: now, ball: a.id, pocket: hit.pocket });
      }
    }
    // Only reached with time left if the event cap was hit (pathological cluster).
    if (remaining > 0) advance(remaining);

    time += dt;
    step++;
    if (recorder && step % stepsPerSample === 0) recorder.sample(bodies);
    collectMoving();
  }

  for (const b of bodies) {
    b.vx = b.vy = b.rx = b.ry = b.wz = 0;
  }
  if (recorder && step % stepsPerSample !== 0) recorder.sample(bodies);

  return {
    final: tableFromBodies(bodies),
    events,
    duration: time,
    firstContact,
    pocketed,
    playback: recorder ? recorder.finish() : null,
  };
}

function createRecorder(bodies: readonly Body[]) {
  const n = bodies.length;
  let capacity = 256;
  let count = 0;
  let positions = new Float32Array(capacity * n * 2);
  let orientations = new Float32Array(capacity * n * 4);
  const grow = (): void => {
    capacity *= 2;
    const p = new Float32Array(capacity * n * 2);
    p.set(positions);
    positions = p;
    const o = new Float32Array(capacity * n * 4);
    o.set(orientations);
    orientations = o;
  };
  const sample = (all: readonly Body[]): void => {
    if (count === capacity) grow();
    let pi = count * n * 2;
    let oi = count * n * 4;
    for (const b of all) {
      positions[pi++] = b.px;
      positions[pi++] = b.py;
      orientations[oi++] = b.qw;
      orientations[oi++] = b.qx;
      orientations[oi++] = b.qy;
      orientations[oi++] = b.qz;
    }
    count++;
  };
  sample(bodies);
  return {
    sample,
    finish: (): ShotPlayback => ({
      sampleInterval: PHYSICS.sampleInterval,
      sampleCount: count,
      ballCount: n,
      positions: positions.slice(0, count * n * 2),
      orientations: orientations.slice(0, count * n * 4),
    }),
  };
}
