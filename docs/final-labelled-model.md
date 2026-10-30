# Final labelled scan integration

Updated 19 October 2026 from `artifacts/heart-scan-web/heart final labelled.glb`.
Active URL: `/models/heart-024522f87aa6dbb0.glb`, selected by
`public/models/heart-model.json`. The supplied file is unchanged; the served copy
has the identical SHA-256:
`024522f87aa6dbb05463a18df944e62e7a10d3f3c6d6ee3da66ca1f03085feef`.

## What changed

The export contains 46,826,392 bytes, 1,283,381 triangles, 13 mesh objects,
26 material primitives and all 17 marker empties. Its four embedded 2048 x 2048
JPEGs and two materials are identical to the previous export. The overall bounds
and normalization are unchanged, preserving the upright Reset View preset.
No geometry, texture, lighting or camera code was modified for this replacement.

- **Right Marginal Artery (12):** uses the newly separated `right-marginal-artery`
  mesh and its new `marker-right-marginal-artery` empty.
- **Left Marginal Artery (14):** uses `left-marginal-artery` and its authored
  ` marker-left-marginal-artery` empty. These are the geometry and position the
  preceding export labelled right marginal; the revised names are respected.
  Marker 14 now supports hover, selection, isolation and occlusion normally.
  No missing-marker notice is needed.
- **Left main and LAD (5-8):** the previously confirmed combined mesh is now
  named `left-anterior-descending`. Its geometry, transforms and four marker
  positions are unchanged. The shared `left-main-and-lad` group still highlights
  the whole mesh and offers numbered choices 5-8, each with independent progress.
- **PDA (4):** remains mapped explicitly to `posterior-descending-artery.001`
  (`posterior-descending-artery001` after GLTFLoader name sanitization), the
  unchanged 5,367-triangle vessel.
- **Context heart:** the unsuffixed object `posterior-descending-artery` is the
  985,782-triangle main surface, previously named `Whole heart` with 995,159
  triangles. The new right marginal accounts for the remaining 9,377 triangles.
  Outside isolation it remains opaque background anatomy, blocks picking through the heart,
  and is never highlighted as PDA. Rename it to `Whole heart` in a future Blender
  export to remove the misleading label; no change is needed for this website.

Other mappings remain: RCA -> 1-3 (whole-vessel choices); D1 -> 9; D2 -> 10;
LCx -> 11; conus -> 13; ascending aorta -> 15; SVC -> 16; coronary sinus -> 17.
Twelve independently interactive vessel groups cover all seventeen stable IDs.
Leading whitespace in authored marker names is handled by the existing resolver.
Numeric suffixes are explicit and are not stripped or guessed.

## Marker placement

All 17 anchors resolve unambiguously and have exposed directions in the
264-view geometry audit. The new right marginal anchor is approximately
0.00088 normalized units from its own vessel; the left marginal is approximately
0.00150 units away.

The existing D1 surface correction is retained because its unchanged authored
empty sits slightly inside its own mesh. No new coordinates were invented.
The middle RCA anchor remains on adjacent tissue, approximately 0.051 normalized
units from its RCA mesh; that pre-existing Blender calibration issue remains.
The global occlusion tolerance is unchanged.

## Preserved behaviour

Outside isolation, hover remains mint (`#99f6e4`), selected vessels teal
(`#2dd4bf`), and explored markers rose. Each vessel's material primitives
highlight together while other vessels retain their original textures.
Full rotation, right-drag panning, zoom,
Reset View, learning levels, selection panels, progress and Tutor navigation
continue using the existing implementation. Teaching content and IDs are unchanged.

Separating the right marginal adds two draw calls (26 instead of 24), but adds
no triangles or textures. Existing BVH picking, occlusion and demand rendering
are reused; no new per-frame feature or rendering effect was added.

## Textured isolation

Isolate Structure restores the selected vessel's original colour, emissive
settings, texture maps and shading at 100% opacity across all its components.
Hover and selection do not tint it while isolation is active. The surrounding
heart remains visible at 20% opacity with its original textures.

Context renders first without depth writes; the selected vessel renders afterward
at full opacity with depth writes. Both use the ordered transparency pass, with
single-pass rendering to avoid extra draws for the scan's double-sided materials.
This keeps surrounding surfaces from covering the isolated vessel. Translucent
context cannot intercept vessel picking or occlude markers. Opaque anatomy
continues to block both outside isolation.

Clicking the isolated RCA or combined left main/LAD retains the current segment
instead of reopening segment choices. Catalogue and Tutor selections switch the
isolated vessel. Turning isolation off restores the original rendering settings
and normal hover/selection styling. Existing owned material clones are reused;
the source GLB and its materials are never modified.

## Verification

- `node tests/final-model-audit.mjs`: validates explicit ownership, both marginal
  anchors, context exclusion, surface distances and visibility across 264 views.
  Writes the proposed configuration and audit under `artifacts/final-model/`.
- `node tests/final-model-browser.mjs`: checks actual surface hover/click,
  per-vessel material restoration, whole-vessel choices, all markers, learning
  levels, unique exploration, multiple viewing angles and mobile layout.
- `node tests/heart-navigation-browser.mjs`: checks rotation, panning, zoom,
  marker click-versus-drag, mobile touch, Reset View and mocked Tutor navigation.
- `node tests/final-model-inspect-browser.mjs`: verifies isolated PDA, conus,
  right marginal and left marginal retain their original opaque material
  primitives with translucent context.
- `node tests/isolation-browser.mjs`: checks original materials, full opacity,
  translucent context, actual surface hover/click, grouped-vessel isolation,
  repeated toggles, rotation, mocked Tutor navigation, Reset View, keyboard and
  mobile interactions on the supplied scan.
- `npm.cmd test`: includes projecting every vertex of the active scan to verify
  that the upright reset preset fits desktop/mobile aspect ratios.
- `npm.cmd run typecheck`, `npm.cmd run lint`,
  `npm.cmd run build -- --webpack`.

The model integration checks passed on 19 October 2026: 192 automated tests, all 17 markers,
all 12 vessel groups, isolation, desktop/mobile navigation, TypeScript, ESLint
and the production build. The browser requested only the newly versioned GLB
and reported no page errors.

After the isolation update, all 194 automated tests, the dedicated isolation
browser check, navigation browser regression, TypeScript, ESLint and production
build passed. The isolation check reported no page errors or external requests;
screenshots and its report are under `artifacts/isolation/`.

Browser checks block external requests and mock AI endpoints. No live or paid
AI calls are required. Current reports/screenshots are under
`artifacts/final-model/` and `artifacts/heart-navigation/`.
The source comparison is `artifacts/final-labelled-update/file-comparison.json`.

## Rollback and files

The preceding manifest is preserved at
`artifacts/final-labelled-update/before-heart-08bd2807cd1ac6ee.json`.
The previous GLB remains on disk for rollback and is not rendered alongside the
replacement. The content-hashed asset URL prevents reuse of stale model bytes;
the manifest is fetched without caching when the website loads.

Updated files: the active manifest, versioned GLB and inventory;
`tests/final-model-audit.mjs`, `tests/final-model-browser.mjs`,
`tests/final-model-inspect-browser.mjs`; this document and generated evidence.
