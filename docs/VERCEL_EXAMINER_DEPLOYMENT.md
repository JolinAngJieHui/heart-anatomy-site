# AnaBuddy examiner deployment

Deployed and verified 30 October 2026 (Singapore).

**Report link: https://anabuddy.vercel.app/**

Owner: Vercel account `jolinangjiehui`, team `ana-buddy` (AnaBuddy), project
`anabuddy`, free Hobby plan. Both the website and its Next.js API routes run on
Vercel; the owner's computer does not need to remain on. No examiner login or
API key is required. Production uses the owner's securely configured API credits.

Final release: `dpl_87RxfLheLPZHsvGNw8ETgmucXGu7`. Use the stable report link above,
not the deployment-specific URL. Node.js is pinned to `24.x`. Standard Vercel
protection remains on preview/deployment URLs; the stable production domain is
public. No hosting purchase or additional database was needed.

## Deployment configuration

- Deploy this existing working directory with the Vercel CLI; no new repository
  or public source repository is needed.
- `.vercelignore` uploads the application and the active labelled GLB only. The
  model and all original local files are unchanged. The current upload is about
  49.91 MB (180 files), below the 100 MB Hobby CLI source-upload limit.
- The served model is `/models/heart-024522f87aa6dbb0.glb`. It contains embedded
  textures. The model manifest, existing markers and Draco supporting files are
  included. Update the GLB allow-list if the active model changes in future.
- The active 11-source, 137-passage collection is included explicitly in the
  Next.js server traces. No external database or reference reindexing is needed.
- `vercel.json` selects Next.js, `npm ci`, the verified Webpack production build,
  and 180-second durations for the tutor, review and quiz routes. Use Fluid
  Compute, whose Hobby function limit supports this duration.
- Existing browser requests use same-origin `/api/...` URLs. Learning records,
  conversations, reviews and quizzes remain scoped to the browser's tab session.
  Server caches contain reference data or temporary in-flight work, rather than
  a shared active student session.

## Deployment procedure (already completed)

1. Sign in with `npx vercel login` and inspect `npx vercel whoami`.
2. Link the intended account-owned project using `npx vercel link`. Confirm its
   account, project and plan before making settings changes. Do not create a
   temporary or claim-later deployment.
3. Configure Production environment variables below, using Vercel's secret
   settings or stdin to `vercel env add NAME --environment production
   --sensitive --force`. Never use `--value` for secrets or print `.env.local`.
4. Run the checks below, then `npx vercel --prod`. The upload uses the current
   files; a Git commit or push is not required by this deployment route.
5. Verify the project's stable production domain anonymously, without Vercel
   cookies or bypass headers. If production protection prevents examiner access,
   adjust only this project's Production protection settings.

## Production environment

Keep `NODE_ENV=production` (provided by the platform). Preserve the working model
assignments from `.env.local`:

```dotenv
TUTOR_MODE=live
OPENAI_TUTOR_MODEL=gpt-6.1-sol
OPENAI_NAVIGATION_MODEL=gpt-6-luna
TUTOR_LIVE_ENABLED=true
LESSON_REVIEW_LIVE_ENABLED=true
QUIZ_LIVE_ENABLED=true
ASSESSMENT_DISABLE_USAGE_LIMITS=true
TUTOR_TIMEOUT_MS=60000
LEARNING_GENERATION_TIMEOUT_MS=60000
TUTOR_MAX_OUTPUT_TOKENS=1600
RAG_TOP_K=5
RAG_MAX_CONTEXT_TOKENS=3500
```

`OPENAI_API_KEY` has been transferred privately as a sensitive Production
variable. Do not prefix secrets with
`NEXT_PUBLIC_`. The local `TUTOR_REVIEW_BACKEND` and vector-store settings are not
needed for live local-reference retrieval. Provider and hosting limits apply.

### Assessment limiter exception

