import { describe, expect, it } from 'vitest';
import { PHYSICS, cueSpeedForPower, simulate, simulateShot } from '../../src/physics';
import { resolveBalls, resolveCushion } from '../../src/physics/collisions';
import { applyFriction } from '../../src/physics/motion';
import type { Body } from '../../src/physics/world';
import { createRack } from '../../src/rules';
import { QUAT_IDENTITY, TABLE } from '../../src/shared';
import type { BallNumber, BallState, Shot, ShotResult, TableState } from '../../src/shared';

const R = TABLE.ballRadius;
const HALF_L = TABLE.length / 2;
const HALF_W = TABLE.width / 2;

const ball = (id: BallNumber, x: number, y: number): BallState => ({
  id,
  position: { x, y },
  orientation: QUAT_IDENTITY,
  isPocketed: false,
  pocketId: null,
});

const body = (over: Partial<Body> = {}): Body => ({
  id: 0,
  px: 0,
  py: 0,
  vx: 0,
  vy: 0,
  rx: 0,
  ry: 0,
  wz: 0,
  qw: 1,
  qx: 0,
  qy: 0,
  qz: 0,
  onTable: true,
  pocket: null,
  ...over,
});

const shot = (angle: number, power: number, sx = 0, sy = 0): Shot => ({
  angle,
  power,
  spin: { x: sx, y: sy },
});

const finalOf = (r: ShotResult, id: BallNumber): BallState => {
  const b = r.final.balls.find((x) => x.id === id);
  if (!b) throw new Error(`ball ${id} missing`);
  return b;
};

/** Inside the cushions, or resting in a pocket mouth (where there is no rail). */
function isInsideTable(p: { x: number; y: number }): boolean {
  const inRect = Math.abs(p.x) <= HALF_L - R + 1e-6 && Math.abs(p.y) <= HALF_W - R + 1e-6;
  const inMouth = TABLE.pockets.some(
    (k) => Math.hypot(p.x - k.mouth.x, p.y - k.mouth.y) < TABLE.ballRadius * 2.5,
  );
  return inRect || inMouth;
}

function expectNoOverlapsInside(state: TableState): void {
  const on = state.balls.filter((b) => !b.isPocketed);
  for (const b of on) expect(isInsideTable(b.position)).toBe(true);
  for (let i = 0; i < on.length; i++) {
    for (let j = i + 1; j < on.length; j++) {
      const a = on[i]!.position;
      const b = on[j]!.position;
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(2 * R - 1e-6);
    }
  }
}

/**
 * Furthest the cue ball travels along the shot line after its first contact, before
 * anything else touches it (so balls coming back off a rail don't spoil the measurement).
 */
function cueTravelAfterContact(r: ShotResult, angle = 0): number {
  const pb = r.playback!;
  const contact = r.events.find((e) => e.kind === 'ball');
  if (!contact) throw new Error('no contact');
  const next = r.events.find(
    (e) =>
      e.time > contact.time &&
      ((e.kind === 'ball' && (e.a === 0 || e.b === 0)) || (e.kind !== 'ball' && e.ball === 0)),
  );
  const end = next ? next.time : r.duration;
  const n = pb.ballCount;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const along = (s: number): number =>
    pb.positions[s * n * 2]! * ux + pb.positions[s * n * 2 + 1]! * uy;
  const s0 = Math.ceil(contact.time / pb.sampleInterval);
  let best = 0;
  for (let s = s0; s * pb.sampleInterval < end && s < pb.sampleCount; s++) {
    const d = along(s) - along(s0);
    if (Math.abs(d) > Math.abs(best)) best = d;
  }
  return best;
}

describe('determinism', () => {
  it('same table + same shot gives bit-identical results', () => {
    const rack = createRack(7);
    const s = shot(0.0123, 0.93, 0.2, -0.4);
    const a = simulateShot(rack, s, { record: true });
    const b = simulateShot(structuredClone(rack), s, { record: true });
    expect(b.final).toEqual(a.final);
    expect(b.events).toEqual(a.events);
    expect(b.duration).toBe(a.duration);
    expect(Array.from(b.playback!.positions)).toEqual(Array.from(a.playback!.positions));
  });

  it('recording a playback does not change the outcome', () => {
    const rack = createRack(3);
    const s = shot(-0.004, 1);
    expect(simulateShot(rack, s, { record: true }).final).toEqual(simulateShot(rack, s).final);
  });

  it('does not mutate the input table', () => {
    const rack = createRack(1);
    const copy = structuredClone(rack);
    simulateShot(rack, shot(0, 1));
    expect(rack).toEqual(copy);
  });

  it('tiny aim changes give different (chaotic) breaks, each reproducible', () => {
    const rack = createRack(1);
    const a = simulateShot(rack, shot(0, 1));
    const b = simulateShot(rack, shot(0.002, 1));
    expect(b.final).not.toEqual(a.final);
    expect(simulateShot(rack, shot(0.002, 1)).final).toEqual(b.final);
  });
});

