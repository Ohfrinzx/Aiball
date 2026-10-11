import { describe, expect, it } from 'vitest';
import { aimDeltaFromDrag, powerFromPull, spinFromPad, wrapAngle } from '../../src/input';

describe('aimDeltaFromDrag', () => {
  const pivot = { x: 100, y: 100 };

  it('rotates by the angle swept around the cue ball when far away', () => {
    // Quarter circle at radius 200, in small steps: total ≈ π/2 clockwise (screen y down).
    let total = 0;
    let prev = { x: 300, y: 100 };
    for (let i = 1; i <= 200; i++) {
      const a = (i / 200) * (Math.PI / 2);
      const next = { x: 100 + 200 * Math.cos(a), y: 100 + 200 * Math.sin(a) };
      total += aimDeltaFromDrag(pivot, prev, next, 50);
      prev = next;
    }
    expect(total).toBeCloseTo(Math.PI / 2, 3);
  });

  it('is damped near the cue ball', () => {
    const near = aimDeltaFromDrag(pivot, { x: 110, y: 100 }, { x: 110, y: 110 }, 50);
    expect(near).toBeCloseTo(10 / 50, 9);
  });

  it('ignores radial movement and handles counter-clockwise drags', () => {
    expect(aimDeltaFromDrag(pivot, { x: 200, y: 100 }, { x: 260, y: 100 }, 50)).toBeCloseTo(0, 12);
    expect(aimDeltaFromDrag(pivot, { x: 200, y: 100 }, { x: 200, y: 90 }, 50)).toBeLessThan(0);
  });
});

describe('powerFromPull', () => {
  it('maps downward pull distance to 0..1', () => {
    expect(powerFromPull(100, 100, 200)).toBe(0);
    expect(powerFromPull(100, 200, 200)).toBeCloseTo(0.5, 12);
    expect(powerFromPull(100, 900, 200)).toBe(1);
    expect(powerFromPull(100, 50, 200)).toBe(0);
  });
});

describe('spinFromPad', () => {
  const c = { x: 100, y: 100 };
  it('maps right to right english and up to follow', () => {
    expect(spinFromPad(c, 100, { x: 150, y: 100 })).toEqual({ x: 0.5, y: -0 });
    const s = spinFromPad(c, 100, { x: 100, y: 40 });
    expect(s.x).toBe(0);
    expect(s.y).toBeCloseTo(0.6, 12);
  });

  it('clamps to the unit circle and snaps the center to no spin', () => {
    const s = spinFromPad(c, 100, { x: 400, y: 100 });
    expect(Math.hypot(s.x, s.y)).toBeCloseTo(1, 12);
    expect(spinFromPad(c, 100, { x: 105, y: 104 })).toEqual({ x: 0, y: 0 });
  });
});

describe('wrapAngle', () => {
  it('keeps angles in (−π, π]', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(wrapAngle(-Math.PI / 2 - 2 * Math.PI)).toBeCloseTo(-Math.PI / 2, 12);
    expect(wrapAngle(0.5)).toBe(0.5);
  });
});
