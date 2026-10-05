# Sleep Log autonomous development workflow

This document defines the operating loop for Work, Codex, and GitHub. It is an execution and review guide, not a replacement for product decisions.

## Authority and reading order

The three authoritative product documents are:

1. [`docs/DEVELOPMENT_PLAN.md`](docs/DEVELOPMENT_PLAN.md) — roadmap, current priority, phase status, and completion conditions.
2. [`docs/SPEC.md`](docs/SPEC.md) — current product behavior, data contracts, UI policy, and constraints.
3. [`docs/DECISIONS.md`](docs/DECISIONS.md) — accepted decisions and their reasons.

`WORKFLOW.md`, [`docs/WORK_AUTONOMOUS_REVIEW.md`](docs/WORK_AUTONOMOUS_REVIEW.md), `AGENTS.md`, README files, prior reports, and chat history are operating guidance or evidence. If they conflict with the three documents, the three documents take precedence. A conflict, stale commit reference, or unresolved fact must be recorded in the Issue or PR; it must not be silently resolved by changing an authoritative document.

Before any task, read the three documents in the order above, then the applicable `AGENTS.md`. Inspect the actual code and tests for the proposed scope. Treat untracked files and unrelated changes as someone else's work unless their owner explicitly includes them.

## Responsibilities

| Surface     | Owns                                                                                                                                                       | Does not own                                                                                                           |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Normal chat | Clarifies intent, gives context, and makes explicit human decisions.                                                                                       | Repository state, approval by silence, or an implicit product decision.                                                |
| Work        | Supervises the Issue, checks quality and scope, turns findings into clear next-Issue or PR-review instructions, and decides whether a phase can advance.   | Implementing code in place of Codex or inventing product/data decisions.                                               |
| Codex       | Inspects the repository, implements the approved bounded scope, writes and runs tests, fixes its findings, stages only in-scope files, and updates the PR. | Expanding the Issue, changing protected data contracts without approval, or treating planned functionality as shipped. |
| GitHub      | Holds the shared branch history, Issues, PR discussion, reviews, Actions, and release state. `main` is the shared integration reference.                   | Replacing the three authoritative product documents or making a human approval decision.                               |

Work should produce an actionable Issue or review instruction: goal, non-goals, protected contracts, completion checks, and the exact evidence to return. Codex should return the implementation, tests, open questions, and a PR that Work can review. GitHub keeps the durable shared state; it is not a substitute for a decision recorded in the three authoritative documents.

## Mandatory preflight and Git discipline

Before editing, Codex records:

- current branch, `HEAD`, and refreshed `origin/main`;
- `git status --short --branch`, including staged, modified, and untracked files;
- `main...origin/main` divergence, relevant existing Issues/PRs, and the latest relevant Actions result;
- applicable files under `.github/`, existing templates, and the three authoritative documents.

Use one bounded task per branch and PR. Start from the agreed base, use a `codex/` branch by default, never force-push, and never stage by glob or `git add .`. Inspect the final diff and stage only the task files. Do not delete, reformat, move, commit, or "clean up" unrelated local changes.

The repository's current deploy workflow runs verification on pull requests targeting `main` and again on non-PR deployment runs. Pull-request runs execute type check, lint, tests, and the web export but never deploy. A merge must not be recommended while required PR checks are pending or failing. After merge, Work must separately verify the `main` run and Pages deployment; pending, failed, or unverified post-merge state blocks the next task.

## Protected data and compatibility rules

Existing user data is the highest-priority compatibility boundary.

