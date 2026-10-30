# Tutor interface redesign

The workspace toolbar now contains a rose Ask AI Tutor button with an icon, visible text, focus/hover states and an active indicator. It toggles a dedicated panel without remounting the 3D canvas or changing selection, learning level, exploration progress or camera state.

Desktop uses structures → viewer → tutor while open, and restores viewer width when closed. Medium screens use a compact split layout or partial overlay; phones use a bottom sheet with part of the viewer exposed. The main page stays within the dynamic viewport. Conversation history scrolls independently while the input, consent and Send controls stay pinned. Short phones retain scene controls in their existing scrollable toolbar.

An empty conversation starts at the welcome heading and offers four questions that follow the selected structure and level. Before privacy consent, a suggestion fills the input; after consent it sends through the existing endpoint. Selected structure and level are displayed near the header and captured independently on every turn. Closing/reopening preserves messages, the input draft and consent. Escape/Close returns focus to the toolbar button. New Conversation clears chat only.

Student messages use rose-tinted bubbles; tutor replies include source links, status and error/loading feedback. A prominent mock/unavailable notice appears before sending. No anatomical answers are hard-coded. The RAG service, approval/indexing pipeline, model configuration, fixed education, markers, anchors and scene reducer are unchanged. Generated scene actions remain inactive.

Changed files: app/page.tsx (passes non-secret tutor mode), components/HeartExplorer.tsx, components/AnatomyTutor.tsx, app/globals.css, tests/tutor-browser.mjs, docs/anatomy-tutor.md. Added components/TutorIcon.tsx and this record.

Validation: 28 unit/integration tests; TypeScript; ESLint; production build. Existing browser suites passed 51 explanations, 17 marker clicks, floating card/leader behavior and progress persistence/milestones across six viewports. Expanded tutor browser checks cover visibility, three-column order, chat and selection persistence, unchanged canvas identity, contextual suggestions/request payloads, citations/errors/refusals, keyboard close/focus, independent history scroll and viewport bounds. All answers used local mock mode or explicitly synthetic intercepted UI fixtures; no live OpenAI call or academic accuracy evaluation was performed.
