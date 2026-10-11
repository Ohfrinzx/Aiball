import type { BallNumber } from '../shared';
import { PHYSICS } from './params';
import type { Body } from './world';

/** Balls closer than this (surface to surface) are treated as one touching cluster. */
const CLUSTER_GAP = 0.002;
/** Contact duration of two pool balls is ~0.2 ms. */
const CONTACT_TIME = 2e-4;
const MICRO_DT = CONTACT_TIME / 40;
/** Safety cap: 20 ms of micro-simulation. */
const MAX_MICRO_STEPS = 4000;

const OMEGA = Math.PI / CONTACT_TIME;
/** Spring stiffness per unit mass (two equal masses: relative ω² = 2κ). */
const KAPPA = (OMEGA * OMEGA) / 2;
/** Damping ratio giving the ball–ball restitution: e = exp(−πζ/√(1−ζ²)). */
const ZETA = (() => {
  const l = -Math.log(PHYSICS.ballRestitution);
  return l / Math.sqrt(Math.PI * Math.PI + l * l);
})();
const GAMMA = ZETA * OMEGA;

export interface ContactRecord {
  readonly a: BallNumber;
  readonly b: BallNumber;
  readonly speed: number;
  /** Seconds after the triggering contact. */
  readonly dt: number;
}

/** All on-table balls connected to a or b through near-touching neighbours. */
export function touchingCluster(bodies: readonly Body[], a: Body, b: Body, radius: number): Body[] {
  const reach = 2 * radius + CLUSTER_GAP;
  const reach2 = reach * reach;
  const cluster = [a, b];
  for (let i = 0; i < cluster.length; i++) {
    const c = cluster[i] as Body;
    for (const o of bodies) {
      if (!o.onTable || cluster.includes(o)) continue;
      const dx = o.px - c.px;
      const dy = o.py - c.py;
      if (dx * dx + dy * dy < reach2) cluster.push(o);
    }
  }
  return cluster;
}

/**
 * Resolves a collision inside a cluster of touching balls (the rack on the break, or
 * frozen balls) with a short soft-contact simulation. Instantaneous pairwise impulses
 * pass momentum through a cluster like a Newton's cradle — only the far balls move.
 * Real contacts last ~0.2 ms and overlap in time, which is what spreads a rack; a
 * damped spring per contact reproduces that while keeping the same restitution.
 * Positions advance by the (sub-millimetre) micro motion; friction is ignored for
 * this ~1 ms. Returns the contacts that began, for events.
 */
export function resolveCluster(cluster: readonly Body[], radius: number): ContactRecord[] {
  const n = cluster.length;
  const diam = 2 * radius;
  const touching = new Uint8Array(n * n);
  const contacts: ContactRecord[] = [];
  for (let step = 0; step < MAX_MICRO_STEPS; step++) {
    let anyOverlap = false;
    let anyClosing = false;
    for (let i = 0; i < n; i++) {
      const a = cluster[i] as Body;
      for (let j = i + 1; j < n; j++) {
        const b = cluster[j] as Body;
        const dx = b.px - a.px;
        const dy = b.py - a.py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const nx = dx / dist;
        const ny = dy / dist;
        const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        const overlap = diam - dist;
        if (overlap <= 0) {
          touching[i * n + j] = 0;
          // Keep going while a near neighbour is about to be struck (within ~2 ms).
          if (closing > 0 && -overlap < closing * 0.002) anyClosing = true;
          continue;
        }
        anyOverlap = true;
        if (!touching[i * n + j]) {
          touching[i * n + j] = 1;
          contacts.push({ a: a.id, b: b.id, speed: closing, dt: step * MICRO_DT });
        }
        const force = KAPPA * overlap + GAMMA * closing;
        if (force <= 0) continue;
        const dv = force * MICRO_DT;
        a.vx -= dv * nx;
        a.vy -= dv * ny;
        b.vx += dv * nx;
        b.vy += dv * ny;
      }
    }
    if (!anyOverlap && !anyClosing && step > 0) break;
    for (const b of cluster) {
      b.px += b.vx * MICRO_DT;
      b.py += b.vy * MICRO_DT;
    }
  }
  return contacts;
}
