# Agent packets

Subagents share nothing with you: no conversation, no rules you read, no plan you
approved. Every delegation failure is a missing sentence in the packet. Build packets
from these templates, pasting real content — file paths, types, endpoint shapes — never
"see the plan".

Spawn with the `Agent` tool: `subagent_type: "general-purpose"`, `model: "opus"`,
`description` naming the unit (e.g. `Unit A backend write-off`). Spawn every
parallel-safe unit in one message.

## Implementer packet

Start from build-feature `references/delegation.md` → "The delegation packet" and keep
all of its sections (Task, Contract, Files, Conventions, Verify). Then add:

```
## Role
You are one implementer in a multi-agent build. An orchestrator owns the contract and
will validate your work against it before a separate code review. Other agents are
working on other units in parallel — stay inside your file set or you will collide
with them.

## Effort: <low|medium|high>
<paste the matching block from references/effort-tiers.md>

## Hard limits
- Do not modify packages/types, apps/api/prisma/schema.prisma, or any file not listed
  under Files. If you believe you need to, stop and report why instead.
- Do not run any git command that changes state (add, commit, push, stash, checkout).
- Do not run Prisma migrations; the orchestrator already applied them.
- Do not "improve" neighbouring code you were not asked to touch.

## Report format
Files changed (path — what)
Decisions made (each with the reason)
Edge cases covered
Unsure about (be specific; empty only if genuinely nothing)
Lint and typecheck result (paste the commands and the last lines of output)
```

## Fixer packet

Used in Phase E. One fixer per touched app; disjoint file sets may run in parallel.

```
## Task
Apply the review findings below to the working tree. Fix only what is listed. The
implementation was already validated against the contract; your job is to make these
specific findings go away without changing behaviour that was not flagged.

## Findings (verbatim — fix each, in this order)
1. <file:line> — <finding>
2. ...

## Contract (frozen — do not change)
<paste from the plan>

## Files you may touch
<the unit's file set; if a finding requires a file outside it, stop and report>

## Conventions
- Read .cursor/rules/backend.mdc or frontend.mdc (whichever applies), general.mdc,
  AGENTS.md, and BRANDING.md for UI.
- Fixes must use the same helpers the checklist demands (AppError, createApiClient,
  StatusBadge, formatCurrency). Do not introduce a new pattern to fix an old one.

## Effort: <tier of the most severe finding>
<paste the matching block from references/effort-tiers.md>

## Hard limits
Same as the implementer packet: no files outside the set, no git state changes, no
migrations, no unrelated refactors.

## Report format
For each finding number: fixed (how) | not fixed (why — e.g. false positive, needs
contract change, outside file set)
Lint and typecheck result (paste)
Anything you noticed that is a new finding but was not on the list (do not fix it —
report it)
```

## Corrections to an agent that already reported

Use `SendMessage` to the same agent rather than a new spawn: it keeps the context of
what it built. Send the exact gap ("the response shape is
`{ success, data: Note, correlationId }` but you return the raw note") and the expected
result. Wait for it to report again before validating.

## When not to spawn

A fix that is one or two lines and unambiguous costs less to do yourself than to
package. Do it, note it in the orchestration log, move on. Anything larger goes to an
agent — not because you can't, but because the workflow's value is that the person
who wrote the plan is not the person writing the code.
