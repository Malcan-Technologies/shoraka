# ARF Deed of Assignment — data sources

What [`buildDeedOfAssignmentMergeData`](../../apps/api/src/modules/applications/deed-of-assignment/build-doa-merge-data.ts) does for production generate (`arf_deed_of_assignment` **v1**).

Requires `contract_offer_sent`. Generated at facility-offer time.

SigningCloud recipients are the configured **issuer_director** assignor signatories only. SSP, witnesses, stamps, and wet-ink execution lines stay untagged in Word. CA signature boxes sit on each assignor signature line in the ASSIGNOR execution block.

## Filled from platform data

| Field | Source |
|-------|--------|
| `assignment_date` | `offer_details.sent_at` via `formatLetterDate` (also used in Schedule 2’s “effective from” sentence) |
| `assignor_company_name` | `issuer_organization.name` |
| `assignor_registration_number` | Org `registration_number`, then COD `basicInfo` SSM aliases (same as LO) |
| `assignor_registered_address` | COD `addresses.registered`, else `org.address` |
| `assignor_business_postal_address` | COD `addresses.business` only |
| `assignor_email` | `application.company_details.contact_person.email` |
| `assignor_contact_number` | `contact_person.contact`, else org `phone_number` |
| `assignor_signatories[]` | All issuer authorised representatives (`Director` / `Authorised Signatory`). One execution block per person. |
| `trust_bank_name`, `trust_account_name`, `trust_account_number` | `PlatformFinanceSetting.ledger_bucket_accounts_config.REPAYMENT_POOL` (`bankName`, `accountName`/`displayName`, `accountNumber`) |
| `debtor_company_name`, `debtor_registration_number` | `contract.customer_details.name` and `ssm_number` |
| `transaction_documents[]` | Application invoices (`invoice_number` / `number` / `display_reference`, issued date, value, due/maturity). Debtor name is reused on each row. |

## Visible tags (not collected at facility time)

These print as `{tag}` until a later data source exists. Generate does **not** fail closed on them:

`trust_swift_code`, `debtor_address`, `debtor_attention`, `notice_date`, `notice_signatory_name`, `notice_signatory_designation`, `outstanding_amount`, `balance_as_of_date`, `debtor_signatory_name`, `debtor_signatory_designation`, `acknowledgement_date`.

If the application has no invoices, Schedule 3 still renders **one placeholder row** with visible item tags so the schedule is never silently blank.

## Preserved legal-copy inconsistencies

The tagged Word file does **not** rewrite counsel’s source text. Only merge tags and the ASSIGNOR execution tables were added. Intentionally left as in the clean copy:

- SSP naming differs across the deed (for example `SHORAKA SUYULA PLATFORM SDN. BHD.` versus `SHORAKA SUYULA SDN. BHD.`).
- Schedule 2 notice sender stays the literal `[Debtor]` marker.
- Schedule 1 cross-references stay unnumbered as in the source.

## Production

Filled when admin sends the signing package if the frozen product includes **Deed of Assignment**. Also available as:

`GET /v1/applications/:id/generated-documents/arf_deed_of_assignment`

Fails closed (`GENERATED_DOCUMENT_DATA_INCOMPLETE`) without offer send date, assignment date, assignor name, assignor registration number, the authorised-representatives draft, or a named issuer representative.

Product workflow: Financing type → Signing package → add **Deed of Assignment** (defaults to `issuer_director`).
