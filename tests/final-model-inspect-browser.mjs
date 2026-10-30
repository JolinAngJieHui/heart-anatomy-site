// Inspect mapped vessels in the supplied file in an isolated browser context.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = await import(new URL('../.next/cache/browser-tools/node_modules/playwright/index.mjs', import.meta.url).href);
const directory = 'artifacts/final-model'; fs.mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const config = JSON.parse(fs.readFileSync('artifacts/final-model/proposed-config.json'));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['localhost', '127.0.0.1'].includes(url.hostname)) return route.abort();
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { mode: 'basic', reason: 'disabled', sources: [], passages: [] } });
    if (url.pathname.endsWith('/heart-model.json')) return route.fulfill({ json: { ...config, url: '/models/inspection.glb' } });
    if (url.pathname.endsWith('/inspection.glb')) return route.fulfill({ contentType: 'model/gltf-binary', body: fs.readFileSync('artifacts/heart-scan-web/heart final labelled.glb') });
    return route.continue();
  });
  const page = await context.newPage();
  for (const id of ['posterior-descending-artery', 'right-conus-artery', 'right-marginal-artery', 'left-marginal-artery']) {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.scene-surface[data-model-kind="imported"]', { timeout: 90000 }); await page.waitForTimeout(1000);
    await page.locator(`[data-structure-id="${id}"]`).click(); await page.waitForTimeout(800);
    await page.getByRole('switch', { name: 'Isolate Structure' }).click(); await page.waitForTimeout(800);
    const materials = await page.locator('.scene-surface').evaluate(el => JSON.parse(el.dataset.modelMaterials));
    const own = materials.filter(material => material.structures.includes(id));
    assert.equal(own.length, 2, 'Both texture primitives of the selected vessel remain visible');
    assert.ok(own.every(mesh => mesh.visible && mesh.colors.every(color => color === 'ffffff') && mesh.materials.every(m => m.opacity === 1 && m.emissive === '000000')));
    assert.ok(materials.filter(mesh => !mesh.structures.includes(id)).every(mesh => mesh.visible && mesh.isolationContext && mesh.materials.every(m => m.opacity === .2 && !m.depthWrite)), 'Context is translucent without obstructing the selected vessel');
    await page.waitForTimeout(500); await page.screenshot({ path: `${directory}/revised-isolated-${id}.png` });
  }
} finally { await browser.close(); }
