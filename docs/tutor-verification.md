# Verification record — 10 October 2026

Branch: feature/website-improvements. No merge, deployment, document upload, paid API call or credential setup performed. Earlier uncommitted viewer work was preserved.

Passed: 28 automated unit/integration tests (16 existing viewer tests and 12 tutor tests); Next.js route generation/TypeScript; ESLint; production build including /api/tutor; indexer dry run with zero approved documents and zero uploads.

Passed browser checks: actual local mock endpoint, privacy consent, selected structure/learning-level context, New Conversation, synthetic provider error/citation/refusal rendering, desktop/mobile/landscape viewport bounds, keyboard collapse. Live-labelled browser replies were deliberately intercepted synthetic UI fixtures, not real OpenAI responses.

Existing viewer browser suite passed all 51 explanations, 17 marker clicks and six viewports. The information-card suite passed reuse, leader tracking, positioning, marker fallback, scrolling and keyboard close. The progress suite passed unique exploration, milestones, dismissal, refresh persistence, level changes, completion and six layouts.

No live API or academic accuracy evaluation was performed. Production approved corpus is empty. Existing 51 descriptions remain draft, with 14 external references recorded as unverified metadata. Grounding checks do not establish anatomical accuracy.

Dependency audit reports 10 findings: 9 high and 1 critical. Packages include Next.js (critical), eslint-config-next and its transitive glob/YAML dependencies, sharp and source-map-js. Neither newly added openai nor server-only is named by that audit. Framework/dependency remediation remains a release blocker; no force-fix/downgrade was applied. Audit detail is temporarily available in .next/tutor-audit.json (ignored).

Release prerequisites: academic/licensing approvals; server-side API key/model/store configuration; explicit billing activation; live evaluation; production shared limiter plus authenticated gateway/WAF; dependency remediation and hosting file-tracing validation.
