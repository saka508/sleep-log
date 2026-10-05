# Work autonomous PR review guide

Work is the supervising reviewer, not the implementation owner. Its job is to compare the Issue, PR, diff, tests, and GitHub state; then translate any gap into a precise instruction that Codex can execute. Work should not silently edit the implementation in place, infer product approval, or turn an unapproved future feature into a requirement.

## Review inputs

Read, in order:

1. The Issue and its acceptance criteria, scope, and human-decision conditions.
2. `docs/DEVELOPMENT_PLAN.md`, `docs/SPEC.md`, and `docs/DECISIONS.md`.
3. Applicable `AGENTS.md`, the PR description, changed files, test output, and GitHub Actions state.
4. The current branch/base relationship and all PR conversation, including unresolved comments.

`WORK_AUTONOMOUS_REVIEW.md` is a review procedure, not a fourth authoritative product document. If a source conflicts with the three authoritative documents, report the conflict and ask for a decision; do not rewrite the product rules during PR review.

## Review checklist

### Issue and scope

- Does the diff meet every stated completion criterion?
- Is every changed file inside the allowed scope? Are there no unrelated refactors, generated artifacts, user-local files, or drive-by formatting changes?
- Does the PR say what it did _not_ change? Do the stated non-goals match the diff?
- Does the task need a follow-up Issue rather than further expansion of this PR?

### Storage, CSV, and existing data

- Are existing AsyncStorage keys, `SleepRecord`, daily date-key replacement behavior, and separate headache/pressure-history stores preserved?
- Is `DailyConditionRecord` still a derived read model rather than an unannounced persisted migration?
- Do CSV columns retain their established meanings and order, and do old CSV files still import? Are headache-event and pressure-history backups still separate versioned JSON formats?
- If any data shape, migration, backup, restore, deletion, or import behavior changes, is there a versioned/idempotent plan, recovery behavior, old-data test fixture, and explicit human approval? If not, block the PR.

### Sleep provenance, missing values, and dates

- Are `legacy` and `actualSleep` kept distinct? Legacy records must remain readable and must not be retrospectively recalculated. Actual-sleep analyses may use only `actualSleep` and must preserve a visible exclusion count where applicable.
- Are absent values (`undefined`, `null`, blank, unrecorded) distinct from an explicit zero across form state, persistence, CSV/JSON, derived records, graphs, and analysis? In particular, do not replace unknown headache intensity with zero.
- Are daily keys based on local dates, never an ISO UTC slice? For time changes, are crossing-midnight, same-day/next-day assignment, minute precision, and existing timestamps covered by tests?

### Analysis responsibilities

- Does detailed analysis remain the per-metric day/week/month trend and aggregate view?
- Does advanced analysis remain a separate direct destination for cross-record comparisons, relation analysis, and evidence? Do not force a route through detailed analysis.
- Are sample records excluded where required? Are data quality, record counts, missing values, date alignment, method, and limitations exposed instead of inventing a conclusion?
- Is the calculation layer still responsible for statistics and matching, with AI limited to explaining established results and limitations? No diagnosis, causal claim, fabricated metric, or unimplemented AI/Health capability is implied.

### UI quality

- At phone widths of 320, 360, 390, and 412 CSS pixels, check overflow, safe areas, touch targets, scrolling, font scaling, and text truncation. Inspect dark mode as well as the intentionally light forest home.
- Look specifically for accidental white-background exposure, clipped cards or charts, illegible contrast, and an interaction visible only through a gesture. A gesture needs a tappable alternative.
- For pressure history, verify saved-points-only display, local-day detail, seven-day cards, 30-day compact rows, explicit missing days, no interpolation, and no lines or change calculations across batches.
- For numeric entry, preserve the platform picker/roll behavior and stored minute precision; do not replace an optional numeric state with a forced zero or free-text-only control.
- For the current AI-card placeholder, reject visual glow or motion that claims an active AI result, transfer, prediction, or success. Future animation requires UX-C conditions and human approval.

### Verification and CI

- Confirm the reported commands and outcomes for `corepack pnpm check`, `corepack pnpm lint`, `corepack pnpm test`, `corepack pnpm exec expo export --platform web`, and `git diff --check`; require focused regression tests for touched contracts.
- Require Android/PWA smoke evidence when the change touches platform behavior, service worker, permissions, native modules, release packaging, or platform-specific UI.
- Confirm the actual GitHub Actions trigger. The current workflow verifies pull requests targeting `main` with type check, lint, tests, and web export. Pull-request runs do not deploy. Pending or failing PR checks block merge recommendation. After merge, separately verify the `main` verification and Pages deployment; pending, failed, or unverified post-merge state blocks the next task.

### Source synchronization and unknowns

- Are the three authoritative documents updated only when the PR has evidence for an implementation-status change? Has the author avoided changing roadmap purpose/order or accepted decisions without human approval?
- Does the PR disclose stale documentation, unverified device checks, missing CI, blocked approvals, or unresolved review comments? Unknowns must remain visible; do not convert them to assumptions.

