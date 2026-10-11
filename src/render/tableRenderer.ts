import { TABLE, TABLE_OUTER } from '../shared';
import type { Vec2 } from '../shared';
import type { Layout } from './layout';

/** Original palette — deliberately not matching any existing game's art. */
const COLORS = {
  background: '#0d1b24',
  railDark: '#3b2215',
  railLight: '#6e4126',
  railEdge: 'rgba(255, 225, 190, 0.18)',
  feltCenter: '#21926f',
  feltEdge: '#136048',
  cushion: '#17734f',
  cushionNose: 'rgba(255, 255, 255, 0.10)',
  cushionShade: 'rgba(0, 0, 0, 0.28)',
  pocket: '#030504',
  pocketLiner: '#1b120c',
  diamond: '#efe2c4',
  markings: 'rgba(255, 255, 255, 0.16)',
} as const;

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function polygon(ctx: CanvasRenderingContext2D, points: readonly Vec2[]): void {
  ctx.beginPath();
  points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
}

/** Applies the table-space transform (meters, rotated for portrait) to `ctx`. */
export function applyTableTransform(ctx: CanvasRenderingContext2D, layout: Layout): void {
  ctx.translate(layout.center.x, layout.center.y);
  ctx.rotate(layout.rotation);
  ctx.scale(layout.scale, layout.scale);
}

/**
 * Draws the empty table. `ctx` must already be scaled for devicePixelRatio so
 * that 1 unit = 1 CSS pixel. Everything inside is drawn in table space (meters).
 */
export function drawTable(ctx: CanvasRenderingContext2D, layout: Layout): void {
  const { viewport } = layout;

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  ctx.save();
  applyTableTransform(ctx, layout);

  const halfOL = TABLE_OUTER.length / 2;
  const halfOW = TABLE_OUTER.width / 2;
  const halfL = TABLE.length / 2;
  const halfW = TABLE.width / 2;
  const cushion = TABLE.cushionWidth;

  // Wooden rails.
  roundedRect(ctx, -halfOL, -halfOW, TABLE_OUTER.length, TABLE_OUTER.width, 0.05);
  const railGrad = ctx.createLinearGradient(0, -halfOW, 0, halfOW);
  railGrad.addColorStop(0, COLORS.railLight);
  railGrad.addColorStop(0.5, COLORS.railDark);
  railGrad.addColorStop(1, COLORS.railLight);
  ctx.fillStyle = railGrad;
  ctx.fill();
  ctx.strokeStyle = COLORS.railEdge;
  ctx.lineWidth = 0.006;
  ctx.stroke();

  // Felt (extends under the cushions so no wood shows through the jaws).
  const felt = ctx.createRadialGradient(0, 0, 0.05, 0, 0, halfL * 1.1);
  felt.addColorStop(0, COLORS.feltCenter);
  felt.addColorStop(1, COLORS.feltEdge);
  ctx.fillStyle = felt;
  ctx.fillRect(
    -halfL - cushion,
    -halfW - cushion,
    TABLE.length + 2 * cushion,
    TABLE.width + 2 * cushion,
  );

  // Pocket holes with a leather liner, drawn before the cushions so the jaws overlap them.
  for (const pocket of TABLE.pockets) {
    const { x, y } = pocket.position;
    ctx.fillStyle = COLORS.pocketLiner;
    ctx.beginPath();
    ctx.arc(x, y, pocket.radius + 0.016, 0, Math.PI * 2);
    ctx.fill();
    const hole = ctx.createRadialGradient(x, y, pocket.radius * 0.2, x, y, pocket.radius + 0.004);
    hole.addColorStop(0, COLORS.pocket);
    hole.addColorStop(0.85, COLORS.pocket);
    hole.addColorStop(1, '#14100c');
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.arc(x, y, pocket.radius + 0.004, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cushion rubber, cut back at each pocket along the jaw lines.
  for (const outline of TABLE.cushionOutlines) {
    polygon(ctx, outline);
    ctx.fillStyle = COLORS.cushion;
    ctx.fill();
    ctx.strokeStyle = COLORS.cushionShade;
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }
  // Highlight along each cushion nose.
  ctx.strokeStyle = COLORS.cushionNose;
  ctx.lineWidth = 0.004;
  for (const seg of TABLE.cushions) {
    if (seg.kind !== 'rail') continue;
    ctx.beginPath();
    ctx.moveTo(seg.a.x, seg.a.y);
    ctx.lineTo(seg.b.x, seg.b.y);
    ctx.stroke();
  }

  // Head string and foot spot.
  ctx.strokeStyle = COLORS.markings;
  ctx.lineWidth = 0.003;
  ctx.beginPath();
  ctx.moveTo(TABLE.headStringX, -halfW);
  ctx.lineTo(TABLE.headStringX, halfW);
  ctx.stroke();
  ctx.fillStyle = COLORS.markings;
  for (const spot of [TABLE.footSpot, TABLE.headSpot]) {
    ctx.beginPath();
    ctx.arc(spot.x, spot.y, 0.008, 0, Math.PI * 2);
    ctx.fill();
  }

  // Diamonds: 3 per half of each long rail, 3 on each short rail.
  ctx.fillStyle = COLORS.diamond;
  const railMid = cushion + TABLE.railWidth / 2;
  const r = 0.01;
  for (const i of [1, 2, 3, 5, 6, 7]) {
    const x = -halfL + (TABLE.length / 8) * i;
    drawDiamond(ctx, x, -halfW - railMid, r);
    drawDiamond(ctx, x, halfW + railMid, r);
  }
  for (const i of [1, 2, 3]) {
    const y = -halfW + (TABLE.width / 4) * i;
    drawDiamond(ctx, -halfL - railMid, y, r);
    drawDiamond(ctx, halfL + railMid, y, r);
  }

  ctx.restore();
}

function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.7, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.7, y);
  ctx.closePath();
  ctx.fill();
}
