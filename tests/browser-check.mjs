// Optional browser QA: keep browser tooling outside the application's dependency tree.
import assert from "node:assert/strict";
const { chromium } = await import("playwright").catch(() => import(new URL("../.next/cache/browser-tools/node_modules/playwright/index.mjs", import.meta.url).href));

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(process.env.EXPLORER_TEST_URL ?? "http://127.0.0.1:3100", { waitUntil: "networkidle" });
  await page.waitForSelector("canvas");
  await page.waitForFunction(() => document.querySelectorAll(".anatomy-marker:not([hidden])").length === 17);
  const marker = (id) => page.locator(`[data-marker-id="${id}"]`);
  const entry = (id) => page.locator(`[data-structure-id="${id}"]`);
  const title = page.locator("#detail-title");
  const waitForFraming = () => page.waitForFunction(() => {
    const line = document.querySelector(".leader.selected");
    const view = document.querySelector(".scene-surface");
    const marker = document.querySelector(".anatomy-marker.selected");
    const framing = view.dataset.framing && JSON.parse(view.dataset.framing);
    return line && marker && !marker.hidden && framing?.measured && !framing.moving && framing.selectedId === marker.dataset.markerId && framing.cardOpen;
  });
  assert.equal(await page.locator("[data-structure-id]").count(), 17);
  const inventory = await page.locator("[data-structure-id]").evaluateAll((elements) => elements.map((el) => ({ id: el.dataset.structureId, name: el.querySelector(".structure-name").childNodes[0].textContent })));
  for (const structure of inventory) {
    await entry(structure.id).click();
    await waitForFraming();
    for (const level of ["basic", "intermediate", "advanced"]) {
      await page.getByRole("button", { name: level, exact: true }).click();
      assert.equal(await title.innerText(), structure.name);
      assert.ok((await page.locator(".detail-summary").innerText()).length > 80);
      assert.ok(await page.locator(".blood-flow li").count() >= 3);
      assert.ok(await page.locator(".education-references a").count() >= 2);
      assert.equal(await marker(structure.id).getAttribute("aria-pressed"), "true");
    }
  }
  await page.waitForTimeout(750);
  const beforePan = await page.locator(".scene-surface").evaluate(el => JSON.parse(el.dataset.framing));
  await entry("right-coronary-proximal").click();
  await page.waitForTimeout(750);
  await waitForFraming();
  const afterPan = await page.locator(".scene-surface").evaluate(el => JSON.parse(el.dataset.framing));
  assert.ok(Math.hypot(afterPan.offset.x - beforePan.offset.x, afterPan.offset.y - beforePan.offset.y) > 1, "vessel selection pans the projected anchor");
  for (const key of ["position", "target", "quaternion"]) beforePan[key].forEach((v, i) => assert.ok(Math.abs(afterPan[key][i] - v) < .00001, "optical pan preserves orbit pose"));
  assert.ok(Math.abs(beforePan.distance - afterPan.distance) < .00001, "selection pan preserves zoom");
  await page.getByRole("button", { name: "basic", exact: true }).click();
  assert.equal(await page.locator(".learning-panel .detail-card").count(), 0);
  assert.equal(await page.locator(".workspace-heading .learning-levels").count(), 1);
  assert.equal(await page.locator(".detail-card").count(), 1);
  // Exercise every numbered viewport marker, not only sidebar selection.
  for (const structure of inventory) {
    await page.getByRole("button", { name: "Close anatomical information", exact: true }).click();
    await page.getByRole("button", { name: "Reset view", exact: true }).click();
    await marker(structure.id).hover();
    assert.ok(await entry(structure.id).evaluate((el) => el.classList.contains("hovered")));
    assert.ok(await marker(structure.id).locator("[role=tooltip]").isVisible());
    await marker(structure.id).click();
    await waitForFraming();
    assert.equal(await title.innerText(), structure.name);
    assert.ok(await page.locator(".information-overlay").isVisible());
    assert.equal(await entry(structure.id).getAttribute("aria-pressed"), "true");
  }
  await entry("left-anterior-descending-mid").hover();
  assert.ok(await marker("left-anterior-descending-mid").evaluate((el) => el.classList.contains("hovered")));
  const canvas = await page.locator("canvas").elementHandle();
  const leader = page.locator("line").nth(16);
  const position = async () => [await leader.getAttribute("x1"), await leader.getAttribute("y1")].join(",");
  const beforeLevel = await position();
  await page.getByRole("button", { name: "intermediate", exact: true }).click();
  assert.equal(await position(), beforeLevel);
  assert.equal(await page.locator("canvas").evaluate((el, old) => el === old, canvas), true);
  assert.equal(await title.innerText(), "Coronary Sinus");
  // The aortic placeholder is a real selectable mesh, even with markers hidden.
  const aorticLeader = page.locator("line").nth(14);
  await page.getByRole("button", { name: "Close anatomical information", exact: true }).click();
  await page.waitForTimeout(300);
  const aorticPoint = { x: Number(await aorticLeader.getAttribute("x1")), y: Number(await aorticLeader.getAttribute("y1")) };
  await page.getByRole("button", { name: "Hide Markers", exact: true }).click();
  await page.locator("canvas").click({ position: aorticPoint });
  assert.equal(await title.innerText(), "Ascending Aorta");
  await page.getByRole("button", { name: "Show Markers", exact: true }).click();
  await entry("coronary-sinus").click();
  for (const [button, expected] of [["Hide Markers", false], ["Show Markers", true]]) {
    await page.getByRole("button", { name: button, exact: true }).click();
    await page.waitForFunction((visible) => (document.querySelectorAll(".anatomy-marker:not([hidden])").length > 0) === visible, expected);
    assert.equal(await title.innerText(), "Coronary Sinus");
  }
  const isolation = page.getByRole("switch", { name: "Isolate Structure", exact: true });
  assert.equal(await isolation.getAttribute("aria-checked"), "false");
  await isolation.focus();
  await page.keyboard.press("Space");
  assert.equal(await isolation.getAttribute("aria-checked"), "true");
  await page.waitForFunction(() => document.querySelectorAll(".anatomy-marker:not([hidden])").length === 1);
  await entry("left-diagonal-d1").click();
  await waitForFraming();
  assert.ok(await marker("left-diagonal-d1").isVisible());
  assert.equal(await title.innerText(), "Left Diagonal D1");
  await isolation.click();
  await entry("coronary-sinus").click();
  await waitForFraming();
  const zoomPosition = async () => page.locator(".scene-surface").evaluate(el => JSON.parse(el.dataset.framing).distance);
  const beforeZoom = await zoomPosition();
  const zoomSurface = await page.locator("canvas").boundingBox();
  await page.mouse.move(zoomSurface.x + 20, zoomSurface.y + 20);
  await page.mouse.wheel(0, -250);
  await page.waitForTimeout(1100);
  assert.notEqual(await zoomPosition(), beforeZoom);
  await page.mouse.wheel(0, 250);
  await page.waitForTimeout(1100);
  assert.equal(await page.getByRole("button", { name: /^Zoom (in|out)$/i }).count(), 0);
  assert.equal(await page.getByText("Approximate markers", { exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Focus selected", exact: true }).count(), 0);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.waitForTimeout(1300);
  const resetPosition = await position();
  const surface = await page.locator(".scene-surface").boundingBox();
  await page.mouse.move(surface.x + surface.width / 2, surface.y + surface.height / 2);
  await page.mouse.down();
  await page.mouse.move(surface.x + surface.width / 2 + 160, surface.y + surface.height / 2 + 20, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(2500);
  assert.notEqual(await position(), resetPosition);
  assert.ok(await page.locator(".information-overlay").isHidden());
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await page.waitForTimeout(1100);
  assert.ok(Math.abs(Number(await leader.getAttribute("x1")) - Number(resetPosition.split(",")[0])) < 2);
  await page.locator(".structure-catalog").evaluate((el) => el.scrollTop = el.scrollHeight);
  await page.screenshot({ path: ".next/cache/coronary-desktop.png" });
  await entry("coronary-sinus").click(); await waitForFraming();
  const layouts = [];
  for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(950);
    await waitForFraming();
    const sizes = await page.evaluate(() => {
      const rect = (selector) => { const r = document.querySelector(selector).getBoundingClientRect(); return { width: r.width, height: r.height, bottom: r.bottom, right: r.right }; };
      return {
        pageWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight,
        card: rect(".information-card-position"), levels: rect(".learning-levels"), viewer: rect(".scene-surface"), catalog: rect(".structure-catalog"), detail: rect(".detail-body"),
        visibleMarkers: document.querySelectorAll(".anatomy-marker:not([hidden])").length,
        buttons: [...document.querySelectorAll(".anatomy-marker:not([hidden])")].map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y }; }),
      };
    });
    assert.equal(sizes.pageWidth, width);
    assert.equal(sizes.pageHeight, height);
    assert.equal(await page.locator(".anatomy-marker").count(), 17, `all structure markers retained at ${width}x${height}`);
    assert.ok(sizes.visibleMarkers > 0 && sizes.visibleMarkers <= 17, `usable projected markers at ${width}x${height}`);
    assert.ok(sizes.viewer.height >= 60);
    for (const region of [sizes.catalog, sizes.detail, sizes.viewer, sizes.card, sizes.levels]) {
      assert.ok(region.height > 30 && region.width > 60);
      assert.ok(region.bottom <= height && region.right <= width);
    }
    sizes.buttons.forEach((a, i) => sizes.buttons.slice(0, i).forEach((b) => assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 35.9)));
    await page.locator(".structure-catalog").evaluate((el) => el.scrollTop = el.scrollHeight);
    await page.locator(".detail-body").evaluate((el) => el.scrollTop = el.scrollHeight);
    assert.deepEqual(await page.evaluate(() => [window.scrollX, window.scrollY]), [0, 0]);
    layouts.push({ width, height, sceneHeight: sizes.viewer.height, markers: sizes.visibleMarkers });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("combobox", { name: "Learning level", exact: true }).selectOption("basic");
  assert.equal(await title.innerText(), "Coronary Sinus");
  assert.equal(await page.locator(".detail-body").evaluate((el) => el.scrollTop), 0);
  await page.screenshot({ path: ".next/cache/coronary-mobile.png" });
  // Keyboard marker selection and clear selection on empty canvas.
  await marker("left-diagonal-d1").focus();
  await page.keyboard.press("Enter");
  assert.equal(await title.innerText(), "Left Diagonal D1");
  await page.locator("canvas").click({ position: { x: 4, y: 4 } });
  assert.ok(await page.locator(".information-overlay").isHidden());
  assert.ok(await isolation.isDisabled());
  assert.equal(await isolation.getAttribute("aria-checked"), "false");
  assert.ok(await page.getByText("Select a structure to isolate", { exact: true }).isVisible());
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, explanationsRendered: 51, markersClicked: 17, layouts }, null, 2));
} finally {
  await browser.close();
}
