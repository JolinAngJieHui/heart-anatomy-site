# Adding the finished heart model

## Installed scan — 17 October 2026

The main explorer now uses the user-selected `artifacts/heart-scan-web/heart-scan-full-geometry.glb`, copied unchanged to `public/models/heart-63a763d7f09821f6.glb` and activated in `public/models/heart-model.json`. SHA-256: `63a763d7f09821f6e4014329fd9269f560248e6b3e54d94c7c88685d5beb415e`. The file is 15,869,960 bytes and retains all 2,500,020 triangles. Its textures are embedded, and Draco decoding files and licences are served locally from `public/models/draco/`.

The exported orientation is retained. `Heart_Scan` is one untagged mesh definition; no placeholder marker positions or vessel ownership were copied onto it. The 17-item anatomy list, teaching levels and learning activity remain available. Vessel markers and separate vessel isolation require the later tagging/segmentation work described below. The schematic remains an explicit loading/error fallback and the basis for existing schematic identification quizzes.

Installation verification: the source and deployed copy have matching SHA-256 hashes; all eight model-import tests passed; the actual asset rendered in the browser at desktop and 390 × 844 mobile size with no horizontal overflow. Rotation, zoom, Reset View, list selection, progress and learning-level switching were checked. No AI calls were made. The original GLB was not modified.

The viewer accepts a **single self-contained GLB (glTF 2.0)**. Vessel tags are optional: the finished heart can be rotated and zoomed immediately, while the structure list, learning levels, tutor, review and session tracking remain available. No API key or AI request is involved in model loading.

## When the GLB arrives

From the project folder in PowerShell:

```powershell
npm.cmd run model:inspect -- "C:\path\to\finished-heart.glb"
npm.cmd run model:install -- "C:\path\to\finished-heart.glb"
```

Then refresh the local website. These commands do not change the original file. The installer checks the binary container, dependencies and supported extensions; copies the asset to a content-versioned filename in `public/models`; writes a node inventory beside it; and activates it in `public/models/heart-model.json`. No component edits are needed. Rendering is checked again in the browser; a preflight pass is not a scientific or complete glTF conformance review.

If replacing an asset, the previous configuration is backed up under `.next/cache/model-import`. A different model starts with no tags because old coordinates may be wrong. Reinstalling identical bytes retains its tags and rotation. Existing model files are retained so you can revert the manifest. Keep a separate backup of authored tags: `.next` is disposable build cache.

To return to the original schematic, set `url` to `null` in `public/models/heart-model.json` and refresh. To deploy, include **the whole `public/models` folder** with the application before building/deploying. For Next standalone hosting, copy `public` alongside the standalone server as part of deployment. Do not upload only the GLB while omitting its manifest or optional decoder folder.

## Export checklist for the modeller

- Export the intended scene as **glTF Binary (.glb)**, with geometry and PNG/JPEG textures embedded. Export the heart and required vessels; exclude construction helpers, enormous background planes and unwanted objects, since all geometry contributes to sizing.
- Aim for a web version below **20 MB** where practical; the importer rejects files over **100 MB**. These are project limits, not a guarantee of smooth performance. Simplify excessive polygons and large textures before export; keep the full-resolution master separately.
- Use a static, anatomically reviewed pose. Animation playback is not enabled. Existing materials, textures, transparency and node transforms are retained; the viewer supplies its own lights.
- Plain GLB, Meshopt geometry compression and Draco geometry compression are supported. The installer supplies local Draco decoders only when required. No decoder CDN is used. KTX2/Basis, WebP/AVIF texture extensions and other unlisted extensions are refused with an explanation; use embedded PNG/JPEG for this handoff.
- Separate vessel meshes are **not required to display the model or place markers**. They are required to independently highlight/isolate those vessels. A single fused heart mesh cannot acquire separate vessel geometry through tagging.
- If possible, give vessels and groups unique stable names using letters, numbers and underscores, for example `RCA_Proximal`. Renaming or rebuilding nodes after tagging can invalidate mappings. Names in the inventory's `lookupName` field match the loader's normalized names when there are no duplicates; resolve duplicate names in the authoring file first.
- Include model authorship, permission/licence and any required attribution with delivery. The importer does not infer rights or anatomical accuracy from a file.

The viewer automatically centres and uniformly scales the model to fit its existing camera range, regardless of source units. It does not mirror anatomy or guess anterior orientation. If required, edit `rotationDegrees` in the manifest (XYZ Euler rotation in degrees), refresh, and inspect the result. Keep a known anterior reference from the modeller for this check.

## Add vessel tags later

`lib/heart-parts.ts` remains the source of the 17 stable IDs, names and teaching numbers. Education, progress and tutor context use those IDs; do not rename them to match mesh names. `lib/marker-anchors.ts` now applies **only to the schematic**. Its approximate positions are never reused on an imported heart.

Edit `structures` in `public/models/heart-model.json`. This example illustrates the format only; the node name and point must be replaced with your verified model data:

