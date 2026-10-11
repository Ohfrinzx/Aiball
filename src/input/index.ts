/**
 * src/input — touch/mouse handling turned into aim / power / spin / ball-in-hand intents.
 * May import: src/shared only.
 */
export { attachTableInput } from './tableInput';
export { attachPowerSlider, attachFineAim, attachSpinPad } from './controlsInput';
export {
  aimDeltaFromDrag,
  powerFromPull,
  spinFromPad,
  wrapAngle,
  FINE_AIM_RAD_PER_PX,
} from './gestures';
