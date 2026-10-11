import type { InputHandlers, Vec2 } from '../shared';
import { FINE_AIM_RAD_PER_PX, powerFromPull, spinFromPad } from './gestures';

/** Pull distance for full power, as a fraction of the slider's height. */
const POWER_TRAVEL = 0.78;

/** Tracks one pointer on `el`, calling back with element-local coordinates. */
function trackPointer(
  el: HTMLElement,
  onStart: (p: Vec2, rect: DOMRect) => boolean,
  onMove: (p: Vec2, rect: DOMRect) => void,
  onEnd: (p: Vec2, rect: DOMRect, isCancel: boolean) => void,
): () => void {
  let pointerId: number | null = null;
  const local = (e: PointerEvent): [Vec2, DOMRect] => {
    const rect = el.getBoundingClientRect();
    return [{ x: e.clientX - rect.left, y: e.clientY - rect.top }, rect];
  };
  const down = (e: PointerEvent): void => {
    if (pointerId !== null || !e.isPrimary) return;
    const [p, rect] = local(e);
    if (!onStart(p, rect)) return;
    pointerId = e.pointerId;
    el.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const move = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    onMove(...local(e));
  };
  const end =
    (isCancel: boolean) =>
    (e: PointerEvent): void => {
      if (e.pointerId !== pointerId) return;
      pointerId = null;
      const [p, rect] = local(e);
      onEnd(p, rect, isCancel);
    };
  const up = end(false);
  const cancel = end(true);
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', cancel);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', up);
    el.removeEventListener('pointercancel', cancel);
  };
}

/**
 * Pull-back power slider: press anywhere on it and drag down to pull the cue back;
 * releasing shoots. Dragging back up to the start cancels (power 0).
 */
export function attachPowerSlider(
  el: HTMLElement,
  isEnabled: () => boolean,
  handlers: InputHandlers,
): () => void {
  let startY = 0;
  let power = 0;
  return trackPointer(
    el,
    (p) => {
      if (!isEnabled()) return false;
      startY = p.y;
      power = 0;
      handlers.setPower(0);
      return true;
    },
    (p, rect) => {
      power = powerFromPull(startY, p.y, rect.height * POWER_TRAVEL);
      handlers.setPower(power);
    },
    (_p, _rect, isCancel) => {
      handlers.releasePower(isCancel ? 0 : power);
      power = 0;
    },
  );
}

/** Fine-aim wheel: vertical drags rotate the aim slowly (down = clockwise). */
export function attachFineAim(
  el: HTMLElement,
  isEnabled: () => boolean,
  handlers: InputHandlers,
): () => void {
  let lastY = 0;
  return trackPointer(
    el,
    (p) => {
      if (!isEnabled()) return false;
      lastY = p.y;
      return true;
    },
    (p) => {
      handlers.aimBy((p.y - lastY) * FINE_AIM_RAD_PER_PX);
      lastY = p.y;
    },
    () => {},
  );
}

/** Spin pad: press or drag on the big cue ball to place the tip contact point. */
export function attachSpinPad(el: HTMLElement, handlers: InputHandlers): () => void {
  const update = (p: Vec2, rect: DOMRect): void => {
    const r = rect.width / 2;
    handlers.setSpin(spinFromPad({ x: r, y: rect.height / 2 }, r, p));
  };
  return trackPointer(
    el,
    (p, rect) => {
      update(p, rect);
      return true;
    },
    update,
    () => {},
  );
}
