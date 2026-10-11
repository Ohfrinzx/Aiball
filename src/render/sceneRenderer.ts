import { TABLE } from '../shared';
import type { AimPrediction, CueStickView, SceneBall, SceneView, Vec2 } from '../shared';
import { createBallRenderer } from './ballSprites';
import type { Layout } from './layout';
import { applyTableTransform } from './tableRenderer';

const R = TABLE.ballRadius;
const CUE_LENGTH = 1.45;
const CUE_TIP_WIDTH = 0.0135;
const CUE_BUTT_WIDTH = 0.03;

export interface SceneRenderer {
  /** Call whenever the layout or devicePixelRatio changes. */
  resize(layout: Layout, dpr: number): void;
  /** Draws balls, guide line and cue on a transparent canvas. `time` drives pulses (s). */
  draw(ctx: CanvasRenderingContext2D, scene: SceneView, time: number): void;
}

export function createSceneRenderer(): SceneRenderer {
  const balls = createBallRenderer();
  let layout: Layout | null = null;
  let shadow: HTMLCanvasElement | null = null;

  return {
    resize(next, dpr) {
      layout = next;
      balls.configure(2 * R * next.scale * dpr, next.orientation);
      shadow = makeShadow(Math.ceil(2 * R * next.scale * dpr * 1.6));
    },
    draw(ctx, scene, time) {
      if (!layout) return;
      const l = layout;
      ctx.clearRect(0, 0, l.viewport.width, l.viewport.height);
      const ballPx = 2 * R * l.scale;

      if (scene.ballInHand === 'kitchen') drawKitchen(ctx, l);

      if (shadow) {
        const size = ballPx * 1.6;
        for (const b of scene.balls) {
          const p = l.tableToScreen(b.position);
          const s = size * b.size;
          ctx.globalAlpha = b.size;
          ctx.drawImage(shadow, p.x - s / 2 + ballPx * 0.12, p.y - s / 2 + ballPx * 0.18, s, s);
        }
        ctx.globalAlpha = 1;
      }

      if (scene.guide) drawGuide(ctx, l, scene.guide);

      for (const b of scene.balls) drawBall(ctx, l, b, ballPx);

      if (scene.ballInHand) {
        const cue = scene.balls.find((b) => b.id === 0);
        if (cue) drawHandRing(ctx, l, cue.position, time);
      }

      if (scene.cue) {
        const cueBall = scene.balls.find((b) => b.id === 0);
        if (cueBall) drawCue(ctx, l, cueBall.position, scene.cue);
      }
    },
  };

  function drawBall(ctx: CanvasRenderingContext2D, l: Layout, b: SceneBall, ballPx: number): void {
    const sprite = balls.sprite(b.id, b.orientation);
    if (!sprite) return;
    const p = l.tableToScreen(b.position);
    // Sprite has a 1 device-px margin around the ball.
    const scale = ballPx / (sprite.width - 2);
    const s = sprite.width * scale * b.size;
    ctx.globalAlpha = Math.min(1, b.size * 1.3);
    ctx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
    ctx.globalAlpha = 1;
  }
}

function makeShadow(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = Math.max(4, size);
  const g = c.getContext('2d');
  if (g) {
    const r = c.width / 2;
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
    grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.3)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
  }
  return c;
}

function drawKitchen(ctx: CanvasRenderingContext2D, l: Layout): void {
  ctx.save();
  applyTableTransform(ctx, l);
  const halfL = TABLE.length / 2;
  const halfW = TABLE.width / 2;
  const width = TABLE.headStringX + halfL;
  ctx.beginPath();
  ctx.rect(-halfL, -halfW, width, TABLE.width);
  ctx.clip();
  // Even-odd with the pocket circles keeps the tint off the corner pocket holes.
  ctx.beginPath();
  ctx.rect(-halfL, -halfW, width, TABLE.width);
  for (const p of TABLE.pockets) {
    ctx.moveTo(p.position.x + p.radius + 0.016, p.position.y);
    ctx.arc(p.position.x, p.position.y, p.radius + 0.016, 0, Math.PI * 2);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fill('evenodd');
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1.5 / l.scale;
  ctx.setLineDash([6 / l.scale, 6 / l.scale]);
  ctx.beginPath();
  ctx.moveTo(TABLE.headStringX, -halfW);
  ctx.lineTo(TABLE.headStringX, halfW);
  ctx.stroke();
  ctx.restore();
}

function drawHandRing(ctx: CanvasRenderingContext2D, l: Layout, at: Vec2, time: number): void {
  const p = l.tableToScreen(at);
  const pulse = 0.5 + 0.5 * Math.sin(time * 5);
  const r = R * l.scale * (1.5 + 0.25 * pulse);
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 + 0.4 * pulse})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Aim guide: a line from the cue ball to the ghost ball, the ghost ball outline, and on
 * a ball hit two short lines — where the object ball goes (longer for fuller hits) and
 * where the cue ball deflects (longer for thinner hits).
 */
