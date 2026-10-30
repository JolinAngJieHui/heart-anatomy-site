# Stable whole-heart framing

The explorer starts with no selected structure and the tutor closed. Saved exploration progress is restored without automatically selecting a vessel or opening an information card.

Marker and sidebar selections update the anatomical information and leader line; they no longer request a camera pan. `scene-state.ts` only emits camera requests for explicit reset/zoom controls. `HeartCamera.tsx` removes selection-following, 400 ms framing animations and saved-composition restoration. It performs one instantaneous off-axis projection adjustment when a meaningful measured panel/viewport layout changes, or after an explicit reset. A layout already centred needs no adjustment.

`panel-framing.ts` finds the largest clear rectangle between actual panel edges (including the full-height corridor beside inset panels) and centres the whole heart's projected visible-mesh bounds in the largest clear region. Marker positions do not influence the chosen centre. Camera position, orbit target, orientation, focal length and zoom remain unchanged on panel events. Heart meshes and anatomical anchors are untouched. Bounds are conservative projected geometry boxes, not exact silhouettes. Very small viewing areas can still clip a large heart; this implementation preserves the user's zoom instead of automatically shrinking it.

`usePanelMeasurements.ts` coalesces DOM observations into a frame rather than waiting 180 ms. Significant changes use a 10 px threshold, while panel open/close states always register. `FloatingStructureEducation.tsx` sets its initial dock position in a layout effect; its stable docking key still excludes selection and camera motion. Its leader line continues updating from projected markers. The workspace grid transition is removed so tutor toggles do not generate a stream of intermediate camera layouts.

Once framed, the camera does not follow model rotation, marker selection, reading/scrolling or learning-level changes. Manual OrbitControls interaction cancels pending automatic framing and retains normal damping. A subsequent meaningful panel or viewport change uses the user's current orientation and zoom.

Validation:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
node tests/panel-framing-browser.mjs
$env:EXPLORER_TEST_URL = 'http://localhost:3000'
node tests/progress-browser.mjs
```

Browser checks use the existing local development server and bundled Playwright/Chrome. They cover closed initial panels, one-shot opening/closing, unchanged camera pose and projection offset across repeated selections, tutor/card combinations, leader lines, manual zoom and rotation, and responsive centring. The progress check covers saved progress, achievements, card selection and full-screen layouts. The server hostname is `localhost` to respect Next.js development-origin checks.
