# Personalised learning sessions

The existing explorer now supports this local workflow: explore structures, ask the tutor, review the session, read supporting source passages, download Word notes, take source-grounded practice, revisit missed concepts, and return to the model. The implementation stays on `feature/website-improvements`. No OpenAI calls or external uploads were made during implementation or validation.

## Try the workflow

1. Start the development server with `npm run dev` and open `http://localhost:3000`. Use `localhost` so Next.js development-origin checks allow the 3D scripts.
2. Select a few vessels, such as Coronary Sinus, Left Circumflex Artery, and Left Diagonal D1. Repeated selections do not increase unique exploration counts. Change the learning level if desired.
3. Open **Ask AI Tutor**, confirm the existing privacy checkbox, and ask an educational question. In mock mode the response is a demonstration, not medical evidence. Submitted questions and responses are saved locally. **New Conversation** clears the visible conversation but retains previous questions in the session review; this behaviour persists after refresh.
4. Choose **Review Session** in the top toolbar. The model remains mounted, and opening the review does not end the session. The review has its own scrollbar; the overall page stays within the viewport.
5. Expand a structure under **Read Supporting Passages**, open the original reference link, read the excerpt and its qualifications, and choose **Mark Passage Reviewed**. This records self-reported review at the selected level. Opening a card does not automatically mark its source material reviewed.
6. Add a general study topic in **Your revision note**. You can also choose **Mark this topic for revision** on a tutor turn. Merely asking a question does not mark a student as having poor understanding.
7. Choose **Download Word**. The document contains exactly the validated summary sections displayed in the review, with heading styles, session date, levels, original citation URLs and versions. Export adds no explanations. The filename is `Heart_Anatomy_Session_Summary_YYYY-MM-DD.docx`.
8. Choose **Take Personalised Quiz**, read the practice-status explanation, and explicitly start. Five questions are requested by default. Ten or fifteen become available only when the pool contains enough eligible questions. If fewer than five are eligible, the interface states the smaller practice size. If none are eligible, it explains what to review rather than substituting unsourced content.
9. Submit each answer to see feedback, the original excerpt and reference. Identification questions reuse the model with names and tooltips hidden, including accessible marker names. They test numbered marker associations on the schematic, not real coronary geometry. Rotate or zoom to reach far-side markers.
10. Results show the score on the attempted questions, correct concepts and concepts to revisit. Use **Review Incorrect Answers**, **Retry Missed Questions**, **Take Another Quiz**, **Download Updated Summary**, or return to a structure in the model. Exiting an unfinished quiz retains submitted-answer events but does not invent a completed score.

## Storage and session management

`heart-anatomy:tab-session:v1` in sessionStorage checkpoints only the current tab’s lesson. Activity lives in memory first, with batched writes for refresh recovery. The lesson stores its title, timestamps and structured events. Events include card openings, card content displayed after a level change, levels, questions, replies/errors, conversation resets, explicitly reviewed passages, revision notes, quiz starts, submitted answers and completed quizzes. Stable IDs refer to the existing inventory; names come from that inventory rather than a second anatomy database.

**Restart Session** clears the current tab’s lesson and any obsolete browser-wide history. Separate open tabs have independent lessons. The old saved-session archive and resume controls have been removed. No legacy visits are imported into a new lesson.

The active tab’s actual card-opened events are the single source of explored IDs. Refresh restores unique progress, rose markers, the last learning level, and conversations from sessionStorage, without selecting a structure or replaying earned milestones. Fresh document visits start empty. Browser-wide archives are never read on startup.

The persistence adapter has a storage interface that can later be replaced with authenticated account storage. No account identifiers, analytics, durations or demographic data are collected. Raw session histories are not posted to a summary service. `/api/learning/evidence` receives no chat history and reads local files only. AI requests are made only for explicit tutor questions or requested personalised reviews; see the lesson-review setup guide for the separate live-use gates.

Corrupt or unsupported tab checkpoints start a fresh usable lesson with a warning. Storage failure and quota limits leave activity available in memory; keep the tab open and export notes if refresh recovery is unavailable. Each tab has at most 10,000 events and a bounded checkpoint; no previous-session archive is loaded. Other tabs are independent. Browser storage is not authenticated account storage or an authoritative assessment record.

## Summary and evidence rules

The basic summary is deterministic local activity summarisation. Optional AI personalisation uses the dedicated review endpoint described in the lesson-review setup guide. Both report only recorded activity. Educational notes consist of literal approved local excerpts explicitly marked reviewed. Existing information-card explanations are preserved but are not silently reclassified as approved knowledge-base documents.

Original reference metadata and bytes are checked with the existing registry and document preparation modules. Drafts, pending/rejected references, metadata-only records, changed files and synthetic fixtures cannot enter production source review. Broad whole-RCA/LAD mentions cannot supply an exact segment. Clinical abbreviations, procedural context, conditional origin descriptions and case/variant sections are conservatively excluded from ordinary source-template practice. These are technical heuristics, not a scientific review or proof of anatomical normality; original qualifications remain visible.

