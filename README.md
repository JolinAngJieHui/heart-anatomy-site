# AnaBuddy

An AI-assisted 3D heart anatomy teaching platform built with Next.js, React,
TypeScript, React Three Fiber and Three.js.

- **Use the website:** https://anabuddy.vercel.app/
- **Source repository:** https://github.com/JolinAngJieHui/heart-anatomy-site

Examiners can use the hosted website without installing software, signing in or
providing an API key. Running a separate local copy with live AI requires the
reader's own server-side API credentials; the owner's credentials are not part
of this repository.

## Implementation guide for examiners

- **AI Anatomy Tutor and model navigation:** `components/AnatomyTutor.tsx`,
  `app/api/tutor/route.ts`, `app/api/chat/route.ts`, `lib/tutor/` and
  `lib/vessel-navigation.ts`.
- **RAG and approved references:** `knowledge-base/active-collection.json`,
  `knowledge-base/approved/minimal-2026-10-14/`,
  `lib/knowledge-base/minimal.ts`, `lib/tutor/retrieval.ts` and
  `lib/tutor/evidence-budget.ts`. The active collection has 11 approved sources
  (R1–R11) and 137 extracted passages. Retrieval is local and deterministic;
  Supabase, embeddings and a hosted vector database are not required.
- **Personalised lesson reviews:** `components/LearningReview.tsx`,
  `components/LessonRecap.tsx`, `app/api/learning/review/route.ts` and
  `lib/learning/review-generation.ts`.
- **Personalised quizzes and feedback:** `components/PersonalisedQuiz.tsx`,
  `app/api/learning/quiz/route.ts`, `lib/learning/quiz-generation.ts` and
  `lib/learning/quiz-evidence.ts`.
- **Session records and Word export:** `components/useLearningSession.ts`,
  `lib/learning/session-store.ts` and `lib/learning/word-export.ts`.
- **Labelled heart and interactions:** `public/models/heart-model.json`, the
  active GLB it references, `components/HeartScene.tsx`,
  `components/ImportedHeart.tsx` and `components/HeartAnnotations.tsx`.
- **Tests:** `tests/`. The normal test command blocks live OpenAI requests and
  uses mocked provider responses.

The repository includes the active model, source-attributed reference excerpts,
configuration template and tests. Historical reference records are retained for
provenance and migration regression tests; only the active collection is used
by the live tutor. Source excerpts and third-party decoder files retain their
individual licence notices. Public availability does not grant a new licence
for the specimen model or other project material. Local credentials, original
scan exports, personal report documents and generated browser recordings are
excluded.

Local retrieval relevance: [implementation and before/after testing](docs/local-retrieval-relevance.md).

Current implementation and verification: [Vessel navigation, reviews and quizzes](docs/navigation-learning-handover.md). The active collection is `minimal-2026-10-14`: 11 approved references, stored as 137 selected original paragraphs. Historical source-management reports describe superseded collections; their provenance and licensing records remain archived.

A full-screen coronary artery and vein teaching app using Next.js, React Three Fiber and Three.js. The 17 teaching numbers and names follow `Coronary arteries.docx`; they are not standard angiographic segment numbers. The corrected labelled GLB supplies the actual heart geometry, vessel groups and all 17 authored marker anchors.

## Local preview and checks

The AI Anatomy Tutor uses approved local retrieval and the existing server-side OpenAI integration. `.env.example` defaults to reference review with live generation disabled. Follow [current setup and verification](docs/navigation-learning-handover.md) for the explicit live gates and production hosting requirements.

Use Node.js 24.x and the included lockfile. Run `npm ci`, copy `.env.example` to
`.env.local`, then run `npm run dev -- --hostname 127.0.0.1`. Open
http://127.0.0.1:3000. On PowerShell, use `npm.cmd` if needed. The example keeps
paid AI generation disabled. To enable it in a separate installation, follow
the linked setup guide and explicitly configure the API key, supported models
and live-feature gates. Never commit `.env.local` or expose keys through
`NEXT_PUBLIC_` variables. The first production build may need network access
for Geist fonts.

```sh
npm run typecheck
npm run lint
npm test
npm run build -- --webpack
```

Optional browser QA lives in `tests/browser-check.mjs`. Install isolated tooling with `npm install --prefix .next/cache/browser-tools --no-save --package-lock=false --ignore-scripts playwright`, start the production app on port 3100, and run `node tests/browser-check.mjs`. This keeps the application's locked dependencies unchanged. Run `node tests/information-card-browser.mjs` for card reuse, leader-line tracking and overlay interaction checks. The scripts use installed Chrome on Windows and software WebGL. It checks all 51 rendered explanations, every numbered marker, keyboard selection, camera controls and six viewport sizes.

## Interactions

