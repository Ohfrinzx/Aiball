import {
  attachFineAim,
  attachPowerSlider,
  attachSpinPad,
  attachTableInput,
  wrapAngle,
} from '../input';
import { predictAim, simulateShot } from '../physics';
import { computeLayout, createSceneRenderer, drawTable } from '../render';
import type { Layout } from '../render';
import { createHud } from '../ui';
import type { AimPrediction, InputHandlers, SceneView, ShotResult, TableState } from '../shared';
import { aimAt, cueBallPosition, newGame, placeCueBall, settleShot, type GameModel } from './game';
import { playbackLength, sceneBallsAt, staticScene } from './playback';

/** Cue tip gap at rest and extra pull-back at full power, meters. */
const REST_GAP = 0.012;
const MAX_PULL = 0.22;
/** Duration of the cue's forward stroke before the balls start moving, seconds. */
const STRIKE_TIME = 0.09;
/** Releasing the slider below this power cancels the shot. */
const MIN_SHOT_POWER = 0.03;

export interface AppElements {
  /** Static table (redrawn on resize only). */
  readonly table: HTMLCanvasElement;
  /** Balls, cue and guide line, redrawn while something changes. */
  readonly scene: HTMLCanvasElement;
  /** Container for the DOM HUD. */
  readonly hud: HTMLElement;
}

export interface App {
  /** Current layout (exposed for debugging and tests). */
  readonly layout: Layout;
  readonly model: GameModel;
  destroy(): void;
}

interface Strike {
  readonly start: TableState;
  readonly result: ShotResult;
  readonly gap: number;
  t: number;
}

interface Rolling {
  readonly start: TableState;
  readonly result: ShotResult;
  readonly length: number;
  t: number;
}

function initialSeed(): number {
  const param = new URLSearchParams(window.location.search).get('seed');
  const parsed = param === null ? NaN : Number(param);
  return Number.isFinite(parsed) ? parsed : Math.floor(Math.random() * 2 ** 31);
}

/**
 * Wires canvases, HUD and input to the game model and runs the frame loop.
 * Phase 1: practice mode — single player, shots, scratches and re-racks.
 */
