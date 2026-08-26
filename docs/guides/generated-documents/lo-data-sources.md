# ARF contract facility LO — data sources (working index)

What [`buildFacilityLoMergeData`](../../apps/api/src/modules/applications/letter-of-offer/build-facility-lo-merge-data.ts) does **today** for production generate (`arf_contract_facility_lo` **v3**, dynamic guarantor loops).

**Full verification table (use this to review):** [lo-16-aug-2026-field-map.md](./lo-16-aug-2026-field-map.md)

Older editable discussion table: [arf-letter-of-offer-placeholder-map.md](../application-flow/arf-letter-of-offer-placeholder-map.md) (July wording — partially superseded).

## Filled from platform data (EXISTS / DERIVE)

| Area | Source | Notes |
|------|--------|--------|
| Issuer identity | `issuer_organization` + onboarding address | Name, SSM, registered address |
| Letter date | `offer_details.sent_at` or today | `formatLetterDate` |
| Attention | `application.company_details.contact_person` | Name, position |
| Facility amount | `offer_details.offered_facility` or `contract_details.approved_facility` | `formatRmAmount` — also Schedule A Part A Financing Limit + MoA |
| Guarantors (individual) | `business_details.guarantors` | All individuals — `{#guarantors_individual}` loops (list, ack names, one sig page each) |
| Corporate guarantor | First company guarantor | Name + SSM when present |
| Authorised signatories | `offer_acceptance.authorized_parties` | Issuer names → `moa_authorised_signatory_names`; first corporate guarantor’s first two people → `corporate_signatory_1_name` / `_2_name` |
| Assigned contract | `contract_details` + `customer_details` | Date, counterparty, description/number |
| Offer validity phrase | `offer_acceptance.acceptance_expires_at` vs `sent_at` | `daysPhrase` when clocks exist |
| Transaction docs days | `signing_expires_at` vs offer/letter date | When acceptance clocks exist |
| Grace period | `PlatformFinanceSetting.grace_period_days` | When settings row exists |

## Hardcoded in Word (16 Aug legal text)

Not merge tags:

| Topic | Template text |
|-------|----------------|
| Maximum financing margin | Up to eighty per cent (80%) of Eligible Invoice Value |
| Profit rate | 8%–18% p.a., set per Utilization Offer |
| Part A availability | thirty (30) days from acceptance |
| Withdrawal notice | twenty-one (21) days’ prior written notice |

## Empty until product/legal defines (EMPTY / FLAG)

| Field | Status |
|-------|--------|
| `tenure_days` | Empty |
| `max_invoice_tenure_days` | Empty (Schedule A “up to N”) |
| `sub_limit_per_invoice_rm` | Empty |
| `part_b_financing_amount_rm` | Empty |
| `payment_period_days` | Empty |
| Facility Type Part A/B checkboxes | Not tagged — **FLAG** |

## Wet ink (SIGNEE)

Signature blocks stay blank — no merge tags for wet-ink signature strokes.

## Production vs demo

| Path | Use |
|------|-----|
| `GET /v1/applications/:id/generated-documents/arf_contract_facility_lo` | Production (issuer/admin) |
| `POST /v1/admin/demos/contract-lo/generate` | Engineering demo with editable body |

**Same template file and `renderFacilityLoDocx`.** Prefill uses the same builder as production. See [lo-16-aug-2026-field-map.md](./lo-16-aug-2026-field-map.md#demo--production-sync).
