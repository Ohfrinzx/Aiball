import type { Shot, ShotResult, TableState } from '../shared';
import { CUE_BALL, TABLE } from '../shared';
import { PHYSICS } from './params';
import { simulate, type InitialMotion, type SimulateOptions } from './simulate';

/**
 * Cue ball speed for a power fraction. Slightly convex so the bottom of the slider
 * gives fine control over soft shots while the top still breaks hard.
 */
export function cueSpeedForPower(power: number): number {
  const p = Math.max(0, Math.min(1, power));
  if (p === 0) return 0;
  return PHYSICS.minCueSpeed + (PHYSICS.maxCueSpeed - PHYSICS.minCueSpeed) * Math.pow(p, 1.4);
}

/**
 * Motion the cue gives the cue ball. A tip offset b (fraction of R, + above center)
 * gives roll velocity 2.5·b·V along the shot (b = 0.4 is natural roll, b < 0 is draw);
 * a sideways offset a gives side spin −2.5·a·V/R (right english spins counter-clockwise
 * seen from above, i.e. negative about +z which points into the cloth).
 */
export function cueStrike(shot: Shot, ballIndex: number, radius: number): InitialMotion {
  const speed = cueSpeedForPower(shot.power);
  const dx = Math.cos(shot.angle);
  const dy = Math.sin(shot.angle);
  // Keep the tip inside the miscue limit whatever the spin selector reports.
  let sx = shot.spin.x;
  let sy = shot.spin.y;
  const mag = Math.sqrt(sx * sx + sy * sy);
  if (mag > 1) {
    sx /= mag;
    sy /= mag;
  }
  const a = sx * PHYSICS.maxTipOffset;
  const b = sy * PHYSICS.maxTipOffset;
  const roll = 2.5 * b * speed;
  return {
    index: ballIndex,
    vx: dx * speed,
    vy: dy * speed,
    rx: dx * roll,
    ry: dy * roll,
    wz: (-2.5 * a * speed) / radius,
  };
}

/**
 * Pure: plays `shot` on `state` and returns the full outcome. The game and the AI use
 * exactly this function, so whatever the AI predicts is what will happen on screen.
 */
export function simulateShot(
  state: TableState,
  shot: Shot,
  options: SimulateOptions = {},
): ShotResult {
  const cueIndex = state.balls.findIndex((b) => b.id === CUE_BALL && !b.isPocketed);
  const radius = (options.table ?? TABLE).ballRadius;
  const motions = cueIndex >= 0 && shot.power > 0 ? [cueStrike(shot, cueIndex, radius)] : [];
  return simulate(state, motions, options);
}
