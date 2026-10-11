import type { BallNumber, Orientation, Quat } from '../shared';

/** Original ball colors (traditional number hues, own tints). RGB 0–255. */
const BALL_RGB: Record<number, readonly [number, number, number]> = {
  0: [246, 242, 231],
  1: [245, 196, 44],
  2: [36, 86, 200],
  3: [214, 46, 46],
  4: [110, 62, 166],
  5: [242, 124, 32],
  6: [28, 140, 78],
  7: [140, 40, 36],
  8: [22, 22, 24],
};
const WHITE: readonly [number, number, number] = [246, 242, 231];

/** Number disc: angular radius ≈ 30° around the ball's local ±z axis. */
const DISC_SIN = 0.5;
const DISC_COS = Math.sqrt(1 - DISC_SIN * DISC_SIN);
/** Stripe band half-width (|local x| below this is colored). */
const STRIPE_HALF = 0.62;
const GLYPH = 64;

/** Light from the upper left, slightly toward the viewer (screen space, z = toward viewer). */
const LIGHT = normalize3(-0.45, -0.62, 0.65);
const HALF = normalize3(LIGHT[0], LIGHT[1], LIGHT[2] + 1);

function normalize3(x: number, y: number, z: number): [number, number, number] {
  const n = Math.hypot(x, y, z);
  return [x / n, y / n, z / n];
}

interface PixelTable {
  readonly size: number;
  /** Indices of pixels inside the disc (including the anti-aliased rim). */
  readonly index: Int32Array;
  /** Table-space normal per inside pixel. */
  readonly nx: Float32Array;
  readonly ny: Float32Array;
  readonly nz: Float32Array;
  readonly shade: Float32Array;
  readonly spec: Float32Array;
  readonly alpha: Float32Array;
}

/**
 * Precomputes, for a sprite of `size` device pixels, each pixel's sphere normal and
 * lighting. Screen normals become table-space normals through the view rotation
 * (portrait turns the table 90°); the viewer looks along table +z.
 */
function buildPixelTable(size: number, orientation: Orientation): PixelTable {
  const r = size / 2 - 1;
  const c = size / 2;
  const idx: number[] = [];
  const nx: number[] = [];
  const ny: number[] = [];
  const nz: number[] = [];
  const shade: number[] = [];
  const spec: number[] = [];
  const alpha: number[] = [];
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = px + 0.5 - c;
      const dy = py + 0.5 - c;
      const d = Math.sqrt(dx * dx + dy * dy);
      const a = Math.max(0, Math.min(1, r - d + 0.5));
      if (a <= 0) continue;
      const k = Math.min(d / r, 1);
      const sx = (dx / (d || 1)) * k;
      const sy = (dy / (d || 1)) * k;
      const sz = Math.sqrt(Math.max(0, 1 - sx * sx - sy * sy));
      idx.push(py * size + px);
      // Screen → table: landscape is identity; portrait maps screen (x, y) to table (−y, x).
      if (orientation === 'portrait') {
        nx.push(-sy);
        ny.push(sx);
      } else {
        nx.push(sx);
        ny.push(sy);
      }
      nz.push(-sz);
      const diffuse = Math.max(0, sx * LIGHT[0] + sy * LIGHT[1] + sz * LIGHT[2]);
      const h = Math.max(0, sx * HALF[0] + sy * HALF[1] + sz * HALF[2]);
      shade.push((0.38 + 0.72 * diffuse) * (0.82 + 0.18 * sz));
      spec.push(Math.pow(h, 70) * 0.95 + Math.pow(h, 9) * 0.1);
      alpha.push(a);
    }
  }
  return {
    size,
    index: Int32Array.from(idx),
    nx: Float32Array.from(nx),
    ny: Float32Array.from(ny),
    nz: Float32Array.from(nz),
    shade: Float32Array.from(shade),
    spec: Float32Array.from(spec),
    alpha: Float32Array.from(alpha),
  };
}

/** Alpha mask (0–1) of the ball's number, drawn once with the system font. */
function buildGlyph(n: number): Float32Array {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = GLYPH;
  const g = canvas.getContext('2d');
  const mask = new Float32Array(GLYPH * GLYPH);
  if (!g) return mask;
  const text = String(n);
  g.fillStyle = '#000';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold ${text.length > 1 ? 34 : 40}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
  g.fillText(text, GLYPH / 2, GLYPH / 2 + 2);
  const data = g.getImageData(0, 0, GLYPH, GLYPH).data;
  for (let i = 0; i < mask.length; i++) mask[i] = (data[i * 4 + 3] ?? 0) / 255;
  return mask;
}

interface Sprite {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly image: ImageData;
  readonly glyph: Float32Array | null;
  readonly base: readonly [number, number, number];
  readonly striped: boolean;
  last: Quat | null;
}

