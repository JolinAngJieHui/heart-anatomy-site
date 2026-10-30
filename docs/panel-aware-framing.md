# Selected-marker camera framing

The existing React Three Fiber scene and free camera controls share one automatic animation controller. Educational content, all 17 stable anatomical IDs and anchors, meshes and the RAG backend are unchanged. See [Free heart navigation](heart-navigation.md) for the current pointer controls.

## Selection and measurement

Marker buttons and Heart Structures entries dispatch the same selection action. A selection revision also lets the learner reselect the same structure after manually changing the view. The camera reads the selected structure's world anchor from `ModelRegistry`.

`usePanelMeasurements` measures the viewer, information card and open tutor from browser rectangles. Obstacles are clipped into viewer coordinates. Desktop tutor panels reduce the viewer width; overlapping tablet/mobile tutor panels are measured as obstacles. Measurements are coalesced before painting and changes below half a pixel are ignored. The camera waits for matching, settled card and viewer measurements before starting a pan.

`clearFramingRegions` finds clear rectangles spanning panel edges. `planFraming` targets the centre of the largest clear region using the selected anchor. With no selection it centres the model bounds. The right-docked desktop card leaves a full-height corridor to its left; compact layouts use the existing bottom-sheet presentation and target the available region above/beside it.

## One coordinated animation

`HeartCamera` uses a full-size `PerspectiveCamera.setViewOffset` to translate the projected scene over 420 ms with smoothstep easing. A selection pan preserves world camera position, orientation, rotation target, distance, zoom and focal length. It does not modify meshes or anchor coordinates. Retargeting starts at the currently displayed position; no second camera-pan effect runs alongside it. Reduced-motion preferences apply the endpoint on the next frame.

The camera transition runs at frame priority -0.5, and marker projection follows at 0. Manual gestures read the live camera pose and cancel both pending and active movement. There is no residual inertia to compete with automatic transitions. Completion leaves the camera stationary; marker projection, chat text and learning-level changes do not schedule camera updates.

Reset clears selection, hover and isolation in the scene reducer, which closes the card and clears its highlight/leader. The same controller smoothly interpolates orbit orientation, target, distance and zoom to defaults and frames the unselected model in the current layout. Progress, learning level, saved history, conversations and tutor visibility are preserved.

## Stable information card and leader

`stable-card-layout.ts` docks the card independently of marker and model projection. This prevents camera movement from changing card position and triggering another camera movement. `FloatingStructureEducation` reuses the existing card and updates its leader from the displayed selected marker each frame. Hidden/offscreen markers hide the leader; far-side markers keep the dashed convention. Hover and keyboard tooltips remain. The selected-label pinning control and its state/styles have been removed.

## Exploration and history

Exploration count and milestone notifications live only in page memory. Refresh starts at 0 / 17; revisiting an ID does not increment it. Start New Session resets both count and milestones. The legacy `heart-anatomy:exploration:v1` entry is ignored without deleting it. Saved review sessions and conversations continue using their separate existing history; refresh does not overwrite or clear them. The explicitly confirmed Clear Saved History flow retains its existing purpose.

## Verification commands

Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`. With a local server running, use `EXPLORER_TEST_URL` to select its origin and run:

- `node tests/panel-framing-browser.mjs`: all 17 list and marker selections, intermediate animation positions, interruption/rapid selection, settled stability, leader attachment, orientation/zoom preservation, tutor, reset and six responsive sizes.
- `node tests/progress-browser.mjs`: refresh resets, unique selection counts, milestones re-earned, saved reviews preserved, new-session reset, unavailable storage and responsive progress.
- `node tests/browser-check.mjs`, `node tests/information-card-browser.mjs`, `node tests/tutor-browser.mjs`, `node tests/learning-session-browser.mjs`: existing explorer, card, tutor and saved-review regressions.

The camera suite writes `docs/stable-camera-framing-browser-report.json` and screenshots under `.next/cache/selection-*.png`. Report visibility is a conservative projected bounding-box fraction, not a silhouette measurement or anatomical accuracy score.

## Practical limits

At unchanged zoom, a peripheral marker centred in a very small viewing region can leave part of the heart outside the clear area. The controller prioritises the selected marker and does not force a large zoom-out. Closing panels or manually zooming restores more context. Extreme manual camera positions can still put anchors offscreen; list selection restores the chosen anchor to the clear area. Future animated/skinned GLB assets may need dynamic bounds support.