describe('ball–ball collisions', () => {
  it('head-on: conserves momentum and loses energy according to restitution', () => {
    const a = body({ vx: 2 });
    const b = body({ id: 1, px: 2 * R });
    resolveBalls(a, b);
    const e = PHYSICS.ballRestitution;
    expect(a.vx + b.vx).toBeCloseTo(2, 12);
    expect(a.vx).toBeCloseTo((2 * (1 - e)) / 2, 12);
    expect(b.vx).toBeCloseTo((2 * (1 + e)) / 2, 12);
    const keBefore = 2 * 2;
    const keAfter = a.vx * a.vx + b.vx * b.vx;
    expect(keAfter).toBeLessThan(keBefore);
    expect(keAfter).toBeCloseTo(keBefore * ((1 + e * e) / 2), 12);
  });

  it('cut: object ball leaves along the line of centers, cue ball ~90° away', () => {
    const cut = Math.PI / 6;
    const a = body({ vx: 1 });
    const b = body({ id: 1, px: 2 * R * Math.cos(cut), py: 2 * R * Math.sin(cut) });
    resolveBalls(a, b);
    expect(Math.atan2(b.vy, b.vx)).toBeCloseTo(cut, 12);
    const dot = a.vx * b.vx + a.vy * b.vy;
    // Not exactly 90° because restitution < 1, but close.
    expect(Math.abs(dot) / (Math.hypot(a.vx, a.vy) * Math.hypot(b.vx, b.vy))).toBeLessThan(0.1);
  });

  it('separating balls do not collide', () => {
    const a = body({ vx: -1 });
    const b = body({ id: 1, px: 2 * R });
    expect(resolveBalls(a, b)).toBe(0);
    expect(a.vx).toBe(-1);
  });

  it('a stun shot stops the cue ball dead on a full hit', () => {
    const t: TableState = { balls: [ball(0, -0.2, 0), ball(1, 0, 0)] };
    const r = simulateShot(t, shot(0, 0.6), { record: true });
    expect(r.firstContact).toBe(1);
    // The cue ball is still sliding at contact, so it keeps almost nothing.
    expect(Math.abs(cueTravelAfterContact(r))).toBeLessThan(0.05);
  });

  it('fast balls never tunnel through each other', () => {
    const t: TableState = { balls: [ball(0, -0.8, 0), ball(1, 0, 0.9 * 2 * R)] };
    const r = simulateShot(t, shot(0, 1));
    expect(r.firstContact).toBe(1);
  });
});

describe('cushions', () => {
  it('rebounds with the cushion restitution and keeps the tangential speed', () => {
    const b = body({ vx: 2, vy: 1 });
    resolveCushion(b, -1, 0, PHYSICS.cushionRestitution, R);
    expect(b.vx).toBeCloseTo(-2 * PHYSICS.cushionRestitution, 12);
    expect(b.vy).toBeCloseTo(1, 12);
    expect(Math.hypot(b.vx, b.vy)).toBeLessThan(Math.hypot(2, 1));
  });

  it('a ball shot straight at a rail comes straight back', () => {
    const t: TableState = { balls: [ball(0, 0, 0.2)] };
    const r = simulateShot(t, shot(0, 0.35));
    expect(r.events.some((e) => e.kind === 'cushion' && e.cushion === 'rail')).toBe(true);
    expect(finalOf(r, 0).position.y).toBeCloseTo(0.2, 9);
  });

  it('side spin bends the rebound: right english kicks to the shooter’s right', () => {
    const t: TableState = { balls: [ball(0, 0.5, 0)] };
    // Shooting along +x the shooter's right is +y. Look just after the rail.
    const yAfterRail = (english: number): number => {
      const r = simulateShot(t, shot(0, 0.25, english, 0), { record: true });
      const rail = r.events.find((e) => e.kind === 'cushion');
      const pb = r.playback!;
      const s = Math.min(pb.sampleCount - 1, Math.ceil((rail!.time + 0.3) / pb.sampleInterval));
      return pb.positions[s * 2 + 1]!;
    };
    expect(yAfterRail(1)).toBeGreaterThan(0.02);
    expect(yAfterRail(-1)).toBeLessThan(-0.02);
    expect(yAfterRail(0)).toBeCloseTo(0, 9);
  });

  it('balls stay on the table and never overlap, even after hard breaks', () => {
    for (const angle of [0, 0.01, -0.02, 0.05]) {
      const r = simulateShot(createRack(11), shot(angle, 1, 0.3, 0.3));
      expectNoOverlapsInside(r.final);
    }
  });
});

