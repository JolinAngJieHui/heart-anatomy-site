# Viewer navigation and review–quiz workflow

Implemented against the current production model and existing application architecture, 23 October 2026.

## Behaviour

- A submitted student message resolves its first supported vessel name or alias. Whole RCA/LAD names use the model's existing shared mesh groups and segment-choice panel; the application does not invent segment boundaries or silently choose a segment.
- Sidebar, marker and chatbot selection use the same scene selection transaction. Navigation uses the installed geometry, registry and marker anchors, independently of article retrieval.
- The viewer waits for committed selection, the rendered camera transition and the corresponding information panel. Its receipt identifies the command, requested ID, model availability, camera/panel confirmation, and success/failure/interruption. This is application state, not image-based visual inspection.
- The receipt accompanies the anatomy request and is retained with the chat reply. Navigation-only confirmations use the actual receipt without a model generation call. Unsupported or ambiguous names need clarification. Student messages alone can initiate automatic navigation; assistant replies and restored conversations cannot replay it.
- A message ID is consumed once by the action ledger. Local recognition and a returned server proposal cannot both execute. During review/quiz, viewer navigation is disabled and the model workspace is hidden; quiz model picking remains independent assessment input.
- Isolated selections retain their original appearance, including whole-vessel groups. Normal selected/hover highlighting resumes outside isolation.
- The workspace toolbar is hidden and inert throughout review and quiz loading, questions, results and error states. Dedicated return controls restore the existing model/session. Hidden model rendering pauses without disposing the model or replacing the camera; zero-size hidden layouts do not reframe it.
- Review opening captures the session and learning level. The selected level and explicit language/depth instructions are included in generation. Reopening after relevant activity or completed results refreshes automatically; unchanged content, evidence and level reuse the content-addressed cache. There is no Update review control or generation on every interaction.
- Every quiz entry point opens the same workspace directly. A successful quiz has exactly five validated, source-supported questions at its captured level. A specific-vessel request restricts assessed IDs to that vessel's registered scope. Invalid or incomplete sets produce recovery rather than fewer questions or filler.
- Questions, keys, explanations, choices and attempt level are recorded locally. Grading, question navigation and existing feedback remain local. Reopening an in-progress generation/attempt reuses its generation ID and cached work. Explicit new attempts/retries create new work.
- Return to summary captures the newly completed results and refreshes once. Recorded prompts, submitted answers, correct answers, explanations, levels and attempt IDs reach the summary request. The latest attempt is identified separately from historical results. Unanswered questions do not establish misconceptions; a short quiz does not establish mastery.
- General AI information has the exact requested notice after the relevant content in small, muted, readable text. Reference citations remain separate. Quiz generation still requires approved evidence and a separate answer/distractor audit; unsupported general-knowledge questions are not accepted.
- The revision-topic button and its callback were removed. Historical revision events remain readable for compatibility with existing saved sessions.

## Important files

- `components/HeartExplorer.tsx`: captured review context, shared viewer execution, structured completion receipts, toolbar visibility and model suspension.
- `components/AnatomyTutor.tsx`: first-vessel recognition on submission, one execution per message, receipt round trip, shared quiz requests and accurate failure display.
- `lib/tutor/routing.ts`, `viewer-execution.ts`, `schema.ts`, `types.ts`, `service.ts`, `generation.ts`: canonical resolution, receipt validation, navigation-only replies and viewer context for teaching requests. RAG no longer selects an inferred viewer target.
- `components/HeartCamera.tsx`, `HeartScene.tsx`, `usePanelMeasurements.ts`: camera completion reporting and pausing hidden rendering without disturbing camera/layout state.
- `lib/scene-state.ts`, `lib/imported-model.ts`, `components/ImportedHeart.tsx`, `SceneControls.tsx`: preserve group isolation and original materials.
- `components/LearningReview.tsx`, `PersonalisedQuiz.tsx`: automatic review refresh, fixed-level direct quizzes, local attempts and results-to-summary navigation.
- `lib/learning/review-client.ts`, `lesson-review.ts`, `review-generation.ts`, `review-http.ts`, `level-instructions.ts`: cache invalidation, captured activity, explicit level guidance and quiz feedback.
- `lib/learning/quiz-personalisation.ts`, `generated-quiz.ts`, `quiz-generation.ts`, `quiz-client.ts`, `quiz.ts`, `session.ts`: five-question validation, scoped evidence, local scoring and detailed attempt records.
- `components/TutorAnswer.tsx`, `LessonRecap.tsx`, `app/globals.css`: end-of-content provenance notices and hidden toolbar styling.

The production GLB, mesh mapping JSON, canonical vessel labels and marker coordinates were not edited. No new service or dependency was introduced. Existing uncommitted work was retained.

## Verification

- Full automated suite: 238 passing tests, zero failures or skips.
- TypeScript and ESLint passed.
- Production build result is recorded in `artifacts/workflow-build.log`.
- `artifacts/review-quiz-workflow/browser-report.json`: actual production-model navigation for both reported aorta phrases through the real chat route; LAD/RCA switching, cross-vessel first mention, CS alias and navigation without retrieved passages. Also covers all three review/quiz levels, toolbar hiding/restoration, cache reuse, exactly five questions, local 4/5 grading, recorded result metadata, one refresh per completed attempt, chat-focused quizzes and rejection of a four-question response.
- `artifacts/review-quiz-workflow/failure-cases.json`: actual frontend and route receipts for a missing marker, unavailable model and user-interrupted transition; each displays its actual failure and never confirms success.
- `artifacts/review-quiz-workflow/provenance.json`: browser checks that chatbot, overview and takeaway notices follow their content, have no banner border/background, and use small readable text.
- `artifacts/review-quiz-workflow/isolation-materials.json`: actual production-model material checks for both shared groups; original colour, emissive values, textures and full selected opacity are preserved during isolation.

Generation responses in browser workflow tests are clearly labelled synthetic fixtures. Automated provider tests inject mocks and block live model requests. **No paid OpenAI calls were made.** These tests verify integration, validation, caching and data flow; they do not establish the scientific accuracy or wording of a new live AI response. Existing separate evidence/answer/distractor audits remain in the live generation path.

## Re-run

From the project folder:

```powershell
npm test
npm run typecheck
npm run lint
```

With the development server running:

```powershell
$env:EXPLORER_TEST_URL="http://localhost:3000"
node tests/review-quiz-workflow-browser.mjs
node tests/viewer-execution-failures-browser.mjs
node tests/provenance-placement-browser.mjs
```

These scripts reuse this project's existing Playwright cache and installed Chrome. They mock paid generation endpoints. The two navigation reproductions and the failure cases exercise the actual chat receipt path.

Stop the development server before `npm run build`, then restart with `npm run dev`. Existing environment configuration is retained; no API key, model or billing settings were changed.
