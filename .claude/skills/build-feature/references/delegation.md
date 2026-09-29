# Delegation — splitting work across agents

## Why delegation fails (and how to prevent it)

Subagents share **nothing** with you: no conversation history, no rules you've read,
no decisions you've made. Every failure mode of delegation is a missing sentence in
the packet. Write packets as if onboarding a competent contractor on day one.

## Capability mapping

| Task shape | Claude Code agent | Notes |
|---|---|---|
| "Where is X / how does Y work across many files" | `Explore` | Read-only, fast fan-out search. Give it the question, not instructions. |
| "Design the approach for X" | `Plan` | Returns a plan; you still own the decision. |
| Implementation unit (backend, frontend, docs) | `general-purpose` | Full tools. One unit per agent. |
| Tiny fix, single file | nobody | Do it yourself; a packet costs more than the fix. |

In Cursor without subagents: execute the same units yourself sequentially, contract
first. The decomposition and packet discipline still apply — write the "packet" as
your own working notes so the review phase can check implementation against it.

## Parallel-safety rule

Two units may run in parallel **only if** their file sets are disjoint and both depend
only on the frozen contract. Backend (`apps/api/**`) and frontend (`apps/admin/**`, or
another portal app) qualify once schema + shared types + route signatures are done
and committed to the plan. Two agents editing `packages/types` never qualify.

## The delegation packet (required sections)

Send ALL of this to every implementing agent:

```
## Task
One paragraph: what to build and the definition of done.

## Contract (frozen — do not change)
- Endpoints: METHOD /v1/... — permission string — request body — response `{ success, data: ..., correlationId }`
- Types: paste the shared types or their exact file location
- Schema: paste the relevant Prisma models (lead applies local migrate + generate per backend.mdc §11)

## Files
- Modify: exact paths
- Create: exact paths
- Do NOT touch: anything outside these (especially packages/types, apps/api/prisma/schema.prisma)

## Conventions (do not rediscover — obey)
- Read .cursor/rules/backend.mdc / frontend.mdc / general.mdc, AGENTS.md and BRANDING.md first
- Mirror this existing feature: <path to the closest analog you found in Phase 0>
- Backend: services hold logic, controllers orchestrate (backend.mdc §1); errors via
  AppError (apps/api/src/lib/http/error-handler.ts); requirePermission(...); audit via
  the helpers in apps/api/src/lib/audit
- Frontend: createApiClient from @cashsouk/config; formatCurrency from @cashsouk/config;
  status via StatusBadge from @cashsouk/ui; no hardcoded colours, tokens only (BRANDING.md)

## Verify before reporting done
- pnpm --filter @cashsouk/<your app> lint and
  pnpm --filter @cashsouk/<your app> typecheck must pass
- Report: files changed, decisions made, anything you were unsure about
```

## After the agents return

Do not trust "done." Their report enters your Phase 4 review loop like any other
untrusted diff. If an agent reports uncertainty, resolve it yourself — never let an
agent's guess become a silent decision.
