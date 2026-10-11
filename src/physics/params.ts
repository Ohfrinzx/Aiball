/**
 * Physical constants. Tuned for the feel of a casual mobile pool game while staying
 * close to measured billiards values (see PROGRESS.md decisions log).
 */
export const PHYSICS = {
  /** Fixed simulation timestep, seconds. */
  dt: 1 / 240,
  /** Playback sampling interval, seconds (two physics steps). */
  sampleInterval: 1 / 120,
  /** Hard cap on simulated time for one shot, seconds. */
  maxTime: 40,
  gravity: 9.81,
  /** Ball–cloth sliding friction (fast cloth: keeps draw/follow alive over distance). */
  slideFriction: 0.12,
  /** Rolling resistance coefficient. */
  rollFriction: 0.013,
  /** Angular deceleration of side spin (rotation about the vertical axis), rad/s². */
  spinDecel: 30,
  /** Ball–ball coefficient of restitution. */
  ballRestitution: 0.95,
  /** Rail cushion coefficient of restitution. */
  cushionRestitution: 0.8,
  /** Pocket jaws are softer and absorb more: this is what lets a ball rattle and drop. */
  jawRestitution: 0.55,
  /** Ball–cushion friction coefficient (how strongly side spin grips the rail). */
  cushionFriction: 0.22,
  /**
   * Share of the roll (top/back spin) component into the cushion that is reversed by
   * the bounce. 0 = spin unchanged (ball fights back toward the rail), 1 = fully reversed.
   * Real rails sit above the ball's equator and partly reverse it.
   */
  cushionRollReversal: 0.45,
  /** Cue ball speed at full power, m/s. */
  maxCueSpeed: 7,
  /** Cue ball speed at the lowest non-zero power, m/s. */
  minCueSpeed: 0.12,
  /** Largest cue tip offset from the ball center, fraction of the radius (arcade-strong spin). */
  maxTipOffset: 0.6,
  /** Below this the ball is considered stopped / rolling, m/s. */
  restSpeed: 0.004,
  slipEpsilon: 1e-4,
  /** Safety valve for pathological clusters: collisions resolved per step before moving on. */
  maxEventsPerStep: 200,
} as const;
