# 01 — Establish customer Activity contract & catalog

**Type**: AFK  
**Triage**: ready-for-agent (repo-local ticket)

## Parent

[Portal Activity PRD](../../guides/application/portal-activity-prd.md)

## What to build

Introduce the spine for portal `/activity`: a single customer-facing activity catalog (structured source of truth for copy and variants), an explicit allowlist of customer-safe event types, and a thin resolver that maps raw activity sources plus portal audience into one normalized shape. That shape must carry enough for presentation (`What`, business-scope `Where`, `Who`, `Domain`, supplementary detail rows) without services composing free-form prose in multiple places. Extend the shared Activity contract so portals consume these fields from the API rather than inferring them ad hoc.

## Acceptance criteria

- [ ] Customer Activity uses an explicit allowlist; granular section/item review events stay excluded from portal feeds unless explicitly promoted later.
- [ ] Catalog defines audiences per entry (issuer, investor, or both) and supports metadata-driven variant keys where needed.
- [ ] Resolver outputs stable fields for customer title, scope subtitle, domain bucket, actor label per customer-safe rules (org user display name when available, branded admin label for platform staff, `System` for automation).
- [ ] Shared types and API validation accept the extended Activity shape without breaking existing pagination, filtering, or envelope conventions.

## Blocked by

None — can start immediately.
