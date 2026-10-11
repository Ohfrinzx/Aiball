import { createRules } from '../../src/rules';
import { QUAT_IDENTITY, TABLE } from '../../src/shared';
import type {
  BallNumber,
  PocketId,
  RulesState,
  ShotEvent,
  ShotResult,
  TableState,
} from '../../src/shared';

export const ALL_SOLIDS: BallNumber[] = [1, 2, 3, 4, 5, 6, 7];
export const ALL_STRIPES: BallNumber[] = [9, 10, 11, 12, 13, 14, 15];

/** A table where only the listed balls (and always the cue ball) are still up. */
export function tableWith(onTable: readonly BallNumber[]): TableState {
  const up = new Set<BallNumber>([0, ...onTable]);
  return {
    balls: Array.from({ length: 16 }, (_, i) => {
      const id = i as BallNumber;
      return {
        id,
        position: { x: TABLE.headSpot.x + i * 0.01, y: 0 },
        orientation: QUAT_IDENTITY,
        isPocketed: !up.has(id),
        pocketId: null,
      };
    }),
  };
}

/** All 15 object balls up, as after a rack. */
export const fullTable = (): TableState => tableWith([...ALL_SOLIDS, 8, ...ALL_STRIPES]);

export interface ShotSpec {
  /** First ball the cue ball touches (default: none). */
  first?: BallNumber | null;
  /** Balls pocketed, in order. The cue ball is 0. */
  pockets?: readonly (readonly [BallNumber, PocketId])[];
  /** When a cushion is touched relative to the first contact (default: never). */
  rail?: 'after' | 'before' | 'none';
  /** Which cushion kind the event reports. */
  cushion?: 'rail' | 'jaw';
}

/** Builds the part of a physics `ShotResult` the rules read. */
export function shotResult(spec: ShotSpec, final: TableState = fullTable()): ShotResult {
  const events: ShotEvent[] = [];
  const first = spec.first ?? null;
  const cushion = spec.cushion ?? 'rail';
  if (spec.rail === 'before') {
    events.push({ kind: 'cushion', time: 0.05, ball: 0, cushion, speed: 1 });
  }
  if (first !== null) events.push({ kind: 'ball', time: 0.1, a: 0, b: first, speed: 1 });
  if (spec.rail === 'after') {
    events.push({ kind: 'cushion', time: 0.5, ball: first ?? 0, cushion, speed: 1 });
  }
  (spec.pockets ?? []).forEach(([ball, pocket], i) => {
    events.push({ kind: 'pocket', time: 0.6 + i * 0.1, ball, pocket });
  });
  return {
    final,
    events,
    duration: 2,
    firstContact: first,
    pocketed: (spec.pockets ?? []).map(([ball]) => ball),
    playback: null,
  };
}

/** Mid-game rules state: player 0 to shoot, table open, unless overridden. */
export function midGame(overrides: Partial<RulesState> = {}): RulesState {
  return { ...createRules(), isBreak: false, ballInHand: null, ...overrides };
}
