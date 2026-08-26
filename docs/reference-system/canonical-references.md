# Canonical display references

Human-facing CashSouk references are **forward-only**. They are allocated at create time, persisted on the entity, and never regenerated on read, render, download, or click.

Internal CUIDs remain the system identity for primary keys, foreign keys, API routes, and joins.

```text
Internal CUID  = system identity / routing
Canonical ref  = human / business identity
```

A link may show `ISS-202608-DK3` while navigating to `/organizations/cmknl1imvf0003gnp0hsbmc1dp`. That is correct.

## Formats

Allocated with 3 random `A-Z0-9` characters and Malaysia business month (`Asia/Kuala_Lumpur`):

```text
Application                 APP-{PRODUCT_CODE}-{YYYYMM}-{XXX}
Contract (facility)         CON-{PRODUCT_CODE}-{YYYYMM}-{XXX}
Invoice                     INV-{PRODUCT_CODE}-{YYYYMM}-{XXX}
Note                        NOTE-{PRODUCT_CODE}-{YYYYMM}-{XXX}
Settlement                  SET-{PRODUCT_CODE}-{YYYYMM}-{XXX}
Product-linked withdrawal   WDL-{PRODUCT_CODE}-{YYYYMM}-{XXX}
Account-level withdrawal    WDL-{YYYYMM}-{XXX}
Issuer organization         ISS-{YYYYMM}-{XXX}
Investor organization       IVT-{YYYYMM}-{XXX}
```

Persistent fields:

| Entity | Field |
| --- | --- |
| Application | `display_reference` |
| Contract | `display_reference` |
| Invoice | `display_reference` |
| Note | `note_reference` (required; historical values stay as stored) |
| NoteSettlement | `display_reference` |
| WithdrawalInstruction | `display_reference` |
| IssuerOrganization | `display_reference` |
| InvestorOrganization | `display_reference` |

Historical rows may have `display_reference = null`. That is valid. Do not backfill.

## UI presentation

Normal business UI shows the canonical reference, not the CUID.

Named entity: `Toyota (ISS-202608-DK3)`. If the canonical ref is null, show the name only.

When a customer/business number also exists, keep it separate:

```text
CashSouk Reference    CON-ARF-202608-K71
Contract Number       ABC-CONTRACT-123

CashSouk Reference    INV-ARF-202608-0N5
Invoice Number        INV-CUSTOMER-99281
```

Do not append the raw CUID in brackets next to a canonical reference.

Admin diagnostic screens may show a separately labelled Internal ID when support work needs it. Organization detail Quick Links is one such surface.

Facility is the business concept represented by **Contract**. User-facing label is **Facility Reference**; the value is `CON-…`. Routes stay `/contracts/{contractId}`.

Provider identifiers (Curlec, RegTank, CTOS, SigningCloud, receipt numbers) stay their own labelled fields.

Shared formatters live in `packages/types/src/display-reference.ts`. Frontends must not invent canonical-looking values.