- `SleepRecord` remains the persisted day record. Its `id` is the local `date` key, and one daily record per `YYYY-MM-DD` is enforced. Do not silently change, reinterpret, or mass-rewrite existing records.
- `DailyConditionRecord` is a read-only model derived from `SleepRecord`; it is not proof of a completed storage migration. Do not turn it into the persisted format without an approved storage contract.
- Protect AsyncStorage keys, especially `sleep-log.local-data.v1`, `sleep-log.headache-events.v1`, `sleep-log.pressure-history.v1`, and `sleep-log.theme`. Keep the independent headache-event and pressure-history stores separate from daily records.
- Preserve CSV compatibility: existing daily-column meaning and ordering stay intact, legacy CSV remains readable, and the pressure-history backup remains separate JSON. Do not silently mix daily CSV, headache-event JSON, and pressure-history JSON.
- Date keys are local dates. Use the established date helpers; never create a daily key with `toISOString().slice(0, 10)`. Explicitly test crossing midnight, local boundaries, and existing time precision when a task touches time.
- A destructive or schema-level change requires a versioned, idempotent migration design, backup and recovery behavior, old-data fixtures, and human approval before implementation.

### Sleep-duration provenance

`legacy` and `actualSleep` are distinct meanings, not two values that can be averaged together. Records or old CSV without `sleepDurationDefinition` remain `legacy`; do not retroactively deduct latency or infer a new sleep duration. New or re-saved records marked `actualSleep` may drive actual-sleep comparisons, recommendations, and applicable detailed or advanced analyses. Keep legacy records visible in history/detail, exclude them from actual-sleep calculations, and expose exclusion counts as evidence.

### Missing is not zero

`undefined`, `null`, an empty input, and an explicit `0` have different meanings. Preserve that distinction through the form, normalization, AsyncStorage, CSV/JSON import-export, derived models, charts, and analysis. Do not fill a missing value with zero to make a graph or aggregate easier. In particular, a daily headache marked present with an unknown intensity remains missing for intensity analysis, while an explicit zero continues to mean zero.

## Product and UI guardrails

### Detailed and advanced analysis

Detailed analysis is the existing per-metric day/week/month view: trends, aggregates, and concise data-quality context. Advanced analysis is a separate direct menu destination for cross-record condition comparisons, existing relation analysis, and cross-cutting evidence. Do not make one an implicit replacement for the other.

The calculation layer determines records, date alignment, sample count, missing values, and statistics. AI may only explain those established results and limitations. It must not invent records, metrics, statistical values, causal claims, diagnoses, or an unavailable integration. AI communication, prediction, and Health/smartwatch synchronization are not currently implemented.

### Pressure-history UI

Pressure history is a short-lived, independent batch series. Show only saved points: a local-calendar-day detail graph, newest-first seven-day cards for a week, and newest-first 30-day compact rows with a selected-day detail for a month. Show missing days as unavailable, never interpolate missing values, and never connect or calculate changes across batches. For a day with several batches, use only the batch containing the latest observation for its summary and 3-hour/24-hour change. The home weather circle may show those changes or a data-insufficient state; it must not become a graph.

### Numeric input and mobile layout

Use the established control that matches the number: the native date/time dialog on Android and the web/PWA date or time picker columns; score controls for 0–10 inputs; and the existing duration/time conversion helpers. Numeric pickers may use platform wheel/roll behavior, but must not require free-text entry, erase a stored minute precision, or turn an optional value into zero. Standard web minute choices are five-minute increments while a stored nonstandard minute remains selectable.

Design mobile first. Verify 320, 360, 390, and 412 CSS-pixel widths where the screen changes, including safe areas, text scaling, touch targets, dark mode, scroll behavior, no horizontal overflow, no clipped labels, and no unintended white background exposure. Do not hide an essential action behind a gesture without a tappable alternative.

### AI-card visual policy

The current home AI card is a non-networked, non-diagnostic placeholder. Do not make its glow, pulse, or animation imply an active analysis, data transfer, prediction, or success state. A future visual accent must be restrained, static by default, readable in light and dark contexts, and never the only status signal. Animated or reactive glow belongs to the UX-C motion track: it requires a static-preview review, Reduced Motion and mute behavior, no rapid flashing, performance validation, and human approval before implementation.

