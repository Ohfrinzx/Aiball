import { describe, expect, it } from 'vitest';
import { predictAim, simulateShot } from '../../src/physics';
import { QUAT_IDENTITY, TABLE } from '../../src/shared';
import type { BallNumber, BallState, TableState } from '../../src/shared';

const R = TABLE.ballRadius;
const ball = (id: BallNumber, x: number, y: number): BallState => ({
  id,
  position: { x, y },
  orientation: QUAT_IDENTITY,
  isPocketed: false,
  pocketId: null,
});

describe('predictAim', () => {
  it('straight at a ball: ghost ball touches it and the hit is full', () => {
    const t: TableState = { balls: [ball(0, -0.5, 0), ball(3, 0, 0)] };
    const p = predictAim(t, 0)!;
    expect(p.contact.x).toBeCloseTo(-2 * R, 9);
    expect(p.contact.y).toBeCloseTo(0, 9);
    expect(p.hit).toMatchObject({ kind: 'ball', ball: 3 });
    if (p.hit.kind !== 'ball') throw new Error();
    expect(p.hit.fullness).toBeCloseTo(1, 9);
    expect(p.hit.objectDirection.x).toBeCloseTo(1, 9);
  });

  it('cut: object ball along the line of centers, cue ball along the tangent', () => {
    const t: TableState = { balls: [ball(0, -0.5, 0), ball(3, 0, 0.03)] };
    const p = predictAim(t, 0)!;
    if (p.hit.kind !== 'ball') throw new Error('expected ball hit');
    const { objectDirection: o, cueDirection: c, fullness } = p.hit;
    expect(Math.hypot(p.contact.x - 0, p.contact.y - 0.03)).toBeCloseTo(2 * R, 9);
    expect(o.x * c.x + o.y * c.y).toBeCloseTo(0, 9);
    expect(o.y).toBeGreaterThan(0);
    expect(c.y).toBeLessThan(0);
    expect(fullness).toBeGreaterThan(0);
    expect(fullness).toBeLessThan(1);
  });

  it('matches the simulation: object ball leaves in the predicted direction', () => {
    const t: TableState = { balls: [ball(0, -0.6, -0.1), ball(9, 0, 0)] };
    const angle = 0.12;
    const p = predictAim(t, angle)!;
    if (p.hit.kind !== 'ball') throw new Error('expected ball hit');
    const r = simulateShot(t, { angle, power: 0.3, spin: { x: 0, y: 0 } }, { record: true });
    expect(r.firstContact).toBe(9);
    const contact = r.events.find((e) => e.kind === 'ball')!;
    const pb = r.playback!;
    const s0 = Math.ceil(contact.time / pb.sampleInterval) + 1;
    const s1 = s0 + 10;
    const dx = pb.positions[s1 * 4 + 2]! - pb.positions[s0 * 4 + 2]!;
    const dy = pb.positions[s1 * 4 + 3]! - pb.positions[s0 * 4 + 3]!;
    const simulated = Math.atan2(dy, dx);
    const predicted = Math.atan2(p.hit.objectDirection.y, p.hit.objectDirection.x);
    expect(Math.abs(simulated - predicted)).toBeLessThan(0.2 * (Math.PI / 180));
  });

  it('at an empty rail: stops one radius off the cushion', () => {
    const t: TableState = { balls: [ball(0, 0, 0.2)] };
    const p = predictAim(t, 0)!;
    expect(p.hit.kind).toBe('cushion');
    expect(p.contact.x).toBeCloseTo(TABLE.length / 2 - R, 9);
  });

  it('into a pocket: reports the pocket', () => {
    const t: TableState = { balls: [ball(0, 0, 0)] };
    const p = predictAim(t, Math.PI / 2)!;
    expect(p.hit).toEqual({ kind: 'pocket', pocket: 'bottomSide' });
  });

  it('ignores pocketed balls and returns null without a cue ball', () => {
    const t: TableState = {
      balls: [ball(0, -0.5, 0), { ...ball(3, 0, 0), isPocketed: true, pocketId: 'topLeft' }],
    };
    expect(predictAim(t, 0)!.hit.kind).toBe('cushion');
    expect(predictAim({ balls: [ball(3, 0, 0)] }, 0)).toBeNull();
  });
});
