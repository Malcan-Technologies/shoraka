# ARF contract facility LO — data sources (working index)

What [`buildFacilityLoMergeData`](../../apps/api/src/modules/applications/letter-of-offer/build-facility-lo-merge-data.ts) does for production generate (`arf_contract_facility_lo` **v2**, per-guarantor acknowledgement pages). Facility offers fill Part A; standalone invoice offers fill Part B.

**Full verification table:** [lo-19-aug-2026-field-map.md](./lo-19-aug-2026-field-map.md)

Older editable discussion table: [arf-letter-of-offer-placeholder-map.md](../application-flow/arf-letter-of-offer-placeholder-map.md) (July wording — partially superseded).

## Filled from platform data (EXISTS / DERIVE)

| Area | Source | Notes |
|------|--------|--------|
| Header Issuer ID / Our Reference | `issuer_organization.display_reference` (`ISS-…`); facility `contract.display_reference` (`CON-…`) or invoice `display_reference` (`INV-…`) | Never CUIDs. Empty when a historical row has no allocated ref. |
| Issuer identity | `issuer_organization.registration_number`, then COD `basicInfo.ssmRegistrationNumber` / `ssmRegisterNumber` | Name, SSM, registered address |
| Letter date | Selected offer `sent_at` (facility or invoice) | Required — generation fails if missing |
| Attention | `application.company_details.contact_person` | Name, position |
| Facility amount | Facility: `offer_details.offered_facility` or `contract_details.approved_facility`. Invoice: `invoice.offer_details.offered_amount` | `formatRmAmount` — also Schedule A Part A Financing Limit + MoA |
| Guarantors | Ordered live `application_guarantors` | Individuals and companies. Finance Documents uses `{#finance_documents_guarantors}` with nested `{rep_line}` for corporate authorised representatives (`a. b. c.` under roman `i. ii. iii.`). Missing identity parts print `[INSERT NAME]` / `[INSERT]`. An empty list prints one placeholder line. |
| Corporate signatories | `offer_acceptance.authorized_parties` or `authorized_parties_draft` | Name, NRIC, and capacity. While Step 1 is editable the saved draft is used; after submit the canonical snapshot is. Draft must be saved before LO download |
| Tenure / payment / max invoice tenure | `FINANCING_TENURE_MAX_DAYS` (180) | Same value in all three merge fields |
| Part B financing amount | Facility: same as financing limit. Invoice: `invoice.offer_details.offered_amount` | Schedule A Part B (“up to … per invoice”) |
| Facility Type checkboxes | `financing_structure.structure_type` | Part A for `new_contract`; Part B for `invoice_only` / `existing_contract` |
| Assigned contract | `contract_details` + `customer_details` | Date, counterparty, description/number. Uses this application's current `customer_details` (official identity after verification auto-sync, when that application was still editable). Historical generated documents are not rewritten. |
| Offer validity phrase | Frozen product `acceptance_deadline.days` (default 7) | Used in **both** acceptance/lapse clauses. Not `acceptance_expires_at − sent_at`. |
| Transaction docs days | Frozen product `signing_deadline.days` (default 14) | Not timestamp subtraction |
| Grace period | `PlatformFinanceSetting.grace_period_days` | When settings row exists |

## Hardcoded in Word (19 Aug legal text)

Not merge tags:

| Topic | Template text |
|-------|----------------|
| Maximum financing margin | Up to eighty per cent (80%) of Eligible Invoice Value |
| Profit rate | 8%–18% p.a., set per Utilization Offer |
| Part A availability | thirty (30) days from acceptance |
| Withdrawal notice | twenty-one (21) days’ prior written notice |
| Application Fee | RM150, payable on application |
| Electronic execution | Platform records equal written form; Utilisation Offer acceptance = Purchase Requisition and Wa'd |

## MoA authorised signatory

Left blank for wet-ink / issuer completion. Not merge data.

## Wet ink (SIGNEE)

Signature blocks print the signatory name and NRIC (yellow). Missing NRIC prints `[INSERT]`. Corporate boxes: signature line first, then name, then NRIC. `Designation :` stays blank for wet ink.

## Production vs demo

| Path | Use |
|------|-----|
| `GET /v1/applications/:id/generated-documents/arf_contract_facility_lo` | Production (issuer/admin). Fails closed if required data is missing. |
| `POST /v1/admin/demos/contract-lo/generate` | Engineering demo with editable body |

**Same template file and `renderFacilityLoDocx`.** Prefill uses the same builder as production. See [lo-19-aug-2026-field-map.md](./lo-19-aug-2026-field-map.md#demo--production-sync).