## Autonomous loop

GitHub is the bridge between Work and Codex. There is no direct Work → New Codex Cloud dispatch in the current workflow.

1. Work converts an approved goal into one bounded Issue and links the relevant authoritative sections.
2. Codex implements one coherent change, runs the required checks, and opens or updates one focused PR.
3. A Work event-triggered task watches supported pull-request activity in the authorized repository and reviews the current PR state.
4. Work compares the Issue, authoritative documents, current head SHA, diff, reviews, comments, and CI state.
5. If a repair is required, Work persists one concrete PR instruction with a deterministic task ID. Persistence does not start Codex, and the legacy GitHub `@codex` invocation is not a required path.
6. A human starts New Codex Cloud with the existing `sleep-log` environment. This is the workflow's only manual start action; no unavailable Work → New Codex Cloud dispatch is assumed.
7. New Codex Cloud uses the connected GitHub connector to retrieve the PR and latest incomplete handoff, confirms the PR/head/task marker, and repairs only that bounded scope on the same branch/PR.
8. New Codex Cloud runs verification and pushes the same PR branch. The new full head SHA is completion evidence and triggers Work re-evaluation.
9. Work re-reviews the new revision and CI rather than trusting acknowledgement or the prior result.
10. When all acceptance criteria are met and PR checks succeed, Work may recommend merge. Automatic merge is intentionally disabled at this stage.
11. After merge, Work verifies the `main` Actions run and Pages deployment. Only a confirmed success may unlock the next task.

### Event-triggered Work task

The Work task may watch supported GitHub pull-request activity such as PR open/ready events, reviews, comments, commit updates, and completed merges. Its prompt must limit the task to `saka508/sleep-log` and the current PR, and must require the authoritative reading order before any recommendation.

The event task must be idempotent. Before issuing a Codex repair instruction, check the PR conversation for a marker in this form:

`<!-- work-to-codex:pr=<number>;head=<full-sha>;task=<stable-id> -->`

The task ID identifies the canonical finding, not the event that reported it. Use `review-comment-<immutable-numeric-comment-id>` for a review-comment finding and an equivalent immutable GitHub object ID, such as `issue-comment-<immutable-numeric-comment-id>`, for another anchored finding. If no immutable GitHub object anchors it, use a canonical source coordinate: `issue-<issue-number>-criterion-<ordinal>` for an Issue acceptance criterion or `doc-<path>-heading-<slug>-rule-<ordinal>` for an authoritative documented rule. Derive the coordinate from that source at the reviewed head, never from delivery metadata, time, run identity, actor, or paraphrased text. Recover and reuse the task ID from an existing marker for the same canonical source. If the source identity is ambiguous, record `BLOCKED` rather than dispatching.

Immediately before posting, re-read the current full head SHA and existing markers. If the same PR number, head SHA, and task ID already exist, the repair is pending or acknowledged; do not issue it again. A comment event and review event for the same review comment therefore produce the same ID and one dispatch, while separate source anchors remain separate findings.

Use three explicit lifecycle states:

- `handoff persisted`: Work wrote the marker and bounded repair to the PR. Work must not report this as task start or acknowledgement.
- `Codex retrieval/acknowledgement`: New Codex Cloud, running in the existing `sleep-log` environment, retrieved the handoff through the connected GitHub connector and confirmed its PR, full head SHA, and task ID.
- `completion`: New Codex Cloud pushed the repair commit to the same PR branch and GitHub reports the new full head SHA.

Acknowledgement is not completion, and CI success remains separate. A new head starts a fresh review cycle: inspect its diff and CI before deciding that the finding is resolved or issuing another instruction.

The current path requires one human action to start the New Codex Cloud task. After that start, Codex retrieves the latest incomplete handoff, performs only that bounded repair, verifies it, and pushes the same branch. The head update triggers the Work event supervisor. Do not claim or depend on a nonexistent direct Work → New Codex Cloud dispatch.

