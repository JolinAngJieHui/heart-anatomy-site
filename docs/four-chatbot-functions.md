> Historical implementation report. The current generative review/quiz workflow, local navigation and persistent tab caches are described in [the updated handover](navigation-learning-handover.md).

# Four chatbot functions — 21 October 2026

The existing Next.js application already had a working OpenAI Responses client,
approved local retrieval, session review/Word export and source-based quiz
interfaces. The missing connections were chat-triggered reviews and quizzes,
review-to-quiz provenance, and consistent model ownership of navigation. Clear
navigation previously bypassed Luna; mixed requests could give Sol viewer tools.

## Current routing

- Anatomy questions use `OPENAI_TUTOR_MODEL=gpt-6.1-sol`. Sol produces cited claims
  from approved local passages; a separate bounded Sol request verifies support.
  Neither request has viewer tools. Explicit vessel names override selection;
  “this vessel” uses the current selection. Simplification follow-ups retrieve
  the preceding question's topic and use bounded conversation context.
- Named navigation uses `OPENAI_NAVIGATION_MODEL=gpt-6-luna`, including clear
  aliases. It receives the inventory and strict permitted tools, not article
  text. Ambiguous or unavailable targets produce clarification. The installed
  RCA and combined LM/LAD groups open their existing numbered choices without
  inventing a segment or marking group members explored.
- Mixed requests use Sol for the explanation, then Luna for the validated
  viewer action. Function-described targets require evidence-supported identity
  and verification before Luna is called. An explanation can remain visible if
  navigation fails. A failed model never causes model substitution.
- “Summarise my session” opens the existing review via the shared review client
  and `/api/learning/review`, using Sol. “Summarise RCA” remains an anatomy question.
- “Quiz me on my review” prepares/reuses a current review, then uses Sol through
  `/api/learning/quiz` to select eligible source-grounded practice questions.
  The existing review/quiz buttons use these same clients and endpoints. Model
  names, prompts and tool payloads remain out of the student interface.

The reviewer deliberately selects safe introductions, complete saved answer
paragraphs and approved takeaway passages. It cannot rewrite original questions
or full answers, erase required qualifications or invent medical explanations.
Quiz personalisation selects existing validated question templates/approved bank
items; it does not invent a new clinical question bank. Fixed-answer marking and
source-linked feedback run locally, without a paid request per answer.

## Session, review and quiz relationship

The current tab's event history remains the source of truth. Deliberate structure
selections, actual tutor questions/completed answers, levels, confirmed navigation
and quiz attempts are recorded. Navigation is counted as exploration only after
the model is ready, selection is committed and the camera transition settles.
Whole-group actions do not count as segment exploration.

Study commands stay in the visible conversation/history but are excluded from
medical review input, avoiding a review-of-the-review feedback loop. Reviews use
the actual explored IDs, saved question/answer records, level history and prior
quiz results. Their snapshots retain the input, validated AI selection if any,
reference versions and a content version label. The label is not an authentication
token. The server rebuilds the review and quiz candidates from approved sources;
browser-supplied keys/explanations cannot become quiz evidence.

Quiz scope comes from the snapshot's explored topics and supported review
citations. Original source passages supply questions, keys and explanations.
The snapshot version is recorded with the quiz attempt. A new selection,
completed answer, level or quiz result changes the next requested review.
Default quiz length is five, or fewer when evidence is limited; chat can request
1–15. Unsupported/clinical topics without eligible reviewed questions are not
filled with invented material.

Completed review/quiz results are cached in bounded memory for this tab. Reopening
unchanged content reuses them; an explicit review update can regenerate. Refresh
restores activity but clears this memory cache, so a newly requested AI review
after refresh can make a new call. Restart aborts pending work and clears caches.
The server coalesces in-flight identical requests, but keeps no completed student
review cache. Other application persistence/reset behaviour is unchanged.

