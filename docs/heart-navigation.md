# Free heart navigation

The viewer uses incremental quaternion rotation in the existing React Three
Fiber / Three.js scene. The previous OrbitControls polar limits prevented a
continuous vertical revolution. Rotation now has no polar limit or preferred
upright direction; the camera's current orientation is the source of truth.

## Controls

- Left drag rotates in both directions, including through the poles and upside
  down. Right drag pans horizontally/vertically by the same number of pixels.
- Wheel zoom retains the previous 0.95 step and 1.6–12 distance limits. Middle
  drag also zooms. One finger rotates; two fingers pinch to zoom and drag to pan.
- A left click selects a marker. A six-pixel movement threshold separates clicks
  from drags, including gestures that start on HTML marker buttons. Right drags
  and rotation do not record exploration. Keyboard marker activation remains.
- The browser context menu is suppressed on the canvas and markers. Toolbar,
  information-card and Tutor events keep their normal behaviour.

Panning reuses the existing full-size camera projection offset. It moves the
heart on screen without moving the anatomical rotation pivot. Subsequent
rotation preserves that offset rather than orbiting an unrelated pan target.
Model transforms, authored anchors, materials and geometry are unchanged.

Native pointer capture and window release/cancel/blur listeners end a gesture
even when the pointer leaves the viewer. One shared gesture state guards both
HTML marker selection and mesh clicks. During dragging, pointer moves stop before
the detailed mesh hover/raycast handlers. Rendering remains demand-driven; the
controller does not add a perpetual animation loop or React state updates.

## Programmatic movements and visibility

`HeartCamera` retains the existing 420 ms panel/framing transitions and reduced
motion behaviour. Manual input cancels a transition and uses its displayed pose;
there are no cached spherical angles or residual damping to restore an old pose.
Reset View explicitly restores the default orientation, target, distance, zoom
and framing offset. Tutor navigation retains the existing selection/framing
behaviour, including keeping the current viewing angle.

The labelled scan now starts and resets to the upright reference view: arch at
the top, apex down, with the full heart visible. The preset in `lib/heart-model.ts`
stores camera roll as well as viewing direction and targets the visible heart
rather than the empty corners of its oblique bounding box. Narrow viewports pull
back to retain the full scan. Reset still closes the information card and exits
isolation without clearing exploration or conversations. The routine tab-session
notice is removed; storage errors still appear when relevant.

Camera changes invalidate the existing marker projector. Its geometry-based
occlusion checks account for the new camera quaternion and projection offset.
Hidden markers and connectors stay hidden, while a selected information card
stays open. The current scan has seventeen connected markers; see
[Final labelled scan integration](final-labelled-model.md) for the current
exported names, surface mappings and outstanding author calibration issues.

## Checks

- `npm.cmd test`: 189 tests, including six new camera tests for repeated full
  turns, smooth upside-down rotation, fixed-pivot pan, wheel limits and input
  after a programmatic pose.
- `npm.cmd run typecheck`, `npm.cmd run lint`,
  `npm.cmd run build -- --webpack`.
- `node tests/heart-navigation-browser.mjs`: complete horizontal/vertical turns,
  inverted views, four-way pan, pan then rotate, release outside the viewer,
  focus loss, marker click/drag distinction, scoped context-menu suppression,
  wheel/pinch zoom, single-finger mobile rotation, Tutor navigation and Reset.
- `node tests/marker-occlusion-browser.mjs` and its `--real` variant: all seventeen
  synthetic anchors and the actual scan across front, back, sides, top,
  underside, tilted views, selection, keyboard focus and Tutor navigation.
- `node tests/rca-model-browser.mjs`: existing whole-artery highlighting,
  keyboard marker activation, isolation, direct surface selection and mobile.
- `node tests/heart-navigation-performance.mjs after`: local Chrome comparison
  against `artifacts/heart-navigation/performance-before.json`, using the same
  real scan, viewport, pixel ratio and drag sequence.

Browser reports and screenshots are under `artifacts/heart-navigation/`,
`artifacts/marker-occlusion/` and `artifacts/rca-test/`. These tests mock AI
endpoints and block external requests; they do not incur API costs.

All checks above passed on 18 October 2026. The isolated local comparison recorded
the same 16.7 ms median frame interval before and after (approximately 60 fps);
p95 was 17.4 ms before and 17.9 ms after. Both retained 1,250,000 triangles, four
draw calls and the same textures. This short local comparison found no material
slowdown; it is not a frame-rate guarantee for other devices. The final frame's
occlusion query took approximately 0.1 ms after the change.

## Files changed for navigation

Production: `components/HeartCamera.tsx`, `components/HeartScene.tsx`,
`components/HeartExplorer.tsx`, `lib/free-heart-camera.ts`,
`lib/heart-navigation-input.ts`, `app/globals.css`.

Tests: `tests/heart-navigation.test.mjs`, `tests/heart-navigation-browser.mjs`,
`tests/heart-navigation-performance.mjs`, `tests/helpers/viewer-orbit.mjs`,
`tests/marker-occlusion-browser.mjs`. The view helper now steers through public
free-rotation pointer controls instead of assuming spherical OrbitControls.
