import type { RulesOptions, RulesState } from '../shared';

/**
 * Choices the reference game does not document clearly (see PROGRESS.md decisions log).
 * `table` for a break scratch follows the brief: ball in hand anywhere after every foul.
 */
export const DEFAULT_RULES_OPTIONS: RulesOptions = {
  eightOnBreak: 'win',
  breakScratchPlacement: 'table',
};

/** A new game: `breaker` shoots first, with ball in hand behind the head string. */
export function createRules(
  options: Partial<RulesOptions> = {},
  breaker: RulesState['currentPlayer'] = 0,
): RulesState {
  return {
    options: { ...DEFAULT_RULES_OPTIONS, ...options },
    currentPlayer: breaker,
    groups: [null, null],
    isBreak: true,
    ballInHand: 'kitchen',
    end: null,
  };
}
