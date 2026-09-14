# 02 — Issuer application milestones on new contract

**Type**: AFK  
**Triage**: ready-for-agent (repo-local ticket)

## Parent

[Portal Activity PRD](../../guides/application/portal-activity-prd.md)

## What to build

Wire issuer-facing application milestones through the new catalog and resolver end-to-end for `/activity`: curated milestone list (not every review step), consistent copy for outcomes like resubmission without portal page overrides, and correct audience scoping for issuer organization. Aggregation should still flow through the existing activity API; behavior change is policy + normalization + contract population.

## Acceptance criteria

- [ ] Issuer portal `/activity` shows application lifecycle and related milestones using resolver-driven titles and scope, aligned with PRD inclusion rules.
- [ ] Section-level and item-level review churn does not appear as separate rows in the issuer feed unless explicitly allowlisted.
- [ ] Issuer-specific page hacks that override displayed copy for events such as resubmission are removed in favor of catalog-backed strings.
- [ ] Responses remain customer-safe relative to actor and visibility expectations from the PRD.

## Blocked by

- [01 — Establish customer Activity contract & catalog](./01-establish-customer-activity-contract-and-catalog.md)
