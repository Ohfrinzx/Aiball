import { expect, test, type Page } from '@playwright/test';

const OUTER_RATIO = (2.24 + 2 * 0.145) / (1.12 + 2 * 0.145);

async function tableRect(page: Page) {
  const raw = await page.locator('#table').getAttribute('data-table-rect');
  const [x, y, width, height] = (raw ?? '').split(',').map(Number);
  return { x: x!, y: y!, width: width!, height: height! };
}

test('loads without errors and draws the table', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));

  await page.goto('./');
  await expect(page).toHaveTitle('Velvet 8');
  const canvas = page.locator('#table');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-table-rect', /\d/);

  // Something other than the background was painted at the table center.
  const painted = await canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')!;
    const [r, g, b] = ctx.getImageData(el.width / 2, el.height / 2, 1, 1).data;
    return { r, g, b };
  });
  expect(painted.g).toBeGreaterThan(painted.r!);

  expect(errors).toEqual([]);
});

test('table orientation matches the viewport and keeps its proportions', async ({ page }) => {
  await page.goto('./');
  const viewport = page.viewportSize()!;
  const canvas = page.locator('#table');
  const expected = viewport.height > viewport.width ? 'portrait' : 'landscape';
  await expect(canvas).toHaveAttribute('data-orientation', expected);

  const r = await tableRect(page);
  if (expected === 'portrait') expect(r.height).toBeGreaterThan(r.width);
  else expect(r.width).toBeGreaterThan(r.height);
  const ratio = Math.max(r.width, r.height) / Math.min(r.width, r.height);
  expect(ratio).toBeCloseTo(OUTER_RATIO, 1);

  await page.screenshot({ path: `test-results/table-${test.info().project.name}.png` });
});

test('re-lays out when the viewport rotates', async ({ page }) => {
  await page.goto('./');
  const canvas = page.locator('#table');
  const { width, height } = page.viewportSize()!;

  await page.setViewportSize({ width: height, height: width });
  const expected = width > height ? 'portrait' : 'landscape';
  await expect(canvas).toHaveAttribute('data-orientation', expected);
});
