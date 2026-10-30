# Vessel navigation and learning workflow — 21 October 2026

## Delivered

The explorer and quizzes use the corrected **17-marker `heart final labelled.glb`**, as confirmed by the user. The browser loads `/models/heart-024522f87aa6dbb0.glb` through `public/models/heart-model.json`. Original scan assets and the supplied GLB were not modified or decimated.

Sidebar selections and tutor navigation share one application action. Explicit navigation searches viewpoints against actual transformed mesh geometry using the existing BVH occlusion checks. Explorer selections preserve the current camera distance, lens zoom and orbit pivot, rotating to a visible location and panning its marker to the centre of the clear area beside the information card (above it on narrow layouts). They do not zoom out to fit the whole heart. The independent quiz camera retains whole-model fitting. Ordinary panel resizing and manual orbit do not repeatedly refocus the selected vessel. Mouse gestures, free rotation, Reset View, occlusion, rose exploration markers and original-texture isolation remain intact.

The quiz shows one question at a time, a compact navigator, a persistent Submit/Next area, green checks and red crosses, an explanation below the correct option, and compact final feedback. Desktop content scrolls internally where needed; mobile navigation is horizontal. Model questions load the actual scan with independent camera/material/selection state. Location questions use a neutral selection before submission; identification questions highlight only their target. Names/tooltips and information cards cannot reveal model-question answers. Asset bytes are cached within the tab, while each viewer owns its mutable resources.

## Grounded learning content

The authoritative active collection is `minimal-2026-10-14`: **11 approved references and 137 extracted original paragraphs**, version `3b4750c2fb52dd61449b810b2cdaf50bb7e1b94ce85b4eda284f6b8815884edc`. These are selected excerpts, not full articles. Retrieval searches across vessel categories. No Supabase or hosted vector index was introduced; no references were deleted or re-embedded.

A strict active-collection requirement removes obsolete runtime fallback retrieval. Historical collections, rollback records, licensing metadata and original assets remain preserved. Removed unused rendering code: `components/SchematicHeart.tsx`, `components/MarkerAnchors.tsx`, `lib/marker-anchors.ts`, and the schematic constants/loading branch. Model loading failures now show a retry state rather than substitute anatomy.

Reviews contain the actual explored structures, original questions, concise generated answer summaries, grounded takeaways and a restrained closing message. Full answers and citations remain available. Completed quiz concepts/results contribute to an updated review; viewing a structure is never treated as mastery. Navigation/workflow commands are excluded from substantive question summaries.

Review and quiz generation use the existing server-side OpenAI client and model settings. Each generation has a separate evidence-audit pass. Quiz questions are audited individually: unsupported or out-of-scope extras are discarded, retaining good questions without another generation loop. Structural checks enforce valid anatomy IDs, unique options, equivalent-synonym exclusion, source IDs/versions and stable answer keys. No model silently substitutes invented sources.

A retrieval defect discovered by live testing was fixed: two-letter CS mentions and anatomy headings now retain the actual coronary-sinus function passages. Exact sources cited in saved answers receive priority. The question/answer records remain unchanged. Review fingerprints now survive JSON property-order changes between browser and server.

## Requests, caches and fallback

- Obvious navigation commands, camera motion, panel opening, marker selection, scoring and feedback: **no OpenAI call**. Local navigation can still use the existing website endpoint for acknowledgement.
- Complex unambiguous navigation interpretation: at most one existing navigation-model call; ambiguous targets request clarification.
- Anatomy answer: one level-aware generation request, plus the existing citation audit when reference claims are proposed. Partial coverage separates cited statements from clearly labelled general knowledge; general-only answers need no citation audit. Local retrieval can expand for complementary targets or question clauses without a provider call. See [Tutor learning levels and answer provenance](tutor-learning-levels.md) for the current behaviour and checks.
- Requested new review: one generation plus one evidence audit. Requested new quiz: one generation plus one question-level evidence audit. There are no automatic provider retry loops.
- Identical in-flight requests coalesce. Bounded memory/sessionStorage caches retain original generated results, attempt order, choices and feedback. Reopening unchanged content does not regenerate it. Relevant activity, level or reference changes invalidate generation keys; an in-progress attempt remains stable until the student requests another quiz.
- Session data remains tab-scoped. Refresh restores the lesson and cached content; a fresh visit starts empty. Restart clears application content caches and aborts/invalidate pending work. Unrelated browser storage is preserved.
- API/validation/time-limit failures display an explicitly labelled basic review or source-based practice. The fallback uses actual recorded answers and approved source content; it does not pretend to be generated AI. A very limited session may have fewer questions or no suitable local question.

