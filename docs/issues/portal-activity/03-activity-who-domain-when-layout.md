# 03 — Shared Activity / Who / Domain / When layout

**Type**: AFK  
**Triage**: ready-for-agent (repo-local ticket)

## Parent

[Portal Activity PRD](../../guides/application/portal-activity-prd.md)

## What to build

Update the shared Activity row experience so issuer and investor portals render the same grid: primary column stacks bold `What` with muted business-scope `Where`; dedicated `Who` column; `Domain` column for high-level scanning; `When` right-aligned. Replace reliance on an Event badge column with this layout. Expanded rows show only supplementary structured facts in a key–value grid with sentence-case labels; do not repeat title, scope, actor, or domain already shown in the row.

## Acceptance criteria

- [ ] Desktop layout matches PRD column intent (`Activity`, `Who`, `Domain`, `When`) across both portals using shared UI.
- [ ] Collapsed rows show bold primary title and muted scope subtitle; Event badge column is removed or repurposed consistently with PRD.
- [ ] Expanded panel is supplementary-only and uses sentence-case detail labels (no shouty uppercase label styling).
- [ ] Responsive behavior keeps the feed usable on narrow viewports without breaking the information hierarchy.

## Blocked by

- [01 — Establish customer Activity contract & catalog](./01-establish-customer-activity-contract-and-catalog.md)
