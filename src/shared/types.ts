/**
 * Shared types: the ONLY place cross-module interfaces live.
 * Changing anything here affects other modules — add a note in PROGRESS.md (see AGENTS.md).
 *
 * Coordinate system ("table space"): meters, origin at the center of the playing
 * surface, +x toward the foot rail (along the table's length), +y toward the
 * bottom long rail in landscape view. Screen orientation never affects table space.
 */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export type Orientation = 'portrait' | 'landscape';

/** Ball numbers 0 (cue) to 15. 1–7 solids, 8 the eight ball, 9–15 stripes. */
export type BallNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export type PocketId =
  'topLeft' | 'topSide' | 'topRight' | 'bottomLeft' | 'bottomSide' | 'bottomRight';

export interface Pocket {
  readonly id: PocketId;
  /** Center of the pocket opening in table space. */
  readonly position: Vec2;
  /** Radius at which a ball center is considered pocketed. */
  readonly radius: number;
}

/** Fixed geometry of the table, in meters. */
export interface TableGeometry {
  /** Playing surface length (cushion nose to cushion nose), along x. */
  readonly length: number;
  /** Playing surface width, along y. */
  readonly width: number;
  /** Cushion thickness (rubber) outside the playing surface. */
  readonly cushionWidth: number;
  /** Wooden rail thickness outside the cushions. */
  readonly railWidth: number;
  readonly ballRadius: number;
  readonly pockets: readonly Pocket[];
  /** Head string x position (break line, cue ball placement side). */
  readonly headStringX: number;
  /** Foot spot (apex of the rack). */
  readonly footSpot: Vec2;
}

/** A player's shot as produced by input (human) or ai. */
export interface Shot {
  /** Aim direction in radians in table space (0 = +x). */
  readonly angle: number;
  /** 0..1 fraction of maximum cue speed. */
  readonly power: number;
  /** Cue tip offset on the cue ball, each -1..1 (x: left/right english, y: follow(+)/draw(-)). */
  readonly spin: Vec2;
}

/** Size of the drawable area in CSS pixels. */
export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/**
 * Mapping between table space and screen (CSS pixel) space. Produced by render,
 * consumed by input and ui (wired together by state).
 */
export interface ViewTransform {
  readonly orientation: Orientation;
  /** CSS pixels per meter. */
  readonly scale: number;
  tableToScreen(p: Vec2): Vec2;
  screenToTable(p: Vec2): Vec2;
}
