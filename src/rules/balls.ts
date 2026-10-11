import { CUE_BALL, EIGHT_BALL } from '../shared';
import type { BallGroup, BallNumber, PlayerId, RulesState, TableState } from '../shared';

export function otherPlayer(player: PlayerId): PlayerId {
  return player === 0 ? 1 : 0;
}

export function otherGroup(group: BallGroup): BallGroup {
  return group === 'solids' ? 'stripes' : 'solids';
}

/** 1–7 are solids, 9–15 stripes; the cue ball and the 8 belong to no group. */
export function groupOf(ball: BallNumber): BallGroup | null {
  if (ball >= 1 && ball <= 7) return 'solids';
  if (ball >= 9) return 'stripes';
  return null;
}

/** Balls of a group still on the table, in ascending order. */
export function groupRemaining(table: TableState, group: BallGroup): BallNumber[] {
  return table.balls.filter((b) => !b.isPocketed && groupOf(b.id) === group).map((b) => b.id);
}

/** True while the table is open: nobody has been given solids or stripes yet. */
export function isTableOpen(rules: RulesState): boolean {
  return rules.groups[0] === null;
}

/** The current shooter's group, or null on the break / an open table. */
export function shooterGroup(rules: RulesState): BallGroup | null {
  return rules.groups[rules.currentPlayer];
}

/**
 * True when the shooter's only legal target is the 8: groups are assigned and none of their
 * balls are left on the table (judged before the shot, so clearing the last ball and
 * pocketing the 8 on the same shot is still an early 8).
 */
export function isShootingEight(rules: RulesState, table: TableState): boolean {
  if (rules.isBreak) return false;
  const group = shooterGroup(rules);
  return group !== null && groupRemaining(table, group).length === 0;
}

/** The shooter must name the 8's pocket before shooting at it. */
export function needsPocketCall(rules: RulesState, table: TableState): boolean {
  return isShootingEight(rules, table);
}

/**
 * Balls the cue ball may touch first without fouling. On the break any rack ball is fine;
 * on an open table anything but the 8; afterwards the shooter's group, or the 8 alone once
 * the group is cleared. Useful to the AI (target choice) and the HUD.
 */
export function legalFirstContacts(rules: RulesState, table: TableState): BallNumber[] {
  const onTable = table.balls.filter((b) => !b.isPocketed && b.id !== CUE_BALL).map((b) => b.id);
  if (rules.isBreak) return onTable;
  if (isShootingEight(rules, table)) return onTable.filter((id) => id === EIGHT_BALL);
  const group = shooterGroup(rules);
  if (group === null) return onTable.filter((id) => id !== EIGHT_BALL);
  return onTable.filter((id) => groupOf(id) === group);
}
