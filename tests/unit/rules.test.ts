import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RULES_OPTIONS,
  END_TEXT,
  FOUL_TEXT,
  createRules,
  detectFouls,
  evaluateShot,
  groupOf,
  groupRemaining,
  isShootingEight,
  isTableOpen,
  legalFirstContacts,
  needsPocketCall,
  otherGroup,
  otherPlayer,
} from '../../src/rules';
import type { BallNumber, ShotCall } from '../../src/shared';
import {
  ALL_SOLIDS,
  ALL_STRIPES,
  fullTable,
  midGame,
  shotResult,
  tableWith,
  type ShotSpec,
} from './rulesHelpers';

const NO_CALL: ShotCall = { pocket: null };

/** Groups assigned: player 0 solids, player 1 stripes. */
const assigned = (over = {}) => midGame({ groups: ['solids', 'stripes'], ...over });

describe('createRules', () => {
  it('starts with player 0 breaking, an open table and ball in hand in the kitchen', () => {
    const r = createRules();
    expect(r.currentPlayer).toBe(0);
    expect(r.isBreak).toBe(true);
    expect(r.ballInHand).toBe('kitchen');
    expect(r.groups).toEqual([null, null]);
    expect(r.end).toBeNull();
    expect(r.options).toEqual(DEFAULT_RULES_OPTIONS);
  });

  it('lets the caller pick the breaker and override options', () => {
    const r = createRules({ eightOnBreak: 'loss' }, 1);
    expect(r.currentPlayer).toBe(1);
    expect(r.options.eightOnBreak).toBe('loss');
    expect(r.options.breakScratchPlacement).toBe('table');
  });
});

describe('ball helpers', () => {
  it('classifies balls', () => {
    expect(groupOf(0)).toBeNull();
    expect(groupOf(8)).toBeNull();
    expect([1, 7].map((n) => groupOf(n as BallNumber))).toEqual(['solids', 'solids']);
    expect([9, 15].map((n) => groupOf(n as BallNumber))).toEqual(['stripes', 'stripes']);
    expect(otherGroup('solids')).toBe('stripes');
    expect(otherPlayer(0)).toBe(1);
    expect(otherPlayer(1)).toBe(0);
  });

  it('lists the balls a group has left', () => {
    const t = tableWith([2, 3, 8, 9]);
    expect(groupRemaining(t, 'solids')).toEqual([2, 3]);
    expect(groupRemaining(t, 'stripes')).toEqual([9]);
  });

  it('knows the table is open until groups are assigned', () => {
    expect(isTableOpen(createRules())).toBe(true);
    expect(isTableOpen(assigned())).toBe(false);
  });

  it('is on the 8 only after the shooter has cleared their group', () => {
    const onlyEightAndStripes = tableWith([8, 9, 10]);
    expect(isShootingEight(assigned(), onlyEightAndStripes)).toBe(true);
    expect(isShootingEight(assigned({ currentPlayer: 1 }), onlyEightAndStripes)).toBe(false);
    expect(isShootingEight(assigned(), tableWith([1, 8]))).toBe(false);
    expect(isShootingEight(midGame(), tableWith([8]))).toBe(false); // open table
    expect(needsPocketCall(assigned(), tableWith([8, 9]))).toBe(true);
    expect(needsPocketCall(assigned(), fullTable())).toBe(false);
  });

  it('says which balls may be hit first', () => {
    const full = fullTable();
    expect(legalFirstContacts(createRules(), full)).toHaveLength(15); // break
    expect(legalFirstContacts(midGame(), full)).not.toContain(8); // open
    expect(legalFirstContacts(midGame(), full)).toHaveLength(14);
    expect(legalFirstContacts(assigned(), full)).toEqual(ALL_SOLIDS);
    expect(legalFirstContacts(assigned({ currentPlayer: 1 }), full)).toEqual(ALL_STRIPES);
    expect(legalFirstContacts(assigned(), tableWith([8, 9]))).toEqual([8]);
  });
});

