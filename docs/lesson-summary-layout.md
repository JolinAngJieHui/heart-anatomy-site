# Lesson summary layout

The review uses the existing dark surfaces, rose accents, typeface and controls. Its content area scrolls inside the full-screen workspace; quiz, update/retry, Word export and return-to-model actions stay above it. Narrow screens stack the card contents and wrap the vessel buttons.

## Content and source handling

- The header displays the generated title and introduction. Older cached reviews without a title use **Your lesson review**.
- An overview card appears only when the API supplies a supported overview. Missing, null or repeated-introduction overviews are omitted.
- Each actual takeaway becomes one numbered card. Its generated heading and complete explanation are retained, with expandable source links. Existing cached points without headings remain readable without generating decorative headings.
- General-AI points and overviews retain the unverified-information notice and cannot acquire reference citations. Source-supported content keeps its own evidence references.
- **Vessels explored** uses canonical IDs and names from the current session, removes duplicates and uses the existing vessel-navigation callback. Chips stay current even when a previously generated review awaits an explicit update.
- Original questions, saved answers and citations remain available under the expandable **Questions you asked** section.
- Word export uses the same title, introduction, optional overview, takeaway headings, full explanations, notices and explored vessels. Original answers remain in its appendix.

Generated text is rendered as React text, never HTML. New output fields have length/type checks and overview evidence is validated by the same provenance rules as the takeaways. Invalid output produces the existing basic saved-activity review and retry action, not fabricated AI content.

## API and cache behaviour

The existing structured generation request now asks for `title`, a nullable `overview`, and a `heading` on each takeaway. The existing evidence audit also checks those fields. No separate formatting call, dependency, model, credential or endpoint was added.

The same first-request generation, current-session cache, explicit update, in-flight deduplication and reset behaviour remain. Rendering, resizing, vessel-chip navigation, export and reopening an unchanged review do not regenerate it. Legacy cached output is accepted without a formatting-only request. See [lesson-review-setup.md](lesson-review-setup.md) for the existing live API configuration.

## Verification

Tests use provider mocks; browser checks intercept AI endpoints and block external network requests. They verify rendering and integration, not the quality of a newly generated live medical answer.

- `tests/lesson-layout.test.mjs`: optional fields, one/two/five takeaways, complete explanations, matching Word content, legacy records, overview provenance, malformed output, and the same generation/audit calls at all three levels.
- `tests/lesson-layout-browser.mjs`: real production model; empty and one/all-17 exploration sessions; keyboard vessel navigation; source expansion; three learning levels; stale/update/cache behaviour; long and short content; desktop, mobile and landscape layouts; Word download; literal-text rendering; malformed response and retry.
- `tests/key-takeaways-browser.mjs`: existing chat, source/general notices, full review workflow, pending-request coalescing, failure/retry, quiz completion, restart and refresh checks.

Layout screenshots and the focused browser report are in `artifacts/lesson-layout/`. Automated check logs use the `artifacts/lesson-layout-` prefix. Synthetic prose in browser screenshots is test data and is never inserted into the production workflow.

Verified on 22 October 2026: all 232 automated tests, TypeScript, ESLint, the production build and both browser suites above passed. The layout suite covered 1440×1000, 1024×768, 390×844, 320×568 and 844×390. No paid API calls were made. New live-model prose quality has not been evaluated as part of this visual redesign.

## Implementation files

- `components/LessonRecap.tsx`, `components/LearningReview.tsx`, `app/globals.css`: layout, actions and navigation.
- `lib/learning/lesson-review.ts`, `review-generation.ts`, `verify-content.ts`: presentation fields, generation and validation.
- `lib/learning/summary.ts`: matching Word content.
- New `tests/lesson-layout.test.mjs` and `tests/lesson-layout-browser.mjs`; updated `tests/learning-session.test.mjs`, `tests/lesson-review-browser.mjs` and `tests/key-takeaways-browser.mjs` for the new title, section names and action positions.

The heart model, markers, camera controls, tutor request pipeline, reference collection, quiz generation and API credentials were not changed by this layout task.