describe('friction', () => {
  it('a sliding ball without spin starts rolling at 5/7 of its speed', () => {
    const b = body({ vx: 3 });
    for (let i = 0; i < 1000 && b.rx !== b.vx; i++) applyFriction(b, PHYSICS.dt);
    expect(b.rx).toBe(b.vx);
    // Rolling resistance also acted during the remaining steps; allow for it.
    expect(b.vx).toBeLessThan((5 / 7) * 3 + 1e-9);
    expect(b.vx).toBeGreaterThan((5 / 7) * 3 - 0.02);
  });

  it('slide→roll happens after 2u/(7μg)', () => {
    const b = body({ vx: 2 });
    const expected = (2 * 2) / (7 * PHYSICS.slideFriction * PHYSICS.gravity);
    let t = 0;
    while (b.rx !== b.vx) {
      applyFriction(b, PHYSICS.dt);
      t += PHYSICS.dt;
    }
    expect(Math.abs(t - expected)).toBeLessThanOrEqual(PHYSICS.dt);
  });

  it('a rolling ball decelerates uniformly and stops', () => {
    const t: TableState = { balls: [ball(0, -0.9, 0)] };
    const speed = cueSpeedForPower(0.1);
    const r = simulate(t, [{ index: 0, vx: speed, vy: 0, rx: speed, ry: 0, wz: 0 }]);
    const dist = finalOf(r, 0).position.x + 0.9;
    const expected = (speed * speed) / (2 * PHYSICS.rollFriction * PHYSICS.gravity);
    expect(dist).toBeCloseTo(expected, 2);
  });

  it('energy only ever decreases: total speed² over a break is non-increasing between collisions', () => {
    const r = simulateShot(createRack(2), shot(0, 0.8), { record: true });
    const pb = r.playback!;
    const n = pb.ballCount;
    const ke = (s: number): number => {
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const dx = pb.positions[(s + 1) * n * 2 + i * 2]! - pb.positions[s * n * 2 + i * 2]!;
        const dy =
          pb.positions[(s + 1) * n * 2 + i * 2 + 1]! - pb.positions[s * n * 2 + i * 2 + 1]!;
        sum += dx * dx + dy * dy;
      }
      return sum;
    };
    // Compare windows a second apart (finite differences are noisy right at impacts).
    const perSecond = Math.round(1 / pb.sampleInterval);
    for (let s = perSecond; s + perSecond + 1 < pb.sampleCount; s += perSecond) {
      expect(ke(s + perSecond)).toBeLessThanOrEqual(ke(s) + 1e-12);
    }
    expect(ke(pb.sampleCount - 2)).toBe(0);
  });
});

describe('spin', () => {
  // Cue ball and object ball lined up with the bottom-right pocket: the object ball drops,
  // so it can't come back and disturb the cue ball.
  const mouth = TABLE.pockets.find((p) => p.id === 'bottomRight')!.mouth;
  const start = { x: -0.45, y: -0.25 };
  const angle = Math.atan2(mouth.y - start.y, mouth.x - start.x);
  const ob = { x: start.x + 0.6 * Math.cos(angle), y: start.y + 0.6 * Math.sin(angle) };
  const lineUp: TableState = { balls: [ball(0, start.x, start.y), ball(1, ob.x, ob.y)] };
  const travel = (sy: number, power: number): number =>
    cueTravelAfterContact(simulateShot(lineUp, shot(angle, power, 0, sy), { record: true }), angle);

  it('draw pulls the cue ball back after a full hit', () => {
    expect(travel(-1, 0.4)).toBeLessThan(-0.3);
  });

  it('follow pushes the cue ball through after a full hit', () => {
    expect(travel(1, 0.3)).toBeGreaterThan(0.2);
  });

  it('more draw or follow moves the cue ball further', () => {
    const power = 0.3;
    expect(travel(-1, power)).toBeLessThan(travel(-0.5, power));
    expect(travel(-0.5, power)).toBeLessThan(travel(0, power));
    expect(travel(0, power)).toBeLessThan(travel(0.5, power));
    expect(travel(0.5, power)).toBeLessThan(travel(1, power));
  });

  it('the object ball is pocketed in these set-ups', () => {
    expect(simulateShot(lineUp, shot(angle, 0.3)).pocketed).toContain(1);
  });
});

