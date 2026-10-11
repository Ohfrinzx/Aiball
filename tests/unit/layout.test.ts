import { describe, expect, it } from 'vitest';
import { computeLayout, orientationFor } from '../../src/render/layout';
import { TABLE_OUTER } from '../../src/shared/constants';

const OUTER_RATIO = TABLE_OUTER.length / TABLE_OUTER.width;

const VIEWPORTS = [
  { name: 'iPhone SE portrait', width: 375, height: 667 },
  { name: 'iPhone 15 portrait', width: 393, height: 852 },
  { name: 'tablet portrait', width: 820, height: 1180 },
  { name: 'laptop', width: 1366, height: 768 },
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'ultrawide', width: 3440, height: 1440 },
  { name: 'phone landscape', width: 852, height: 393 },
];

describe('orientationFor', () => {
  it('is portrait when taller than wide, landscape otherwise', () => {
    expect(orientationFor({ width: 390, height: 844 })).toBe('portrait');
    expect(orientationFor({ width: 1440, height: 900 })).toBe('landscape');
    expect(orientationFor({ width: 800, height: 800 })).toBe('landscape');
  });
});

describe('computeLayout', () => {
  for (const vp of VIEWPORTS) {
    describe(vp.name, () => {
      const layout = computeLayout(vp);
      const { tableRect: r } = layout;

      it('preserves the table aspect ratio (no distortion)', () => {
        const long = Math.max(r.width, r.height);
        const short = Math.min(r.width, r.height);
        expect(long / short).toBeCloseTo(OUTER_RATIO, 6);
      });

      it('fits entirely inside the viewport', () => {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(vp.width + 1e-9);
        expect(r.y + r.height).toBeLessThanOrEqual(vp.height + 1e-9);
      });

      it('stands the table vertically in portrait and horizontally in landscape', () => {
        if (layout.orientation === 'portrait') expect(r.height).toBeGreaterThan(r.width);
        else expect(r.width).toBeGreaterThan(r.height);
      });

      it('uses a reasonable share of the screen', () => {
        const fill = Math.max(r.width / vp.width, r.height / vp.height);
        expect(fill).toBeGreaterThan(0.7);
      });

      it('round-trips table space <-> screen space', () => {
        for (const p of [
          { x: 0, y: 0 },
          { x: 1.12, y: -0.56 },
          { x: -0.3, y: 0.4 },
        ]) {
          const back = layout.screenToTable(layout.tableToScreen(p));
          expect(back.x).toBeCloseTo(p.x, 9);
          expect(back.y).toBeCloseTo(p.y, 9);
        }
      });
    });
  }

  it('maps the foot of the table (+x) to the top of the screen in portrait', () => {
    const layout = computeLayout({ width: 390, height: 844 });
    const foot = layout.tableToScreen({ x: 1, y: 0 });
    expect(foot.y).toBeLessThan(layout.center.y);
    expect(foot.x).toBeCloseTo(layout.center.x, 9);
  });
});