describe('fouls', () => {
  const foulsFor = (spec: ShotSpec, rules = assigned(), table = fullTable()) =>
    detectFouls(rules, table, shotResult(spec));

  it('calls a clean shot clean', () => {
    expect(foulsFor({ first: 3, rail: 'after' })).toEqual([]);
  });

  it('flags a scratch', () => {
    expect(foulsFor({ first: 3, rail: 'after', pockets: [[0, 'topLeft']] })).toEqual(['scratch']);
  });

  it('flags a shot that touches no ball (and does not also report a missing rail)', () => {
    expect(foulsFor({ first: null, rail: 'after' })).toEqual(['no-contact']);
    expect(foulsFor({ first: null, pockets: [[0, 'topLeft']] })).toEqual(['scratch', 'no-contact']);
  });

  it('flags the wrong ball first: opponent ball, 8 too early, 8 on an open table', () => {
    expect(foulsFor({ first: 10, rail: 'after' })).toEqual(['wrong-ball-first']);
    expect(foulsFor({ first: 8, rail: 'after' })).toEqual(['wrong-ball-first']);
    expect(foulsFor({ first: 8, rail: 'after' }, midGame())).toEqual(['wrong-ball-first']);
  });

  it('accepts any solid or stripe first on an open table', () => {
    expect(foulsFor({ first: 3, rail: 'after' }, midGame())).toEqual([]);
    expect(foulsFor({ first: 12, rail: 'after' }, midGame())).toEqual([]);
  });

  it('requires the 8 first once the shooter is on it', () => {
    const t = tableWith([8, 9, 10]);
    expect(foulsFor({ first: 9, rail: 'after' }, assigned(), t)).toEqual(['wrong-ball-first']);
    expect(foulsFor({ first: 8, rail: 'after' }, assigned(), t)).toEqual([]);
  });

  it('flags no rail after contact, but not when a ball is pocketed', () => {
    expect(foulsFor({ first: 3 })).toEqual(['no-rail-after-contact']);
    expect(foulsFor({ first: 3, pockets: [[3, 'topLeft']] })).toEqual([]);
  });

  it('does not count a cushion touched before the cue ball hit anything', () => {
    expect(foulsFor({ first: 3, rail: 'before' })).toEqual(['no-rail-after-contact']);
  });

  it('counts pocket-jaw cushions as rails', () => {
    expect(foulsFor({ first: 3, rail: 'after', cushion: 'jaw' })).toEqual([]);
  });

  it('does not count the cue ball alone going in as a pocketed ball for the rail rule', () => {
    expect(foulsFor({ first: 3, pockets: [[0, 'topLeft']] })).toEqual([
      'scratch',
      'no-rail-after-contact',
    ]);
  });

  it('reports several fouls at once', () => {
    expect(foulsFor({ first: 10, pockets: [[0, 'topRight']] })).toEqual([
      'scratch',
      'wrong-ball-first',
      'no-rail-after-contact',
    ]);
  });

  it('has text for every foul and ending', () => {
    expect(Object.keys(FOUL_TEXT)).toHaveLength(4);
    expect(Object.keys(END_TEXT)).toHaveLength(6);
  });
});