```json
{
  "version": 1,
  "url": "/models/heart-REPLACE_WITH_INSTALLED_HASH.glb",
  "rotationDegrees": [0, 0, 0],
  "structures": {
    "right-coronary-proximal": {
      "meshes": ["RCA_Proximal"],
      "anchor": { "node": "RCA_Proximal", "position": [0, 0, 0] }
    }
  }
}
```

`meshes` names may refer to individual meshes or groups containing multiple meshes. `anchor.position` is in that node's **original local coordinates**, before the website's automatic scaling and centring. Omit `anchor.node` to use the exported scene root's local coordinates. This makes a marker possible on a fused model: use `meshes: []` with an approved root-local point.

Mesh selection and marker placement are independent. A mapping without an anchor supports mesh picking/highlighting/isolation but shows no numbered marker. An anchor without mapped meshes shows a marker and supports marker-only isolation while retaining context geometry. Untagged structures remain available in the list, but their isolation control is disabled. Selecting them opens the existing teaching card without a fabricated leader line. Partial tags are supported.

Missing/duplicate node names are skipped with diagnostic warnings. Meshes assigned to more than one structure are excluded from picking/isolation rather than arbitrarily choosing a vessel. Verify every point and segment boundary against the actual anatomy before using the tags for teaching. Anatomical approval remains human work; the website does not automatically identify vessels.

Identification quizzes deliberately retain their explicitly labelled schematic until questions are reviewed against final-model tags. They do not silently test unplaced final-model markers. Other source-based practice is unchanged.

## Active scan and viewer update — 17 October 2026

The active asset is now `public/models/heart-8a8836115ed74c29.glb`, served as `/models/heart-8a8836115ed74c29.glb` through `public/models/heart-model.json`. It is a byte-identical copy of `artifacts/heart-scan-web/heart-scan-1250k.glb` (SHA-256 `8a8836115ed74c296758d6fb0c1f71eaaddeb6af4b2ff5f7fc2c5ba4fd8b862f`). The source was not modified or further decimated. Deploy the full `public/models` directory, including the local Draco decoder. The previous GLB is retained on disk but is not rendered alongside this replacement.

Inspection of the actual GLBs, rather than their names, found:

- Previous asset: 15,869,960 bytes, 2,500,020 indexed triangles, 1,453,054 vertices across two primitives.
- Replacement: 11,715,828 bytes, 1,250,000 indexed triangles, 777,897 vertices across two primitives; two draw calls in the browser. Its position bounds before the exported node rotation span approximately 0.179224 × 0.155873 × 0.114133 author units. Author units are not assumed to be anatomical measurements.
- Both have the same four embedded 2048 × 2048 JPEG images (two photographic colour maps and two normal maps), verified by individual image hashes, and the same two double-sided materials: metalness 0, roughness 0.75, specular factor 0.4. Positions, normals and UVs are supplied. No normals or textures were regenerated.
- Decoded accessor payloads fall from 76,497,968 to 39,892,704 bytes. These are geometry buffer estimates from accessor metadata, **not** total browser/GPU memory. The four RGBA textures alone require approximately 64 MiB before mipmaps; texture memory is intentionally unchanged.

The existing GLTF loader retains the exported orientation, recentres the scan on the orbit target and uniformly normalizes its bounding-sphere diameter to 3.4 viewer units. Initial import and Reset View fit that sphere with a margin for the viewport aspect ratio. Ordinary selection and panel opening retain the existing optical pan and camera orientation/distance. Reset View still closes the anatomical information card.

Lighting was changed and visually checked on the full-geometry heart **before** installing the replacement, then checked on the replacement from the initial view, opposite side, both lateral directions, above and below. Ambient plus neutral hemisphere illumination and two shadow-free directional lights provide fill and shape; the main light follows the viewing angle. sRGB output, ACES tone mapping and exposure 1 are explicit. Photographic colours, material roughness and normal maps remain intact. Some dark creases and cavities are already present in the photographic colour maps; lighting cannot reconstruct detail absent from those photographs.

Performance changes:

- Untagged scan geometry no longer participates in pointer raycasting. Partially tagged models retain picking only on explicitly mapped meshes; HTML markers remain independent.
- Render only when the scene changes, the user rotates/zooms or a camera transition is active. Panel measurements explicitly wake the renderer. Residual orbit damping finishes before returning to idle, preventing later selections from restarting rotation.
- Limit device pixel ratio to 1.5, reducing pixel work by about 44% on devices that previously used DPR 2, without downscaling embedded textures.
- Throttle download progress updates to at most ten intermediate updates per second, plus completion. The existing single-load lifecycle, versioned URL and disposal behaviour remain in place.
- No shadow maps, post-processing, remote environment maps or additional dependencies were added.

The local browser preview measured about 16.6 ms median and 18.7 ms p95 intervals during a replacement-model rotation (120-frame sample). Its render-frame counter remained unchanged while idle. These are development-browser observations on this computer, not guaranteed performance on all phones. The old idle viewer already reached roughly 60 FPS; the avoidable work was continuous rendering and triangle-level picking of a scan with no pickable vessels. Initial loading separately includes downloading and Draco decoding; the smaller transfer does not establish a universal loading-time improvement.