## Turning a finding into a Codex instruction

Give Codex one actionable instruction per independent finding. Include:

1. Severity and observed behavior, with a file/line or reproducible scenario.
2. The violated Issue criterion or authoritative-document section.
3. The required outcome and the protected non-goal.
4. The test or UI evidence needed to close the finding.

Example: “P1 — `recordsFromCsv` treats a blank optional fatigue cell as `0`, violating SPEC section 6. Preserve it as missing through import and add blank-versus-zero CSV round-trip tests. Do not alter existing explicit zeros or change CSV column order.”

Do not give vague instructions such as “improve compatibility,” ask Codex to decide an unapproved product rule, or mix several unrelated repairs into one comment. If the remedy changes storage semantics, privacy, costs, health behavior, or roadmap scope, request a human decision instead.

## Human-decision gates

Stop and request a human decision before approving work that changes a persistent format or migration, CSV meaning/order, backup/restore or deletion semantics, external AI transmission, Health/smartwatch/location permission behavior, release publication, medical/safety language, roadmap order/purpose, accepted decisions, or a materially new UI direction. Also stop when the three authoritative documents, `AGENTS.md`, current code, or a PR requirement conflict in a way that changes behavior.

## Completion and next Issue

Work can recommend the PR for merge only when all acceptance criteria, scope boundaries, compatibility checks, required verification, UI evidence, and disclosed unknowns are satisfactory; blocking review comments and required human decisions must be resolved first. After merge, check the `main` Actions/deploy result. Mark a Phase ready to advance only when the authoritative plan's Definition of Done and transition condition are evidenced. Then create the next smallest safe Issue from the plan's current priority; do not skip a quality gate merely because a later feature is attractive.

## Work → Codex handoff protocol

GitHub PR state is the durable bridge. Work must not claim that it directly dispatched a Codex task unless the selected Codex surface actually accepted it.

Before sending a repair instruction:

1. Re-read the Issue and the three authoritative documents.
2. Confirm the PR number, full head SHA, changed files, unresolved comments, and current CI.
3. Reduce the finding to one bounded repair with explicit non-goals and verification.
4. Assign the finding's reproducible task ID from its canonical source:
   - use `review-comment-<immutable-numeric-comment-id>` for a GitHub review comment;
   - otherwise use another immutable GitHub anchor such as `issue-comment-<immutable-numeric-comment-id>`;
   - without an immutable GitHub anchor, use `issue-<issue-number>-criterion-<ordinal>` for an Issue acceptance criterion or `doc-<path>-heading-<slug>-rule-<ordinal>` for an authoritative documented rule, based on that source at the reviewed head.
     Never use event delivery, time, run identity, actor, or paraphrased finding text. Recover and reuse an existing marker's task ID for the same canonical source. If the source identity is ambiguous, record `BLOCKED` and do not dispatch.
5. Search the PR conversation for an existing marker:
   `<!-- work-to-codex:pr=<number>;head=<full-sha>;task=<stable-id> -->`
6. Immediately before posting, re-read the current full head SHA and all handoff markers. If the same PR/head/task marker already exists, treat it as pending or acknowledged and do not duplicate the instruction. Comment and review deliveries for one canonical finding must resolve to one ID and one dispatch; different source anchors must remain distinct.
7. Post the marker and the actionable instruction through the supported Codex PR conversation/review path.
8. Treat acknowledgement, a new Codex task, a pushed commit, CI, and merge as separate states. A response is acknowledgement, not completion. A new head requires a fresh diff and CI review before the finding can be closed; never blindly redispatch an instruction from the old head.

If Codex cannot attach to the repository environment, record `BLOCKED_HANDOFF` and stop automated repair. Do not loop on repeated mentions. A human may switch to Codex Code Review / Cloud and continue from the same Issue and PR.

After Codex produces a new head SHA, the next Work trigger starts a new review cycle. Work must re-check the new diff and checks instead of assuming the requested repair was implemented correctly.

## Event-trigger safety

The Work webhook task should react only to supported pull-request activity for this repository. It must ignore events that do not change review state and should not generate a next Issue merely because a comment arrived.

Recommended state outcomes are:

- `NO_ACTION`: no relevant change or duplicate event.
- `NEEDS_CODEX`: one bounded repair can proceed without a human product decision.
- `NEEDS_HUMAN`: a protected decision gate is reached.
- `WAITING_CI`: required PR or main checks are pending.
- `BLOCKED`: checks failed, merge conflict exists, or Codex handoff is unavailable.
- `READY_FOR_MERGE`: acceptance criteria met and required PR checks passed.
- `DEPLOY_CONFIRMED`: merged main revision and Pages deployment both confirmed successful.

Only `DEPLOY_CONFIRMED` allows Work to select the next task automatically.
