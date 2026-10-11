import { describe, expect, it } from 'vitest';
import { findCuePlacement, isValidCuePlacement } from '../../src/physics';
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
const table: TableState = { balls: [ball(0, -0.5, 0), ball(1, 0, 0)] };

describe('cue ball placement', () => {
  it('keeps the cue ball behind the head string in the kitchen', () => {
    const p = findCuePlacement({ x: 0.3, y: 0.1 }, table, 'kitchen')!;
    expect(p.x).toBeLessThanOrEqual(TABLE.headStringX);
    expect(p.y).toBeCloseTo(0.1, 9);
  });

  it('keeps the cue ball inside the cushions', () => {
    const p = findCuePlacement({ x: -5, y: 5 }, table, 'table')!;
    expect(p.x).toBeGreaterThanOrEqual(-TABLE.length / 2 + R);
    expect(p.y).toBeLessThanOrEqual(TABLE.width / 2 - R);
  });

  it('pushes the cue ball out of other balls', () => {
    const p = findCuePlacement({ x: 0.01, y: 0 }, table, 'table')!;
    expect(Math.hypot(p.x, p.y)).toBeGreaterThanOrEqual(2 * R);
    expect(isValidCuePlacement(p, table, 'table')).toBe(true);
  });

  it('validates spots', () => {
    expect(isValidCuePlacement({ x: -0.6, y: 0 }, table, 'kitchen')).toBe(true);
    expect(isValidCuePlacement({ x: 0, y: 0.02 }, table, 'table')).toBe(false);
    expect(isValidCuePlacement({ x: 0.2, y: 0 }, table, 'kitchen')).toBe(false);
  });
});
