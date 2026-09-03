# ARF Joint and Several Guarantee — data sources

What [`buildJsgMergeData`](../../apps/api/src/modules/applications/joint-several-guarantee/build-jsg-merge-data.ts) does for production generate (`arf_joint_several_guarantee` **v1**).

Requires `contract_offer_sent`. Recital A needs the Letter of Offer date and contract reference.

## Filled from platform data

| Field | Source |
|-------|--------|
| `guarantee_date`, `letter_date` | `offer_details.sent_at` via `formatLetterDate` (same value) |
| `our_reference` | `Contract.id` (same as LO) |
| `issuer_name` | `issuer_organization.name` |
| `issuer_registration_number` | Org `registration_number`, then COD `basicInfo` SSM aliases |
| `issuer_address` | COD `addresses.registered`, else `org.address` |
| `issuer_business_address` | COD `addresses.business` only — empty prints `{issuer_business_address}` |
| `facility_description` | `offered_facility` or `approved_facility` plus “as described in the Letter of Offer dated {letter_date}” |
| Individual / corporate guarantors | Ordered live `application_guarantors`; drawdowns inherit via originating facility |
| Corporate signatories | `offer_acceptance` authorised-parties snapshot, matched by `client_guarantor_id` / `application_guarantor_id` |
| Schedule 1 list | Same ordered live rows (`schedule_guarantors` / nested `rep_line`) |

Guarantor address and witnesses are not collected. Word signature lines stay as underscores; CA signature boxes are placed on the last PDF page when the signing package is sent.

## Production

Filled when admin sends the signing package if the frozen product includes **Guarantor Agreement**. Also available as:

`GET /v1/applications/:id/generated-documents/arf_joint_several_guarantee`

Fails closed (`GENERATED_DOCUMENT_DATA_INCOMPLETE`) without send date, issuer name/SSM, facility amount, authorised-representatives draft, or named reps on corporate guarantors.

Product workflow: Financing type → Signing package → add **Guarantor Agreement**.
