import { buildTableGeometry } from './tableGeometry';
import type { BallNumber, TableGeometry } from './types';

export const GAME_NAME = 'Velvet 8';

/** Regulation ball diameter 57.15 mm. */
const BALL_RADIUS = 0.028575;
const BALL_DIAMETER = 2 * BALL_RADIUS;

/**
 * 7-foot (bar box) 2:1 playing surface. Mobile pool games show large balls relative
 * to the table; a 7-ft table (≈17 balls across) is closer to that look than an 8-ft.
 */
const LENGTH = 1.98;
const WIDTH = 0.99;

const DEG = Math.PI / 180;

export const TABLE: TableGeometry = buildTableGeometry({
  length: LENGTH,
  width: WIDTH,
  cushionWidth: 0.045,
  railWidth: 0.075,
  ballRadius: BALL_RADIUS,
  // Slightly more generous than regulation (≈2.0 / 2.25 balls) for touch-screen play.
  cornerMouth: 2.2 * BALL_DIAMETER,
  sideMouth: 2.35 * BALL_DIAMETER,
  // Regulation facing angles (142° corner, 104° side) expressed as lean from the axis.
  cornerJawAngle: 7 * DEG,
  sideJawAngle: 14 * DEG,
  cornerHoleOffset: 0.012,
  sideHoleOffset: 0.052,
  cornerCaptureRadius: 0.058,
  sideCaptureRadius: 0.058,
});

/** Full outer size of the table including cushions and rails. */
export const TABLE_OUTER = {
  length: LENGTH + 2 * (TABLE.cushionWidth + TABLE.railWidth),
  width: WIDTH + 2 * (TABLE.cushionWidth + TABLE.railWidth),
} as const;

export const CUE_BALL: BallNumber = 0;
export const EIGHT_BALL: BallNumber = 8;
