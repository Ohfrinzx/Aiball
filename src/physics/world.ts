import type { BallNumber, PocketId, TableState } from '../shared';

/**
 * Mutable per-ball state used inside one simulation (plain numeric fields keep the hot
 * loop allocation-free, which the AI needs to run many simulations per turn).
 *
 * r is the horizontal spin expressed as the velocity the ball would have if it rolled
 * without slipping: r = (-R·ωy, R·ωx). The contact point slips at v − r, so r = v is
 * pure rolling, r ahead of v is follow (topspin) and r behind v is draw.
 * wz is spin about the vertical axis in rad/s (+z points into the cloth, so right
 * english — counter-clockwise seen from above — is negative).
 */
export interface Body {
  readonly id: BallNumber;
  px: number;
  py: number;
  vx: number;
  vy: number;
  rx: number;
  ry: number;
  wz: number;
  /** Orientation quaternion (cosmetic only). */
  qw: number;
  qx: number;
  qy: number;
  qz: number;
  onTable: boolean;
  pocket: PocketId | null;
}

export function bodiesFromTable(table: TableState): Body[] {
  return table.balls.map((b) => ({
    id: b.id,
    px: b.position.x,
    py: b.position.y,
    vx: 0,
    vy: 0,
    rx: 0,
    ry: 0,
    wz: 0,
    qw: b.orientation.w,
    qx: b.orientation.x,
    qy: b.orientation.y,
    qz: b.orientation.z,
    onTable: !b.isPocketed,
    pocket: b.pocketId,
  }));
}

export function tableFromBodies(bodies: readonly Body[]): TableState {
  return {
    balls: bodies.map((b) => ({
      id: b.id,
      position: { x: b.px, y: b.py },
      orientation: { w: b.qw, x: b.qx, y: b.qy, z: b.qz },
      isPocketed: !b.onTable,
      pocketId: b.pocket,
    })),
  };
}

/** True while a ball on the table still translates or slips. */
export function isMoving(b: Body): boolean {
  return b.onTable && (b.vx !== 0 || b.vy !== 0 || b.rx !== 0 || b.ry !== 0);
}