export interface BallRenderer {
  /** Re-target sprites for a new on-screen ball diameter (device px) or orientation. */
  configure(diameterDevicePx: number, orientation: Orientation): void;
  /** Sprite showing ball `id` at orientation `q`, or null before configure(). */
  sprite(id: BallNumber, q: Quat): HTMLCanvasElement | null;
}

/**
 * Renders pool balls as true 3D spheres, per pixel, so numbers and stripes roll with
 * the ball. Each ball keeps a small cached sprite that is re-rendered only when its
 * orientation changes; at phone sizes a full redraw of 16 balls is ~25k pixels.
 */
export function createBallRenderer(): BallRenderer {
  let pixels: PixelTable | null = null;
  let currentOrientation: Orientation = 'landscape';
  const sprites = new Map<BallNumber, Sprite>();

  return {
    configure(diameterDevicePx, orientation) {
      const size = Math.max(8, Math.ceil(diameterDevicePx) + 2);
      if (pixels && pixels.size === size && currentOrientation === orientation) return;
      currentOrientation = orientation;
      pixels = buildPixelTable(size, orientation);
      sprites.clear();
    },
    sprite(id, q) {
      if (!pixels) return null;
      let s = sprites.get(id);
      if (!s) {
        s = createSprite(id, pixels.size) ?? undefined;
        if (!s) return null;
        sprites.set(id, s);
      }
      const last = s.last;
      const turned =
        !last ||
        Math.abs(last.w - q.w) +
          Math.abs(last.x - q.x) +
          Math.abs(last.y - q.y) +
          Math.abs(last.z - q.z) >
          1e-4;
      if (turned) {
        paint(s, pixels, q);
        s.ctx.putImageData(s.image, 0, 0);
        s.last = q;
      }
      return s.canvas;
    },
  };
}

function createSprite(id: BallNumber, size: number): Sprite | null {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const colorKey = id > 8 ? id - 8 : id;
  return {
    canvas,
    ctx,
    image: ctx.createImageData(size, size),
    glyph: id === 0 ? null : buildGlyph(id),
    base: BALL_RGB[colorKey] ?? WHITE,
    striped: id > 8,
    last: null,
  };
}

function paint(s: Sprite, px: PixelTable, q: Quat): void {
  // Rotation matrix (ball-local → table); local = Mᵀ · normal.
  const { w, x, y, z } = q;
  const m00 = 1 - 2 * (y * y + z * z);
  const m01 = 2 * (x * y - w * z);
  const m02 = 2 * (x * z + w * y);
  const m10 = 2 * (x * y + w * z);
  const m11 = 1 - 2 * (x * x + z * z);
  const m12 = 2 * (y * z - w * x);
  const m20 = 2 * (x * z - w * y);
  const m21 = 2 * (y * z + w * x);
  const m22 = 1 - 2 * (x * x + y * y);
  const data = s.image.data;
  const [br, bg, bb] = s.base;
  const [wr, wg, wb] = WHITE;
  const glyph = s.glyph;
  const count = px.index.length;
  for (let i = 0; i < count; i++) {
    const nx = px.nx[i] as number;
    const ny = px.ny[i] as number;
    const nz = px.nz[i] as number;
    const lx = m00 * nx + m10 * ny + m20 * nz;
    const ly = m01 * nx + m11 * ny + m21 * nz;
    const lz = m02 * nx + m12 * ny + m22 * nz;

    let r: number;
    let g: number;
    let b: number;
    if (glyph && (lz > DISC_COS || lz < -DISC_COS)) {
      // Number disc; the far-side disc is mirrored so it reads correctly from there.
      const u = (lz > 0 ? lx : -lx) / DISC_SIN;
      const v = -ly / DISC_SIN;
      const gx = Math.min(GLYPH - 1, Math.max(0, ((u + 1) / 2) * GLYPH)) | 0;
      const gy = Math.min(GLYPH - 1, Math.max(0, ((v + 1) / 2) * GLYPH)) | 0;
      const ink = glyph[gy * GLYPH + gx] as number;
      r = wr * (1 - ink) + 18 * ink;
      g = wg * (1 - ink) + 18 * ink;
      b = wb * (1 - ink) + 20 * ink;
    } else if (s.striped && (lx > STRIPE_HALF || lx < -STRIPE_HALF)) {
      r = wr;
      g = wg;
      b = wb;
    } else {
      r = br;
      g = bg;
      b = bb;
    }

    const shade = px.shade[i] as number;
    const spec = (px.spec[i] as number) * 255;
    const o = (px.index[i] as number) * 4;
    data[o] = r * shade + spec;
    data[o + 1] = g * shade + spec;
    data[o + 2] = b * shade + spec;
    data[o + 3] = (px.alpha[i] as number) * 255;
  }
}