When credentials, live gates, evidence or the API are unavailable, the basic
review shows the real activity and saved answers. A quiz can use eligible local
source templates; otherwise it explains that evidence is insufficient. Only a
validated live result receives the AI-personalised label. Empty reviews make no
generation request.

## Configuration and deployment

The user's existing `.env.local` credentials and live settings were left intact.
The committed `.env.example` remains safe: blank key and live gates disabled.

For local use, configure `.env.local` in the project root. For NUS deployment,
configure the same variables in the server/service environment or secret manager:

```dotenv
OPENAI_API_KEY=<server-side credential>
OPENAI_TUTOR_MODEL=gpt-6.1-sol
OPENAI_NAVIGATION_MODEL=gpt-6-luna
TUTOR_MODE=live
TUTOR_REVIEW_BACKEND=local
TUTOR_LIVE_ENABLED=true
LESSON_REVIEW_LIVE_ENABLED=true
QUIZ_LIVE_ENABLED=true
```

Retain the bounded timeout, output, retrieval and usage settings documented in
`.env.example`. Production live mode also requires the existing
`TUTOR_REDIS_REST_URL` and `TUTOR_REDIS_REST_TOKEN` shared usage limiter.
Do not prefix secrets with `NEXT_PUBLIC_`. Use a Node-capable Next.js host, ship
the approved local `knowledge-base` files and public model assets, and restart the
server after changing settings. Static-file-only hosting cannot run these routes.
No new database, Supabase service, embedding job or dependency was introduced.

Private server diagnostics include correlation/request IDs, category, requested
model, actual API-returned model and response IDs, token usage, evidence count,
latency, errors/fallback reasons, proposed actions and browser-confirmed execution.
Acknowledgements are bounded, expiring, one-time receipts in the serving process.
They are operational diagnostics, not an authenticated audit trail. In a deployment
with multiple independent server processes an acknowledgement may reach another
process and be absent from its log; viewer/session confirmation still works.
No student conversation, reference body or credential is logged by default.

## Verification

Final checks passed: **201/201 automated tests**, TypeScript/type generation,
ESLint and the Webpack production build. Mocked workflow, actual-GLB group
navigation, isolation and full camera/navigation browser regressions passed.
The live-session observer limitation is documented separately below.

`npm test` blocks live OpenAI traffic and injects mock providers. It covers model
routing, all 11 reference probes, claims/citations, insufficient evidence, strict
tools, invalid/stale/duplicate actions, model errors, review scope, caching,
snapshot invalidation, quiz keys/scoring, reset, original answers and Word export.

Browser commands use the existing cached Playwright installation and a separate
Chrome profile, without changing the user's browsing session:

```text
node tests/four-functions-browser.mjs
node tests/four-functions-navigation-browser.mjs
node tests/isolation-browser.mjs
node tests/heart-navigation-browser.mjs
npm run typecheck
npm run lint
npm run build -- --webpack
```

The first browser check mocks AI responses and exercises chat → review → quiz,
unchanged-review caching, Word export, source-linked feedback, scoring, mobile,
API fallback and pending-request restart. The navigation check uses the actual
labelled GLB with mock tool responses to verify RCA/LAD groups, numbered choices,
selected-vessel pronouns, clarification, duplicates, Reset View and progress.
Isolation regression verifies original materials, opaque selection/translucent
context, repeated toggles, pointer interactions, camera rotation and navigation.

One authorised live browser session used the actual site and GLB, explored LCx,
D1 and coronary sinus, asked “Where does the coronary sinus drain?” followed by
“Can you explain that more simply?”, navigated to LCx, generated/reopened a review,
exported Word, and completed a quiz. Both anatomy answers were verified with R11
citations. Luna navigation was confirmed by the browser. The review and quiz
completed using Sol. Only two quiz questions were eligible for the chosen review,
and both were submitted and recorded (one correct, one incorrect).

Actual API metadata confirmed **seven Responses calls**: four Sol calls for
anatomy generation/verification, one Luna navigation call, one Sol review and one
Sol quiz. Reported totals were **7,558 input tokens and 691 output tokens**.
No retries or model substitutions occurred. The navigation request retrieved
zero article passages.

