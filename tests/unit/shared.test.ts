import { describe, expect, it } from 'vitest';
import { TABLE, TABLE_OUTER } from '../../src/shared/constants';
import {
  QUAT_IDENTITY,
  quatFromAxisAngle,
  quatMultiply,
  quatNormalize,
} from '../../src/shared/quat';
import { createRng } from '../../src/shared/rng';
import { distance, normalize, length } from '../../src/shared/vec2';

describe('table geometry', () => {
  it('has a 2:1 playing surface', () => {
    expect(TABLE.length / TABLE.width).toBeCloseTo(2, 9);
  });

  it('has six pockets with unique ids, symmetric about both axes', () => {
    expect(TABLE.pockets).toHaveLength(6);
    expect(new Set(TABLE.pockets.map((p) => p.id)).size).toBe(6);
    const sum = TABLE.pockets.reduce((s, p) => ({ x: s.x + p.position.x, y: s.y + p.position.y }), {
      x: 0,
      y: 0,
    });
    expect(sum.x).toBeCloseTo(0, 9);
    expect(sum.y).toBeCloseTo(0, 9);
  });

  it('pockets are larger than a ball and mouths fit two balls', () => {
    for (const p of TABLE.pockets) expect(p.radius).toBeGreaterThan(TABLE.ballRadius);
    const tips = TABLE.jawTips;
    expect(tips).toHaveLength(12);
    for (let i = 0; i < tips.length; i += 2) {
      const mouth = Math.hypot(tips[i]!.x - tips[i + 1]!.x, tips[i]!.y - tips[i + 1]!.y);
      expect(mouth).toBeGreaterThan(4 * TABLE.ballRadius);
    }
  });

  it('has six rails and twelve jaws with unit normals facing the balls', () => {
    const rails = TABLE.cushions.filter((c) => c.kind === 'rail');
    const jaws = TABLE.cushions.filter((c) => c.kind === 'jaw');
    expect(rails).toHaveLength(6);
    expect(jaws).toHaveLength(12);
    for (const c of TABLE.cushions) expect(Math.hypot(c.normal.x, c.normal.y)).toBeCloseTo(1, 12);
    // Rail normals point toward the table center.
    for (const r of rails) {
      const mid = { x: (r.a.x + r.b.x) / 2, y: (r.a.y + r.b.y) / 2 };
      expect(-mid.x * r.normal.x - mid.y * r.normal.y).toBeGreaterThan(0);
    }
  });

  it('jaws end inside the pocket capture circle (no gap to escape through)', () => {
    for (const jaw of TABLE.cushions.filter((c) => c.kind === 'jaw')) {
      const pocket = TABLE.pockets.reduce((best, p) =>
        distance(p.position, jaw.b) < distance(best.position, jaw.b) ? p : best,
      );
      expect(distance(pocket.position, jaw.b)).toBeLessThan(pocket.radius);
    }
  });

  it('jaws narrow the pocket throat', () => {
    const [t0, t1] = TABLE.jawTips;
    const ends = TABLE.cushions.filter((c) => c.kind === 'jaw').slice(0, 2);
    const mouth = distance(t0!, t1!);
    const throat = distance(ends[0]!.b, ends[1]!.b);
    expect(throat).toBeLessThan(mouth);
    expect(throat).toBeGreaterThan(2 * TABLE.ballRadius);
  });

  it('outer size includes cushions and rails', () => {
    expect(TABLE_OUTER.length).toBeGreaterThan(TABLE.length);
    expect(TABLE_OUTER.length - TABLE.length).toBeCloseTo(TABLE_OUTER.width - TABLE.width, 9);
  });

  it('head string, head spot and foot spot sit on opposite quarters', () => {
    expect(TABLE.headStringX).toBeCloseTo(-TABLE.length / 4, 9);
    expect(TABLE.headSpot).toEqual({ x: TABLE.headStringX, y: 0 });
    expect(TABLE.footSpot.x).toBeCloseTo(TABLE.length / 4, 9);
  });
});

describe('quaternions', () => {
  it('compose rotations', () => {
    const quarter = quatFromAxisAngle(0, 0, 1, Math.PI / 2);
    const half = quatMultiply(quarter, quarter);
    const expected = quatFromAxisAngle(0, 0, 1, Math.PI);
    expect(half.w).toBeCloseTo(expected.w, 12);
    expect(half.z).toBeCloseTo(expected.z, 12);
    expect(quatNormalize({ w: 2, x: 0, y: 0, z: 0 })).toEqual(QUAT_IDENTITY);
  });
});

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('produces values in [0, 1) and differs between seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    const va = Array.from({ length: 50 }, () => a.next());
    const vb = Array.from({ length: 50 }, () => b.next());
    expect(va).not.toEqual(vb);
    for (const v of va) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range stays within bounds', () => {
    const r = createRng(7);
    for (let i = 0; i < 100; i++) {
      const v = r.range(-2, 3);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThan(3);
    }
  });
});

describe('vec2', () => {
  it('normalizes and measures', () => {
    expect(length(normalize({ x: 3, y: 4 }))).toBeCloseTo(1, 12);
    expect(normalize({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
