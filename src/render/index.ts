/**
 * src/render — canvas drawing: table, balls (per-pixel 3D sprites), cue stick, aim guide,
 * layout/scaling and the orientation transform.
 * May import: src/shared only.
 */
export * from './layout';
export { drawTable, applyTableTransform } from './tableRenderer';
export { createSceneRenderer } from './sceneRenderer';
