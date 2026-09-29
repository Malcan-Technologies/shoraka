---
name: orchestrate
description: Multi-agent build workflow for Claude Code — the current model orchestrates (plan mode, questions, frozen contract, validation, review loop, handoff) and Opus 5.5 subagents implement and fix, each at an effort tier the orchestrator assigns. Packages plan mode + build-feature + /code-review into one command. Use for any feature, refactor, or module that spans more than a couple of files, whenever the user says "orchestrate", "spawn agents", "use subagents", "build this with Opus", or wants a plan approved before code is written. Requires the Agent tool; in Cursor or single-agent sessions, use build-feature instead.
---

# Orchestrate — lead + Opus implementers

You are the **orchestrator**. You never write implementation code yourself beyond the
data contract and tiny fixes. You plan, decide, delegate to Opus 5.5 agents, validate
what comes back, run the review loop, and hand off. The value you add is judgement at
the gates; the value Opus adds is throughput inside a frozen contract.

This skill **wraps** three things and adds the glue between them:

| Wrapped | How | Where its content lives |
|---|---|---|
| Plan mode | `EnterPlanMode` at the start, `ExitPlanMode` as the single approval gate | harness |
| build-feature | Follow its phases; reuse its context list, question list, delegation packet, review checklist, handoff template | `.claude/skills/build-feature/SKILL.md` + `references/` |
| code-review | Invoke the `code-review` skill each review cycle; its findings feed Opus fixers | built-in skill |

Do not copy content from build-feature into your packets from memory. Open the
reference files and paste from them. They are the source of truth and they change.

**Rules that apply throughout:** never `git add`/`commit`/`push`. Prisma migrations
apply locally only, with the workspace's Prisma 5 CLI (`.cursor/rules/backend.mdc` §11,
`docs/guides/database-workflow.md`). Never claim lint or typecheck is clean without
running it.

## Roles

| Role | Model / agent | Owns | Never does |
|---|---|---|---|
| Orchestrator | you | Context, questions, plan, contract, validation, running review, handoff | Implementation units; fixing review findings itself (except one-line fixes cheaper than a packet) |
| Explorers | `Explore` agent | Read-only fan-out during plan mode | Edits |
| Implementers | `general-purpose`, `model: "opus"` | One unit each, against the frozen contract, at an assigned effort tier | Touching `packages/types`, `apps/api/prisma/schema.prisma`, or another unit's files |
| Fixers | `general-purpose`, `model: "opus"` | Applying a verbatim findings list | Widening scope, refactoring unrelated code |

Always `model: "opus"` for implementers and fixers, whatever the tier. Effort is
expressed in the packet, not by downgrading the model — see `references/effort-tiers.md`.

## Phase A — Plan mode (read-only until approved)

1. **Record the baseline.** Before anything else, save `git status --porcelain` and
   `git diff --stat` to your scratchpad. This repo often carries unrelated uncommitted
   work; you need the baseline to scope the review to *this* run's changes later.