export function startApp(elements: AppElements): App {
  const tableCtx = elements.table.getContext('2d');
  const sceneCtx = elements.scene.getContext('2d');
  if (!tableCtx || !sceneCtx) throw new Error('Canvas 2D context unavailable');

  const hud = createHud(elements.hud);
  const scene = createSceneRenderer();
  let seed = initialSeed();
  let model = newGame(seed);
  let layout = computeLayout({ width: 1, height: 1 });
  let strike: Strike | null = null;
  let rolling: Rolling | null = null;
  let guide: AimPrediction | null = null;
  let guideTable: TableState | null = null;
  let guideAim = NaN;
  let dirty = true;

  const setModel = (next: GameModel): void => {
    model = next;
    dirty = true;
    syncHud();
  };

  const syncHud = (): void => {
    hud.setPower(model.power);
    hud.setSpin(model.spin);
    hud.setAimAngle(model.aim);
    hud.setControlsEnabled(model.phase === 'aiming');
    hud.setStatus(
      model.ballInHand === 'kitchen'
        ? 'Break · move the cue ball behind the line'
        : model.ballInHand === 'table'
          ? 'Ball in hand · drag the cue ball'
          : 'Practice',
    );
    const ds = elements.scene.dataset;
    ds.phase = model.phase;
    ds.aim = model.aim.toFixed(4);
    ds.shots = String(model.shotCount);
    ds.ballInHand = model.ballInHand ?? 'none';
    ds.ballsOnTable = String(model.table.balls.filter((b) => !b.isPocketed).length);
    const cue = cueBallPosition(model.table);
    ds.cueBall = cue ? `${cue.x.toFixed(4)},${cue.y.toFixed(4)}` : 'none';
  };

  const shoot = (power: number): void => {
    if (model.phase !== 'aiming' || !cueBallPosition(model.table)) return;
    const shot = { angle: model.aim, power, spin: model.spin };
    const result = simulateShot(model.table, shot, { record: true });
    strike = { start: model.table, result, gap: REST_GAP + power * MAX_PULL, t: 0 };
    setModel({ ...model, phase: 'striking', power, ballInHand: null });
  };

  const finishShot = (r: Rolling): void => {
    seed += 1;
    const { model: next, message } = settleShot(model, r.result, seed);
    rolling = null;
    setModel(next);
    if (message) hud.showToast(message);
  };

  const handlers: InputHandlers = {
    aimBy(delta) {
      if (model.phase !== 'aiming') return;
      setModel({ ...model, aim: wrapAngle(model.aim + delta) });
    },
    aimAt(target) {
      if (model.phase !== 'aiming') return;
      setModel(aimAt(model, target));
    },
    setPower(power) {
      if (model.phase !== 'aiming') return;
      setModel({ ...model, power });
    },
    releasePower(power) {
      if (model.phase !== 'aiming') return;
      if (power < MIN_SHOT_POWER) setModel({ ...model, power: 0 });
      else shoot(power);
    },
    setSpin(spin) {
      if (model.phase !== 'aiming') return;
      setModel({ ...model, spin });
    },
    moveCueBall(target) {
      setModel(placeCueBall(model, target));
    },
  };

  const isAiming = (): boolean => model.phase === 'aiming';
  const detach = [
    attachTableInput(
      elements.scene,
      () => ({
        view: layout,
        cueBall: cueBallPosition(model.table),
        canAim: isAiming(),
        canMoveCueBall: isAiming() && model.ballInHand !== null,
      }),
      handlers,
    ),
    attachPowerSlider(hud.powerElement, isAiming, handlers),
    attachFineAim(hud.fineAimElement, isAiming, handlers),
    attachSpinPad(hud.spinPadElement, handlers),
  ];
  hud.onReset(() => {
    strike = null;
    rolling = null;
    seed += 1;
    setModel(newGame(seed));
  });

  const resize = (): void => {
    const rect = elements.table.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    for (const c of [elements.table, elements.scene]) {
      c.width = Math.max(1, Math.round(rect.width * dpr));
      c.height = Math.max(1, Math.round(rect.height * dpr));
    }
    layout = computeLayout({ width: rect.width, height: rect.height });
    tableCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sceneCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTable(tableCtx, layout);
    scene.resize(layout, dpr);
    hud.setLayout(layout.tableRect, layout.viewport, layout.orientation);
    dirty = true;

    elements.table.dataset.orientation = layout.orientation;
    const t = layout.tableRect;
    elements.table.dataset.tableRect = [t.x, t.y, t.width, t.height]
      .map((n) => n.toFixed(1))
      .join(',');
  };

  /** The guide line only changes with the aim or the table, so cache it on those. */
  const currentGuide = (): AimPrediction | null => {
    if (guideTable !== model.table || guideAim !== model.aim) {
      guideTable = model.table;
      guideAim = model.aim;
      guide = predictAim(model.table, model.aim);
    }
    return guide;
  };

  const buildScene = (): SceneView => {
    if (rolling) {
      return {
        balls: sceneBallsAt(rolling.start, rolling.result, rolling.t),
        cue: null,
        guide: null,
        ballInHand: null,
      };
    }
    if (strike) {
      const k = Math.min(1, strike.t / STRIKE_TIME);
      return {
        balls: staticScene(strike.start),
        cue: { angle: model.aim, gap: strike.gap * (1 - k * k) },
        guide: null,
        ballInHand: null,
      };
    }
    return {
      balls: staticScene(model.table),
      cue: { angle: model.aim, gap: REST_GAP + model.power * MAX_PULL },
      guide: currentGuide(),
      ballInHand: model.ballInHand,
    };
  };

  let last = performance.now();
  let raf = 0;
  const frame = (now: number): void => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (strike) {
      strike.t += dt;
      if (strike.t >= STRIKE_TIME) {
        const s = strike;
        strike = null;
        rolling = { start: s.start, result: s.result, length: playbackLength(s.result), t: 0 };
        setModel({ ...model, phase: 'rolling' });
      }
      dirty = true;
    } else if (rolling) {
      rolling.t += dt;
      if (rolling.t >= rolling.length) finishShot(rolling);
      dirty = true;
    }
    // Ball in hand pulses, so keep animating while it's shown.
    if (dirty || model.ballInHand) {
      scene.draw(sceneCtx, buildScene(), now / 1000);
      dirty = false;
    }
    raf = requestAnimationFrame(frame);
  };

  const observer = new ResizeObserver(resize);
  observer.observe(elements.table);
  resize();
  syncHud();
  raf = requestAnimationFrame(frame);
  // Warm up the JIT with a throwaway break so the player's first shot doesn't hitch.
  const warmUp = setTimeout(() => {
    simulateShot(model.table, { angle: 0, power: 1, spin: { x: 0, y: 0 } });
  }, 300);

  return {
    get layout() {
      return layout;
    },
    get model() {
      return model;
    },
    destroy: () => {
      cancelAnimationFrame(raf);
      clearTimeout(warmUp);
      observer.disconnect();
      for (const d of detach) d();
    },
  };
}
