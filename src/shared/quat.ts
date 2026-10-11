import type { Quat, Vec2 } from './types';

export const QUAT_IDENTITY: Quat = { w: 1, x: 0, y: 0, z: 0 };

/** Rotation of `angle` radians about the unit axis (ax, ay, az). */
export function quatFromAxisAngle(ax: number, ay: number, az: number, angle: number): Quat {
  const s = Math.sin(angle / 2);
  return { w: Math.cos(angle / 2), x: ax * s, y: ay * s, z: az * s };
}

/** Hamilton product a·b (apply b first, then a). */
export function quatMultiply(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

export function quatNormalize(q: Quat): Quat {
  const n = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
  return n === 0 ? QUAT_IDENTITY : { w: q.w / n, x: q.x / n, y: q.y / n, z: q.z / n };
}

/** Unit vector for an angle in table space. */
export const fromAngle = (angle: number): Vec2 => ({ x: Math.cos(angle), y: Math.sin(angle) });
