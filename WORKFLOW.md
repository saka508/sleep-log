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

GitHub is the bridge between Work and Codex. Do not assume a private direct Work → Codex handoff exists.

1. Work converts an approved goal into one bounded Issue and links the relevant authoritative sections.
2. Codex implements one coherent change, runs the required checks, and opens or updates one focused PR.
3. A Work event-triggered task watches supported pull-request activity in the authorized repository and reviews the current PR state.
4. Work compares the Issue, authoritative documents, current head SHA, diff, reviews, comments, and CI state.
5. If a repair is required, Work writes one concrete PR instruction for Codex. Prefer the Codex pull-request review/conversation path when available. A handoff is not considered accepted until Codex actually responds or produces a new revision.
6. Codex repairs the same branch/PR, runs verification, and reports the changed head SHA and evidence.
7. A later PR event triggers Work again. Work re-reviews the new revision rather than trusting the prior result.
8. When all acceptance criteria are met and PR checks succeed, Work may recommend merge. Automatic merge is intentionally disabled at this stage.
9. After merge, Work verifies the `main` Actions run and Pages deployment. Only a confirmed success may unlock the next task.

### Event-triggered Work task

The Work task may watch supported GitHub pull-request activity such as PR open/ready events, reviews, comments, commit updates, and completed merges. Its prompt must limit the task to `saka508/sleep-log` and the current PR, and must require the authoritative reading order before any recommendation.

The event task must be idempotent. Before issuing a Codex repair instruction, check the PR conversation for a marker in this form:

`<!-- work-to-codex:pr=<number>;head=<full-sha>;task=<stable-id> -->`

If the same PR number, head SHA, and task ID already exist, do not issue the same instruction again. A new head SHA permits a new review cycle. Bot acknowledgement, task creation, implementation completion, and CI success are separate states and must not be conflated.

If a GitHub `@codex` task comment fails to attach to the configured Codex environment, record the handoff as blocked instead of retrying indefinitely. The documented Codex code-review conversation may still be used to review the PR or prepare a bounded fix.

Codex may autonomously inspect, implement, test, repair, improve documentation that reflects already-approved behavior, and update PR evidence within the approved Issue scope. It must request human confirmation before changing the roadmap's purpose/order, accepted decisions, persistent data contracts, migrations, CSV meaning/order, deletion semantics, external AI or data transmission, Health/permission behavior, release publication, or a materially new visual direction. Human confirmation is also required when an ambiguity changes user-visible meaning, privacy, cost, safety, or the scope of an Issue.

## Required verification and phase completion

For a code change, run `corepack pnpm check`, `corepack pnpm lint`, `corepack pnpm test`, `corepack pnpm exec expo export --platform web`, and `git diff --check`, plus focused regression tests for every protected boundary touched. Perform Android/PWA smoke or device checks when the change affects native behavior, platform-specific UI, service-worker behavior, permissions, or release packaging. For a documentation-only change, validate Markdown, Issue-template YAML front matter where applicable, template placement, `git diff --check`, and that no application files changed.

A work unit is complete only when its Issue acceptance criteria are met, its change remains within scope, compatibility evidence is present, required tests and UI checks are reported, no unresolved blocking finding remains, and any required human decision has been made. A Phase advances only when the authoritative plan's Definition of Done and transition condition are both satisfied; Work, rather than Codex alone, makes that supervisory judgment. Update an implementation status only when its evidence exists; changing the roadmap's order, purpose, or decision still needs human approval.

## Current priority

Do not hard-code a phase priority in this operating guide. Re-read `docs/DEVELOPMENT_PLAN.md` at the start of every Issue and after each successful merge/deploy cycle. The plan is the source of truth for the next safe work unit.
