# ARF Facility Agreement — data sources

What [`buildFacilityAgreementMergeData`](../../apps/api/src/modules/applications/facility-agreement/build-fa-merge-data.ts) does for production generate (`arf_facility_agreement` **v6**).

Requires `offer_sent` (contract facility offer **or** standalone invoice offer). Generated when admin previews or sends the signing package if the frozen product includes **Facility Agreement**. Replaces the e-sign Offer Letter; the Step 1 `arf_contract_facility_lo` download/upload is unchanged.

SigningCloud recipients are the configured **issuer authorised signatories** only. Investor, Agent, witness, and Schedule 4–9 utilisation lines stay unsigned so platform signatures can be added later. Each ISSUER signatory is paired with one wet-ink witness in a two-column table (signatory left, witness right). CA boxes sit on the left-column underscores. ISSUER execution starts on its own page, before Schedule 1.

## Filled from platform data

| Field | Source |
|-------|--------|
| `facility_agreement_date` | Document generate time via `formatLetterDate` (Asia/Kuala_Lumpur) |
| `letter_date` | Offer `sent_at` via `formatLetterDate` (generate-ready check; not printed in Word after v2) |
| `our_reference` | Contract id, or invoice `display_reference` |
| `issuer_name` | `issuer_organization.name` |
| `issuer_registration_number` | Org `registration_number`, then COD `basicInfo` SSM aliases (same as LO) |
| `issuer_address` | COD `addresses.registered`, else `org.address` |
| `issuer_email` | `application.company_details.contact_person.email` |
| `financing_limit_rm` | Contract: `offer_details.offered_facility` / `contract_details.approved_facility`. Invoice: `invoice.offer_details.offered_amount` |
| `facility_description` | Derived from financing limit + letter date (generate-ready check; not printed in Word after v2) |
| `sub_limit_per_invoice_rm` | Product workflow invoice-details sub-limit; invoice offers fall back to offered amount |
| `facility_fee_rate_percent` | Contract offer / contract details only |
| `drawdown_fee` | Invoice `platform_fee_rate_percent` only |
| `trustee_disclosure_email` | `PlatformFinanceSetting.trustee_letter_config.trusteeEmail` |
| `issuer_bank_name`, `issuer_bank_account_name`, `issuer_bank_account_number` | Organisation `bank_account_details` |
| `issuer_bank_swift` | Stored SWIFT on the org, else exact picklist value or short label from [`MALAYSIAN_BANKS`](../../packages/types/src/malaysian-banks.ts) |
| `guarantors_individual` / `guarantors_corporate` | Live application guarantors + authorised-parties snapshot |
| `issuer_signatories` | Issuer authorised representatives (`Director` / `Authorised Signatory`) |

## Visible tags (not collected yet)

These print as `{tag}` until a later data source exists. Generate does **not** fail closed on them:

contract `drawdown_fee`, invoice `facility_fee_rate_percent`, and any optional email/bank field with no source.

Schedule 2 **Bank Branch** is left blank (no merge tag). We do not collect branch.

## Unchanged schedules

Schedules 4 to 9 are copied unchanged from the 19 August 2026 clean copy. They have no merge tags; counsel placeholders such as `[●]`, `[insert]`, and `[ISSUER NAME]` stay as in the original template.

## Production

Filled when admin sends the signing package if the frozen product includes **Facility Agreement**. Also available as:

`GET /v1/applications/:id/generated-documents/arf_facility_agreement`

Pass `contractId` or `invoiceId` from the envelope/preview target so invoice-only holder contracts do not pick a missing facility offer.

Fails closed (`GENERATED_DOCUMENT_DATA_INCOMPLETE`) without offer send date, letter date, facility agreement date, issuer name, issuer registration number, financing limit, facility description, the authorised-representatives draft, or a named issuer representative. Missing live guarantors fail closed when guarantor rows exist.

Product workflow: Financing type → Signing package → add **Facility Agreement** (defaults to `issuer_director`). Stored products that still list Offer Letter can be rewritten with `pnpm --filter @cashsouk/api migrate-signing-offer-letter-to-fa` (future envelopes only; existing envelopes are left unchanged).