describe('the break', () => {
  const brk = (spec: ShotSpec, rules = createRules()) =>
    evaluateShot(rules, fullTable(), shotResult(spec), NO_CALL);

  it('passes the turn when nothing drops, with no ball in hand', () => {
    const { rules, outcome } = brk({ first: 1, rail: 'after' });
    expect(rules.currentPlayer).toBe(1);
    expect(rules.ballInHand).toBeNull();
    expect(rules.isBreak).toBe(false);
    expect(rules.groups).toEqual([null, null]);
    expect(outcome.turnChanged).toBe(true);
    expect(outcome.fouls).toEqual([]);
  });

  it('lets the breaker keep shooting after pocketing a ball, and leaves the table open', () => {
    const { rules, outcome } = brk({ first: 1, pockets: [[9, 'topLeft']], rail: 'after' });
    expect(rules.currentPlayer).toBe(0);
    expect(rules.groups).toEqual([null, null]);
    expect(outcome.groupsAssigned).toBe(false);
    expect(outcome.turnChanged).toBe(false);
    expect(outcome.pocketedObjects).toEqual([9]);
  });

  it('does not penalise the first contact on the break, whichever ball it is', () => {
    expect(brk({ first: 8, rail: 'after' }).outcome.fouls).toEqual([]);
  });

  it('gives the opponent ball in hand anywhere after a scratch', () => {
    const { rules, outcome } = brk({
      first: 1,
      rail: 'after',
      pockets: [[0, 'bottomRight']],
    });
    expect(outcome.fouls).toEqual(['scratch']);
    expect(rules.currentPlayer).toBe(1);
    expect(rules.ballInHand).toBe('table');
  });

  it('can be configured so a break scratch places behind the head string', () => {
    const { rules } = brk(
      { first: 1, rail: 'after', pockets: [[0, 'bottomRight']] },
      createRules({ breakScratchPlacement: 'kitchen' }),
    );
    expect(rules.ballInHand).toBe('kitchen');
  });

  it('only uses the break-scratch placement for scratches, not other break fouls', () => {
    const { rules } = brk({ first: 1 }, createRules({ breakScratchPlacement: 'kitchen' }));
    expect(rules.ballInHand).toBe('table');
  });

  it('is a foul if nothing is pocketed and no ball reaches a rail', () => {
    const { rules, outcome } = brk({ first: 1 });
    expect(outcome.fouls).toEqual(['no-rail-after-contact']);
    expect(rules.currentPlayer).toBe(1);
    expect(rules.ballInHand).toBe('table');
  });

  it('assigns nothing even if a ball drops on a scratched break', () => {
    const { rules } = brk({
      first: 1,
      pockets: [
        [3, 'topLeft'],
        [0, 'topRight'],
      ],
    });
    expect(rules.groups).toEqual([null, null]);
    expect(rules.currentPlayer).toBe(1);
  });

  it('ends the game when the 8 drops on the break (breaker wins by default)', () => {
    const { rules, outcome } = brk({ first: 1, pockets: [[8, 'topLeft']] });
    expect(outcome.end).toEqual({ winner: 0, reason: 'eight-on-break' });
    expect(rules.end).toEqual(outcome.end);
  });

  it('loses the game on the break 8 when configured, and always on a break 8 + scratch', () => {
    const lose = brk(
      { first: 1, pockets: [[8, 'topLeft']] },
      createRules({ eightOnBreak: 'loss' }),
    );
    expect(lose.outcome.end).toEqual({ winner: 1, reason: 'eight-on-break' });
    const scratch = brk({
      first: 1,
      pockets: [
        [8, 'topLeft'],
        [0, 'topRight'],
      ],
    });
    expect(scratch.outcome.end).toEqual({ winner: 1, reason: 'eight-scratch' });
  });

  it('lets player 1 break when asked', () => {
    const { rules } = brk({ first: 1, rail: 'after' }, createRules({}, 1));
    expect(rules.currentPlayer).toBe(0);
  });
});

