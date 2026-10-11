import { describe, expect, it } from 'vitest';
import { TABLE, TABLE_OUTER } from '../../src/shared/constants';
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

  it('pockets are larger than a ball', () => {
    for (const p of TABLE.pockets) expect(p.radius).toBeGreaterThan(TABLE.ballRadius);
  });

  it('outer size includes cushions and rails', () => {
    expect(TABLE_OUTER.length).toBeGreaterThan(TABLE.length);
    expect(TABLE_OUTER.length - TABLE.length).toBeCloseTo(TABLE_OUTER.width - TABLE.width, 9);
  });

  it('head string and foot spot sit on opposite quarters', () => {
    expect(TABLE.headStringX).toBeCloseTo(-TABLE.length / 4, 9);
    expect(TABLE.footSpot.x).toBeCloseTo(TABLE.length / 4, 9);
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
