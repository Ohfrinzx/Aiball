import { describe, expect, it } from 'vitest';
import { createRack } from '../../src/rules';
import { TABLE } from '../../src/shared';
import type { BallNumber } from '../../src/shared';

const R = TABLE.ballRadius;
const isSolid = (n: BallNumber) => n >= 1 && n <= 7;
const isStripe = (n: BallNumber) => n >= 9;

describe('createRack', () => {
  const rack = createRack(42);
  const objectBalls = rack.balls.filter((b) => b.id !== 0);
  const byDistance = [...objectBalls].sort((a, b) => a.position.x - b.position.x);

  it('has the cue ball on the head spot and 15 numbered balls', () => {
    expect(rack.balls.map((b) => b.id)).toEqual([...Array(16).keys()]);
    expect(rack.balls[0]!.position).toEqual(TABLE.headSpot);
    expect(rack.balls.every((b) => !b.isPocketed)).toBe(true);
  });

  it('puts the apex ball on the foot spot', () => {
    expect(byDistance[0]!.position.x).toBeCloseTo(TABLE.footSpot.x, 12);
    expect(byDistance[0]!.position.y).toBeCloseTo(TABLE.footSpot.y, 12);
  });

  it('places the 8 in the middle of the third row', () => {
    const eight = rack.balls.find((b) => b.id === 8)!;
    const rowStep = (2 * R * Math.sqrt(3)) / 2;
    expect(eight.position.y).toBeCloseTo(0, 9);
    expect((eight.position.x - TABLE.footSpot.x) / rowStep).toBeCloseTo(2, 2);
  });

  it('has one solid and one stripe in the back corners', () => {
    const back = [...objectBalls].sort((a, b) => b.position.x - a.position.x).slice(0, 5);
    const corners = back.sort((a, b) => a.position.y - b.position.y);
    const pair = [corners[0]!.id, corners[4]!.id];
    expect(pair.filter(isSolid)).toHaveLength(1);
    expect(pair.filter(isStripe)).toHaveLength(1);
  });

  it('balls do not overlap but are packed tight', () => {
    for (const a of objectBalls) {
      const nearest = Math.min(
        ...objectBalls
          .filter((b) => b !== a)
          .map((b) => Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y)),
      );
      expect(nearest).toBeGreaterThan(2 * R);
      expect(nearest).toBeLessThan(2 * R + 0.001);
    }
  });

  it('is deterministic per seed and varies between seeds', () => {
    expect(createRack(42)).toEqual(rack);
    const order = (s: number) =>
      createRack(s)
        .balls.slice()
        .sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y)
        .map((b) => b.id);
    expect(order(1)).not.toEqual(order(2));
  });
});
