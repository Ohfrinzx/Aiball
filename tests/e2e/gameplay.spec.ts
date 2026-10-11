import { expect, test, type Page } from '@playwright/test';

// Must match src/shared/constants.ts (7-ft table, 0.045 cushion + 0.075 rail).
const OUTER_LENGTH = 1.98 + 2 * 0.12;
const HEAD_STRING_X = -1.98 / 4;

interface Geometry {
  readonly left: number;
  readonly top: number;
  readonly cx: number;
  readonly cy: number;
  readonly scale: number;
  readonly portrait: boolean;
}

/** Mirrors render/layout.ts so tests can find table-space points on screen. */
async function geometry(page: Page): Promise<Geometry> {
  const canvas = page.locator('#scene');
  const box = (await canvas.boundingBox())!;
  const raw = (await page.locator('#table').getAttribute('data-table-rect'))!;
  const [x, y, w, h] = raw.split(',').map(Number) as [number, number, number, number];
  const portrait = (await page.locator('#table').getAttribute('data-orientation')) === 'portrait';
  return {
    left: box.x,
    top: box.y,
    cx: box.x + x + w / 2,
    cy: box.y + y + h / 2,
    scale: (portrait ? h : w) / OUTER_LENGTH,
    portrait,
  };
}

function toScreen(g: Geometry, p: { x: number; y: number }): { x: number; y: number } {
  return g.portrait
    ? { x: g.cx + p.y * g.scale, y: g.cy - p.x * g.scale }
    : { x: g.cx + p.x * g.scale, y: g.cy + p.y * g.scale };
}

async function data(page: Page, key: string): Promise<string> {
  return (await page.locator('#scene').getAttribute(`data-${key}`)) ?? '';
}

async function cueBall(page: Page): Promise<{ x: number; y: number }> {
  const [x, y] = (await data(page, 'cue-ball')).split(',').map(Number);
  return { x: x!, y: y! };
}

async function pullAndRelease(page: Page, fraction: number): Promise<void> {
  const box = (await page.locator('.power').boundingBox())!;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + 8);
  await page.mouse.down();
  await page.mouse.move(x, box.y + 8 + box.height * 0.78 * fraction, { steps: 6 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto('./?seed=3');
  await expect(page.locator('#scene')).toHaveAttribute('data-phase', 'aiming');
});

test('power slider shoots; balls roll and come to rest', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));

  await pullAndRelease(page, 0.25);
  await expect(page.locator('#scene')).toHaveAttribute('data-phase', /striking|rolling/);
  await expect(page.locator('#scene')).toHaveAttribute('data-phase', 'aiming', { timeout: 30_000 });
  await expect(page.locator('#scene')).toHaveAttribute('data-shots', '1');
  // The break opened the rack; ball in hand ends once the shot is taken.
  await expect(page.locator('#scene')).toHaveAttribute('data-ball-in-hand', /none|table/);
  expect(errors).toEqual([]);
});

test('releasing the slider without pulling does not shoot', async ({ page }) => {
  await pullAndRelease(page, 0);
  await page.waitForTimeout(200);
  await expect(page.locator('#scene')).toHaveAttribute('data-phase', 'aiming');
  await expect(page.locator('#scene')).toHaveAttribute('data-shots', '0');
});

test('dragging on the table rotates the aim around the cue ball', async ({ page }) => {
  const g = await geometry(page);
  const before = Number(await data(page, 'aim'));
  // Drag sideways across the far end of the table.
  const a = toScreen(g, { x: 0.6, y: -0.3 });
  const b = toScreen(g, { x: 0.6, y: 0.3 });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await page.mouse.up();
  const after = Number(await data(page, 'aim'));
  expect(Math.abs(after - before)).toBeGreaterThan(0.2);
});

test('tapping the table points the aim at the tap', async ({ page }) => {
  const g = await geometry(page);
  const cue = await cueBall(page);
  const target = { x: cue.x + 0.4, y: cue.y + 0.3 };
  const s = toScreen(g, target);
  await page.mouse.click(s.x, s.y);
  const aim = Number(await data(page, 'aim'));
  expect(aim).toBeCloseTo(Math.atan2(0.3, 0.4), 1);
});

test('fine-aim wheel nudges the aim by a small amount', async ({ page }) => {
  const box = (await page.locator('.fine-aim').boundingBox())!;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(x, box.y + 120, { steps: 5 });
  await page.mouse.up();
  const aim = Number(await data(page, 'aim'));
  expect(aim).toBeGreaterThan(0.02);
  expect(aim).toBeLessThan(0.1);
});

test('spin picker opens, sets english and closes', async ({ page }) => {
  await page.locator('.hud-spin').click();
  await expect(page.locator('.spin-overlay')).toBeVisible();
  const pad = (await page.locator('.spin-pad').boundingBox())!;
  // Low and to the right: right english with draw.
  await page.mouse.click(pad.x + pad.width * 0.8, pad.y + pad.height * 0.75);
  const [sx, sy] = ((await page.locator('.hud-spin').getAttribute('data-spin')) ?? '')
    .split(',')
    .map(Number);
  expect(sx).toBeGreaterThan(0.4);
  expect(sy).toBeLessThan(-0.3);
  await page.locator('.spin-done').click();
  await expect(page.locator('.spin-overlay')).toBeHidden();
});

test('ball in hand: the cue ball can be dragged, but only behind the head string', async ({
  page,
}) => {
  const g = await geometry(page);
  const from = toScreen(g, await cueBall(page));
  const to = toScreen(g, { x: 0.3, y: 0.2 });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  const cue = await cueBall(page);
  expect(cue.x).toBeLessThanOrEqual(HEAD_STRING_X + 1e-6);
  expect(cue.y).toBeCloseTo(0.2, 1);
});

test('re-rack button resets the table', async ({ page }) => {
  await pullAndRelease(page, 0.2);
  await expect(page.locator('#scene')).toHaveAttribute('data-phase', 'aiming', { timeout: 30_000 });
  await page.locator('.hud-reset').click();
  await expect(page.locator('#scene')).toHaveAttribute('data-shots', '0');
  await expect(page.locator('#scene')).toHaveAttribute('data-ball-in-hand', 'kitchen');
  await expect(page.locator('#scene')).toHaveAttribute('data-balls-on-table', '16');
});
