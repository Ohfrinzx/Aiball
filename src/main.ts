import './styles.css';
import { GAME_NAME } from './shared/constants';
import { startApp } from './state';

document.title = GAME_NAME;

const canvas = document.querySelector<HTMLCanvasElement>('#table');
if (!canvas) throw new Error('#table canvas missing');
startApp(canvas);