The owner explicitly authorised this setting and subsequently confirmed that all
live AI features must remain enabled. The exception is implemented in the shared
usage limiter, tutor configuration and shared review/quiz configuration. Only the
exact server-side value `true` enables it. No shared-store credentials are needed
in that mode, and the bypass runs before store initialisation. API credentials,
live-feature gates, request validation, grounding checks and provider/hosting
limits remain intact. The environment example defaults the exception to `false`.

Restore normal limiting by setting the flag to `false` (or removing it), supplying
`TUTOR_REDIS_REST_URL` and `TUTOR_REDIS_REST_TOKEN`, and redeploying. Without the
exception, the existing production shared-store requirement remains in force.
In assessment mode there is no application-level request cap on API credit use.

## Checks and verification

Completed locally on 30 October 2026:

- 263 automated tests passed, including deployment packaging and assessment
  limiter/production-configuration checks. Provider
  calls were mocked or blocked by the existing test network guard.
- ESLint, standalone TypeScript and `next build --webpack` passed.
- All 11 reference documents / 137 passages load in production mode with no
  excluded sources. All six checked server traces contain the required files.
- Upload preflight passed, including local-import filename case checks for Linux.
- Production dependency audit reports zero known vulnerabilities after updating
  Next.js and its lint configuration to 16.4.3, Zod to 4.6.6, and the locked
  transitive Sharp/source-map-js packages to 0.35.5/1.2.2 respectively.
- Layout, UI styles, model assets, AI prompts and task assignments were preserved.
  The production check exposed an existing quiz citation display omission:
  feedback showed only the first supporting source. It now lists every unique
  supporting source in both answer feedback and the results cards.
- With the assessment flag enabled, the current local API configuration passes
  all production tutor/review/quiz configuration gates without Redis. This check
  made no provider requests and does not verify hosted AI functionality.

Completed against the actual stable production domain:

- **Passed — public access:** direct HTTP requests without cookies, auth or
  protection-bypass headers returned 200 for the page, model manifest, GLB and
  learning evidence endpoint. The browser opened the teaching workspace without
  any sign-in screen.
- **Passed — asset integrity and references:** the hosted GLB is 46,826,392 bytes
  and SHA-256 matches the local active model. All 17 canonical structures are in
  the hosted manifest. Runtime evidence reports all 11 sources. Its 186 learning
  evidence records include structure-associated entries and are not a count of
  unique original extracted passages; the source corpus remains 137 passages.
- **Passed — viewer:** the textured model renders; side-list and marker selection,
  rose explored markers/count, rotation, wheel zoom, changing marker occlusion,
  Reset View and fully textured selected-vessel isolation were exercised.
- **Passed — learning levels and live tutor:** the same LAD question was answered
  at Basic, Intermediate and Advanced with visibly different depth, valid source
  links, and explicit notices for supplementary general-AI material. Production
  diagnostics confirm real `gpt-6.1-sol` responses, not mocks.
- **Passed — named-vessel navigation:** “Show me the coronary sinus” visibly
  rotated/framed the vein, selected marker 17, highlighted it blue and opened its
  information card. This straightforward command ran locally, without a paid
  model request.
- **Passed — live review:** the review included only the proximal LAD and coronary
  sinus explored in this test and its two substantive questions. The navigation
  command was excluded from the questions section.
- **Passed — live quiz:** five AI-personalised questions covered that session.
  Multiple-choice, actual-heart identification and numbered-marker selection all
  worked. A deliberately incorrect answer produced a red cross, the correct
  answer a green check with explanation; submitted answers locked. Final score
  was 4/5. No placeholders were used.
- **Passed — revision loop:** Return to summary generated a new review that
  accurately discussed the missed LAD-course answer and its correction, retained
  the actual score and supporting references.
- **Passed — export:** Download Word produced a real DOCX; its document XML
  contains the session's two structures, personalised takeaways, source URLs,
  4/5 result and revision feedback. Saved test copy:
  `artifacts/vercel-assessment/production-review-export.docx`.
- **Passed — persistence/isolation/reuse:** refresh restored 2/17 explored and
  the saved conversation. A separate newly opened tab began at 0/17 with no
  conversation from the first tab. Reopening the unchanged review retained the
  same post-quiz content. Production diagnostics showed no additional generation
  requests across refresh/reopening.
