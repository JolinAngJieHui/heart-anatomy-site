import fs from 'node:fs';
const { chromium } = await import(new URL('../.next/cache/browser-tools/node_modules/playwright/index.mjs', import.meta.url).href);
const stage = process.argv[2] ?? 'after';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const directory = 'artifacts/heart-navigation'; fs.mkdirSync(directory, { recursive: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { mode: 'basic', reason: 'disabled', sources: [], passages: [] } });
    return route.continue();
  });
  const page = await context.newPage();
  await page.goto(process.env.EXPLORER_TEST_URL ?? 'http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.scene-surface[data-model-kind="imported"]', { timeout: 90000 });
  await page.waitForTimeout(3500);
  const box = await page.locator('canvas').boundingBox();
  await page.evaluate(() => {
    const element = document.querySelector('.scene-surface');
    window.rotationSamples = [];
    let last = performance.now();
    window.rotationObserver = new MutationObserver(() => {
      const now = performance.now();
      window.rotationSamples.push(now - last); last = now;
    });
    window.rotationObserver.observe(element, { attributes: true, attributeFilter: ['data-render-frame'] });
  });
  for (let pass = 0; pass < 3; pass++) {
    const x = box.x + box.width * .7, y = box.y + box.height * .72;
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x - 240, y + (pass - 1) * 35, { steps: 35 }); await page.mouse.up();
  }
  const result = await page.evaluate(() => {
    window.rotationObserver.disconnect();
    const samples = window.rotationSamples.slice(1).sort((a, b) => a - b);
    const surface = document.querySelector('.scene-surface');
    return { renderer: 'Chrome default renderer; local comparison', frames: samples.length,
      medianMs: samples[Math.floor(samples.length * .5)], p95Ms: samples[Math.floor(samples.length * .95)],
      render: JSON.parse(surface.dataset.renderStats), occlusion: JSON.parse(surface.dataset.markerVisibility ?? 'null') };
  });
  fs.writeFileSync(`${directory}/performance-${stage}.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }

