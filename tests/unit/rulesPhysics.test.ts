import { describe, expect, it } from 'vitest';
import { simulateShot } from '../../src/physics';
import { createRack, createRules, evaluateShot } from '../../src/rules';

// The rules read real physics output here, so a change to event names, times or
// firstContact in `src/physics` shows up as a failure in this file.
const rack = createRack(7);
const NO_CALL = { pocket: null } as const;
const shoot = (angle: number, power: number) =>
  simulateShot(rack, { angle, power, spin: { x: 0, y: 0 } });

describe('rules on real physics results', () => {
  it('treats a full-power break into the rack as having contact and a rail or pocket', () => {
    const result = shoot(0, 1);
    expect(result.firstContact).not.toBeNull();
    const { outcome } = evaluateShot(createRules(), rack, result, NO_CALL);
    expect(outcome.fouls).not.toContain('no-contact');
    expect(outcome.fouls).not.toContain('no-rail-after-contact');
    expect(outcome.fouls).not.toContain('wrong-ball-first');
  });

  it('calls a soft break aimed away from the rack no-contact', () => {
    const result = shoot(Math.PI, 0.1);
    expect(result.firstContact).toBeNull();
    const { rules, outcome } = evaluateShot(createRules(), rack, result, NO_CALL);
    expect(outcome.fouls).toContain('no-contact');
    expect(rules.currentPlayer).toBe(1);
    expect(rules.ballInHand).toBe('table');
  });

  it('calls a soft tap that reaches the rack but no rail a no-rail foul', () => {
    const result = shoot(0, 0.2);
    expect(result.firstContact).not.toBeNull();
    expect(result.pocketed).toEqual([]);
    const { outcome } = evaluateShot(createRules(), rack, result, NO_CALL);
    expect(outcome.fouls).toEqual(['no-rail-after-contact']);
  });
});