describe('open table and group assignment', () => {
  const play = (spec: ShotSpec, rules = midGame()) =>
    evaluateShot(rules, fullTable(), shotResult(spec), NO_CALL);

  it('gives the shooter solids when a solid is the first ball pocketed', () => {
    const { rules, outcome } = play({ first: 3, pockets: [[3, 'topLeft']] });
    expect(rules.groups).toEqual(['solids', 'stripes']);
    expect(outcome.groupsAssigned).toBe(true);
    expect(rules.currentPlayer).toBe(0);
  });

  it('gives the shooter stripes when a stripe drops, whichever player they are', () => {
    const { rules } = play(
      { first: 12, pockets: [[12, 'topLeft']] },
      midGame({ currentPlayer: 1 }),
    );
    expect(rules.groups).toEqual(['solids', 'stripes']);
    const p0 = play({ first: 12, pockets: [[12, 'topLeft']] });
    expect(p0.rules.groups).toEqual(['stripes', 'solids']);
  });

  it('uses the first ball to drop when a solid and a stripe go in together', () => {
    const { rules } = play({
      first: 3,
      pockets: [
        [11, 'topLeft'],
        [3, 'topRight'],
      ],
    });
    expect(rules.groups).toEqual(['stripes', 'solids']);
    expect(rules.currentPlayer).toBe(0);
  });

  it('keeps the table open and changes turn when nothing drops', () => {
    const { rules } = play({ first: 3, rail: 'after' });
    expect(rules.groups).toEqual([null, null]);
    expect(rules.currentPlayer).toBe(1);
  });

  it('does not assign groups on a foul, even if a ball drops', () => {
    const { rules, outcome } = play({
      first: 3,
      rail: 'after',
      pockets: [
        [3, 'topLeft'],
        [0, 'topRight'],
      ],
    });
    expect(outcome.groupsAssigned).toBe(false);
    expect(rules.groups).toEqual([null, null]);
    expect(rules.currentPlayer).toBe(1);
    expect(rules.ballInHand).toBe('table');
  });

  it('keeps assigned groups for the rest of the game', () => {
    const { rules } = evaluateShot(
      assigned(),
      fullTable(),
      shotResult({ first: 2, rail: 'after' }),
      NO_CALL,
    );
    expect(rules.groups).toEqual(['solids', 'stripes']);
  });
});

