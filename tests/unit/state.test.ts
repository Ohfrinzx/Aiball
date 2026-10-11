import { describe, expect, it } from 'vitest';
import { simulateShot } from '../../src/physics';
import { QUAT_IDENTITY, TABLE } from '../../src/shared';
import type { BallNumber, BallState, ShotResult } from '../../src/shared';
import {
  aimAt,
  cueBallPosition,
  newGame,
  placeCueBall,
  settleShot,
  type GameModel,
} from '../../src/state/game';
import { SINK_TIME, playbackLength, sceneBallsAt } from '../../src/state/playback';

const ball = (id: BallNumber, x: number, y: number): BallState => ({
  id,
  position: { x, y },
  orientation: QUAT_IDENTITY,
  isPocketed: false,
  pocketId: null,
});

const withBalls = (balls: BallState[]): GameModel => ({
  ...newGame(1),
  table: { balls },
  ballInHand: null,
  isBreak: false,
});

describe('game model', () => {
  it('starts a break with ball in hand behind the head string', () => {
    const g = newGame(5);
    expect(g.phase).toBe('aiming');
    expect(g.ballInHand).toBe('kitchen');
    expect(g.isBreak).toBe(true);
    expect(cueBallPosition(g.table)).toEqual(TABLE.headSpot);
  });

  it('aims at a tapped point', () => {
    const g = aimAt(newGame(1), { x: TABLE.headSpot.x, y: 0.3 });
    expect(g.aim).toBeCloseTo(Math.PI / 2, 12);
  });

  it('moves the cue ball only while it is in hand, and only to legal spots', () => {
    const g = placeCueBall(newGame(1), { x: 0.4, y: 0.1 });
    expect(cueBallPosition(g.table)!.x).toBeLessThanOrEqual(TABLE.headStringX);
    expect(cueBallPosition(g.table)!.y).toBeCloseTo(0.1, 9);
    const noHand = { ...g, ballInHand: null };
    expect(placeCueBall(noHand, { x: -0.8, y: 0 })).toBe(noHand);
  });

  it('a scratch puts the cue ball back with ball in hand anywhere', () => {
    const start = withBalls([ball(0, 0, 0), ball(1, 0.5, 0.3)]);
    const result = simulateShot(start.table, {
      angle: -Math.PI / 2,
      power: 0.25,
      spin: { x: 0, y: 0 },
    });
    expect(result.pocketed).toContain(0);
    const { model, message } = settleShot(start, result, 2);
    expect(model.ballInHand).toBe('table');
    expect(cueBallPosition(model.table)).not.toBeNull();
    expect(message).toMatch(/Scratch/);
    expect(model.shotCount).toBe(1);
    expect(model.spin).toEqual({ x: 0, y: 0 });
  });

  it('clearing the table re-racks', () => {
    const start = withBalls([ball(0, 0.4, 0), ball(1, 0.7, 0.2)]);
    const target = TABLE.pockets.find((p) => p.id === 'bottomRight')!;
    const toPocket = Math.atan2(target.mouth.y - 0.2, target.mouth.x - 0.7);
    const ghost = {
      x: 0.7 - 2 * TABLE.ballRadius * Math.cos(toPocket),
      y: 0.2 - 2 * TABLE.ballRadius * Math.sin(toPocket),
    };
    const angle = Math.atan2(ghost.y, ghost.x - 0.4);
    const result = simulateShot(start.table, { angle, power: 0.25, spin: { x: 0, y: -0.5 } });
    expect(result.pocketed).toContain(1);
    const { model, message } = settleShot(start, result, 9);
    expect(message).toMatch(/cleared/);
    expect(model.table.balls).toHaveLength(16);
    expect(model.ballInHand).toBe('kitchen');
  });
});

describe('playback', () => {
  const start = withBalls([ball(0, 0, 0)]).table;
  const result: ShotResult = simulateShot(
    start,
    { angle: -Math.PI / 2, power: 0.25, spin: { x: 0, y: 0 } },
    { record: true },
  );

  it('starts where the table was and ends where the simulation ended', () => {
    expect(sceneBallsAt(start, result, 0)[0]!.position).toEqual({ x: 0, y: 0 });
    const mid = sceneBallsAt(start, result, 0.2)[0]!;
    expect(mid.position.y).toBeLessThan(0);
  });

  it('pocketed balls shrink into the hole and then disappear', () => {
    const pocket = result.events.find((e) => e.kind === 'pocket')!;
    const dropping = sceneBallsAt(start, result, pocket.time + SINK_TIME / 2)[0]!;
    expect(dropping.size).toBeLessThan(1);
    expect(dropping.size).toBeGreaterThan(0);
    expect(sceneBallsAt(start, result, pocket.time + SINK_TIME + 0.01)).toHaveLength(0);
    expect(playbackLength(result)).toBeGreaterThanOrEqual(pocket.time + SINK_TIME);
  });

  it('interpolates orientations to unit quaternions', () => {
    const q = sceneBallsAt(start, result, 0.1234)[0]!.orientation;
    expect(Math.hypot(q.w, q.x, q.y, q.z)).toBeCloseTo(1, 6);
  });
});