Tutor answers enter educational notes only if the recorded response is live, supported and verified, and every cited source is currently locally available with the same source ID, title, URL and document version. Mock, unsupported, unavailable, incomplete and stale responses contribute activity or unanswered-topic entries but no educational claims. Clinical correlations require such a verified answer to a recorded clinical question. No clinical paragraphs are inferred from vessel clicks. Session storage is browser-controlled; it does not cryptographically authenticate historical answers or provide secure examination results.

## Quiz selection and review status

Practice selects only already-visited structures with exact source passages marked reviewed at the requested level. It favours reviewed bank questions, previously missed questions, and structures discussed with the tutor, while keeping multiple structures represented. The latest completed result for a question determines whether it remains a missed priority. Synthetic fixtures are isolated in tests.

The implemented fallback creates literal excerpt recall and numbered-marker association questions. Distractors are existing canonical structure names, not invented medical assertions. Names are masked in recall excerpts. Multiple sources do not create duplicate identification questions for the same structure. Practice is clearly labelled **not academically reviewed**. The same recall formats are available at each level only after a review at that level; they do not claim to assess Advanced clinical competence.

`knowledge-base/quiz-bank.json` starts empty. Clinical application questions and more sophisticated level-specific assessment require reviewer-approved entries before they are offered. The `ReviewedQuestion` contract in `lib/learning/quiz.ts` records question ID, stable structure ID, learning level, question kind, prompt, choices, correct answer, explanation, exact evidence, review status, reviewer and review date. The engine validates current source evidence and choice identities before admitting a bank entry. A source's scientific approval does not automatically approve a derived question. Do not fill reviewer metadata without actual approval.

The conservative initial filter currently finds 13 excerpt mappings for nine structures. Eight have no suitable ordinary-practice excerpt under these rules: proximal/middle/distal RCA, proximal/mid/apical LAD, Right Marginal Artery and Superior Vena Cava. This does not assert that the whole reference collection lacks all useful information for those structures. It describes the narrower direct ordinary-practice pool. See `learning-evidence-coverage.json` for source/section/version mappings and gaps. No sources or teaching notes were approved or changed as part of this feature.

## Files

New modules: `lib/learning/session.ts` (event validation and activity processing), `persistence.ts` (storage adapter), `evidence.ts` (passage contracts and ordinary-practice checks), `evidence-server.ts` (approved local corpus preparation), `summary.ts` (deterministic summary), `word-export.ts` (lazy-loaded docx export), and `quiz.ts` (selection, validation and scoring).

New interface: `components/useLearningSession.ts`, `LearningReview.tsx`, `PersonalisedQuiz.tsx`; local-only endpoint `app/api/learning/evidence/route.ts`; empty reviewed bank `knowledge-base/quiz-bank.json`; tests `tests/learning-session.test.mjs` and `learning-session-browser.mjs`.

Integrated existing files: `components/HeartExplorer.tsx`, `AnatomyTutor.tsx`, `HeartScene.tsx`, `HeartAnnotations.tsx`, `lib/scene-state.ts`, `app/globals.css`, `package.json`, and `package-lock.json`. The only new runtime dependency is `docx` (9.10.0). Existing anatomical content, coordinates, camera framing, learning-level controls and RAG architecture remain in place.

## Validation

```powershell
npm test
npm run typecheck
npm run lint
npm run build
node tests/learning-session-browser.mjs
node tests/panel-framing-browser.mjs
$env:EXPLORER_TEST_URL = 'http://localhost:3000'
node tests/progress-browser.mjs
```

Browser scripts use the project's existing cached Playwright and installed Chrome. Unit fixtures are explicitly fictional and never imported by the website. The browser tutor is intercepted with a mock-only response; reference review uses actual approved local documents. There is no live RAG/LLM evaluation in these results. Microsoft Word opened both a generated fixture and an actual browser export; PDFs and page images were used for visual checking. Test documents and images are temporary QA outputs, not new anatomical teaching material.

The dependency audit reports existing Next.js/tooling advisories; `docx` is not listed in the audit. Forced framework downgrades or unrelated dependency changes were not included. Details are saved in `learning-dependency-audit.json`.

## Remaining work

Add direct, permitted and scientifically reviewed anatomy excerpts for the eight ordinary-practice gaps. Review a clinical/application question bank and level-specific questions. Configure the existing live tutor only after its reference indexing and credentials are ready; no live summary generation or automatic LLM quiz generation has been added. Add authentication, encrypted account persistence, conflict handling and cross-device sync when moving beyond the local prototype. Unfinished quizzes retain events but do not resume mid-question after refresh.

## Review refresh (October 2026)

The current student recap and API activation instructions are in [Lesson review setup](lesson-review-setup.md). The recap now uses five concise sections with expandable original answers and citations. **Saved sessions** contains history controls; **Continue your revision** contains supporting passages, revision notes and the existing quiz. Word export uses the new recap plus clearly labelled original answers; technical event statistics and timestamps are no longer printed in the recap. The original tracking, storage and quiz safeguards described here remain in effect.


Current tab-session lifecycle and startup behavior are documented in [Restart Session and tab-scoped learning](restart-session.md). This supersedes earlier browser-wide persistence details in this document.
