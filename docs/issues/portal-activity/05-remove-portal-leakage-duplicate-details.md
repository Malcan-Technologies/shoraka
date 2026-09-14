# 05 — Remove portal leakage & duplicate expanded details

**Type**: AFK  
**Triage**: ready-for-agent (repo-local ticket)

## Parent

[Portal Activity PRD](../../guides/application/portal-activity-prd.md)

## What to build

Sweep customer-facing Activity output so operational portal provenance is not shown as business context in rows or expanded details. Eliminate duplication between row summary columns and expanded supplementary facts. Align remaining detail rows with customer-safe disclosure while keeping admin audit surfaces unchanged.

## Acceptance criteria

- [ ] Neither collapsed rows nor expanded panels expose portal labels (issuer vs admin portal names) as customer-facing activity context.
- [ ] Expanded details never repeat `What`, `Where`, `Who`, or `Domain` content already visible in the row.
- [ ] No regression to admin timeline or ledger surfaces scoped out of this initiative.
- [ ] Customer feed remains aligned with notifications as a parallel interrupt channel (no merge of concerns in UI copy).

## Blocked by

- [02 — Issuer application milestones on new contract](./02-issuer-application-milestones-new-contract.md)
- [03 — Shared Activity / Who / Domain / When layout](./03-activity-who-domain-when-layout.md)
- [04 — Investor-scoped note & funding milestones](./04-investor-scoped-note-funding-milestones.md)
