import { CUE_BALL, EIGHT_BALL } from '../shared';
import type { BallNumber, Foul, RulesState, ShotResult, TableState } from '../shared';
import { groupOf, isShootingEight, shooterGroup } from './balls';

/**
 * Every foul committed by a shot, in a stable order. `before` is the table at the moment the
 * cue struck; `result` is what physics reported.
 */
export function detectFouls(rules: RulesState, before: TableState, result: ShotResult): Foul[] {
  const fouls: Foul[] = [];
  if (result.pocketed.includes(CUE_BALL)) fouls.push('scratch');

  const first = result.firstContact;
  if (first === null) {
    fouls.push('no-contact');
    return fouls;
  }

  if (!rules.isBreak && !isLegalFirstContact(rules, before, first)) fouls.push('wrong-ball-first');
  if (!hasRailOrPocketAfterContact(result)) fouls.push('no-rail-after-contact');
  return fouls;
}

function isLegalFirstContact(rules: RulesState, before: TableState, first: BallNumber): boolean {
  if (isShootingEight(rules, before)) return first === EIGHT_BALL;
  if (first === EIGHT_BALL) return false;
  const group = shooterGroup(rules);
  return group === null || groupOf(first) === group;
}

/**
 * After the cue ball touches an object ball, some ball must be pocketed or touch a cushion.
 * Pocket-jaw cushions count: they are rubber like the rails. A cushion touched before the
 * contact does not count, so we compare event times.
 */
function hasRailOrPocketAfterContact(result: ShotResult): boolean {
  if (result.pocketed.some((id) => id !== CUE_BALL)) return true;
  const contact = result.events.find(
    (e) => e.kind === 'ball' && (e.a === CUE_BALL || e.b === CUE_BALL),
  );
  const contactTime = contact ? contact.time : 0;
  return result.events.some((e) => e.kind === 'cushion' && e.time >= contactTime);
}
