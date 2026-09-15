# 04 — Investor-scoped note & funding milestones

**Type**: AFK  
**Triage**: ready-for-agent (repo-local ticket)

## Parent

[Portal Activity PRD](../../guides/application/portal-activity-prd.md)

## What to build

Ensure investor portal `/activity` reliably receives customer-safe milestones sourced from application logs where investors share visibility (notes, marketplace, funding, disbursement, repayment families per catalog rules). Fix organization-scoped querying so investor organization context resolves to the correct activities instead of failing open or omitting rows. Investor-facing rows must use the same resolver contract and UI layout as issuer.

## Acceptance criteria

- [ ] Investor portal shows intended milestone categories per catalog audiences without internal workflow noise.
- [ ] Organization-scoped queries for investor portal return correct activity rows when an active investor organization is selected.
- [ ] Actor and domain rules match PRD for investor-visible automation and platform actions.
- [ ] Investor experience uses the shared Activity layout from slice 03 once that lands.

## Blocked by

- [01 — Establish customer Activity contract & catalog](./01-establish-customer-activity-contract-and-catalog.md)
- [03 — Shared Activity / Who / Domain / When layout](./03-activity-who-domain-when-layout.md)
