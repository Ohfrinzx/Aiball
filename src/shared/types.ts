/**
 * Shared types: the ONLY place cross-module interfaces live.
 * Changing anything here affects other modules — add a note in PROGRESS.md (see AGENTS.md).
 *
 * Coordinate system ("table space"): meters, origin at the center of the playing
 * surface, +x toward the foot rail (along the table's length), +y toward the
 * bottom long rail in landscape view. Screen orientation never affects table space.
 * The third axis is z = x × y, which points DOWN into the cloth (the viewer looks
 * along +z). Angular velocities and orientations use this right-handed frame.
 */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** Unit quaternion w + xi + yj + zk. */
export interface Quat {
  readonly w: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export type Orientation = 'portrait' | 'landscape';

/** Ball numbers 0 (cue) to 15. 1–7 solids, 8 the eight ball, 9–15 stripes. */
export type BallNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export type PocketId =
  'topLeft' | 'topSide' | 'topRight' | 'bottomLeft' | 'bottomSide' | 'bottomRight';

export interface Pocket {
  readonly id: PocketId;
  /** Center of the pocket hole in table space. */
  readonly position: Vec2;
  /** Radius at which a ball center is considered pocketed. */
  readonly radius: number;
  /** Midpoint between the two jaw tips: the natural aiming point for this pocket. */
  readonly mouth: Vec2;
}

export type CushionKind = 'rail' | 'jaw';

/** A straight piece of cushion nose that balls bounce off. */
export interface CushionSegment {
  readonly a: Vec2;
  readonly b: Vec2;
  /** Unit normal pointing toward the side balls can be on. */
  readonly normal: Vec2;
  readonly kind: CushionKind;
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
  /** Rails and pocket jaws (cushion noses) for collisions. */
  readonly cushions: readonly CushionSegment[];
  /** Points where a rail meets a jaw; balls can strike these corners directly. */
  readonly jawTips: readonly Vec2[];
  /** One closed polygon per cushion piece (rubber outline), for drawing. */
  readonly cushionOutlines: readonly (readonly Vec2[])[];
  /** Head string x position (break line, cue ball placement side). */
  readonly headStringX: number;
  /** Foot spot (apex of the rack). */
  readonly footSpot: Vec2;
  /** Head spot (cue ball starting position). */
  readonly headSpot: Vec2;
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

/** Where the cue ball may be placed with ball in hand: behind the head string, or anywhere. */
export type PlacementArea = 'kitchen' | 'table';

/** A ball between shots (at rest). Pocketed balls stay in the list, flagged. */
export interface BallState {
  readonly id: BallNumber;
  readonly position: Vec2;
  /** Rotates ball-local coordinates into table space. Cosmetic: never affects physics. */
  readonly orientation: Quat;
  readonly isPocketed: boolean;
  readonly pocketId: PocketId | null;
}

/** Everything physics needs to know about the table between shots. */
export interface TableState {
  readonly balls: readonly BallState[];
}

export type ShotEvent =
  | {
      readonly kind: 'ball';
      readonly time: number;
      readonly a: BallNumber;
      readonly b: BallNumber;
      /** Closing speed along the line of centers, m/s. */
      readonly speed: number;
    }
  | {
      readonly kind: 'cushion';
      readonly time: number;
      readonly ball: BallNumber;
      readonly cushion: CushionKind;
      /** Speed into the cushion, m/s. */
      readonly speed: number;
    }
  | {
      readonly kind: 'pocket';
      readonly time: number;
      readonly ball: BallNumber;
      readonly pocket: PocketId;
    };

/** Recorded trajectory used to animate a shot exactly as it was simulated. */
export interface ShotPlayback {
  /** Seconds between samples; sample 0 is the instant the cue strikes. */
  readonly sampleInterval: number;
  readonly sampleCount: number;
  /** Number of balls per sample, in TableState.balls order. */
  readonly ballCount: number;
  /** sampleCount × ballCount × (x, y). */
  readonly positions: Float32Array;
  /** sampleCount × ballCount × (w, x, y, z). */
  readonly orientations: Float32Array;
}

export interface ShotResult {
  /** Table after every ball has stopped. */
  readonly final: TableState;
  /** Collisions and pocketings, in time order. */
  readonly events: readonly ShotEvent[];
  /** Simulated seconds until every ball stopped. */
  readonly duration: number;
  /** First ball the cue ball touched, or null if it touched none. */
  readonly firstContact: BallNumber | null;
  /** Balls pocketed during the shot, in order. */
  readonly pocketed: readonly BallNumber[];
  /** Present only when requested (animation); the AI skips it for speed. */
  readonly playback: ShotPlayback | null;
}

export type AimHit =
  | {
      readonly kind: 'ball';
      readonly ball: BallNumber;
      readonly ballPosition: Vec2;
      /** Direction the object ball will travel (unit). */
      readonly objectDirection: Vec2;
      /** Direction the cue ball deflects without spin (unit, tangent line). */
      readonly cueDirection: Vec2;
      /** Cosine of the cut angle: 1 = full hit, 0 = thinnest graze. */
      readonly fullness: number;
    }
  | { readonly kind: 'cushion'; readonly normal: Vec2 }
  | { readonly kind: 'pocket'; readonly pocket: PocketId };

/** Guide-line prediction: where the cue ball first touches something. */
export interface AimPrediction {
  readonly origin: Vec2;
  readonly direction: Vec2;
  /** Cue ball center at the moment of first contact (the "ghost ball"). */
  readonly contact: Vec2;
  readonly hit: AimHit;
}

/** Size of the drawable area in CSS pixels. */
export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/** Axis-aligned rectangle in CSS pixels. */
export interface ScreenRect {
  readonly x: number;
  readonly y: number;
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
  /** On-screen bounding box of the whole table (including rails). */
  readonly tableRect: ScreenRect;
  tableToScreen(p: Vec2): Vec2;
  screenToTable(p: Vec2): Vec2;
}

// ---------------------------------------------------------------------------
// state → render: what to draw on top of the table this frame.

export interface SceneBall {
  readonly id: BallNumber;
  readonly position: Vec2;
  readonly orientation: Quat;
  /** 1 normally; shrinks toward 0 while the ball drops into a pocket. */
  readonly size: number;
}

export interface CueStickView {
  /** Aim direction (radians, table space); the stick lies behind the cue ball. */
  readonly angle: number;
  /** Gap between cue tip and cue ball, meters (grows as power is pulled back). */
  readonly gap: number;
}

export interface SceneView {
  /** Balls currently visible (on the table or dropping). */
  readonly balls: readonly SceneBall[];
  readonly cue: CueStickView | null;
  readonly guide: AimPrediction | null;
  /** Where the cue ball may be placed, if the player has ball in hand. */
  readonly ballInHand: PlacementArea | null;
}

// ---------------------------------------------------------------------------
// input → state: player intents.

export interface InputHandlers {
  /** Rotate the aim by a delta (drag on the table or fine-aim wheel), radians. */
  aimBy(delta: number): void;
  /** Point the aim at a table-space position (tap on the table). */
  aimAt(target: Vec2): void;
  /** Power slider moved; 0..1. */
  setPower(power: number): void;
  /** Power slider released; shoots if power is high enough. */
  releasePower(power: number): void;
  /** Spin selector moved; each component -1..1, inside the unit circle. */
  setSpin(spin: Vec2): void;
  /** Ball in hand: drag the cue ball to a table-space position. */
  moveCueBall(target: Vec2, phase: 'start' | 'move' | 'end'): void;
}

/** What input needs to know about the game when interpreting a gesture. */
export interface InputContext {
  readonly view: ViewTransform;
  /** Cue ball position, or null if it is off the table. */
  readonly cueBall: Vec2 | null;
  /** True while the player may aim and shoot. */
  readonly canAim: boolean;
  /** True while the player may pick up and move the cue ball. */
  readonly canMoveCueBall: boolean;
}
