import { PHYSICS } from './params';
import type { Body } from './world';

const { gravity: G, slideFriction, rollFriction, spinDecel, restSpeed, slipEpsilon } = PHYSICS;

/**
 * Applies cloth friction to one ball for `dt` seconds (velocity and spin only; position
 * is advanced by the collision sweep). Sliding friction drives the contact slip
 * u = v − r to zero along a straight line at 3.5·μs·g, after which the ball rolls and
 * only rolling resistance acts. The slide→roll switch is solved exactly inside the step.
 */
export function applyFriction(b: Body, dt: number): void {
  const ux = b.vx - b.rx;
  const uy = b.vy - b.ry;
  const u = Math.sqrt(ux * ux + uy * uy);
  let rollTime = dt;

  if (u > slipEpsilon) {
    const slipDecel = 3.5 * slideFriction * G;
    if (u <= slipDecel * dt) {
      // Starts rolling during this step: final rolling velocity is v − (2/7)·u.
      b.vx -= (2 / 7) * ux;
      b.vy -= (2 / 7) * uy;
      rollTime = dt - u / slipDecel;
    } else {
      const k = (slideFriction * G * dt) / u;
      b.vx -= k * ux;
      b.vy -= k * uy;
      b.rx += 2.5 * k * ux;
      b.ry += 2.5 * k * uy;
      rollTime = 0;
    }
  }

  if (rollTime > 0) {
    const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    const drop = rollFriction * G * rollTime;
    if (speed <= drop || speed < restSpeed) {
      b.vx = 0;
      b.vy = 0;
    } else {
      const s = (speed - drop) / speed;
      b.vx *= s;
      b.vy *= s;
    }
    b.rx = b.vx;
    b.ry = b.vy;
  }

  if (b.wz !== 0) {
    const drop = spinDecel * dt;
    b.wz = Math.abs(b.wz) <= drop ? 0 : b.wz - Math.sign(b.wz) * drop;
  }
}

/**
 * Rotates the ball's orientation by its angular velocity over dt. Pure cosmetics for the
 * renderer (numbers and stripes rolling), so precision requirements are loose.
 */
export function integrateOrientation(b: Body, radius: number, dt: number): void {
  const ox = b.ry / radius;
  const oy = -b.rx / radius;
  const oz = b.wz;
  const rate = Math.sqrt(ox * ox + oy * oy + oz * oz);
  if (rate === 0) return;
  const half = 0.5 * rate * dt;
  const s = Math.sin(half) / rate;
  const dw = Math.cos(half);
  const dx = ox * s;
  const dy = oy * s;
  const dz = oz * s;
  const { qw, qx, qy, qz } = b;
  let w = dw * qw - dx * qx - dy * qy - dz * qz;
  let x = dw * qx + dx * qw + dy * qz - dz * qy;
  let y = dw * qy - dx * qz + dy * qw + dz * qx;
  let z = dw * qz + dx * qy - dy * qx + dz * qw;
  const n = Math.sqrt(w * w + x * x + y * y + z * z);
  w /= n;
  x /= n;
  y /= n;
  z /= n;
  b.qw = w;
  b.qx = x;
  b.qy = y;
  b.qz = z;
}