describe('turns after groups are assigned', () => {
  const play = (spec: ShotSpec, rules = assigned()) =>
    evaluateShot(rules, fullTable(), shotResult(spec), NO_CALL);

  it('keeps the turn after pocketing one of your own balls', () => {
    const { rules, outcome } = play({ first: 2, pockets: [[2, 'topLeft']] });
    expect(rules.currentPlayer).toBe(0);
    expect(rules.ballInHand).toBeNull();
    expect(outcome.turnChanged).toBe(false);
  });

  it('keeps the turn if your ball and an opponent ball drop together', () => {
    const { rules } = play({
      first: 2,
      pockets: [
        [10, 'topLeft'],
        [2, 'topRight'],
      ],
    });
    expect(rules.currentPlayer).toBe(0);
  });

  it('loses the turn, without a foul, when only an opponent ball drops', () => {
    const { rules, outcome } = play({
      first: 2,
      rail: 'after',
      pockets: [[10, 'topLeft']],
    });
    expect(outcome.fouls).toEqual([]);
    expect(rules.currentPlayer).toBe(1);
    expect(rules.ballInHand).toBeNull();
  });

  it('loses the turn on a plain miss', () => {
    const { rules } = play({ first: 2, rail: 'after' });
    expect(rules.currentPlayer).toBe(1);
    expect(rules.ballInHand).toBeNull();
  });

  it('works the same for player 1', () => {
    const r = assigned({ currentPlayer: 1 });
    expect(play({ first: 10, pockets: [[10, 'topLeft']] }, r).rules.currentPlayer).toBe(1);
    expect(play({ first: 10, rail: 'after' }, r).rules.currentPlayer).toBe(0);
  });

  it('gives ball in hand anywhere after wrong-ball-first, even if your ball drops', () => {
    const { rules, outcome } = play({
      first: 10,
      pockets: [[2, 'topLeft']],
    });
    expect(outcome.fouls).toEqual(['wrong-ball-first']);
    expect(rules.currentPlayer).toBe(1);
    expect(rules.ballInHand).toBe('table');
  });

  it('gives ball in hand anywhere after a miss and after no rail', () => {
    expect(play({ first: null }).rules.ballInHand).toBe('table');
    expect(play({ first: 2 }).rules.ballInHand).toBe('table');
  });

  it('clears ball in hand once the player has shot', () => {
    const afterFoul = play({ first: 10, rail: 'after' }).rules;
    expect(afterFoul.ballInHand).toBe('table');
    const next = evaluateShot(
      afterFoul,
      fullTable(),
      shotResult({ first: 10, rail: 'after' }),
      NO_CALL,
    );
    expect(next.rules.ballInHand).toBeNull();
  });

  it('does not mutate the rules state it was given', () => {
    const before = assigned();
    const snapshot = JSON.stringify(before);
    play({ first: 10, pockets: [[0, 'topLeft']] }, before);
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('the 8 ball', () => {
  /** Shooter (player 0, solids) has cleared the solids; stripes 9, 10 remain. */
  const onEight = tableWith([8, 9, 10]);
  const shootEight = (spec: ShotSpec, call: ShotCall = { pocket: 'topRight' }) =>
    evaluateShot(assigned(), onEight, shotResult(spec, onEight), call);

  it('wins by sinking the 8 in the called pocket after clearing the group', () => {
    const { rules, outcome } = shootEight({ first: 8, pockets: [[8, 'topRight']] });
    expect(outcome.end).toEqual({ winner: 0, reason: 'eight-legal' });
    expect(rules.end).toEqual(outcome.end);
    expect(rules.ballInHand).toBeNull();
    expect(outcome.turnChanged).toBe(false);
  });

  it('still wins if an opponent ball drops with the 8', () => {
    const { outcome } = shootEight({
      first: 8,
      pockets: [
        [9, 'topLeft'],
        [8, 'topRight'],
      ],
    });
    expect(outcome.end).toEqual({ winner: 0, reason: 'eight-legal' });
  });

  it('wins for player 1 too', () => {
    const r = assigned({ currentPlayer: 1 });
    const t = tableWith([8, 1, 2]);
    const { outcome } = evaluateShot(
      r,
      t,
      shotResult({ first: 8, pockets: [[8, 'bottomSide']] }, t),
      { pocket: 'bottomSide' },
    );
    expect(outcome.end).toEqual({ winner: 1, reason: 'eight-legal' });
  });

  it('loses if the 8 drops in a different pocket than the one called', () => {
    const { outcome } = shootEight({ first: 8, pockets: [[8, 'bottomLeft']] });
    expect(outcome.end).toEqual({ winner: 1, reason: 'eight-wrong-pocket' });
  });

  it('loses if no pocket was called', () => {
    const { outcome } = shootEight({ first: 8, pockets: [[8, 'topRight']] }, NO_CALL);
    expect(outcome.end).toEqual({ winner: 1, reason: 'eight-wrong-pocket' });
  });

  it('loses by scratching while sinking the 8', () => {
    const { outcome } = shootEight({
      first: 8,
      pockets: [
        [8, 'topRight'],
        [0, 'topLeft'],
      ],
    });
    expect(outcome.end).toEqual({ winner: 1, reason: 'eight-scratch' });
  });

  it('loses if the 8 drops after hitting a different ball first', () => {
    const { outcome } = shootEight({ first: 9, pockets: [[8, 'topRight']] });
    expect(outcome.fouls).toEqual(['wrong-ball-first']);
    expect(outcome.end).toEqual({ winner: 1, reason: 'eight-foul' });
  });

  it('does not end the game when the 8 is shot at and missed; a foul is ball in hand', () => {
    const miss = shootEight({ first: 8, rail: 'after' });
    expect(miss.outcome.end).toBeNull();
    expect(miss.rules.currentPlayer).toBe(1);
    expect(miss.rules.ballInHand).toBeNull();
    const foul = shootEight({ first: 9, rail: 'after' });
    expect(foul.outcome.end).toBeNull();
    expect(foul.rules.ballInHand).toBe('table');
    const scratch = shootEight({ first: 8, rail: 'after', pockets: [[0, 'topLeft']] });
    expect(scratch.outcome.end).toBeNull();
    expect(scratch.rules.ballInHand).toBe('table');
  });

  it('loses by sinking the 8 early', () => {
    const t = tableWith([1, 8, 9]);
    const { outcome } = evaluateShot(
      assigned(),
      t,
      shotResult({ first: 8, pockets: [[8, 'topRight']] }, t),
      { pocket: 'topRight' },
    );
    expect(outcome.end).toEqual({ winner: 1, reason: 'eight-early' });
  });

  it('loses by sinking the 8 together with the last ball of your group', () => {
    const t = tableWith([7, 8, 9]);
    const { outcome } = evaluateShot(
      assigned(),
      t,
      shotResult(
        {
          first: 7,
          pockets: [
            [7, 'topLeft'],
            [8, 'topRight'],
          ],
        },
        t,
      ),
      { pocket: 'topRight' },
    );
    expect(outcome.end).toEqual({ winner: 1, reason: 'eight-early' });
  });

  it('loses by sinking the 8 on an open table', () => {
    const { outcome } = evaluateShot(
      midGame(),
      fullTable(),
      shotResult({ first: 3, pockets: [[8, 'topRight']] }),
      { pocket: 'topRight' },
    );
    expect(outcome.end).toEqual({ winner: 1, reason: 'eight-early' });
  });

  it('after the last own ball drops the shooter stays at the table and is then on the 8', () => {
    const t = tableWith([7, 8, 9]);
    const { rules } = evaluateShot(
      assigned(),
      t,
      shotResult({ first: 7, pockets: [[7, 'topLeft']] }, t),
      NO_CALL,
    );
    expect(rules.currentPlayer).toBe(0);
    const after = tableWith([8, 9]);
    expect(isShootingEight(rules, after)).toBe(true);
  });

  it('refuses to evaluate a shot once the game is over', () => {
    const { rules } = shootEight({ first: 8, pockets: [[8, 'topRight']] });
    expect(() =>
      evaluateShot(rules, onEight, shotResult({ first: 8, rail: 'after' }), NO_CALL),
    ).toThrow(/over/);
  });
});

describe('a whole game, scripted', () => {
  it('plays break → open table → groups → fouls → 8', () => {
    let table = fullTable();
    let rules = createRules();

    // Player 0 breaks, nothing drops: turn passes.
    let ev = evaluateShot(rules, table, shotResult({ first: 1, rail: 'after' }), NO_CALL);
    rules = ev.rules;
    expect([rules.currentPlayer, rules.ballInHand]).toEqual([1, null]);

    // Player 1 pockets a stripe on the open table: stripes, and shoots again.
    ev = evaluateShot(rules, table, shotResult({ first: 9, pockets: [[9, 'topLeft']] }), NO_CALL);
    rules = ev.rules;
    expect(rules.groups).toEqual(['solids', 'stripes']);
    expect(rules.currentPlayer).toBe(1);
    table = tableWith([...ALL_SOLIDS, 8, 10, 11, 12, 13, 14, 15]);

    // Player 1 scratches: player 0 gets ball in hand anywhere.
    ev = evaluateShot(
      rules,
      table,
      shotResult({ first: 10, rail: 'after', pockets: [[0, 'topLeft']] }),
      NO_CALL,
    );
    rules = ev.rules;
    expect([rules.currentPlayer, rules.ballInHand]).toEqual([0, 'table']);

    // Player 0 clears the solids one at a time, then wins on the 8.
    table = tableWith([8, 10, 11, 12, 13, 14, 15]);
    expect(needsPocketCall(rules, table)).toBe(true);
    ev = evaluateShot(
      rules,
      table,
      shotResult({ first: 8, pockets: [[8, 'bottomRight']] }, table),
      { pocket: 'bottomRight' },
    );
    expect(ev.outcome.end).toEqual({ winner: 0, reason: 'eight-legal' });
  });
});
