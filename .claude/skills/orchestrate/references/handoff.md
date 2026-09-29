# Handoff — orchestrate

Use build-feature `references/handoff.md` as the base (What was built, Changes, Run
before using, Verified, Assumptions, Known gaps, Suggested commit message) and add the
sections below. The user commits manually and did not watch the agents work, so this
message has to stand alone.

Keep the base template's rules: a ❌ with pasted output beats a false ✅; "none" under any
gap section must be earned by the review loop, not assumed.

## Extra sections

Insert after **Assumptions made**:

```markdown
## Things I'm unsure about
Judgement calls made by me or by an agent that you should sanity-check. One line each,
with where to look.
- <decision> — <why it might be wrong> — see `path/to/file`

## Remaining gaps
- Escalated review findings (survived cycle 3): <file:line — finding — severity>
- Deferred scope (agreed in the plan or discovered mid-run): <what, and why deferred>
- Not verified: <anything in the verify strategy that could not be exercised>

## Next steps
Ordered. What you'd do next if this were your ticket.
1. <e.g. run the manual flow below on staging data>
2. <e.g. follow-up unit for the issuer-side surface>
3. <e.g. add the jest test that asserts call count for the new page>

## Orchestration log
| Unit | Model | Tier | Cycles to clean | Notes |
|---|---|---|---|---|
| A backend … | opus | high | 2 | one ownership finding fixed in cycle 1 |
| B frontend … | opus | medium | 1 | |
Review: N findings in cycle 1, M in cycle 2, 0 in cycle 3 (or: capped, see gaps).
Orchestrator did directly: contract, migration, <one-line fixes>.
```

## Merge verdict

End the handoff with one line the user can act on without reading the rest:

- `Ready to commit.` — lint and typecheck clean everywhere, zero open findings, manual
  flow verified or clearly described.
- `Ready to commit with caveats.` — lint and typecheck clean, only style-tier findings or
  unverified manual steps remain; listed above.
- `Do not merge yet.` — a correctness, ownership, or security finding survived the loop,
  or lint or typecheck fails. Say which.
