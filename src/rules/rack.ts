import type { BallNumber, BallState, Quat, TableGeometry, TableState } from '../shared';
import { CUE_BALL, EIGHT_BALL, TABLE, createRng, quatFromAxisAngle, quatMultiply } from '../shared';

const SOLIDS: readonly BallNumber[] = [1, 2, 3, 4, 5, 6, 7];
const STRIPES: readonly BallNumber[] = [9, 10, 11, 12, 13, 14, 15];

/** Gap between racked balls, meters. A hair of space keeps the break deterministic. */
const RACK_GAP = 0.00005;

/**
 * Standard 8-ball rack: triangle with its apex on the foot spot, the 8 in the middle of
 * the third row, one solid and one stripe in the two back corners, everything else
 * shuffled with the seeded RNG. The cue ball starts on the head spot.
 */
export function createRack(seed: number, table: TableGeometry = TABLE): TableState {
  const rng = createRng(seed);
  const shuffle = <T>(items: readonly T[]): T[] => {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [a[i], a[j]] = [a[j] as T, a[i] as T];
    }
    return a;
  };

  const solids = shuffle(SOLIDS);
  const stripes = shuffle(STRIPES);
  const cornerSolid = solids.pop() as BallNumber;
  const cornerStripe = stripes.pop() as BallNumber;
  const rest = shuffle([...solids, ...stripes]);

  const R = table.ballRadius;
  const spacing = 2 * R + RACK_GAP;
  const rowStep = (spacing * Math.sqrt(3)) / 2;
  // Row-major slots: row k has k+1 balls; slot (2,1) is the center, (4,0)/(4,4) the corners.
  const order: BallNumber[] = [];
  const solidLeft = rng.next() < 0.5;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      if (row === 2 && col === 1) order.push(EIGHT_BALL);
      else if (row === 4 && col === 0) order.push(solidLeft ? cornerSolid : cornerStripe);
      else if (row === 4 && col === 4) order.push(solidLeft ? cornerStripe : cornerSolid);
      else order.push(rest.pop() as BallNumber);
    }
  }

  const balls: BallState[] = [
    {
      id: CUE_BALL,
      position: table.headSpot,
      orientation: randomUpright(rng.next(), rng.next()),
      isPocketed: false,
      pocketId: null,
    },
  ];
  let i = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      balls.push({
        id: order[i++] as BallNumber,
        position: {
          x: table.footSpot.x + row * rowStep,
          y: table.footSpot.y + (col - row / 2) * spacing,
        },
        orientation: randomUpright(rng.next(), rng.next()),
        isPocketed: false,
        pocketId: null,
      });
    }
  }
  balls.sort((a, b) => a.id - b.id);
  return { balls };
}

/**
 * Orientation with the ball's number facing the viewer (local +z → table −z), a random
 * twist about the vertical and a small random tilt so the rack doesn't look stamped.
 */
function randomUpright(twist: number, tilt: number): Quat {
  // Half-turn about x maps local +z to −z (toward the viewer, who looks along +z).
  const faceUp = quatFromAxisAngle(1, 0, 0, Math.PI);
  const spin = quatFromAxisAngle(0, 0, 1, twist * 2 * Math.PI);
  const lean = quatFromAxisAngle(0, 1, 0, (tilt - 0.5) * 0.5);
  return quatMultiply(lean, quatMultiply(spin, faceUp));
}
