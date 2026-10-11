/**
 * src/physics — deterministic 2D ball physics: motion, friction, spin, ball/cushion/pocket
 * collisions, simulate() / simulateShot(), aim prediction and cue ball placement.
 * May import: src/shared only.
 */
export { PHYSICS } from './params';
export { simulate } from './simulate';
export type { InitialMotion, SimulateOptions } from './simulate';
export { simulateShot, cueStrike, cueSpeedForPower } from './shot';
export { predictAim } from './aim';
export { findCuePlacement, isValidCuePlacement } from './placement';
