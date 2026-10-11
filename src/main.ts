import './styles.css';
import { GAME_NAME } from './shared';
import { startApp } from './state';

document.title = GAME_NAME;

const find = <T extends Element>(selector: string): T => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`${selector} missing`);
  return el;
};

startApp({
  table: find<HTMLCanvasElement>('#table'),
  scene: find<HTMLCanvasElement>('#scene'),
  hud: find<HTMLElement>('#hud'),
});