function drawGuide(ctx: CanvasRenderingContext2D, l: Layout, g: AimPrediction): void {
  ctx.save();
  applyTableTransform(ctx, l);
  const px = 1 / l.scale;
  const { origin: o, direction: d, contact: c } = g;
  const line = (ax: number, ay: number, bx: number, by: number): void => {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
  };
  ctx.lineCap = 'round';

  const segments: [number, number, number, number][] = [];
  const travel = Math.hypot(c.x - o.x, c.y - o.y);
  if (travel > 2 * R) segments.push([o.x + d.x * R, o.y + d.y * R, c.x - d.x * R, c.y - d.y * R]);
  if (g.hit.kind === 'ball') {
    const { ballPosition: b, objectDirection: od, cueDirection: cd, fullness } = g.hit;
    const objLen = 0.04 + 0.2 * fullness;
    const cueLen = 0.2 * Math.sqrt(Math.max(0, 1 - fullness * fullness));
    segments.push([
      b.x + od.x * R,
      b.y + od.y * R,
      b.x + od.x * (R + objLen),
      b.y + od.y * (R + objLen),
    ]);
    // Nothing to show for a dead-full hit: the cue ball stops (or draws/follows straight).
    if (cueLen > 0.01) {
      segments.push([
        c.x + cd.x * R,
        c.y + cd.y * R,
        c.x + cd.x * (R + cueLen),
        c.y + cd.y * (R + cueLen),
      ]);
    }
  }

  // Dark underlay keeps the line readable on bright balls and felt highlights.
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 3.2 * px;
  for (const s of segments) line(...s);
  ctx.beginPath();
  ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = 1.6 * px;
  for (const s of segments) line(...s);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath();
  ctx.arc(c.x, c.y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Original cue design: dark tip, ivory ferrule, maple shaft, steel joint, rosewood butt. */
function drawCue(ctx: CanvasRenderingContext2D, l: Layout, at: Vec2, cue: CueStickView): void {
  ctx.save();
  applyTableTransform(ctx, l);
  ctx.translate(at.x, at.y);
  ctx.rotate(cue.angle);
  // The stick lies along −x from the cue ball; x below is distance behind the ball.
  const start = R + cue.gap;
  const end = start + CUE_LENGTH;
  const width = (x: number): number =>
    CUE_TIP_WIDTH + ((x - start) / CUE_LENGTH) * (CUE_BUTT_WIDTH - CUE_TIP_WIDTH);
  const piece = (from: number, to: number, fill: string | CanvasGradient): void => {
    const w0 = width(from) / 2;
    const w1 = width(to) / 2;
    ctx.beginPath();
    ctx.moveTo(-from, -w0);
    ctx.lineTo(-to, -w1);
    ctx.lineTo(-to, w1);
    ctx.lineTo(-from, w0);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  // Shadow on the cloth.
  ctx.save();
  ctx.translate(0.012, 0.016);
  piece(start, end, 'rgba(0, 0, 0, 0.28)');
  ctx.restore();

  const shaft = ctx.createLinearGradient(0, -CUE_BUTT_WIDTH / 2, 0, CUE_BUTT_WIDTH / 2);
  shaft.addColorStop(0, '#f6e3bf');
  shaft.addColorStop(0.45, '#e2c28f');
  shaft.addColorStop(1, '#a8855a');
  const butt = ctx.createLinearGradient(0, -CUE_BUTT_WIDTH / 2, 0, CUE_BUTT_WIDTH / 2);
  butt.addColorStop(0, '#7a3b2a');
  butt.addColorStop(0.45, '#4a1f16');
  butt.addColorStop(1, '#22100b');

  piece(start, start + 0.008, '#27445f');
  piece(start + 0.008, start + 0.03, '#f3efe4');
  piece(start + 0.03, start + 0.78, shaft);
  piece(start + 0.78, start + 0.795, '#c9ced6');
  piece(start + 0.795, start + 1.1, butt);
  piece(start + 1.1, start + 1.36, '#151515');
  piece(start + 1.36, end - 0.012, butt);
  piece(end - 0.012, end, '#0b0b0b');
  ctx.restore();
}
