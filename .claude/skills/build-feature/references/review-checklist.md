# Review checklist — repo-specific

Run mechanical checks first (cheap, objective), then read the diff. Report findings as
a numbered list with file:line; fix, then re-review only the fixes.

## 1) Mechanical checks

```bash
# Lint + typecheck per touched app or package (lint is ESLint only; typecheck is tsc --noEmit)
pnpm --filter @cashsouk/api lint   && pnpm --filter @cashsouk/api typecheck
pnpm --filter @cashsouk/admin lint && pnpm --filter @cashsouk/admin typecheck   # or issuer / investor / landing / ui
# packages/types and packages/config have no lint script: typecheck only
pnpm --filter @cashsouk/types typecheck

# Brand violations in the diff (portal UI) — each hit needs justification
git diff | grep -nE '^\+.*(from|via|to)-(emerald|amber|orange|red|sky|blue)-' # no hardcoded palette colours; tokens only (frontend.mdc, BRANDING.md)
git diff | grep -nE '^\+.*(text|bg|border)-(emerald|amber|rose|sky|green|red|blue|yellow)-[0-9]' # colors must come from StatusBadge / status tokens
```

## 2) Backend review

- [ ] Ownership scoping: every query on organization-owned data filters by the
      organization/user derived from auth context — never from the request body/params.
- [ ] Route guards: `requireAuth`, `requireRole(...)`, `requirePermission(...)` (correct
      string from `packages/types/src/rbac.ts`).
- [ ] Errors thrown via `AppError` (`apps/api/src/lib/http/error-handler.ts`) and passed
      to `next(err)` — no ad-hoc `res.status(500).json(...)`.
- [ ] Response envelope `{ success: true, data, correlationId }` (+ `pagination` for lists).
- [ ] Domain logic in the module's service, not in the controller.
- [ ] Zod validation on every body/query input; enum values from `@cashsouk/types`.
- [ ] Mutations write an audit entry (helpers in `apps/api/src/lib/audit`) when they
      touch audited data (`docs/logging-architecture.md`).

## 3) Frontend review

- [ ] API calls via `createApiClient` from `@cashsouk/config` — no raw `fetch` to the
      backend.
- [ ] `success === false` and thrown errors handled; user sees a sonner toast, not a
      silent failure or console log.
- [ ] Currency via `formatCurrency` from `@cashsouk/config`.
- [ ] Status rendering via `StatusBadge` and status tokens from `@cashsouk/ui`
      (`BRANDING.md` §3.2–§3.3).
- [ ] Reuses `@cashsouk/ui` primitives and existing feature components; no duplicated
      widget that already exists under `components/`.
- [ ] Loading, empty, and error states exist for every data fetch.
- [ ] Both themes: any color class has a `dark:` counterpart or uses semantic tokens.
- [ ] Forms: Zod schema, inline errors, disabled submit while pending.

## 4) Cross-cutting

- [ ] Matches the plan's contract exactly (paths, shapes, permission strings).
- [ ] No leftover debug: `console.log`, commented-out blocks, unused imports.
- [ ] Naming/idiom matches neighboring code (compare with the analog feature).
- [ ] Anything the implementer flagged as "unsure" has been resolved explicitly.
- [ ] Sends a message? Copy comes from the notification module
      (`apps/api/src/modules/notification/registry.ts`, `email-templates.ts`):
      no inline `title`/`body` literals, no email HTML outside the templates,
      new type added to the registry + templates, every delivery logged (`delivery-log.ts`).

## 5) Performance (rules: `.cursor/rules/backend.mdc` §11, `.cursor/rules/frontend.mdc` Performance)

Grep patterns first, then read the diff with the request/row budget in mind.

- [ ] No unbounded loads: `grep -n "findMany" <changed backend files>` — every hit has `take`,
      an `id: { in }` from a bounded id list, or a justification comment.
- [ ] Pagination is DB-side (`take`/`skip` or id page + hydrate) with a stable `orderBy`
      tie-break; no `.slice(` on a fully loaded array.
- [ ] Wide models use `select`; `grep -n "include: {" ` on wide-model queries is a
      finding unless nested selects are present.
- [ ] Any new sidebar/badge number has a count endpoint — never a list fetched to count it.
- [ ] GET handlers do not write (`grep -n "prisma\.[a-zA-Z]*\.\(update\|create\|delete\|upsert\)" `
      inside `router.get` bodies) unless guarded by a staleness check.
- [ ] Cached reads have an invalidation at every write site.
- [ ] Schema diff: every new FK / filtered column has `@@index`; migration applied
      locally and the Prisma client regenerated.
- [ ] Query rewrites of money/health/count logic ship with a real-DB equivalence test.
- [ ] Frontend: detail hooks fire independent calls in one `Promise.all`; heavy libs are
      `next/dynamic`.
- [ ] Reviewer checked the network tab (or the jest test that asserts call count) for the
      touched page.

## Severity discipline

Order findings: correctness → security/ownership → convention violations → style.
A style nit never blocks handoff on cycle 3; an ownership or permission leak always does.