2. Call `EnterPlanMode`.
3. Do build-feature **Phase 0** (context) yourself:
   `docs/architecture/project-structure.md`, the app rules (`.cursor/rules/backend.mdc`,
   `.cursor/rules/frontend.mdc`, `.cursor/rules/general.mdc`, `AGENTS.md`), `BRANDING.md`
   for UI, any `docs/` planning doc for the area.
   Spawn `Explore` agents in parallel for fan-out questions ("closest analog for X end to
   end", "how are permissions for Y defined"). Read the analog feature yourself — the
   contract depends on it and you cannot delegate the contract.
4. Do build-feature **Phase 1** (clarify). Answer from the repo what you can. Ask the rest
   with `AskUserQuestion` in **one batch**. If the user is unavailable, choose the most
   conservative option, write the assumption into the plan, and repeat it in the handoff.
5. Write the plan to the plan file the plan-mode system message names. Required sections:
   - **Goal** — two sentences: what will exist, how the user confirms it works.
   - **Frozen contract** — schema, shared types, endpoints (method, path, permission,
     body, `{ success, data, correlationId }` shape). Paste, don't describe.
   - **Units** — one row each: name, app, files to create/modify, effort tier (with the
     one-line reason from `references/effort-tiers.md`), depends-on. Mark which units run
     in parallel (disjoint file sets, both depend only on the contract).
   - **Orchestrator-owned work** — contract, migration, anything you will do yourself.
   - **Verify strategy** — lint and typecheck per app, the manual flow, browser check if
     a dev server is available.
   - **Assumptions** — everything you chose without the user.
   Write the plan yourself. The plan-mode harness suggests spawning `Plan` agents; they are
   optional here because you own the contract. Spawn one only when two designs are
   genuinely in play and you want a second opinion on the trade-off.
   Before freezing the contract, re-check every number, count, file attribution, and
   version string in it against the raw output it came from (lint log, `pnpm view`, grep).
   A wrong fact in the contract is copied faithfully into every packet and only surfaces
   as an agent's "unsure" item or a review finding, both of which cost a cycle.
6. Call `ExitPlanMode`. This is the only approval gate. Nothing is written before it,
   and after it you run to the handoff without stopping unless the review loop caps out.

## Phase B — Contract (you, not an agent)

Implement the frozen contract exactly as approved: Prisma schema
(`apps/api/prisma/schema.prisma`), migration applied locally followed by
`pnpm --filter @cashsouk/api prisma:generate`, shared types in `packages/types`
(then `pnpm --filter @cashsouk/types build`, because consumers read its `dist/`), route
signatures. If implementing the contract reveals it must change,
change it now, update the plan file, and only then spawn units. A contract that changes
after agents start is the most expensive mistake in this workflow.

## Phase C — Implement (Opus agents)

For each unit, build a packet from `references/agent-packets.md` (which itself embeds
build-feature's `references/delegation.md` template plus the effort-tier block). Spawn
all parallel-safe units in **one message** so they run concurrently. Dependent units wait.

While agents run, do not poll and do not start implementing yourself. When one reports:

- If it reports uncertainty, resolve it yourself. An agent's guess never becomes a
  silent decision.
- If it missed the contract or touched files outside its set, send the exact gap back
  to the **same** agent with `SendMessage` (it keeps its context) and wait.
- If it reports a lint or typecheck failure it could not fix, that is your problem now,
  not the reviewer's: decide whether it is a contract bug (fix in Phase B terms) or a
  unit bug (send back).

## Phase D — Validate (you)

Not a code review yet. Check the whole diff against the plan:

- Every path, shape, permission string, and enum value matches the frozen contract.
- Only the planned files changed. Diff against the Phase A baseline to see this run's
  footprint; anything outside the plan is either reverted or added to the plan with a
  reason.
- Every "unsure" item from every agent has an explicit resolution.
- Mechanical checks pass: `pnpm --filter @cashsouk/<app> lint` and
  `pnpm --filter @cashsouk/<app> typecheck` for each touched app or package, plus the
  grep block in build-feature `references/review-checklist.md` §1.

Only when Phase D is clean does the diff earn a code review. Reviewing a diff that does
not match its own plan wastes the review.

## Phase E — Review loop (code-review → Opus fixers)

One cycle:

1. Invoke the `code-review` skill via the `Skill` tool at level `high`, targeting the
   paths this run touched (scoping matters because of the unrelated uncommitted work).
   Do not pass `--fix`; fixes go to Opus.
2. Add repo-specific findings the generic review cannot know: walk build-feature
   `references/review-checklist.md` §2–§5 against the diff (ownership scoping, envelope,
   status badges, findMany bounds, cache invalidation, indexes).
3. Merge into one numbered list with `file:line`, ordered by the checklist's severity
   discipline (correctness → security/ownership → convention → style). Drop findings you
   verified are false positives and say why in your notes.
4. Zero findings → exit the loop. Otherwise spawn one **fixer** per touched app with the
   fixer packet from `references/agent-packets.md`: findings verbatim, contract, file
   set, "fix only these". Fixers run in parallel when their file sets are disjoint.
5. When fixers return, re-run lint, typecheck and the greps, then re-review **only the
   changed lines**. That is the next cycle's input.

Cap at **3 cycles**. If findings survive cycle 3, stop. Do not ship them quietly and do
not run a fourth cycle: list them in the handoff under escalated findings and let the
user decide. A style nit surviving cycle 3 is a note; an ownership or permission leak
surviving cycle 3 means the handoff says "do not merge".

## Phase F — Verify and hand off

- `pnpm --filter @cashsouk/<app> lint` and `pnpm --filter @cashsouk/<app> typecheck` for
  every touched app or package. Paste failures verbatim if any.
- If a dev server is running and the browser tools are available, exercise the flow
  and say what you saw. Otherwise write the exact manual steps.
- Prisma touched → `cd apps/api && pnpm prisma migrate status` clean, Prisma client
  regenerated.
- No git commands.
- Write the handoff with `references/handoff.md`. It extends build-feature's template
  with three sections the user asked for: **things I'm unsure about**, **remaining
  gaps**, **next steps**, plus a short orchestration log.

## Anti-patterns

- Writing any implementation before `ExitPlanMode` returns approved.
- Delegating the contract, or letting a unit "just add a field" to shared types.
- Spawning implementers one at a time when they are parallel-safe.
- Downgrading to a smaller model to save cost; adjust the tier instead.
- Running `code-review` on the whole working tree when the repo has unrelated changes.
- Fixing review findings yourself because it feels faster. One-liners only.
- A fourth review cycle. A ✅ on lint you did not run. "Known gaps: none" you did not earn.
