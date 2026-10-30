# Restart Session and tab-scoped learning

The viewer now mounts immediately, while the current tab’s small refresh checkpoint loads. It no longer waits behind a full-screen “Restoring your learning session” message, a Web Lock, or an old browser-wide archive. Progress shows a neutral preparation label until ready, avoiding a false zero count on refresh.

## Current lifetime

- Each fresh document visit starts one empty lesson. No old localStorage history is imported.
- Activity updates in memory synchronously. A 150 ms coalesced save writes only this lesson to sessionStorage `heart-anatomy:tab-session:v1`.
- Refresh and back navigation can restore that tab’s current lesson. A visibility/pagehide flush preserves recent changes even if the save timer has not fired.
- A normal new tab or fresh visit starts empty, including a new tab whose opener copied sessionStorage. Tabs have independent questions, progress, reviews and quiz activity; there are no broadcasts or shared write locks.
- Closing the tab ends normal tracking. Session storage follows the browser’s tab lifecycle; browser session-recovery features can restore a previous tab, so this is not a secure-erasure mechanism. Download Word before closing if you want to keep a review.

The active lesson’s validated card-opened events determine the unique explored IDs and rose markers. Restored milestones are not replayed. The explorer’s last learning level is restored separately from the quiz level. Conversation derivation is memoized so hover/camera renders do not rebuild the saved conversation.

Only one bounded checkpoint is accepted on refresh (at most 10,000 events and four million stored characters). It is validated once on loading. New events are validated individually; saves do not revalidate the entire lesson. Unavailable, corrupt or unsupported storage starts a usable in-memory lesson with an explanation. Persistence failures leave current activity available for review/export.

## Restart

The toolbar and review both offer Restart Session with the same confirmation. Restart cancels pending saves, clears the tab checkpoint, invalidates review caches, and replaces the lesson identity. Stale tutor, quiz and review callbacks cannot write into the new lesson. Pending exports are cancelled when the workspace remounts. Selection, hover, isolation, camera, marker visibility, learning level, tutor draft and privacy checkbox return to defaults.

Explicit Restart also removes the obsolete localStorage keys `heart-anatomy:learning-sessions:v1` and `heart-anatomy:exploration:v1`. They are left untouched and unread during ordinary startup. Other tabs’ sessionStorage, unrelated browser data, references, API configuration and downloaded documents are unaffected. Reset View continues to reset only the view/selection.

The former saved-session archive and resume controls have been replaced by a concise “This session” explanation. Review, quiz and Word features still use the actual current lesson. Completed AI reviews remain cached only in the tab’s memory; the backend retains only in-flight work and discards completed results.

## Changed files for the startup update

- `components/useLearningSession.ts`, `lib/learning/session-store.ts`, `lib/learning/persistence.ts`: tab storage, synchronous in-memory updates, batched checkpoints and lifecycle flush.
- `components/HeartExplorer.tsx`, `components/ExplorationProgress.tsx`: immediate workspace mount, preparation indicator, memoized conversation and restored milestones.
- `components/LearningReview.tsx`, `components/RestartSessionDialog.tsx`: current-tab wording and controls.
- `tests/session-restart.test.mjs`, `tests/session-restart-browser.mjs`, `tests/progress-browser.mjs`, `tests/learning-session-browser.mjs`, `tests/lesson-review-browser.mjs`: updated lifetime, lock/archive exclusion, refresh, restart, independent tabs and regression checks.
- `README.md`, `docs/personalised-learning-sessions.md`, `docs/lesson-review-setup.md`, this file: lifecycle documentation.

## Verification

Run TypeScript, ESLint, the automated suite and the production build. Browser tests use isolated profiles and mocked AI responses. The restart browser check supplies a deliberately unreadable two-million-character legacy archive and a lock API that never resolves: neither is used, and the workspace appears before session readiness. It also checks fresh/opener tabs, reopening after close, refresh, markers, milestones, delayed responses, review caching, Word contents, keyboard controls and six viewport sizes.

Use `EXPLORER_TEST_URL` to point browser tests at the active development preview. Production builds remain separate from live API validation. Do not enable or call paid APIs for these checks. Screenshots and the latest browser report are generated under `.next/cache/restart-session-tests/`.

Verified on 2026-10-16: all 139 automated tests, TypeScript, ESLint and the production build passed. The restart/startup, progress, review and tutor/quiz/Word browser workflows passed, including six viewport sizes. All AI responses were mocked. In one local development-browser check, workspace markup appeared at approximately 435 ms and session readiness at 1,700 ms; these are measurements from that run, not a promise of total 3D loading time. The check recorded zero shared-lock calls and zero legacy-history reads.
