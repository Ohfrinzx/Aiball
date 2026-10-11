/**
 * src/rules — 8-ball rules engine: rack, break, groups, fouls, ball-in-hand, turn order,
 * win/loss. Pure functions over plain data (`RulesState` in, `RulesState` out).
 * May import: src/shared only.
 *
 * Typical turn, as wired by `state`:
 *   1. `needsPocketCall(rules, table)` → make the shooter pick a pocket for the 8.
 *   2. physics `simulateShot()` → `ShotResult`.
 *   3. `evaluateShot(rules, tableBefore, result, call)` → next `RulesState` + `ShotOutcome`.
 *   4. If `rules.ballInHand` is set, the next shooter places the cue ball (kitchen or anywhere).
 */
export { createRack } from './rack';
export { DEFAULT_RULES_OPTIONS, createRules } from './state';
export {
  groupOf,
  groupRemaining,
  isShootingEight,
  isTableOpen,
  legalFirstContacts,
  needsPocketCall,
  otherGroup,
  otherPlayer,
  shooterGroup,
} from './balls';
export { detectFouls } from './fouls';
export { evaluateShot } from './evaluate';
export type { ShotEvaluation, ShotOutcome } from './evaluate';
export { END_TEXT, FOUL_TEXT } from './messages';
