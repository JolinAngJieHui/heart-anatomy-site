# Anatomy Tutor implementation plan

Preserve the existing scene reducer, 17 stable IDs, three learning levels, information cards and progress. Add a collapsed tutor inside the navigation panel with its own scroll area. Each turn captures selection and level; no scene commands are executed by generated text.

Use the official OpenAI SDK on the server: explicit vector-store search, approved manifest filtering, evidence assessment, structured Responses output and a separate grounding verification. Fail closed on missing approval, incomplete generation, invalid citations or provider failures. No web-search fallback.

The existing 51 explanations remain in lib/education.ts. A draft registry references them without copying text. External reference links are unverified metadata, not approved passages. Production starts with zero approved sources. Mock mode returns labelled infrastructure demonstrations only.

Add an indexing CLI with dry-run by default, approval/licensing validation, content hashes, incremental updates and explicit removal. Live activation requires credentials, billing consent and academic approval. Automated tests use synthetic evidence; live evaluation remains a separate academic task.

Use a bounded local limiter for development; production live mode requires a shared Redis REST limiter and authenticated gateway/WAF protection. Record no question content in logs. Privacy confirmation and conservative local rejection reduce inadvertent personal data transmission but cannot detect all sensitive information.
