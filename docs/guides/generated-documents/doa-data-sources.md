# ARF Deed of Assignment — data sources

What [`buildDeedOfAssignmentMergeData`](../../apps/api/src/modules/applications/deed-of-assignment/build-doa-merge-data.ts) does for production generate (`arf_deed_of_assignment` **v2**).

Requires `contract_offer_sent`. Generated at facility-offer time.

SigningCloud recipients are the configured **issuer_director** assignor signatories only. SSP, witnesses, stamps, and wet-ink execution lines stay untagged in Word. CA signature boxes sit on each assignor signature line in the ASSIGNOR execution block.

## Filled from platform data

| Field | Source |
|-------|--------|
| `assignment_date` | `offer_details.sent_at` via `formatLetterDate` |
| `assignor_company_name` | `issuer_organization.name` |
| `assignor_registration_number` | Org `registration_number`, then COD `basicInfo` SSM aliases (same as LO) |
| `assignor_registered_address` | COD `addresses.registered`, else `org.address` |
| `assignor_business_postal_address` | COD `addresses.business` only |
| `assignor_email` | `application.company_details.contact_person.email` |
| `assignor_contact_number` | `contact_person.contact`, else org `phone_number` |
| `assignor_signatories[]` | All issuer authorised representatives (`Director` / `Authorised Signatory`). One execution block per person. |
| `trust_bank_name`, `trust_account_name`, `trust_account_number`, `trust_swift_code` | `PlatformFinanceSetting.ledger_bucket_accounts_config.REPAYMENT_POOL` (`bankName`, `accountName`/`displayName`, `accountNumber`, `swiftCode`) |

## Schedules (not merged)

- **Schedule 2** stays the prescribed Form of Notice of Assignment. Original legal placeholders (`[insert date]`, `[Name & Address of Debtor]`, `[Insert]`, `[Debtor]`) are left as in counsel’s copy. A standalone copy lives at [`arf-notice-of-assignment-template.docx`](../../apps/api/src/modules/applications/templates/arf-notice-of-assignment-template.docx) (static artefact; no generate path).
- **Schedule 3** keeps its heading and table. At execution it records: *Nil as at the date of execution; to be supplemented from time to time in accordance with Clause 4.4.* Invoices are not written into the Deed.

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
