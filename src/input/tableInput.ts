import type { InputContext, InputHandlers, Vec2 } from '../shared';
import { TABLE } from '../shared';
import { TAP_SLOP_PX, WHEEL_RAD_PER_UNIT, aimDeltaFromDrag } from './gestures';

/** Drags closer than this (CSS px) to the cue ball are slowed down. */
const MIN_PIVOT_RADIUS_PX = 70;
/** Touch target for picking up the cue ball with ball in hand, CSS px. */
const MIN_GRAB_RADIUS_PX = 30;

type Mode =
  | { kind: 'idle' }
  | { kind: 'press'; start: Vec2; last: Vec2 }
  | { kind: 'aim'; last: Vec2 }
  | { kind: 'cue' };

/**
 * Table gestures: drag anywhere to rotate the aim around the cue ball, tap to point the
 * aim at a spot, drag the cue ball itself when it is in hand, mouse wheel for fine aim.
 * Returns a function that detaches all listeners.
 */
export function attachTableInput(
  el: HTMLElement,
  context: () => InputContext,
  handlers: InputHandlers,
): () => void {
  let mode: Mode = { kind: 'idle' };
  let pointerId: number | null = null;

  const local = (e: PointerEvent | WheelEvent): Vec2 => {
    const rect = el.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: PointerEvent): void => {
    if (pointerId !== null || !e.isPrimary) return;
    const ctx = context();
    const p = local(e);
    if (ctx.canMoveCueBall && ctx.cueBall) {
      const c = ctx.view.tableToScreen(ctx.cueBall);
      const grab = Math.max(MIN_GRAB_RADIUS_PX, 2.2 * TABLE.ballRadius * ctx.view.scale);
      if (Math.hypot(p.x - c.x, p.y - c.y) <= grab) {
        mode = { kind: 'cue' };
        handlers.moveCueBall(ctx.view.screenToTable(p), 'start');
      }
    }
    if (mode.kind === 'idle' && ctx.canAim) mode = { kind: 'press', start: p, last: p };
    if (mode.kind === 'idle') return;
    pointerId = e.pointerId;
    el.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const rotate = (from: Vec2, to: Vec2): void => {
    const ctx = context();
    if (!ctx.cueBall || !ctx.canAim) return;
    const pivot = ctx.view.tableToScreen(ctx.cueBall);
    handlers.aimBy(aimDeltaFromDrag(pivot, from, to, MIN_PIVOT_RADIUS_PX));
  };

  const onMove = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    const p = local(e);
    if (mode.kind === 'cue') {
      handlers.moveCueBall(context().view.screenToTable(p), 'move');
    } else if (mode.kind === 'press') {
      if (Math.hypot(p.x - mode.start.x, p.y - mode.start.y) >= TAP_SLOP_PX) {
        rotate(mode.start, p);
        mode = { kind: 'aim', last: p };
      }
    } else if (mode.kind === 'aim') {
      rotate(mode.last, p);
      mode = { kind: 'aim', last: p };
    }
  };

  const finish = (e: PointerEvent, isCancel: boolean): void => {
    if (e.pointerId !== pointerId) return;
    const p = local(e);
    const ctx = context();
    if (mode.kind === 'cue') handlers.moveCueBall(ctx.view.screenToTable(p), 'end');
    else if (mode.kind === 'press' && !isCancel && ctx.canAim) {
      handlers.aimAt(ctx.view.screenToTable(p));
    }
    mode = { kind: 'idle' };
    pointerId = null;
  };
  const onUp = (e: PointerEvent): void => finish(e, false);
  const onCancel = (e: PointerEvent): void => finish(e, true);

  const onWheel = (e: WheelEvent): void => {
    if (!context().canAim) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 300 : 1;
    handlers.aimBy(e.deltaY * unit * WHEEL_RAD_PER_UNIT);
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);
  el.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onUp);
    el.removeEventListener('pointercancel', onCancel);
    el.removeEventListener('wheel', onWheel);
  };
}
