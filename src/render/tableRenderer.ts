import { TABLE, TABLE_OUTER } from '../shared/constants';
import type { Layout } from './layout';

/** Original palette — deliberately not matching any existing game's art. */
const COLORS = {
  background: '#0d1b24',
  railOuter: '#4a2c1a',
  railInner: '#6b3f22',
  railHighlight: 'rgba(255, 220, 180, 0.12)',
  cushion: '#14594a',
  feltCenter: '#1f8a6e',
  feltEdge: '#156451',
  pocket: '#050807',
  pocketRim: '#2b1a10',
  diamond: '#efe2c4',
  markings: 'rgba(255, 255, 255, 0.18)',
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

/**
 * Draws the empty table. `ctx` must already be scaled for devicePixelRatio so
 * that 1 unit = 1 CSS pixel. Everything inside is drawn in table space (meters).
 */
export function drawTable(ctx: CanvasRenderingContext2D, layout: Layout): void {
  const { viewport, center, rotation, scale } = layout;

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);

  const halfOL = TABLE_OUTER.length / 2;
  const halfOW = TABLE_OUTER.width / 2;
  const halfL = TABLE.length / 2;
  const halfW = TABLE.width / 2;
  const cushion = TABLE.cushionWidth;

  // Wooden rails.
  roundedRect(ctx, -halfOL, -halfOW, TABLE_OUTER.length, TABLE_OUTER.width, 0.06);
  const railGrad = ctx.createLinearGradient(0, -halfOW, 0, halfOW);
  railGrad.addColorStop(0, COLORS.railInner);
  railGrad.addColorStop(0.5, COLORS.railOuter);
  railGrad.addColorStop(1, COLORS.railInner);
  ctx.fillStyle = railGrad;
  ctx.fill();
  ctx.strokeStyle = COLORS.railHighlight;
  ctx.lineWidth = 0.008;
  ctx.stroke();

  // Cushions.
  ctx.fillStyle = COLORS.cushion;
  ctx.fillRect(
    -halfL - cushion,
    -halfW - cushion,
    TABLE.length + 2 * cushion,
    TABLE.width + 2 * cushion,
  );

  // Felt with soft overhead-light falloff.
  const felt = ctx.createRadialGradient(0, 0, 0.05, 0, 0, halfL * 1.1);
  felt.addColorStop(0, COLORS.feltCenter);
  felt.addColorStop(1, COLORS.feltEdge);
  ctx.fillStyle = felt;
  ctx.fillRect(-halfL, -halfW, TABLE.length, TABLE.width);

  // Head string and foot spot.
  ctx.strokeStyle = COLORS.markings;
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.moveTo(TABLE.headStringX, -halfW);
  ctx.lineTo(TABLE.headStringX, halfW);
  ctx.stroke();
  ctx.fillStyle = COLORS.markings;
  ctx.beginPath();
  ctx.arc(TABLE.footSpot.x, TABLE.footSpot.y, 0.01, 0, Math.PI * 2);
  ctx.fill();

  // Pockets.
  for (const pocket of TABLE.pockets) {
    ctx.fillStyle = COLORS.pocketRim;
    ctx.beginPath();
    ctx.arc(pocket.position.x, pocket.position.y, pocket.radius * 1.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.pocket;
    ctx.beginPath();
    ctx.arc(pocket.position.x, pocket.position.y, pocket.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Diamonds: 3 per half of each long rail, 3 on each short rail.
  ctx.fillStyle = COLORS.diamond;
  const railMid = cushion + TABLE.railWidth / 2;
  const r = 0.011;
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