describe('pockets', () => {
  it('a straight shot into a corner is pocketed', () => {
    const target = TABLE.pockets.find((p) => p.id === 'bottomRight')!;
    const start = { x: 0.3, y: 0 };
    const angle = Math.atan2(target.mouth.y - start.y, target.mouth.x - start.x);
    const r = simulateShot({ balls: [ball(0, start.x, start.y)] }, shot(angle, 0.3));
    expect(r.pocketed).toEqual([0]);
    expect(finalOf(r, 0).isPocketed).toBe(true);
    expect(finalOf(r, 0).pocketId).toBe('bottomRight');
    expect(r.events.at(-1)).toMatchObject({ kind: 'pocket', ball: 0, pocket: 'bottomRight' });
  });

  it('a straight shot into a side pocket is pocketed', () => {
    const r = simulateShot({ balls: [ball(0, 0, 0)] }, shot(-Math.PI / 2, 0.25));
    expect(finalOf(r, 0).pocketId).toBe('topSide');
  });

  it('an object ball cut into a corner drops', () => {
    const target = TABLE.pockets.find((p) => p.id === 'topRight')!;
    const ob = { x: 0.6, y: -0.25 };
    const toPocket = Math.atan2(target.mouth.y - ob.y, target.mouth.x - ob.x);
    const ghost = { x: ob.x - 2 * R * Math.cos(toPocket), y: ob.y - 2 * R * Math.sin(toPocket) };
    const cue = { x: 0.1, y: 0.05 };
    const angle = Math.atan2(ghost.y - cue.y, ghost.x - cue.x);
    const t: TableState = { balls: [ball(0, cue.x, cue.y), ball(5, ob.x, ob.y)] };
    const r = simulateShot(t, shot(angle, 0.35));
    expect(r.firstContact).toBe(5);
    expect(r.pocketed).toContain(5);
  });

  it('balls hitting the jaws can rattle in or rattle out', () => {
    const target = TABLE.pockets.find((p) => p.id === 'topRight')!;
    let rattledIn = 0;
    let rattledOut = 0;
    for (let k = -40; k <= 40; k++) {
      const start = { x: 0.2, y: 0.1 + k * 0.0015 };
      const angle = Math.atan2(target.mouth.y - 0.1, target.mouth.x - 0.2);
      const r = simulateShot({ balls: [ball(0, start.x, start.y)] }, shot(angle, 0.3));
      const jawHits = r.events.filter((e) => e.kind === 'cushion' && e.cushion === 'jaw').length;
      if (jawHits > 0 && r.pocketed.length > 0) rattledIn++;
      if (jawHits > 0 && r.pocketed.length === 0) rattledOut++;
    }
    expect(rattledIn).toBeGreaterThan(0);
    expect(rattledOut).toBeGreaterThan(0);
  });
});

describe('break', () => {
  it('a full-power break spreads the rack', () => {
    const rack = createRack(4);
    const r = simulateShot(rack, shot(0, 1));
    const moved = r.final.balls.filter((b, i) => {
      const s = rack.balls[i]!.position;
      return b.isPocketed || Math.hypot(b.position.x - s.x, b.position.y - s.y) > 0.1;
    });
    expect(moved.length).toBeGreaterThanOrEqual(11);
    expect(r.firstContact).not.toBeNull();
  });

  it('is fast enough for an AI to run many simulations', () => {
    const rack = createRack(9);
    simulateShot(rack, shot(0, 1)); // warm up the JIT
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) simulateShot(rack, shot(0.001 * i, 1));
    expect((performance.now() - t0) / 5).toBeLessThan(150);
  });
});
