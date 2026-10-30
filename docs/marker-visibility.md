# Anatomical marker visibility

The existing marker projector now checks the authored anatomical point before
screen-space decluttering. Points outside the camera frustum or behind visible
heart geometry are hidden together with their number, tooltip and leader line.
The selected information card remains open; its connector disappears until the
marker is visible again. Visibility never dispatches selection or camera actions.

## Geometry and responsiveness

- Uses `three-mesh-bvh` 0.8.3, already present through Drei and now explicitly
  declared as a direct dependency. An indirect BVH retains the original index
  order, material groups, geometry and textures.
- Detailed GLB geometry is indexed once in a bundled background worker during
  loading. Only copies of vertex/index buffers are transferred. The original GLB
  and rendered buffers remain intact. A hosting environment that blocks workers
  falls back to indexing once during loading, never on every rotation frame.
- Queries include descendant meshes, their world transforms, camera layers and
  ancestor visibility. Invisible objects and translucent isolation context do
  not occlude. Outside isolation, opaque heart context blocks both markers and
  vessel picking. Occlusion uses its own accelerated geometry query.
- Uses the first BVH intersection and compares distances in world coordinates,
  including nonuniform scale. Camera movement, projection offsets, zoom, mesh
  transforms and visibility changes invalidate the cache. An unchanged view does
  not repeat intersection checks or marker placement/DOM updates.
- Surface tolerance is 0.4% of the model bounding-box diagonal. Hiding and showing
  thresholds use 1.15 and 0.85 times this tolerance, respectively, to prevent small
  depth fluctuations from flickering. It requires no timeout or perpetual render
  loop. Frustum clipping remains strict.
- Hidden buttons use `hidden` / `display: none`, lose keyboard focus if necessary,
  and clear marker-originated hover without erasing sidebar hover or selection.

## Original RCA test scan and calibration

This section records the earlier RCA test scan; the active asset and current
calibration are documented in [Final labelled scan integration](final-labelled-model.md).
The earlier scan was `/models/heart-b799dff855fdbca5.glb`: 1,250,000 triangles
and four draw calls. No model, texture, lighting or camera settings were changed.
The 17 stable anatomy IDs remain in the catalogue and available to the Tutor.
Only the three RCA anchors have been authored in this GLB. The remaining 14 need
Blender tagging before they can have accurately placed markers on this scan.

The read-only anchor audit samples 264 camera directions. With the surface
tolerance, each of the three authored anchors has exposed viewpoints. The
proximal RCA anchor is slightly inset: its closest surface is approximately
0.00998 normalized viewer units away (about 0.3% of the model diameter). Middle
and distal distances are approximately 0.00099 and 0.00248. The tolerance handles
these placements; no anchor was moved or reassigned. Proximal placement is worth
checking against the intended vessel surface on the next Blender export.

The schematic fallback retains its original approximate anchors. Occlusion does
not make those approximate positions anatomically calibrated. A 648-direction
audit found five anchors inside the placeholder geometry with no exposed view:

- Marker 5: Left Coronary Artery (`left-coronary-artery`).
- Marker 11: Left Circumflex Artery (`left-circumflex-artery`).
- Marker 12: Right Marginal Artery (`right-marginal-artery`).
- Marker 14: Left Marginal Artery (`left-marginal-artery`).
- Marker 15: Ascending Aorta (`ascending-aorta`).

These need manual placement review if the schematic or its identification quiz
is used. The catalogue, Tutor navigation and information remain available for
every ID. No coordinates were guessed or moved to make these markers appear.
This limitation is separate from the three correctly revealable RCA anchors in
the installed scan. The implementation
targets the current rigid, opaque scan: a future deforming/skinned model or
alpha-cutout occluder would need deformation/alpha-aware query support.

## Verification

- `npm.cmd test`: 183 tests pass, including nine new visibility tests covering all
  17 IDs, child occlusion, transforms, frustum clipping, orthographic cameras,
  inset anchors, hysteresis, geometry integrity and cache disposal.
- `npm.cmd run typecheck`, `npm.cmd run lint` and
  `npm.cmd run build -- --webpack`: pass.
- `node tests/marker-occlusion-browser.mjs`: controlled 17-anchor browser test.
  Checks front/back/side/top/underside/tilted views, selected-card persistence,
  connectors, hidden-button focus, restored exploration state, mocked Tutor
  navigation, mobile resizing and zoom.
- `node tests/marker-occlusion-browser.mjs --real`: the same view checks on the
  supplied scan, plus finding and clicking each of its three authored anchors.
- `node tests/marker-occlusion-browser.mjs --no-worker`: hosting restriction path.
- `node tests/model-import-browser.mjs` and `node tests/rca-model-browser.mjs`:
  existing loading, failure, retry, highlighting, isolation and responsive
  regressions, updated to navigate to exposed marker locations.
- `node tests/marker-anchor-audit.mjs`: read-only scan geometry audit. Results and
  browser screenshots are in `artifacts/marker-occlusion/`. The isolated Node
  audit measured a median 0.15 ms and p95 0.48 ms for visibility checks across 264
  views; these are query timings, not overall display frame rates.
- `node tests/marker-occlusion-performance.mjs after`: repeatable local rotation
  comparison against the recorded `performance-before.json`. This intentionally
  uses software rendering; it is not a claim about the student's graphics card.

The isolated software comparison recorded median frame intervals of 1183 ms
before and 1165 ms after; p95 varied from 1414 ms to 1746 ms. Software rendering is
severely limited on this setup, so the tail variation is not evidence of a
hardware frame-rate guarantee. In the regular Chrome RCA regression the recorded
median was 16.6 ms and p95 20 ms. The occlusion query in the software run's final
frame took 0.2 ms. All runs retained four draw calls, 1,250,000 triangles and the
same textures. Browser results and the timing comparison are saved separately.

Browser tests block external requests and mock all AI endpoints. No paid calls
are made. Geometry indexing is packaged by Next.js; there is no extra service or
hosting dependency. If a Content Security Policy is configured in future, allow
same-origin bundled workers to retain the background-loading path.

## Files

Production: `components/HeartAnnotations.tsx`, `components/HeartScene.tsx`,
`lib/load-heart-asset.ts`, `lib/marker-geometry.ts`,
`lib/marker-geometry.worker.ts`, `lib/prepare-marker-geometry.ts`,
`lib/marker-visibility.ts`, `package.json`, `package-lock.json`.

Verification: `tests/marker-visibility.test.mjs`,
`tests/marker-occlusion-browser.mjs`, `tests/marker-occlusion-performance.mjs`,
`tests/marker-anchor-audit.mjs`, `tests/helpers/viewer-orbit.mjs`,
`tests/model-import-browser.mjs`, `tests/rca-model-browser.mjs`.
