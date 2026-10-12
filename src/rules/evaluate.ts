import { CUE_BALL, EIGHT_BALL } from '../shared';
import type {
  BallNumber,
  EndReason,
  Foul,
  GameEnd,
  PlayerId,
  RulesState,
  ShotCall,
  ShotResult,
  TableState,
} from '../shared';
import { groupOf, isShootingEight, otherGroup, otherPlayer } from './balls';
import { detectFouls } from './fouls';

export interface ShotOutcome {
  readonly shooter: PlayerId;
  readonly fouls: readonly Foul[];
  /** Object balls (not the cue, not the 8) pocketed on the shot, in order. */
  readonly pocketedObjects: readonly BallNumber[];
  /** True if this shot gave the players their solids/stripes. */
  readonly groupsAssigned: boolean;
  /** True if the other player shoots next (including when the game ends). */
  readonly turnChanged: boolean;
  readonly end: GameEnd | null;
}

export interface ShotEvaluation {
  readonly rules: RulesState;
  readonly outcome: ShotOutcome;
}

/**
 * Applies the rules to a finished shot and returns the new rules state plus what happened.
 *
 * @param rules   state before the shot
 * @param before  table at the moment the cue struck (needed to know whether the shooter was on the 8)
 * @param result  what `simulateShot()` produced
 * @param call    the shooter's declared pocket; only read when shooting at the 8
 */
export function evaluateShot(
  rules: RulesState,
  before: TableState,
  result: ShotResult,
  call: ShotCall,
): ShotEvaluation {
  if (rules.end !== null) throw new Error('evaluateShot: the game is already over');

  const shooter = rules.currentPlayer;
  const opponent = otherPlayer(shooter);
  const fouls = detectFouls(rules, before, result);
  const isScratch = fouls.includes('scratch');
  const objects = result.pocketed.filter((id) => id !== CUE_BALL && id !== EIGHT_BALL);

  const endReason = result.pocketed.includes(EIGHT_BALL)
    ? eightOutcome(rules, before, result, call, fouls)
    : null;
  if (endReason) {
    const end: GameEnd = {
      winner: endReason.shooterWins ? shooter : opponent,
      reason: endReason.reason,
    };
    return {
      rules: { ...rules, isBreak: false, ballInHand: null, end },
      outcome: {
        shooter,
        fouls,
        pocketedObjects: objects,
        groupsAssigned: false,
        turnChanged: !endReason.shooterWins,
        end,
      },
    };
  }

  // No game-ending 8. Groups are given by the first object ball a clean shot pockets on an
  // open table (not on the break, where the table stays open whatever drops).
  let groups = rules.groups;
  let groupsAssigned = false;
  const first = objects[0];
  if (fouls.length === 0 && !rules.isBreak && rules.groups[0] === null && first !== undefined) {
    const mine = groupOf(first);
    if (mine !== null) {
      const theirs = otherGroup(mine);
      groups = shooter === 0 ? [mine, theirs] : [theirs, mine];
      groupsAssigned = true;
    }
  }

  const myGroup = groups[shooter];
  const scoredOwn =
    fouls.length === 0 && objects.some((id) => (myGroup === null ? true : groupOf(id) === myGroup));

  let next: Pick<RulesState, 'currentPlayer' | 'ballInHand'>;
  if (fouls.length > 0) {
    // A scratch on the break is the only foul with its own placement option.
    const placement = rules.isBreak && isScratch ? rules.options.breakScratchPlacement : 'table';
    next = { currentPlayer: opponent, ballInHand: placement };
  } else if (scoredOwn) {
    next = { currentPlayer: shooter, ballInHand: null };
  } else {
    next = { currentPlayer: opponent, ballInHand: null };
  }

  return {
    rules: { ...rules, ...next, groups, isBreak: false },
    outcome: {
      shooter,
      fouls,
      pocketedObjects: objects,
      groupsAssigned,
      turnChanged: next.currentPlayer !== shooter,
      end: null,
    },
  };
}

interface EightResult {
  readonly shooterWins: boolean;
  readonly reason: EndReason;
}

/** Who wins when the 8 drops. Priority of loss reasons: early, scratch, wrong pocket, foul. */
function eightOutcome(
  rules: RulesState,
  before: TableState,
  result: ShotResult,
  call: ShotCall,
  fouls: readonly Foul[],
): EightResult {
  if (rules.isBreak) {
    if (fouls.includes('scratch')) return { shooterWins: false, reason: 'eight-scratch' };
    return { shooterWins: rules.options.eightOnBreak === 'win', reason: 'eight-on-break' };
  }
  if (!isShootingEight(rules, before)) return { shooterWins: false, reason: 'eight-early' };
  if (fouls.includes('scratch')) return { shooterWins: false, reason: 'eight-scratch' };

  const dropped = result.events.find((e) => e.kind === 'pocket' && e.ball === EIGHT_BALL);
  const pocket = dropped && dropped.kind === 'pocket' ? dropped.pocket : null;
  if (pocket === null || call.pocket !== pocket) {
    return { shooterWins: false, reason: 'eight-wrong-pocket' };
  }
  if (fouls.length > 0) return { shooterWins: false, reason: 'eight-foul' };
  return { shooterWins: true, reason: 'eight-legal' };
}
