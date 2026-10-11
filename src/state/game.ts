import { findCuePlacement } from '../physics';
import { createRack } from '../rules';
import { CUE_BALL, TABLE } from '../shared';
import type { PlacementArea, ShotResult, TableState, Vec2 } from '../shared';

export type Phase = 'aiming' | 'striking' | 'rolling';

/** Everything about the current practice game between frames. Immutable. */
export interface GameModel {
  readonly table: TableState;
  readonly phase: Phase;
  /** Aim direction, radians in table space. */
  readonly aim: number;
  readonly power: number;
  readonly spin: Vec2;
  readonly ballInHand: PlacementArea | null;
  readonly isBreak: boolean;
  readonly rackSeed: number;
  readonly shotCount: number;
}

export const NO_SPIN: Vec2 = { x: 0, y: 0 };

/** Fresh rack; the breaker may move the cue ball behind the head string. */
export function newGame(seed: number): GameModel {
  return {
    table: createRack(seed),
    phase: 'aiming',
    aim: 0,
    power: 0,
    spin: NO_SPIN,
    ballInHand: 'kitchen',
    isBreak: true,
    rackSeed: seed,
    shotCount: 0,
  };
}

export function cueBallPosition(table: TableState): Vec2 | null {
  const cue = table.balls.find((b) => b.id === CUE_BALL);
  return cue && !cue.isPocketed ? cue.position : null;
}

/** Points the aim at a table-space spot (ignored if the spot is on the cue ball). */
export function aimAt(model: GameModel, target: Vec2): GameModel {
  const cue = cueBallPosition(model.table);
  if (!cue) return model;
  const dx = target.x - cue.x;
  const dy = target.y - cue.y;
  if (Math.hypot(dx, dy) < TABLE.ballRadius) return model;
  return { ...model, aim: Math.atan2(dy, dx) };
}

/** Moves the cue ball (ball in hand) to the closest legal spot to `target`. */
export function placeCueBall(model: GameModel, target: Vec2): GameModel {
  if (!model.ballInHand || model.phase !== 'aiming') return model;
  const spot = findCuePlacement(target, model.table, model.ballInHand);
  if (!spot) return model;
  return { ...model, table: withCueBallAt(model.table, spot) };
}

function withCueBallAt(table: TableState, position: Vec2): TableState {
  return {
    balls: table.balls.map((b) =>
      b.id === CUE_BALL ? { ...b, position, isPocketed: false, pocketId: null } : b,
    ),
  };
}

export interface Settled {
  readonly model: GameModel;
  /** Short message for a toast, if anything notable happened. */
  readonly message: string | null;
}

/**
 * Applies a finished shot. Phase 1 is practice: a scratch gives ball in hand anywhere
 * (cue ball back on the head spot, free to move), and clearing the table re-racks.
 * Full 8-ball rules arrive with src/rules in Phase 2.
 */
export function settleShot(model: GameModel, result: ShotResult, nextSeed: number): Settled {
  const base: GameModel = {
    ...model,
    table: result.final,
    phase: 'aiming',
    power: 0,
    spin: NO_SPIN,
    ballInHand: null,
    isBreak: false,
    shotCount: model.shotCount + 1,
  };

  const objectsLeft = result.final.balls.filter((b) => b.id !== CUE_BALL && !b.isPocketed);
  if (objectsLeft.length === 0) {
    return { model: { ...newGame(nextSeed), aim: model.aim }, message: 'Table cleared! New rack' };
  }

  if (cueBallPosition(result.final) === null) {
    const spot = findCuePlacement(TABLE.headSpot, result.final, 'table') ?? TABLE.headSpot;
    return {
      model: { ...base, table: withCueBallAt(result.final, spot), ballInHand: 'table' },
      message: 'Scratch — ball in hand',
    };
  }

  return { model: base, message: null };
}
