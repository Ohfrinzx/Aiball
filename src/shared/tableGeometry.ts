import type { CushionSegment, Pocket, PocketId, TableGeometry, Vec2 } from './types';

/** Inputs for building the table outline. All lengths in meters, angles in radians. */
export interface TableSpec {
  readonly length: number;
  readonly width: number;
  readonly cushionWidth: number;
  readonly railWidth: number;
  readonly ballRadius: number;
  /** Distance between the two jaw tips of a corner pocket. */
  readonly cornerMouth: number;
  /** Distance between the two jaw tips of a side pocket. */
  readonly sideMouth: number;
  /** How far each corner jaw leans in from the pocket axis (narrows the throat). */
  readonly cornerJawAngle: number;
  /** How far each side jaw leans in from perpendicular to the rail. */
  readonly sideJawAngle: number;
  /** Corner hole center, measured outward along the diagonal from the table corner. */
  readonly cornerHoleOffset: number;
  /** Side hole center, measured outward from the rail line. */
  readonly sideHoleOffset: number;
  readonly cornerCaptureRadius: number;
  readonly sideCaptureRadius: number;
}

const v = (x: number, y: number): Vec2 => ({ x, y });

/** Unit normal of segment a→b that points toward `inside`. */
function normalToward(a: Vec2, b: Vec2, inside: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  let nx = -dy / len;
  let ny = dx / len;
  if ((inside.x - a.x) * nx + (inside.y - a.y) * ny < 0) {
    nx = -nx;
    ny = -ny;
  }
  return v(nx, ny);
}

/** A jaw runs from its tip (where it meets the rail) to its far end at the wooden rail. */
interface Jaw {
  readonly tip: Vec2;
  readonly end: Vec2;
}

interface PocketBuild {
  readonly pocket: Pocket;
  readonly jaws: readonly [Jaw, Jaw];
}

/**
 * Builds a corner pocket at table corner (sx·halfL, sy·halfW). The jaws run from
 * the tips through the full cushion depth, leaning toward the pocket axis so the
 * throat is narrower than the mouth — that is what makes balls rattle.
 */
function cornerPocket(spec: TableSpec, id: PocketId, sx: number, sy: number): PocketBuild {
  const halfL = spec.length / 2;
  const halfW = spec.width / 2;
  const c = spec.cornerMouth / Math.SQRT2;
  const tipLong = v(sx * (halfL - c), sy * halfW);
  const tipShort = v(sx * halfL, sy * (halfW - c));
  const mouth = v((tipLong.x + tipShort.x) / 2, (tipLong.y + tipShort.y) / 2);
  const cos = Math.cos(spec.cornerJawAngle);
  const sin = Math.sin(spec.cornerJawAngle);
  const k = 1 / Math.SQRT2;
  const dirLong = v(k * (cos * sx + sin * sx), k * (cos * sy - sin * sy));
  const dirShort = v(k * (cos * sx - sin * sx), k * (cos * sy + sin * sy));
  // Jaw length: until the jaw reaches the back of the cushion (the wooden rail).
  const lenLong = spec.cushionWidth / Math.abs(dirLong.y);
  const lenShort = spec.cushionWidth / Math.abs(dirShort.x);
  const o = spec.cornerHoleOffset * k;
  return {
    pocket: {
      id,
      position: v(sx * (halfL + o), sy * (halfW + o)),
      radius: spec.cornerCaptureRadius,
      mouth,
    },
    jaws: [
      { tip: tipLong, end: v(tipLong.x + dirLong.x * lenLong, tipLong.y + dirLong.y * lenLong) },
      {
        tip: tipShort,
        end: v(tipShort.x + dirShort.x * lenShort, tipShort.y + dirShort.y * lenShort),
      },
    ],
  };
}

function sidePocket(spec: TableSpec, id: PocketId, sy: number): PocketBuild {
  const halfW = spec.width / 2;
  const h = spec.sideMouth / 2;
  const cos = Math.cos(spec.sideJawAngle);
  const sin = Math.sin(spec.sideJawAngle);
  const len = spec.cushionWidth / cos;
  const jaw = (sx: number): Jaw => {
    const tip = v(sx * h, sy * halfW);
    return { tip, end: v(tip.x - sx * sin * len, tip.y + sy * cos * len) };
  };
  return {
    pocket: {
      id,
      position: v(0, sy * (halfW + spec.sideHoleOffset)),
      radius: spec.sideCaptureRadius,
      mouth: v(0, sy * halfW),
    },
    jaws: [jaw(-1), jaw(1)],
  };
}

export function buildTableGeometry(spec: TableSpec): TableGeometry {
  const tl = cornerPocket(spec, 'topLeft', -1, -1);
  const ts = sidePocket(spec, 'topSide', -1);
  const tr = cornerPocket(spec, 'topRight', 1, -1);
  const bl = cornerPocket(spec, 'bottomLeft', -1, 1);
  const bs = sidePocket(spec, 'bottomSide', 1);
  const br = cornerPocket(spec, 'bottomRight', 1, 1);
  const all = [tl, ts, tr, bl, bs, br];

  for (const { pocket, jaws } of all) {
    for (const { end } of jaws) {
      const d = Math.hypot(end.x - pocket.position.x, end.y - pocket.position.y);
      // A gap between a jaw end and the capture circle would let balls escape the table.
      if (d >= pocket.radius) throw new Error(`Pocket ${pocket.id}: jaw ends outside capture`);
    }
  }

  const cushions: CushionSegment[] = [];
  const outlines: Vec2[][] = [];

  // A rail's rubber runs from one pocket's jaw, along the nose, to the next pocket's jaw.
  const rail = (jawA: Jaw, jawB: Jaw, normal: Vec2): void => {
    cushions.push({ a: jawA.tip, b: jawB.tip, normal, kind: 'rail' });
    outlines.push([jawA.end, jawA.tip, jawB.tip, jawB.end]);
  };
  rail(tl.jaws[0], ts.jaws[0], v(0, 1));
  rail(ts.jaws[1], tr.jaws[0], v(0, 1));
  rail(bl.jaws[0], bs.jaws[0], v(0, -1));
  rail(bs.jaws[1], br.jaws[0], v(0, -1));
  rail(tl.jaws[1], bl.jaws[1], v(1, 0));
  rail(tr.jaws[1], br.jaws[1], v(-1, 0));

  const jawTips: Vec2[] = [];
  for (const { jaws } of all) {
    const [j0, j1] = jaws;
    // Jaw normals face the pocket corridor, i.e. toward the opposite jaw.
    cushions.push({
      a: j0.tip,
      b: j0.end,
      normal: normalToward(j0.tip, j0.end, j1.tip),
      kind: 'jaw',
    });
    cushions.push({
      a: j1.tip,
      b: j1.end,
      normal: normalToward(j1.tip, j1.end, j0.tip),
      kind: 'jaw',
    });
    jawTips.push(j0.tip, j1.tip);
  }

  return {
    length: spec.length,
    width: spec.width,
    cushionWidth: spec.cushionWidth,
    railWidth: spec.railWidth,
    ballRadius: spec.ballRadius,
    pockets: all.map((p) => p.pocket),
    cushions,
    jawTips,
    cushionOutlines: outlines,
    headStringX: -spec.length / 4,
    footSpot: v(spec.length / 4, 0),
    headSpot: v(-spec.length / 4, 0),
  };
}
