import type { EndReason, Foul } from '../shared';

/** Short toast text for a foul (state/ui may show these as-is). */
export const FOUL_TEXT: Record<Foul, string> = {
  scratch: 'Scratch',
  'no-contact': 'No ball hit',
  'wrong-ball-first': 'Wrong ball first',
  'no-rail-after-contact': 'No rail after contact',
};

/** One line saying why the game ended, from the winner's point of view of the loser's mistake. */
export const END_TEXT: Record<EndReason, string> = {
  'eight-legal': 'Sank the 8 ball',
  'eight-on-break': '8 ball on the break',
  'eight-early': 'Sank the 8 ball too early',
  'eight-scratch': 'Scratched on the 8 ball',
  'eight-wrong-pocket': '8 ball in the wrong pocket',
  'eight-foul': 'Fouled while sinking the 8 ball',
};