## Configuration and deployment

Keep credentials in the ignored `.env.local` locally and the NUS hosting platform's server-side environment/secret settings. Do not expose them as `NEXT_PUBLIC_` variables. The existing integration is configured and was exercised live with the user's authorisation; no key is included in this report.

Required live settings: `OPENAI_API_KEY`, `OPENAI_TUTOR_MODEL`, `OPENAI_NAVIGATION_MODEL`, `TUTOR_MODE=live`, `TUTOR_LIVE_ENABLED=true`, `LESSON_REVIEW_LIVE_ENABLED=true`, and `QUIZ_LIVE_ENABLED=true`. `.env.example` deliberately defaults all live gates to false. `LEARNING_GENERATION_TIMEOUT_MS=60000` allows generation plus auditing (maximum 120000); browser requests allow the server's full deadline. Existing request/day limits remain in force.

Production needs a compatible Node.js Next.js deployment, the model/public assets and the approved `knowledge-base` files. Configure the existing shared limiter with `TUTOR_REDIS_REST_URL` and `TUTOR_REDIS_REST_TOKEN`; static-only hosting cannot run these API routes. No additional feature implementation is needed, but the eventual hosting deployment itself has not been verified here.

## Verification

- 213 automated tests passed with the no-live-API guard. Includes model/ID validation, review fidelity, generation/audit contracts, rejected questions, API errors, cache reuse, source-version invalidation, abort/reset, source integrity and session persistence. The fixed-zoom follow-up also checks all 17 real anchors at three camera distances, two lens zooms, and desktop/mobile panel layouts, including near-plane clipping at close zoom.
- Fixed-zoom browser follow-up: all 17 list selections, direct marker selection, manual zoom/pan followed by selection, mocked tutor navigation with panels open, mobile marker centring and Reset View passed. The full free-rotation/pan/gesture browser regression passed again. Evidence: `artifacts/fixed-zoom-navigation/report.json` and `artifacts/heart-navigation/browser-report.json`. This follow-up made no live AI calls.
- Mocked browser workflow: all 17 sidebar targets visible after navigation, tutor PDA navigation, three quiz formats on the real scan, independent materials, no answer clues, correct/incorrect feedback, no regeneration when reopening an unchanged quiz, desktop/mobile layout, complete model framing, and Word download.
- Dedicated navigation browser regression: horizontal/vertical full rotations, upside-down rotation, right-drag pan, pan then orbit, pointer release outside viewer, click/drag separation, wheel/pinch/touch, Reset View and tutor transitions.
- Dedicated isolation browser regression: selected original materials fully opaque, surrounding transparency, hover suppression in isolation, restored normal hover, selection changes, keyboard and mobile controls.
- Word archive contents checked: recap sections and completed quiz feedback present.
- Live browser workflow: coronary sinus question with a traceable R11 citation; an AI-personalised recap; three generated quiz formats (function, highlighted vessel, marker location); local correct/incorrect feedback and final 2/3 test score. The wrong marker selection was intentional test activity.
- Earlier live checks exposed missing CS evidence and unstable review fingerprints; those defects were corrected. Unsupported drafts and timeouts showed the basic fallback. A rejected extra quiz concept motivated per-question auditing. Historical failure artifacts are retained as diagnostics, not represented as current passing results.
- Final ESLint, standalone TypeScript, `git diff --check`, and `next build --webpack` all completed successfully. The production build ran with live API gates disabled in that build process. One intermediate standalone typecheck overlapped a build rewriting `.next/types`; rerunning it after the build passed.

Artifacts: `artifacts/navigation-learning/browser-report.json`, `geometry-navigation.json`, `live-browser-verification.json`, `live-quiz.png`, quiz desktop/mobile screenshots and `quiz-review.docx`; regression reports under `artifacts/heart-navigation` and `artifacts/isolation`. Unit/lint/typecheck/build logs are `artifacts/navigation-learning-*.log`.