- **Passed — final release checks:** 263 automated tests, ESLint, TypeScript and
  the Vercel production build passed. A direct render check verified multi-source
  quiz citation output, duplicate removal and compatibility with existing
  single-source questions. The page and seven initial browser scripts did not
  contain the privately compared API key.

Observed limitations / verification boundaries:

- A descriptive-only navigation request (“the large vein that collects blood
  returning from the heart muscle…”) produced an explanation but requested a
  named annotated structure instead of moving the model. Use “Show me the
  coronary sinus” (or another exact vessel name/alias). This is an existing
  interpretation limitation, not a hosting failure; it has not been redesigned.
- Right-drag panning, touch gestures, mobile hardware, the Restart Session
  confirmation, every individual marker's location, and simultaneous-examiner
  load were **not separately browser-tested**
  in this deployment pass. Their existing code was preserved. Manual check:
  right-drag the heart, then rotate and Reset View; open the link on a phone and
  test rotation/pinch zoom and panel scrolling. In a disposable practice session,
  use Restart Session, first Cancel and then confirm; check the counter returns
  to 0/17 and the conversation is empty. Reset behavior is covered by the existing
  automated suite, but this is not a claim of a hosted restart-button test.
- No browser errors appeared in the exercised flows. A non-fatal Three.js Clock
  deprecation warning remains. Initial model loading still downloads the full
  approximately 47 MB asset, so slower connections may take longer.
- These checks verify functionality, not a comprehensive medical-content audit
  of every possible generated answer. General-AI answers retain their notices.

Real API calls were made only for this authorised verification; generation and
validation used the existing live pipeline. No paid hosting was purchased.

```text
npm test
npm run lint
npm run build -- --webpack
npm run typecheck
node scripts/vercel-preflight.mjs --traces
```

`vercel-preflight` verifies the upload size, correct model, absence of secret and
obsolete assets, all source files, and reference inclusion in six server traces.
Automated tests block paid OpenAI calls. The separate hosted checks above used
the actual live service. Screenshots and diagnostic evidence are retained in
`artifacts/vercel-assessment/` and are excluded from deployment.

## Future updates

From this same linked project directory, rerun the checks and
`npx vercel --prod --yes --scope ana-buddy`.
Use the project's stable production domain in the report so updates keep the same
link. Keep the account and AI credits available throughout examiner access.
No further setup is required for the current release. Local changes do not
publish automatically; run the deploy command again when ready. The optional
GitHub integration is not connected and is not required for this CLI workflow.

To change API credentials or flags later, open Vercel → AnaBuddy team → anabuddy
project → Settings → Environment Variables, select Production, update the
appropriate setting, and redeploy. Never put the API key in source or the report.
The local `.env.local` is ignored and is not uploaded. The explicit helper
`scripts/vercel-production-env.mjs` can transfer the known local settings through
authenticated CLI stdin without printing secret values.

## Files changed for deployment

- `next.config.ts`: scoped runtime reference-file tracing.
- `vercel.json`: full Next.js build and API function durations.
- `.vercelignore`: source upload selection; originals remain local.
- `package.json` / `package-lock.json`: targeted production vulnerability fixes.
- `lib/tutor/limiter.ts`, `lib/tutor/config.ts`, `lib/learning/review-http.ts`:
  explicit server-only assessment exception; live AI and validation preserved.
- `.env.example`: documents the exception with a protected default.
- `scripts/vercel-preflight.mjs` and `tests/vercel-packaging.test.mjs`:
  asset/reference/secret-exclusion and Linux import checks.
- `tests/tutor.test.mjs` and `tests/lesson-review.test.mjs`: normal-limit
  restoration, exact opt-in, missing-store handling and live-gate regressions.
- `scripts/vercel-production-env.mjs`: private server-side configuration transfer.
- `components/PersonalisedQuiz.tsx`: display all existing supporting source links.
- `.gitignore`: Vercel CLI keeps local deployment and environment data ignored.
- This guide: configuration, verification limits and repeat deployment steps.
