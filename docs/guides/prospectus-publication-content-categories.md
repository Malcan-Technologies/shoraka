# Prospectus publication content categories

Immediate alignment guide for CashSouk Note prospectus Pages 1–3.

Officer-selected production content is stored in `note_prospectus_reviews` and frozen at publish under `notes.prospectus_snapshot.publication_content`. See [prospectus-review-workflow.md](./prospectus-review-workflow.md).

Development sample placeholders remain in `apps/api/src/modules/notes/prospectus/prospectus-placeholder-publication-content.ts` for preview samples only. Prisma Note mappers must not default them into production Notes.

## AUTO-DERIVED

| Field | Source |
| --- | --- |
| Listing Date | `note_listings.opens_at` |
| Closing Date | `note_listings.closes_at` (canonical; duration suffix allowed) |
| Maturity Date | `notes.maturity_date` |
| Expected Return (p.a.) | `@cashsouk/types` `resolveNetExpectedReturnRatePercent` |
| Confirmed financial rows | Application statements via Page 2 freeze |
| SoukScore | Marketplace scale `AAA`–`B` |

## FIXED TEMPLATE

- Payment Basis / Shariah Principle (typed `fixed_template` until approved copy)
- Six Investor Takeaway category names and order
- Dropdown option catalogues versioned in code

## FUTURE OFFICER-SELECTED

- Key Investor Highlights
- Credit Insights
- Invoice / work statements
- Investor Takeaway description selections
- Unsupported Page 3 financial fills
- Paymaster profile / payment-history metrics

## HIDDEN

Boss-review removal applies to **issuer identity** only:

- Issuer company name
- SSM / registration number (and old SSM)
- Page 3 Issuer metadata item

## Shared header

Pages 1–3 use consistent shared header behaviour via `prospectus-header.*`:

- CashSouk logo
- brand name
- tagline (DNA until approved copy)
- Shariah Status Badge (same unresolved/DNA behaviour on all pages)

The Shariah badge remains on Page 3. It is not a Page 3-specific header variation.

## Rules

1. Preview placeholders must not silently populate Prisma-backed Notes.
2. Pre-marketplace admin workflow is not implemented yet.
3. Prospectus-specific values must later be stored separately from Application/CTOS.
4. Never overwrite Application or CTOS source data.
5. Final approved dropdown labels remain pending.
6. Issuer identity remains hidden; Shariah badge stays in the shared header on Page 3.
7. CTOS is not switched into Page 3 investor financials in this step.
