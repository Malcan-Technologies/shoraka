---
name: build-feature
description: Lead-developer workflow for building features in this monorepo — clarify requirements first, architect, delegate to subagents by capability, review and fix in a loop, verify, then hand off. Use for any multi-step feature, refactor, or new module. Invoke before writing any code.
---

# Build Feature — Lead Developer Workflow

You are acting as the lead developer on this codebase. Your job is not to write code
fastest — it is to ship the *right* change, verified, consistent with the repo's rules,
and cleanly handed off. Follow the five phases in order. Each phase has a gate; do not
pass a gate by assumption.

**Golden rule: facts live in the repo — go read them. Intent lives with the user — go ask.**
Never burn tokens guessing at intent, and never interrupt the user for facts you can
grep for yourself.

## Phase 0 — Context (read before anything)

1. Read `docs/architecture/project-structure.md` to identify which app(s) the feature
   touches. Apps in this repo: `apps/api` (Express + Prisma) and the Next.js portals
   `apps/admin`, `apps/issuer`, `apps/investor`, `apps/landing`. Getting the app wrong
   wastes the entire task.
2. Read the applicable rules: `.cursor/rules/backend.mdc`, `.cursor/rules/frontend.mdc`,
   `.cursor/rules/general.mdc`, `AGENTS.md`, and `BRANDING.md` +
   `.cursor/rules/branding.mdc` for UI work.
3. Find the closest existing feature and read it end-to-end (route → service → API client
   → page → components). Copy its shape. This repo is convention-heavy; a feature that
   ignores an existing pattern is wrong even if it works.
4. Check `docs/` for a planning or architecture doc about this area before designing
   anything (e.g. `docs/architecture/`, `docs/guides/`, `docs/ai-context/`).

## Phase 1 — Clarify (gate: requirements are unambiguous)

Before designing, list every open question. Answer from the codebase what you can.
For the rest, **ask the user in one batch** — do not trickle questions one at a time,
and do not proceed on guesses. Questions that are almost always worth asking for this
repo when the request doesn't specify:

- **Scope:** Which surfaces (admin, api, issuer, investor, landing)?
- **Data:** new tables/fields, or reuse? Soft-delete or hard-delete? Historical data
  migration needed?
- **Permissions:** which permission string gates this
  (`requirePermission('x.view'/'x.manage')`, strings defined in
  `packages/types/src/rbac.ts`, guide in `docs/guides/rbac.md`)? New permission or
  existing?
- **UX:** table + detail page, wizard, or dialog? What appears in audit logs?
- **Edge policy:** what should happen on the ugly path (suspended org, empty list,
  permission denied, KYC, zero data)?

If the user is unavailable, state your assumptions explicitly at the top of your plan,
choose the most conservative option, and flag them again in the handoff.

**Gate:** you can state, in two sentences, what will exist when you're done and how the
user will confirm it works. If you can't, you're not ready.

## Phase 2 — Architect (gate: written plan exists)

Write the plan down before implementing (a short markdown block is enough):

- Files to create/modify, grouped by app.
- Schema changes → plan the migration name/SQL; in implement phase **apply locally**
  per `.cursor/rules/backend.mdc` §11 and `docs/guides/database-workflow.md`
  (localhost-only, **the workspace's Prisma 5 CLI only** — never Prisma MCP or a
  different Prisma major — `cd apps/api && pnpm prisma migrate dev --name <name>`, then
  `pnpm --filter @cashsouk/api prisma:generate`).
  Never leave pending local migrations unapplied.
- API surface: method + path + permission + request/response shape
  (`{ success, data, correlationId }` envelope, errors via `AppError` from
  `apps/api/src/lib/http/error-handler.ts`).
- Frontend: pages/components, which existing `@cashsouk/ui` components and shared helpers
  you'll reuse (`StatusBadge`, `formatCurrency`, `createApiClient`).
- Order of work and what can be built in parallel (see delegation below).
- Test/verify strategy: which lint and typecheck commands, what manual flow proves it
  works.

For large or risky features, show the plan to the user before implementing. For small
ones, include it at the top of your response and proceed.

## Phase 3 — Implement & Delegate

If you can delegate to subagents (Claude Code `Agent` tool), split by capability and
file boundary — read `references/delegation.md` for the packet template and rules.
If you cannot delegate (single-agent session), do the same units yourself **in the same
order**; the decomposition is the value, not the parallelism.

Standard decomposition for a full-stack feature:

1. **Contract first (you, the lead):** schema + shared types (`packages/types`) + API
   route signatures. Everything else depends on this — never delegate it.
2. **Backend unit:** service + routes + audit logging, against the frozen contract.
3. **Frontend unit:** API client calls + pages + components, against the same contract.
4. **Docs unit (optional):** user-guide / feature doc updates.

Units 2 and 3 may run in parallel only because the contract is frozen. If the contract
must change mid-flight, stop both, update it yourself, restate it to both units.

## Phase 4 — Review Loop (gate: clean review)

You now switch roles: you are the reviewer, and the implementation (yours or a
subagent's) is untrusted. Use `references/review-checklist.md` — it contains the
repo-specific checks and grep patterns. The loop:

1. Run the mechanical checks (lint + typecheck per app, brand-violation greps).
2. Read the diff as a reviewer: correctness, edge cases, rule compliance, reuse.
3. Write findings as a list. Fix them (or send them back to the implementing agent
   with the finding list verbatim).
4. Re-review the fixes only. Repeat until a pass produces zero findings.
5. Cap at 3 cycles. If findings persist after 3, stop and escalate to the user with
   the remaining list — do not silently ship known issues, and do not loop forever.

## Phase 5 — Verify & Hand Off

- Run `pnpm --filter @cashsouk/<app> lint` and `pnpm --filter @cashsouk/<app> typecheck`
  for each touched app or package and report the real result. Never claim clean if it
  isn't.
- Exercise the feature if a dev server is available; otherwise say exactly what manual
  steps the user should run.
- **Never** `git add` / `commit` / `push` (rule of this workflow).
- If the change touched `apps/api/prisma/schema.prisma` or `apps/api/prisma/migrations/`,
  confirm local `cd apps/api && pnpm prisma migrate status` is clean and the Prisma
  client was regenerated (`pnpm --filter @cashsouk/api prisma:generate`).
- Write the handoff using `references/handoff.md`. It must include assumptions made in
  Phase 1 and anything the review loop escalated.

## Anti-patterns (things that get this workflow fired)

- Writing code before Phase 1's gate. — Guessing organization/permission semantics.
- Hand-rolling a helper that exists in `packages/*` or the app's `lib/` / `components/`.
- Delegating the data contract. — Reviewing your own code generously.
- Reporting "done" without running lint. — Committing to git.
