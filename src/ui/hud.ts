import type { Orientation, ScreenRect, Vec2, Viewport } from '../shared';
import { GAME_NAME } from '../shared';
import './hud.css';

/** Pixels the fine-aim wheel ribs scroll per radian of aim (visual only). */
const WHEEL_PX_PER_RAD = 2000;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  parent?: HTMLElement,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  parent?.appendChild(e);
  return e;
}

/**
 * Builds the in-game DOM overlay: top bar (status, spin button, re-rack), the pull-back
 * power slider (left of the table), the fine-aim wheel (right of the table), the spin
 * picker and toasts. Gestures on these elements are handled by src/input; this module
 * only draws them and reports button clicks.
 */
export function createHud(root: HTMLElement) {
  root.classList.add('hud');

  const bar = el('div', 'hud-bar', root);
  const title = el('div', 'hud-title', bar);
  const name = el('div', 'hud-name', title);
  name.textContent = GAME_NAME;
  const status = el('div', 'hud-status', title);
  status.textContent = 'Practice';
  const buttons = el('div', 'hud-buttons', bar);
  const spinButton = el('button', 'hud-spin', buttons);
  spinButton.type = 'button';
  spinButton.setAttribute('aria-label', 'Cue ball spin');
  const spinButtonDot = el('span', 'spin-dot', spinButton);
  const resetButton = el('button', 'hud-reset', buttons);
  resetButton.type = 'button';
  resetButton.setAttribute('aria-label', 'Re-rack');
  resetButton.textContent = '↻';

  const power = el('div', 'power', root);
  power.setAttribute('aria-label', 'Power: drag down and release to shoot');
  const powerFill = el('div', 'power-fill', power);
  const powerCue = el('div', 'power-cue', power);
  el('div', 'power-hint', power).textContent = 'PULL';

  const fineAim = el('div', 'fine-aim', root);
  fineAim.setAttribute('aria-label', 'Fine aim: drag up or down');
  const fineAimRibs = el('div', 'fine-aim-ribs', fineAim);

  const spinOverlay = el('div', 'spin-overlay', root);
  spinOverlay.hidden = true;
  const spinPanel = el('div', 'spin-panel', spinOverlay);
  el('div', 'spin-title', spinPanel).textContent = 'Tap where the cue hits the ball';
  const spinPad = el('div', 'spin-pad', spinPanel);
  el('div', 'spin-cross', spinPad);
  const spinPadDot = el('div', 'spin-dot spin-dot-large', spinPad);
  el('div', 'spin-help', spinPanel).textContent = 'Top: follow · Bottom: draw · Sides: english';
  const spinDone = el('button', 'spin-done', spinPanel);
  spinDone.type = 'button';
  spinDone.textContent = 'Done';

  const toast = el('div', 'toast', root);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  const openSpin = (open: boolean): void => {
    spinOverlay.hidden = !open;
    root.dataset.spinOpen = String(open);
  };
  spinButton.addEventListener('click', () => openSpin(true));
  spinDone.addEventListener('click', () => openSpin(false));
  spinOverlay.addEventListener('pointerdown', (e) => {
    if (e.target === spinOverlay) openSpin(false);
  });

  const placeDot = (dot: HTMLElement, s: Vec2): void => {
    dot.style.left = `${50 + s.x * 50}%`;
    dot.style.top = `${50 - s.y * 50}%`;
  };

  return {
    powerElement: power,
    fineAimElement: fineAim,
    spinPadElement: spinPad,

    /** Positions the side controls next to the table. */
    setLayout(table: ScreenRect, viewport: Viewport, orientation: Orientation): void {
      root.dataset.orientation = orientation;
      const leftStrip = table.x;
      const rightStrip = viewport.width - (table.x + table.width);
      const width = Math.max(26, Math.min(48, Math.min(leftStrip, rightStrip) - 8));
      const height = Math.min(table.height * 0.62, 440);
      const top = table.y + (table.height - height) / 2;
      for (const [e, x] of [
        [power, leftStrip / 2 - width / 2],
        [fineAim, table.x + table.width + rightStrip / 2 - width / 2],
      ] as const) {
        e.style.left = `${x}px`;
        e.style.top = `${top}px`;
        e.style.width = `${width}px`;
        e.style.height = `${height}px`;
      }
      bar.style.height = `${Math.max(44, table.y - 6)}px`;
    },

    setPower(p: number): void {
      powerFill.style.transform = `scaleY(${p})`;
      powerCue.style.transform = `translateY(${p * 78}%)`;
      power.dataset.power = p.toFixed(2);
    },

    setSpin(s: Vec2): void {
      placeDot(spinButtonDot, s);
      placeDot(spinPadDot, s);
      spinButton.dataset.spin = `${s.x.toFixed(2)},${s.y.toFixed(2)}`;
    },

    /** Scrolls the wheel ribs with the aim so fine-aim drags feel attached. */
    setAimAngle(angle: number): void {
      fineAimRibs.style.backgroundPositionY = `${(angle * WHEEL_PX_PER_RAD) % 1000}px`;
    },

    setControlsEnabled(enabled: boolean): void {
      root.dataset.controls = enabled ? 'on' : 'off';
      spinButton.disabled = !enabled;
      if (!enabled) openSpin(false);
    },

    setStatus(text: string): void {
      status.textContent = text;
    },

    showToast(text: string, ms = 1600): void {
      toast.textContent = text;
      toast.classList.add('toast-visible');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('toast-visible'), ms);
    },

    onReset(cb: () => void): void {
      resetButton.addEventListener('click', cb);
    },
  };
}
