# 06 — Backend & UI tests for portal Activity

**Type**: AFK  
**Triage**: ready-for-agent (repo-local ticket)

## Parent

[Portal Activity PRD](../../guides/application/portal-activity-prd.md)

## What to build

Add automated coverage that locks in external behavior: allowlist and audience filtering, resolver output for titles, scope, domain, actor labels, and detail rows, adapter-to-contract mapping for issuer and investor contexts, and UI structure for the new row and expanded panel rules. Prefer tests that assert observable outputs over internal helper structure.

## Acceptance criteria

- [ ] Resolver and/or catalog tests cover allowlist omissions, audience variants, and actor labeling edge cases implied by the PRD.
- [ ] Integration or service-level tests prove application-log derived activities map to the extended contract for both portal types where applicable.
- [ ] Shared Activity UI tests verify column structure and non-duplication rules for expanded content.
- [ ] CI-aligned test commands pass (lint/type/test as required by repo conventions for touched packages).

## Blocked by

- [02 — Issuer application milestones on new contract](./02-issuer-application-milestones-new-contract.md)
- [03 — Shared Activity / Who / Domain / When layout](./03-activity-who-domain-when-layout.md)
- [04 — Investor-scoped note & funding milestones](./04-investor-scoped-note-funding-milestones.md)
- [05 — Remove portal leakage & duplicate expanded details](./05-remove-portal-leakage-duplicate-details.md)
