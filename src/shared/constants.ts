import type { Pocket, TableGeometry } from './types';

export const GAME_NAME = 'Velvet 8';

/** Regulation ball diameter 57.15 mm. */
const BALL_RADIUS = 0.028575;

/** 2:1 playing surface (8-foot table). */
const LENGTH = 2.24;
const WIDTH = 1.12;

const CORNER_POCKET_RADIUS = 0.062;
const SIDE_POCKET_RADIUS = 0.058;

const halfL = LENGTH / 2;
const halfW = WIDTH / 2;

const POCKETS: readonly Pocket[] = [
  { id: 'topLeft', position: { x: -halfL, y: -halfW }, radius: CORNER_POCKET_RADIUS },
  { id: 'topSide', position: { x: 0, y: -halfW - 0.012 }, radius: SIDE_POCKET_RADIUS },
  { id: 'topRight', position: { x: halfL, y: -halfW }, radius: CORNER_POCKET_RADIUS },
  { id: 'bottomLeft', position: { x: -halfL, y: halfW }, radius: CORNER_POCKET_RADIUS },
  { id: 'bottomSide', position: { x: 0, y: halfW + 0.012 }, radius: SIDE_POCKET_RADIUS },
  { id: 'bottomRight', position: { x: halfL, y: halfW }, radius: CORNER_POCKET_RADIUS },
];

export const TABLE: TableGeometry = {
  length: LENGTH,
  width: WIDTH,
  cushionWidth: 0.045,
  railWidth: 0.1,
  ballRadius: BALL_RADIUS,
  pockets: POCKETS,
  headStringX: -LENGTH / 4,
  footSpot: { x: LENGTH / 4, y: 0 },
};

/** Full outer size of the table including cushions and rails. */
export const TABLE_OUTER = {
  length: LENGTH + 2 * (TABLE.cushionWidth + TABLE.railWidth),
  width: WIDTH + 2 * (TABLE.cushionWidth + TABLE.railWidth),
} as const;