## Practical limits

RCA segments and left-main/LAD segments share whole-artery meshes. Those segments use their individual numbered anchors for location questions; a shared highlight cannot reliably identify a particular segment, so that ambiguous question is rejected. No marker positions were guessed or changed. Model loading/texture decoding is still substantial (approximately 46.8 MB and 1.283 million triangles); tests on this machine do not establish performance on every GPU. Students can zoom/rotate the quiz model. AI evidence checks do not replace academic review of educational content.

## Files changed in this work

- Viewer: `components/HeartExplorer.tsx`, `HeartCamera.tsx`, `HeartScene.tsx`, `PersonalisedQuiz.tsx`, `VesselSegmentChoices.tsx`, `SceneControls.tsx`, `StructureEducation.tsx`, `useHeartAsset.ts`, `useLearningSession.ts`, `LearningReview.tsx`; `lib/vessel-navigation.ts`, `load-heart-asset.ts`, `model-config.ts`, `heart-model.ts`; `app/globals.css`.
- Learning/API: `lib/learning/evidence-server.ts`, `lesson-review.ts`, `review-generation.ts`, `verify-content.ts`, `review-http.ts`, `review-client.ts`, `review-snapshot.ts`, `generated-quiz.ts`, `quiz.ts`, `quiz-generation.ts`, `quiz-personalisation.ts`, `quiz-http.ts`, `quiz-client.ts`, `content-cache.ts`, `session.ts`, `summary.ts`; `app/api/learning/quiz/route.ts`.
- Tutor: `lib/tutor/navigation.ts`, `routing.ts`, `service.ts`, `pipeline.ts`, `evidence-budget.ts`.
- Tests: new `tests/navigation-learning.test.mjs`, `navigation-learning-browser.mjs`, opt-in `navigation-learning-live.mjs`; updated `explorer.test.mjs`, `four-functions.test.mjs`, `lesson-review.test.mjs`, `quiz-routing.test.mjs`, `tutor.test.mjs`, `heart-navigation-browser.mjs`, `marker-anchor-audit.mjs`.
- Documentation/configuration: `.env.example`, `README.md`, this handover, historical-report pointer in `docs/four-chatbot-functions.md`.

## Confirmed active references

- **R1** — [Coronary Artery Anomalies: A Computed Tomography Angiography Pictorial Review](https://doi.org/10.3390/jcm13133920); status: approved.
- **R2** — [Right ventricular myocardial infarction: pathophysiology, clinical implications and management](https://doi.org/10.31083/j.rcm2204131); status: approved.
- **R3** — [Left Main Coronary Artery Disease: A Contemporary Review of Diagnosis and Management](https://doi.org/10.31083/j.rcm2502066); status: approved.
- **R4** — [Clinical Updates in Coronary Artery Disease: A Comprehensive Review](https://doi.org/10.3390/jcm13164600); status: approved.
- **R5** — [The diagonal branches and outcomes in patients with anterior ST-elevation myocardial infarction](https://doi.org/10.1186/s12872-020-01386-4); status: approved.
- **R6** — [Navigation of the Clinical Implications, Interventional Challenges, and Complexities of the Circumflex Coronary Artery: A Comprehensive Review](https://doi.org/10.31083/RCM47426); status: approved.
- **R7** — [Successful coronary angioplasty of a spontaneous occlusion of the conus artery causing a ST-segment elevation myocardial infarction and electrical storm](https://doi.org/10.1186/s42269-024-01247-6); status: approved.
- **R8** — [Imaging of the aortic root on high-pitch non-gated and ECG-gated CT: awareness is the key!](https://doi.org/10.1186/s13244-020-00855-w); status: approved.
- **R9** — [Optimal Management of Spontaneous Aortic Thrombus Floating in the Ascending Aorta, from a Single Case Experience to a Literature Review](https://doi.org/10.3390/jcdd12040146); status: approved.
- **R10** — [Review of evolving etiologies, implications and treatment strategies for the superior vena cava syndrome](https://doi.org/10.1186/s40064-016-1900-7); status: approved.
- **R11** — [Coronary sinus thrombosis: insights from a comprehensive literature review](https://doi.org/10.1186/s12959-025-00707-x); status: approved.
