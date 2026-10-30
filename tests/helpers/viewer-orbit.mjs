import { Quaternion, Vector3 } from 'three';

/** Reach an exposed view using only public pointer controls. Free rotation has
 * no spherical/polar state: express the desired direction in the camera frame. */
export async function orientHeart(page, azimuth, elevation) {
  await page.waitForFunction(() => { const f = document.querySelector('.scene-surface')?.dataset.framing; return f && !JSON.parse(f).moving; });
  const f = await page.locator('.scene-surface').evaluate(el => JSON.parse(el.dataset.framing));
  const a = azimuth * Math.PI / 180, e = elevation * Math.PI / 180;
  const desired = new Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
  const local = desired.clone().applyQuaternion(new Quaternion(...f.quaternion).invert());
  const delta = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), local);
  const angle = 2 * Math.acos(Math.min(1, delta.w));
  if (angle > .04) {
    const box = await page.locator('canvas').boundingBox();
    const steps = Math.ceil(angle / .5), scale = angle / Math.sin(angle / 2) * box.height / (2 * Math.PI) / steps;
    const dx = -delta.y * scale, dy = -delta.x * scale;
    for (let i = 0; i < steps; i++) {
      const x = box.x + box.width * .25, y = box.y + box.height - 90;
      await page.mouse.move(x, y); await page.mouse.down();
      await page.mouse.move(x + dx, y + dy, { steps: 8 }); await page.mouse.up();
    }
    await page.mouse.move(4, 4);
  }
  await page.waitForFunction(direction => {
    const f = JSON.parse(document.querySelector('.scene-surface').dataset.framing);
    const p = f.position.map((v, i) => v - f.target[i]), length = Math.hypot(...p);
    return Math.acos(Math.min(1, p.reduce((sum, v, i) => sum + v / length * direction[i], 0))) < .08;
  }, desired.toArray());
}

export async function exposeRcaMarker(page, id) {
  const poses = { 'right-coronary-proximal': [180, -60], 'right-coronary-middle': [150, -45], 'right-coronary-distal': [45, -45] };
  await orientHeart(page, ...poses[id]);
  await page.locator(`[data-marker-id="${id}"]`).waitFor({ state: 'visible' });
}
