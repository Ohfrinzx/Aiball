# Rules engine (`src/rules`)

Phase 2 deliverable. Written 2026-10-11 by the Phase 2 rules agent, PR
[Ohfrinzx/Aiball#3](https://github.com/Ohfrinzx/Aiball/pull/3), branch `phase2/rules-engine`.
This document is the reference for anyone debugging or extending the rules: what exists, how a
shot is judged step by step, what is verified, and what is only an assumption.

Read `AGENTS.md` and `PROGRESS.md` first; this file does not repeat the workflow rules.

---

## 1. What it does

A set of **pure functions over plain data** that decide what a finished shot means:

- which fouls were committed,
- whether solids/stripes were assigned,
- who shoots next, and whether they have ball in hand (and where),
- whether the game is over, who won, and why.

It does **not** simulate balls (that is `src/physics`), place the cue ball, draw anything, show
messages, or keep a game loop (that is `src/state`). It never mutates its inputs and uses no
randomness or clock (ESLint enforces this for `src/rules`).

**Status:** implemented, unit-tested, CI green, **not wired into the game yet**. `src/state/game.ts`
still runs the Phase 1 practice logic (`settleShot`: scratch → ball in hand, cleared table →
re-rack). Wiring is the next task (section 9).

## 2. Files

| File                              | Purpose                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/shared/rulesTypes.ts`        | **New, additive.** All rules types: `PlayerId`, `BallGroup`, `RulesOptions`, `RulesState`, `ShotCall`, `Foul`, `EndReason`, `GameEnd` |
| `src/shared/index.ts`             | One line added: `export * from './rulesTypes'`. `src/shared/types.ts` is untouched                                                    |
| `src/rules/index.ts`              | Public API (the only thing other modules may import)                                                                                  |
| `src/rules/state.ts`              | `createRules()`, `DEFAULT_RULES_OPTIONS`                                                                                              |
| `src/rules/balls.ts`              | Ball/group helpers: `groupOf`, `groupRemaining`, `isShootingEight`, `needsPocketCall`, `legalFirstContacts`, …                        |
| `src/rules/fouls.ts`              | `detectFouls()`                                                                                                                       |
| `src/rules/evaluate.ts`           | `evaluateShot()` (the main entry point), `ShotOutcome`, `ShotEvaluation`                                                              |
| `src/rules/messages.ts`           | `FOUL_TEXT`, `END_TEXT`: short strings for toasts                                                                                     |
| `src/rules/rack.ts`               | `createRack()` — **Phase 1, unchanged**                                                                                               |
| `tests/unit/rules.test.ts`        | 59 tests with hand-built `ShotResult`s                                                                                                |
| `tests/unit/rulesPhysics.test.ts` | 3 tests against real `simulateShot()` output                                                                                          |
| `tests/unit/rulesHelpers.ts`      | Builders: `tableWith`, `fullTable`, `shotResult`, `midGame`                                                                           |

The types are in `shared` because `state`, `ai` and `ui` all read them (AGENTS.md section 3: cross-module
types live in `src/shared`). `rules` itself imports only `src/shared`.

## 3. Types (`src/shared/rulesTypes.ts`)

```ts
type PlayerId = 0 | 1;
type BallGroup = 'solids' | 'stripes';

interface RulesOptions {
  eightOnBreak: 'win' | 'loss'; // default 'win'
  breakScratchPlacement: PlacementArea; // default 'table' (anywhere)
}

interface RulesState {
  options: RulesOptions;
  currentPlayer: PlayerId; // about to shoot (after game end: the last shooter)
  groups: [BallGroup | null, BallGroup | null]; // per player; both null = open table
  isBreak: boolean; // true until the break shot is taken
  ballInHand: PlacementArea | null; // for currentPlayer: 'kitchen' | 'table' | null
  end: GameEnd | null; // set once the game is over
}

interface ShotCall {
  pocket: PocketId | null;
} // only read when shooting at the 8

type Foul = 'scratch' | 'no-contact' | 'wrong-ball-first' | 'no-rail-after-contact';

type EndReason =
  | 'eight-legal' // shooter sank the 8 in the called pocket after clearing their group
  | 'eight-on-break' // 8 on the break; winner per options.eightOnBreak
  | 'eight-early' // 8 before the group was cleared (or on an open table)
  | 'eight-scratch' // 8 and cue ball on the same shot
  | 'eight-wrong-pocket' // 8 in a pocket other than the called one (or none called)
  | 'eight-foul'; // 8 on a shot with another foul

interface GameEnd {
  winner: PlayerId;
  reason: EndReason;
}
```

`EndReason` describes what the **shooter** did. `GameEnd.winner` says who won. For every reason
except `eight-legal`, and `eight-on-break` with the default option, the winner is the opponent.

Table open ⇔ `groups[0] === null` (the two entries are always both null or both set).

## 4. Public API (`src/rules/index.ts`)

| Function                                     | Returns                                                               |
| -------------------------------------------- | --------------------------------------------------------------------- |
| `createRules(options?, breaker = 0)`         | New game: `isBreak: true`, `ballInHand: 'kitchen'`, open table        |
| `evaluateShot(rules, before, result, call)`  | `{ rules, outcome }` — see section 5                                  |
| `detectFouls(rules, before, result)`         | `Foul[]` in a stable order                                            |
| `isShootingEight(rules, table)`              | Shooter's group is cleared, groups assigned, not the break            |
| `needsPocketCall(rules, table)`              | Same as `isShootingEight` — the UI must make the player pick a pocket |
| `legalFirstContacts(rules, table)`           | Ball numbers the cue ball may touch first without fouling             |
| `groupOf(ball)`, `otherGroup`, `otherPlayer` | Basic classifiers                                                     |
| `groupRemaining(table, group)`               | Ball numbers of that group still up                                   |
| `isTableOpen(rules)`, `shooterGroup(rules)`  | Accessors                                                             |
| `FOUL_TEXT`, `END_TEXT`                      | `Record<Foul, string>`, `Record<EndReason, string>`                   |
| `createRack(seed)`                           | Phase 1, unchanged                                                    |

`evaluateShot` arguments:

- `rules` — state **before** the shot.
- `before` — the `TableState` **at the moment the cue struck** (i.e. before `simulateShot`). It is
  needed because "was the shooter already on the 8?" must be judged before the shot: clearing the
  last ball and sinking the 8 on the same shot is an early 8.
- `result` — the `ShotResult` from `simulateShot()`. The rules read only `pocketed`, `firstContact`
  and `events` (never `final` or `playback`).
- `call` — `{ pocket }`. Ignored unless the 8 drops while the shooter is on it.

It **throws** if `rules.end !== null` (a finished game must not be evaluated again).

`ShotOutcome` = `{ shooter, fouls, pocketedObjects, groupsAssigned, turnChanged, end }`.
`pocketedObjects` excludes the cue ball and the 8. `turnChanged` is true when the opponent shoots
next; on a game end it is `!shooterWins`.

## 5. How `evaluateShot` judges a shot (exact order)

1. **Throw** if the game is over.
2. `fouls = detectFouls(...)` (section 6). `objects` = pocketed balls that are not the cue ball or
   the 8, in the order they dropped.
3. **If the 8 dropped:** decide the game now (section 7) and return. `isBreak` becomes false,
   `ballInHand` null, groups unchanged, `currentPlayer` unchanged.
4. **Group assignment.** Only if all of: no fouls, not the break, table still open, and at least one
   object ball dropped. The group of `objects[0]` (the first to drop) goes to the shooter; the other
   group to the opponent.
5. **Scored own?** `scoredOwn` = no fouls **and** at least one object ball is in the shooter's group
   (using the groups from step 4). If groups are still null (only possible on the break), any object
   ball counts.
6. **Next player and ball in hand:**

   | Situation                                 | Next player | `ballInHand`                                                                   |
   | ----------------------------------------- | ----------- | ------------------------------------------------------------------------------ |
   | Any foul                                  | opponent    | `'table'`, except a **scratch on the break** → `options.breakScratchPlacement` |
   | No foul, `scoredOwn`                      | same        | `null`                                                                         |
   | No foul, nothing of the shooter's dropped | opponent    | `null`                                                                         |

7. Return the new state with `isBreak: false`.

Consequences worth knowing:

- A ball pocketed on a **foul** stays pocketed and never assigns groups. The opponent plays an open
  table if no groups were set yet.
- Pocketing only the **opponent's** ball (no foul) ends the turn without ball in hand.
- Pocketing your ball and the opponent's on one clean shot keeps your turn.
- The break never assigns groups; pocketing any object ball on a clean break keeps the breaker's turn.

## 6. Fouls (`detectFouls`)

Returned in this order; several can apply to one shot.

| Foul                    | Condition                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `scratch`               | The cue ball (0) is in `result.pocketed`                                                         |
| `no-contact`            | `result.firstContact === null`. **Returns immediately** — no wrong-ball or rail check is added   |
| `wrong-ball-first`      | Not the break, and `firstContact` is not legal (below)                                           |
| `no-rail-after-contact` | No object ball pocketed **and** no `cushion` event at or after the cue ball's first ball contact |

**Legal first contact** (not applied on the break, where any rack ball is fine):

- Shooter on the 8 → only the 8.
- Otherwise the 8 is never legal first (including on an open table).
- Groups assigned → a ball of the shooter's group.
- Open table → any solid or stripe.

**Rail rule details**

- A pocketed ball satisfies the rule if it is not the cue ball. The cue ball alone going in does
  **not** count.
- Any ball touching a cushion counts (cue ball or object ball), but only if the event time is `>=` the
  time of the first `ball` event involving the cue ball. A rail touched before contact does not count.
- Both cushion kinds count: `'rail'` and `'jaw'` (pocket-mouth rubber). A jaw-tip bounce is also
  emitted as `'jaw'`.

## 7. The 8 ball

Only evaluated when the 8 is in `result.pocketed`. Checked in this order, first match wins:

| #   | Condition                                                            | Result                                                              |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Break, and the cue ball also dropped                                 | Shooter loses — `eight-scratch`                                     |
| 2   | Break                                                                | `eight-on-break`; shooter wins iff `options.eightOnBreak === 'win'` |
| 3   | Shooter was **not** on the 8 (group not cleared, or open table)      | Shooter loses — `eight-early`                                       |
| 4   | Cue ball dropped                                                     | Shooter loses — `eight-scratch`                                     |
| 5   | The 8's pocket (from the `pocket` event) ≠ `call.pocket`, or no call | Shooter loses — `eight-wrong-pocket`                                |
| 6   | Any other foul on the shot                                           | Shooter loses — `eight-foul`                                        |
| 7   | otherwise                                                            | Shooter wins — `eight-legal`                                        |

Shots at the 8 that do **not** sink it are ordinary shots: a miss passes the turn, a foul gives ball
in hand anywhere, and neither ends the game. Opponent balls dropping together with a legal 8 do not
spoil the win.

## 8. Rule choices that are unverified

No authoritative GamePigeon rulebook was found (web guides are third-party and contradict one
another), so these are decisions, not facts. They are recorded in `PROGRESS.md` (decisions log) and
the PR. **Playtest them against the reference before treating any as correct.**

| Question                                            | Current behaviour                              | Where to change it                               |
| --------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| 8 on the break                                      | Breaker wins (8 + scratch loses)               | `RulesOptions.eightOnBreak` (`'win'` / `'loss'`) |
| Scratch on the break                                | Ball in hand anywhere                          | `RulesOptions.breakScratchPlacement`             |
| Solid and stripe dropping together on an open table | First to drop decides                          | `evaluate.ts`, step 4 (`objects[0]`)             |
| Hitting the 8 first on an open table                | Foul                                           | `fouls.ts`, `isLegalFirstContact`                |
| Jaw cushions as a rail                              | Count                                          | `fouls.ts`, `hasRailOrPocketAfterContact`        |
| Break with nothing pocketed and no ball to a rail   | Foul (`no-rail-after-contact`); no 4-ball rule | `fouls.ts`                                       |
| 8 on a non-scratch foul shot                        | Loss (`eight-foul`)                            | `evaluate.ts`, `eightOutcome`                    |
| No pocket called when the 8 drops                   | Loss (`eight-wrong-pocket`)                    | `evaluate.ts`, `eightOutcome`                    |
| Opponent's ball pocketed with no foul               | Stays down; shooter's turn ends                | `evaluate.ts`, step 6                            |
| Re-spotting balls                                   | Never — pocketed balls stay pocketed           | n/a                                              |

## 9. Integration guide (for `state`, `ai`, `ui`)

Not done yet. Intended wiring for one turn, inside `state`:

```ts
// before the shot
const needsCall = needsPocketCall(rules, table); // UI: require a pocket pick when true
const result = simulateShot(table, shot, { record: true });
const { rules: next, outcome } = evaluateShot(rules, table, result, { pocket: calledPocket });

table = result.final;
rules = next;
// toasts:   outcome.fouls.map((f) => FOUL_TEXT[f]);  outcome.end && END_TEXT[outcome.end.reason]
// cue ball: if the cue ball dropped, rules.ballInHand says where it may be placed
//           (physics `findCuePlacement(point, table, rules.ballInHand)`); if it did not drop,
//           it stays where it stopped and ballInHand (after a foul) lets the next player move it.
```

Things the rules deliberately do **not** do — `state` must:

- **Put the cue ball back** after a scratch. Pocketed balls stay flagged `isPocketed` in the table;
  the Phase 1 code in `state/game.ts` (`settleShot` + `withCueBallAt`) shows how.
- **Reject a shot with no call** when `needsPocketCall` is true (the rules would score a dropped 8
  as `eight-wrong-pocket`, which is correct but unfriendly).
- **Decide who breaks** (pass `breaker` to `createRules`) and alternate breakers between games.
- **Handle the end of the game** (stop accepting shots; `evaluateShot` throws on a finished game).
- **Keep `isBreak` in `RulesState` as the source of truth.** `GameModel.isBreak` in `state/game.ts`
  is the old Phase 1 flag and should be removed in favour of it.

For the AI: `legalFirstContacts(rules, table)` lists legal targets; `evaluateShot` on a simulated
`ShotResult` scores a candidate (win/loss, fouls, whether the turn continues) without side effects.
For the HUD: `rules.groups`, `rules.currentPlayer`, `rules.ballInHand`, `isShootingEight`.

## 10. Tests

`npm run test:unit` runs everything. The rules tests:

- `tests/unit/rules.test.ts` (59) uses `rulesHelpers.ts` to build `ShotResult`s directly, so each
  rule is checked in isolation. Describe blocks: `createRules`, ball helpers, fouls, the break, open
  table and group assignment, turns after groups are assigned, the 8 ball, and one scripted whole game.
- `tests/unit/rulesPhysics.test.ts` (3) runs the real `simulateShot()` from `createRack(7)` and feeds
  the result to `evaluateShot`, to catch a physics change in event names, times or `firstContact`.

Known weak spots in the tests (places a bug could hide):

- **The hand-built results are idealised.** `shotResult()` emits one `ball` event at t=0.1, an
  optional `cushion` at t=0.5 (or 0.05 for "before") and `pocket` events from t=0.6. Real physics
  can emit events at identical timestamps, cluster contacts, and cue-ball cushion hits during the
  rack's first contact. Only the three physics tests cover real events, and only for the break.
- **`rulesPhysics.test.ts` depends on tuned numbers**: power `0.1` backwards must not reach the
  rack, and power `0.2` forwards must touch the rack without any rail contact. If physics constants
  are retuned these two can fail without a rules bug — re-probe the power values.
- **Nothing tests `evaluateShot` mid-game against real physics** (no real wrong-ball, scratch or 8
  shots). Building such fixtures from `simulateShot` with a hand-set `TableState` would be the most
  valuable next test.
- `FOUL_TEXT` / `END_TEXT` are only tested for key count, not wording.

## 11. Invariants to check when debugging

- `RulesState.groups` is `[null, null]` or one of `['solids','stripes']` / `['stripes','solids']`.
- `isBreak` is true only for the very first shot; every `evaluateShot` return sets it false.
- `ballInHand` is non-null only straight after a foul, and (initially) `'kitchen'` for the breaker.
  After a shot by the player who had ball in hand it is cleared unless they fouled again.
- When `end !== null`: `ballInHand === null`, `currentPlayer` is the **last shooter**, not the winner.
- `evaluateShot` must not mutate `rules`, `before` or `result` (there is a test for `rules`).
- The same `(rules, before, result, call)` always gives the same output.
- `outcome.turnChanged === (next.currentPlayer !== shooter)` except on a game end, where it is `!shooterWins`.

## 12. How to verify locally

```bash
npm install
npm run lint && npm run format:check && npm run typecheck
npm run test:unit                                   # 170 tests at time of writing
PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm test # unit + 22 e2e (cloud sandbox)
npm run build
```

All of the above passed on 2026-10-11 for commit `12d2ed8`, and `ci` is green on PR #3.
