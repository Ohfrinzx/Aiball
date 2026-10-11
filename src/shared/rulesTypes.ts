/**
 * Types for the 8-ball rules engine (`src/rules`). They live in shared because `state`, `ai`
 * and `ui` all read them. Purely additive: nothing in `types.ts` was changed.
 */
import type { PlacementArea, PocketId } from './types';

export type PlayerId = 0 | 1;

export type BallGroup = 'solids' | 'stripes';

/** Rule choices the reference game leaves ambiguous; defaults are in `DEFAULT_RULES_OPTIONS`. */
export interface RulesOptions {
  /** Pocketing the 8 on the break (without a scratch) wins or loses the game for the breaker. */
  readonly eightOnBreak: 'win' | 'loss';
  /** Where the incoming player places the cue ball after a scratch on the break. */
  readonly breakScratchPlacement: PlacementArea;
}

/** Why the game ended. The winner is in `GameEnd.winner`; reasons describe the shooter. */
export type EndReason =
  /** Shooter pocketed the 8 in the called pocket after clearing their group. */
  | 'eight-legal'
  /** 8 pocketed on the break (shooter wins or loses per `RulesOptions.eightOnBreak`). */
  | 'eight-on-break'
  /** Shooter pocketed the 8 before clearing their group (or on an open table). */
  | 'eight-early'
  /** Shooter pocketed the 8 and the cue ball on the same shot. */
  | 'eight-scratch'
  /** The 8 dropped in a pocket other than the called one (or none was called). */
  | 'eight-wrong-pocket'
  /** The 8 dropped on a shot with a foul (wrong ball first, no rail, …). */
  | 'eight-foul';

export interface GameEnd {
  readonly winner: PlayerId;
  readonly reason: EndReason;
}

/** The whole rules-engine state between shots. Plain data; every function returns a new one. */
export interface RulesState {
  readonly options: RulesOptions;
  /** Player about to shoot (or who shot last, once the game has ended). */
  readonly currentPlayer: PlayerId;
  /** Ball group per player; both null while the table is open. */
  readonly groups: readonly [BallGroup | null, BallGroup | null];
  /** True until the break shot has been taken. */
  readonly isBreak: boolean;
  /** Ball in hand for `currentPlayer`: behind the head string, anywhere, or none. */
  readonly ballInHand: PlacementArea | null;
  /** Set once the game is over. */
  readonly end: GameEnd | null;
}

/** What the shooter declared before the shot. Only the 8-ball needs a called pocket. */
export interface ShotCall {
  readonly pocket: PocketId | null;
}

export type Foul =
  /** Cue ball pocketed. */
  | 'scratch'
  /** Cue ball hit nothing. */
  | 'no-contact'
  /** First ball hit was not one the shooter may play. */
  | 'wrong-ball-first'
  /** After contact, no ball was pocketed and no ball touched a cushion. */
  | 'no-rail-after-contact';