- Hover or focus a marker to see its full name and synchronised sidebar feedback. Click either a marker or a sidebar entry to select it. The sidebar scrolls the selected entry into view.
- The workspace header holds the Basic, Intermediate and Advanced controls. Explanations preserve selection, camera commands, isolation and the explored count. Exploration is derived from the current tab’s session: refresh restores the count and rose markers without replaying milestones, while a fresh visit starts empty. Activity stays in memory with a sessionStorage refresh checkpoint; opening the viewer never waits for a shared storage lock or old archives. Restart Session clears this lesson; Reset View only resets the camera and selection.
- Show/Hide Markers changes marker visibility without clearing selection. Hover and keyboard focus still reveal marker names.
- Left drag to rotate freely through 360°; right drag to pan; scroll or pinch to zoom. Reset view smoothly restores the default camera and clears selection, highlight, isolation and the information card, preserving progress and tutor visibility. Explicit vessel navigation searches the actual geometry for a visible viewpoint, then rotates and frames the heart within the clear area in a 420 ms transition. Ordinary panel resizing preserves the viewing angle. Manual interaction interrupts the transition. See [framing implementation and verification](docs/panel-aware-framing.md).
- Isolate Structure keeps the selected vessel fully opaque with its original materials and textures while other geometry is 20% opaque. Hover/selection colours remain disabled on the isolated vessel. Switching it off restores normal highlights.
- Shared RCA and left-main/LAD meshes offer numbered segment choices. A shared whole-artery highlight never claims to identify an individual segment.
- The original information card follows the selected marker with a projected leader line. It docks on the right of the viewer on desktop and uses a bottom overlay on smaller screens; close it to uncover the list underneath. The line disappears when markers are hidden or the selected anchor is offscreen, while the card remains readable.
- The page uses the dynamic viewport height with independent list and explanation scrolling. Narrow screens use stacked panels; short landscape screens use side-by-side panels.

## Data and final-model integration

**Ready for your GLB:** run `npm run model:install -- "path/to/finished-heart.glb"`, then refresh. Vessel tags can be added later. See the [model handoff guide](docs/model-handoff.md) for export settings, tagging, orientation, deployment and checks.

- `lib/heart-parts.ts`: stable IDs, exact names, categories and teaching marker numbers.
- `lib/education.ts`: 51 separately authored explanations, blood-flow routes and reference URLs. References are displayed in each explanation panel.
- `lib/heart-model.ts`: vessel accent colours and the established Reset View camera preset.
- `lib/model-registry.ts`: structure-to-object and local-anchor contract used by the camera and marker projector.
- `ExplorationProgress` and `lib/exploration-progress.ts`: inventory-based progress bar, configurable milestones, notifications earned once per tab session. Run `node tests/progress-browser.mjs` to check refresh, milestones and responsive progress controls.
- `lib/scene-state.ts`: selection, hover, isolation, visibility, learning level, session progress and camera requests.
- `lib/marker-layout.ts`: compact marker collision handling independent of anatomy and rendering.
- `public/models/heart-model.json`: runtime GLB selection, orientation and optional per-structure tags. The importer activates a versioned asset and saves its node inventory.
- `useHeartAsset`, `lib/load-heart-asset.ts`, `lib/imported-model.ts` and `ImportedHeart`: validated asynchronous loading, resource cleanup, centring/sizing, named-node picking, real-mesh highlighting and explicit anchors. Missing assets show an explicit loading/error state and retry control; no schematic substitution is used.
- `HeartAnnotations`: per-frame projection, numbered buttons, tooltips and anchor leader lines.
- `StructureCatalog` and `StructureEducation`: grouped anatomy navigation and unchanged learning content rendering.
- `LearningLevelControls`, `FloatingStructureEducation`, `lib/information-card-layout.ts`: header learning controls and viewport-constrained positioning of the single existing information card.
- `HeartCamera`, `SceneControls`, `SceneBoundary`: camera controls and graphics fallback.

Use the model installer above instead of editing a component or reusing placeholder anchors. An untagged model supports orbit/zoom and list-based study immediately; optional tags enable numbered markers and named meshes enable picking/highlighting/isolation. The registry supports multiple meshes per structure. Educational content, numbers and selection IDs require no changes. Main and quiz viewers use the same served scan and mapping, with independent material, selection and camera state. Asset bytes are reused within the tab.

## Anatomical qualifications

The PDA is grouped with the RCA for an illustrative right-dominant arrangement, not a diagnosis of dominance. Its origin can be the LCx. Left Coronary Artery means the left main trunk. Left Marginal Artery is an obtuse marginal branch of the LCx. Segment boundaries, diagonal sizes, nodal supply and perfusion territories vary; the apical LAD entry is an educational distal-region label. The teaching labels do not establish patient-specific supply or dominance.

The supplied descriptions were expanded and qualified using the linked anatomy and clinical references in `lib/education.ts`. The source's unconditional statements about dominance, nodal supply, LAD size and outcomes were not carried forward. The explanations are educational summaries, without treatment instructions or fixed predictions of clinical outcome.

## Model and evidence limits

Markers use authored surface anchors and actual-geometry occlusion. Hidden markers retain their IDs and explored state but cannot receive pointer or keyboard input. Shared RCA and left-main/LAD meshes support whole-branch highlighting and individually numbered marker-location questions; they cannot support segment-specific highlighted-mesh identification.

The approved collection contains selected excerpts, not complete articles. The tutor prioritises those sources and can supplement them with clearly labelled general AI knowledge. Reference claims retain their citation check; general explanations have no invented citations and are not treated as verified evidence for reviews or quizzes. Answers that cannot be given reliably acknowledge uncertainty. See [learning levels and answer provenance](docs/tutor-learning-levels.md). AI validation is a safeguard, not a substitute for academic review. The 46.8 MB detailed model still needs capable WebGL hardware; a new quiz viewer may take time to decode its independent GPU resources.

Lesson review implementation, no-cost testing, and future API activation: [Lesson review setup](docs/lesson-review-setup.md).

## RAG and model routing

See [the current handover](docs/navigation-learning-handover.md) for routing, generated content, caching and verification. [Four chatbot functions](docs/four-chatbot-functions.md) records the earlier implementation. The earlier [RAG handover](docs/rag-routing-handover.md) retains the 11-source audit. No Supabase or hosted vector index is required.