**Tagging remains an authoring task for all 17 markers.** Neither scan contains reviewed vessel segmentation or anchor positions. The manifest deliberately has `structures: {}`. All existing stable IDs, numbers, learning levels, information panels and progress remain available through the structure list. Do not reuse the schematic's approximate coordinates on this scan. Mesh isolation will require reviewed segmented geometry; marker-only tagging can use reviewed points on the fused scan. No anatomical calibration is claimed by the rendering checks.

Changed implementation files: `components/HeartLighting.tsx`, `HeartScene.tsx`, `HeartCamera.tsx`, `HeartAnnotations.tsx`, `ImportedHeart.tsx`, `ViewerDiagnostics.tsx`, `usePanelMeasurements.ts`; `lib/heart-model.ts`, `imported-model.ts`, `load-heart-asset.ts`, `panel-framing.ts`; `public/models/heart-model.json`, the new GLB and its inventory; model unit/browser checks, the schematic fixture in the panel-framing browser check, and a session-browser popup readiness wait. ViewerDiagnostics is development-only and makes no network requests.

Validation for this update: TypeScript, ESLint and all **153 automated tests** passed. The model browser suite passed its loading, tagged-fixture picking/isolation, idle-rendering, DPR, six-size layout and failure/retry checks. The camera suite passed all 17 schematic marker selections, manual rotation/zoom, panel movement, keyboard/reduced-motion interaction and six viewport sizes. The mocked session suite passed persistence, conversations, restart/late responses, review caching, quiz and Word-export checks with zero external API calls. The supplied GLB itself was visually checked in the local browser, including mobile framing and all viewing directions. A saved close inspection is at `artifacts/heart-scan-web/heart-1250k-installed.jpg`.

The default Turbopack production build failed while starting its CSS-processing worker ("node process exited before we could connect to it"), both in and outside the restricted Windows environment. The supported alternative, `npm.cmd run build -- --webpack`, **completed successfully**, including compilation, TypeScript, all eight static pages and build tracing. Use this verified build command if the same Turbopack worker issue occurs during deployment. The package's default build script was not changed. Do not describe the default Turbopack build as passing.

## Loading and recovery

The existing workspace opens without waiting for the model. The manifest is checked once per viewer mount; a configured GLB loads asynchronously with download feedback and a 60-second timeout. The original schematic remains available during loading and on failure, with a visible explanation and **Retry model**. A successful imported model never inherits schematic anchors. Review opening keeps the main viewer mounted, so it does not redownload the model. Versioned asset filenames prevent an older cached model from being reused after replacement.

A malformed manifest, failed download, unsupported GLB or empty geometry falls back to the schematic without clearing learning activity. Reloaded/restarted viewers cancel pending downloads and dispose their model resources. No unrelated files or browser history are sent anywhere.

## Checks before release

Run `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd test`, and `npm.cmd run build`. With the dev server on port 3000, `node tests/model-import-browser.mjs` exercises synthetic untagged/partially tagged GLBs, loading/failure/retry, selection, camera controls and responsive layouts. It intercepts the manifest/model requests inside an isolated browser context; it does not activate a test asset on the real website or call paid APIs.

The actual finished GLB still needs a visual check for orientation, materials, texture appearance, speed on target devices, and anatomical placement once supplied. No new loader feature development is required for a compatible self-contained GLB; vessel tagging is a separate remaining authoring task.

Verified on 2026-10-16: **147 automated tests**, TypeScript, ESLint and the production build passed. The model browser checks passed at six viewport sizes, including actual synthetic GLB rendering, partial tags, mesh picking, keyboard interaction, isolation, reset, rotation/zoom and failed-load retry. The existing session browser workflow also passed, including refresh/restart, conversations, late responses, review and Word export. Browser checks reported no page errors or paid/external API requests. Synthetic boxes are test fixtures only; no anatomical model has been installed or approved by these checks.

Files involved: `public/models/heart-model.json`; `scripts/heart-model.mjs` and its licence file; `lib/model-config.ts`, `lib/glb-file.mjs`, `lib/load-heart-asset.ts`, `lib/imported-model.ts`; `components/useHeartAsset.ts`, `ImportedHeart`, `HeartScene`, `HeartCamera`, `HeartAnnotations`, `HeartExplorer`, `SceneControls`; the model registry and schematic configuration comments; the model status CSS; package scripts and decoder lint exclusion; model unit/browser fixtures and the session browser checkpoint wait. Teaching content and AI backend behaviour were not changed.

Implementation references: [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html), [Drei GLTF documentation](https://drei.docs.pmnd.rs/loaders/gltf-use-gltf). The installed Next.js public-folder and client-component guides were also checked. Local Draco files are copied unmodified from the installed Three.js package with its upstream README and an Apache 2.0 licence copy.