The legacy GitHub `@codex` invocation is optional and is not the required implementation path. If its repository-environment attachment fails, do not retry it and do not mark the workflow `BLOCKED` when New Codex Cloud plus the connected GitHub connector can still retrieve and update the PR. Use `BLOCKED` with a handoff-specific reason only when no documented path can retrieve the handoff or update the same PR branch.

### CI and Pages reconciliation

PR/head and merge events commonly arrive before their GitHub Actions or Pages results. When supported workflow/check/deployment completion events are unavailable to Work, configure the hourly task in [`docs/WORK_EVENT_TASK_PROMPT.md`](docs/WORK_EVENT_TASK_PROMPT.md). It is a narrow observer, not a second development supervisor.

Every wait persists a durable queue item:

`<!-- work-reconcile:pr=<number>;target=<pr-ci|main-ci|pages>;sha=<full-sha>;state=pending -->`

The reconciler processes only the latest `pending` PR/target/SHA tuple whose latest Work state remains `WAITING_CI`. Before posting a result, it searches for the exact tuple and result marker; an existing marker makes the run a no-op. It may post at most one result marker and one corresponding Work status transition.

| Pending target | Pending result                              | Success result                                                       | Failure, cancelled, unavailable, or stale result                                    |
| -------------- | ------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `pr-ci`        | Remain `WAITING_CI` without another comment | Re-review the current head and choose the appropriate existing state | `BLOCKED`; a stale head is recorded once and the new-head event owns the next cycle |
| `main-ci`      | Remain `WAITING_CI` without another comment | Create one `pages` pending tuple for the same merged `main` SHA      | `BLOCKED`                                                                           |
| `pages`        | Remain `WAITING_CI` without another comment | `DEPLOY_CONFIRMED`                                                   | `BLOCKED`                                                                           |

`success`, `failure`, and `stale` are terminal for that tuple. A PR whose latest Work state is no longer `WAITING_CI` is not eligible. Reconciliation must not duplicate status comments or repair handoffs, push changes, merge, or create a next task. Only the normal review path may create a later deterministic `work-to-codex` handoff, and only `DEPLOY_CONFIRMED` may unlock task selection.

Codex may autonomously inspect, implement, test, repair, improve documentation that reflects already-approved behavior, and update PR evidence within the approved Issue scope. It must request human confirmation before changing the roadmap's purpose/order, accepted decisions, persistent data contracts, migrations, CSV meaning/order, deletion semantics, external AI or data transmission, Health/permission behavior, release publication, or a materially new visual direction. Human confirmation is also required when an ambiguity changes user-visible meaning, privacy, cost, safety, or the scope of an Issue.

## Required verification and phase completion

For a code change, run `corepack pnpm check`, `corepack pnpm lint`, `corepack pnpm test`, `corepack pnpm exec expo export --platform web`, and `git diff --check`, plus focused regression tests for every protected boundary touched. Perform Android/PWA smoke or device checks when the change affects native behavior, platform-specific UI, service-worker behavior, permissions, or release packaging. For a documentation-only change, validate Markdown, Issue-template YAML front matter where applicable, template placement, `git diff --check`, and that no application files changed.

A work unit is complete only when its Issue acceptance criteria are met, its change remains within scope, compatibility evidence is present, required tests and UI checks are reported, no unresolved blocking finding remains, and any required human decision has been made. A Phase advances only when the authoritative plan's Definition of Done and transition condition are both satisfied; Work, rather than Codex alone, makes that supervisory judgment. Update an implementation status only when its evidence exists; changing the roadmap's order, purpose, or decision still needs human approval.

## Current priority

Do not hard-code a phase priority in this operating guide. Re-read `docs/DEVELOPMENT_PLAN.md` at the start of every Issue and after each successful merge/deploy cycle. The plan is the source of truth for the next safe work unit.
