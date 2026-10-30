# RCA model test

This records the earlier RCA-only test export. The explorer now uses the
[final labelled scan](final-labelled-model.md), which supersedes the asset below.
The earlier source was `artifacts/heart-scan-web/Heart scan test (right coro).glb`, copied unchanged to `public/models/heart-b799dff855fdbca5.glb` and served at `/models/heart-b799dff855fdbca5.glb`.

SHA-256: `b799dff855fdbca541d80effcd326d6cc9290a52757f3436aa9fa4a3024e5b7e`.

## Authored model

- 45,909,384 bytes (43.8 MiB), with embedded photographic colour and normal textures. This export has no geometry compression.
- 1,250,000 triangles total: 1,238,692 in the heart context and 11,308 in the RCA.
- Two mesh definitions, each with two material primitives; four draw calls in the complete view.
- All three marker Empty positions are used exactly as exported, with local anchor coordinates `[0, 0, 0]`. No anatomical positions were inferred or moved.
- The proximal and middle Empty names start with a space. Three.js normalizes those to `_marker-right-coronary-proximal` and `_marker-right-coronary-middle`; the manifest uses those lookup names. The distal name is `marker-right-coronary-distal`.
- Only markers 1, 2 and 3 are calibrated in this asset. The remaining 14 structures retain their catalogue information and learning functionality, but have no invented markers on this scan. Placement and segmentation remain the author's anatomical judgement.

## Interaction

Markers now hide when their anatomical anchors are occluded or outside the view.
Rotate to an exposed RCA surface before selecting its marker. This does not
change the authored positions or information; see [marker visibility](marker-visibility.md).

`public/models/heart-model.json` now contains an explicit `highlightGroups` entry for `right-coronary-artery`. Its three members retain independent anchors, information cards and exploration histories. The whole group owns the `right-coronary-artery` GLB node and both of its material primitives.

- Hover/focus any RCA marker or its catalogue entry: highlight the complete RCA.
- Select a marker: highlight the complete RCA and show the chosen segment's original information. Only that selected segment is counted as explored.
- Hover the RCA surface: highlight the complete artery and display its whole-vessel label.
- Click/tap the RCA surface: retain the whole-vessel highlight. Do not choose an arbitrary segment, open a segment card, or mark three segments explored. Choose a numbered marker for segment details.
- Isolate a selected RCA segment: show the complete mapped RCA, retaining that segment's marker.
- Reset View or clear selection: restore the original materials and context geometry without clearing learning history.

Highlighting uses the existing rose selection colour and warm hover tint, plus a restrained rose emissive contribution on the selected/hovered vessel only. Original colour, emissive colour and intensity are restored when inactive. Texture maps and normal maps are retained. No bloom, extra lights, duplicated vessel surfaces or additional triangles are used.

The detailed heart context remains excluded from pointer raycasting. Pointer tests use the 11,308-triangle RCA. Shared highlight groups are explicit; accidental duplicate ownership outside a declared group is still rejected. Further vessels can use the same group schema without duplicating geometry or merging marker identities.

## Repeat the checks

Run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, and `npm.cmd run build -- --webpack`. The webpack build is the previously verified alternative to the environment's Turbopack worker startup issue.

With the development website at `http://localhost:3000`, run `node tests/rca-model-browser.mjs`. It uses the real installed GLB in an isolated browser context, blocks external requests and all AI endpoints, and saves screenshots/report under `artifacts/rca-test`. Development-only diagnostics verify the actual loaded material colours and visibility across both RCA primitives. Tests wait for the separate 3D render root, rather than assuming the DOM label and canvas update in the same frame.

`node tests/model-import-browser.mjs` runs the existing fixture-based loading, failure, retry, camera, marker and responsive checks without changing the installed manifest.

## Files and rollback

The source GLB is preserved. The previous active configuration is backed up at `artifacts/heart-scan-web/before-rca-test.heart-model.json`; its original served asset is also retained. To restore that model, copy the backup over `public/models/heart-model.json` and refresh. Keep the current tagged manifest backed up before doing so.

The current tagged manifest is also saved as `artifacts/heart-scan-web/rca-test.heart-model.json`. Future exports may remove the two unintended leading spaces in the Blender Empty names; inspect the new node inventory and update those two mappings accordingly. Replacing a GLB with the installer starts a fresh mapping, so retain this authored configuration separately.

Code changes: `lib/model-config.ts`, `lib/imported-model.ts`, `lib/scene-state.ts`, `components/ImportedHeart.tsx`, `components/HeartScene.tsx`, `components/ViewerDiagnostics.tsx`, and the small vessel-label style in `app/globals.css`. Tests: `tests/model-import.test.mjs`, `tests/explorer.test.mjs`, and `tests/rca-model-browser.mjs`. Installation adds the served GLB and its node inventory and updates `public/models/heart-model.json`.

No API keys, approved reference material, or AI backend configuration were changed. Tests do not make paid API calls.

## Verification record — 17 October 2026

- All 174 automated tests passed outside the Windows sandbox. The first sandbox run blocked two pre-existing temporary-file tests (symlink creation and file replacement); no test assertions were relaxed. The 31 model/explorer tests passed again after the final highlight appearance adjustment.
- TypeScript, ESLint, and the production build (`npm.cmd run build -- --webpack`) passed, including all nine generated pages and build tracing.
- The actual GLB browser suite passed with zero page errors, tagging warnings or external requests. It checked all three markers and original segment cards, both RCA material primitives, hover restoration, keyboard selection, isolation, unique exploration counts, direct surface hover/click, Reset View, three rotated views, and 390-pixel/768-pixel layouts.
- The existing model browser regression suite passed at six viewport sizes, including loading/failure/retry, marker/mesh selection, camera rotation/zoom, review availability, and the schematic fallback.
- The served asset and source have matching SHA-256 hashes. The complete model draws four primitives and 1,250,000 triangles; the local software-rendered browser checks are not a hardware performance benchmark.
