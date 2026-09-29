# Effort tiers

The Agent tool has no effort knob. "Effort" is what the packet tells the agent to do
before it reports done: how much to read, how much to verify, how much to write back.
Every implementer and fixer is `model: "opus"` regardless of tier — the tier changes
the instructions, never the model. A smaller model at high effort is still a smaller
model; Opus at low effort is cheap because the packet is short and the unit is small.

Pick the tier per unit and write the one-line reason in the plan. When in doubt, go
one tier up: an over-worked unit costs tokens, an under-worked unit costs a review cycle.

## Choosing

| Tier | Use when | Typical units |
|---|---|---|
| **low** | Mechanical, one file or one pattern, an exact analog exists to copy | Docs update, adding a column to an existing table component, wiring an existing endpoint into an existing page, renaming |
| **medium** | Several files in one app, some judgement, but no money, ownership scoping, or schema logic | New page + components against an existing endpoint, new route + service that is CRUD-shaped, form with validation |
| **high** | Any of: money math, ownership scoping, permissions, schema-adjacent code, cache invalidation, concurrency, migration of historical data, anything the review checklist §5 (performance) cares about | Payment allocation, status transitions, list queries, anything with `findMany` on organization-owned tables, auth or RBAC changes |

Fixers inherit the tier of the most severe finding they are fixing: an ownership finding
makes the fixer high even if the unit was medium.

## What each tier says in the packet

Paste the matching block into the packet's `## Effort` section.

### low

```
## Effort: low
- Mirror the analog file(s) named above exactly; do not explore beyond the listed files
  and the rules docs.
- Run `pnpm --filter @cashsouk/<your app> lint` and
  `pnpm --filter @cashsouk/<your app> typecheck` before reporting.
- Report in under 10 lines: files changed, one line per decision, anything unsure.
```

### medium

```
## Effort: medium
- Read the analog feature end to end (route → service → API client → page → component)
  before writing anything, and the rules docs named above.
- Before coding, list the edge cases you will handle (empty, loading, error,
  permission denied) in your notes; handle all of them.
- After coding, re-read your own diff once against build-feature
  references/review-checklist.md §2 or §3 (whichever is your side) and fix what you find.
- Run `pnpm --filter @cashsouk/<your app> lint` and
  `pnpm --filter @cashsouk/<your app> typecheck` before reporting.
- Report: files changed, decisions made with the reason, edge cases covered,
  anything you were unsure about (be honest — the orchestrator resolves these, and an
  unflagged guess is worse than a flagged one).
```

### high

```
## Effort: high
- Read the rules docs named above in full, then the analog feature end to end.
- Before coding, write down in your notes: the invariants this code must hold
  (ownership scoping, money precision, permission), the edge cases, and the failure
  paths. Design the change against that list first.
- Every query on organization-owned data filters by the organization/user from auth
  context, never from the request.
- Every findMany you add or touch is bounded (take / id list) or justified in a comment.
- After coding, review your own diff against build-feature references/review-checklist.md
  §2–§5 as if you were a hostile reviewer; fix what you find and list what you fixed.
- Run `pnpm --filter @cashsouk/<your app> lint` and
  `pnpm --filter @cashsouk/<your app> typecheck`. If a real-DB equivalence or jest test
  applies to what you changed, run it and paste the result.
- Report: files changed, invariants and how each is enforced, edge cases covered,
  what you self-reviewed and fixed, and anything you are unsure about. Do not smooth
  over uncertainty.
```