The live runner's final response-observer assertion missed the quiz HTTP body.
Its original failure remains in `artifacts/four-functions/live-browser.json`.
This was reconciled using the successful server validation/model metadata,
recorded results and the visually inspected `live-quiz.png` displaying
“AI-personalised selection”. No paid session was repeated just to fix the
observer. `live-verification.json` records this distinction. Other outputs include
`mock-browser.json`, `navigation-browser.json`, the Word export and test/build logs.

The bounded live sample does not validate all anatomy or every model phrasing.
Mixed/function-derived navigation, refusal, malformed output and failure paths
have mocked/automated coverage; they were not separately paid-evaluated.
Anatomical teaching and the source-template quiz bank still need qualified human
review. Clinical/free-text evaluation is not a newly implemented quiz mode.

## Try the four functions

1. Open the website, select two or three structures, open **Ask AI Tutor**, and
   confirm that your questions contain no personal/patient information.
2. Ask **“What does the RCA do?”**, then **“Explain that more simply.”** Inspect
   the supporting source links; if evidence is insufficient, the tutor must say so.
3. Ask **“Show me the RCA.”** The whole artery should highlight and offer its
   three numbered segments. Choose one, then ask **“Find this vessel.”**
   **“Explain the RCA and show it”** combines teaching with a separate Luna action.
4. Ask **“Summarise my session.”** Check the actual explored structures, original
   questions, expandable saved answers and qualified takeaways. Return to the
   model to continue the same conversation. Reopening an unchanged review should
   not make another call in the same page lifetime.
5. Ask **“Quiz me on my review.”** The current review is reused or prepared first.
   Submit answers to see deterministic results and original source explanations.
   Try LCx if your selected structures have no eligible quiz evidence.
6. Test **Restart Session** during a pending request, then confirm the new review
   has no old activity. **Reset View** only resets the viewer.

Live use consumes the configured account's credits. The optional acceptance command
`node tests/four-functions-browser.mjs --authorised-live` must only be run with
explicit authorisation. It caps the workflow at three chat requests, one review
and one quiz (at most seven model responses); it is not part of `npm test`.

## Files changed in this implementation

- UI: `components/AnatomyTutor.tsx`, `HeartExplorer.tsx`, `HeartScene.tsx`,
  `LearningReview.tsx`, `PersonalisedQuiz.tsx`.
- Tutor: `lib/tutor/core.ts`, `routing.ts`, `generation.ts`, `pipeline.ts`,
  `service.ts`, `navigation.ts`, `scene-actions.ts`, `vessel-groups.ts`,
  `retrieval.ts`, `types.ts`, `schema.ts`, `usage.ts`, `diagnostics.ts`, `http.ts`.
- Learning: `lib/learning/intent.ts`, `workflow-client.ts`, `review-snapshot.ts`,
  `lesson-review.ts`, `review-client.ts`, `review-generation.ts`, `review-http.ts`,
  `quiz-personalisation.ts`, `quiz-client.ts`, `quiz-generation.ts`, `quiz-http.ts`,
  `quiz.ts`, `session.ts`, `evidence.ts`, `evidence-server.ts`.
- Routes: `app/api/chat/route.ts`, `app/api/chat/action-result/route.ts`,
  `app/api/learning/review/route.ts`, `app/api/learning/quiz/route.ts`.
- Supporting code: `lib/model-config.ts`, `scripts/load-typescript.mjs`.
- Tests: `tests/four-functions.test.mjs`, `four-functions-browser.mjs`,
  `four-functions-navigation-browser.mjs`, `rag-routing.test.mjs`,
  `quiz-routing.test.mjs`, `learning-session.test.mjs`.
- Documentation: this file, `docs/rag-routing-handover.md`, `README.md`.

No GLB, marker coordinates, approved reference text, camera algorithm, lighting,
theme or private credential was changed. Existing unrelated work was preserved.
