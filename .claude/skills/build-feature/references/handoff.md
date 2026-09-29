# Handoff template

End every feature task with this report. The user commits manually (rule of this
workflow), so the handoff must be complete enough to write the commit message and run
follow-ups from.

```markdown
## What was built
One paragraph, user-language: what exists now that didn't before.

## Changes
- `path/to/file` — what and why (group by app)

## Run before using
# Schema/migrations: agent should already have applied locally (localhost only).
# Report what was applied, e.g.:
# Applied `2026..._add_...` via `prisma migrate dev`; regenerated the Prisma client (apps/api).
# Only list commands here if a safety gate blocked local apply (non-local DATABASE_URL, etc.).

## Verified
- apps/api:   pnpm --filter @cashsouk/api lint ✅/❌ · typecheck ✅/❌ (paste failures verbatim if ❌)
- apps/admin: pnpm --filter @cashsouk/admin lint ✅/❌ · typecheck ✅/❌
- prisma (if touched): migrate status up to date; client regenerated ✅/❌
- Manual: <what you exercised, or exact steps for the user to exercise>

## Assumptions made (from Phase 1)
- <assumption> — chosen because <reason>; revisit if wrong

## Known gaps / escalated review findings
- <anything the review loop capped out on, or explicitly deferred scope>

## Suggested commit message
feat(<area>): <summary>
```

Rules:
- Never mark "Verified" on hope. A ❌ with pasted output is a good handoff; a false ✅
  is the worst possible outcome of this workflow.
- "Known gaps: none" must be earned by the review loop, not assumed.
- Do not stage, commit, or push. Summarize so the user can.
- Local Prisma migrate + generate is the agent's job when migrations are part of the
  change (`.cursor/rules/backend.mdc` §11, `docs/guides/database-workflow.md`). Never
  instruct the user to migrate a remote/prod DB.
