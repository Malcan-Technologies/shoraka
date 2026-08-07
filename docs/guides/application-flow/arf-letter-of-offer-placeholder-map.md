# ARF-i Letter of Offer — Placeholder Map (Contract financing)

Editable fill map for the contract facility LOO.

## Demo usage (temporary)

Not production. No SigningCloud — signature lines stay blank for **wet ink**.

| Item | Detail |
|------|--------|
| Tagged template | [`apps/api/src/modules/applications/templates/arf-contract-facility-loo.docx`](../../apps/api/src/modules/applications/templates/arf-contract-facility-loo.docx) |
| Source copy (untagged) | [`apps/api/src/modules/applications/templates/Clean - ACCOUNT RECEIVABLE FINANCING-i Letter of Offer (16 July 2026) copy.docx`](../../apps/api/src/modules/applications/templates/Clean%20-%20ACCOUNT%20RECEIVABLE%20FINANCING-i%20Letter%20of%20Offer%20(16%20July%202026)%20copy.docx) |
| Admin UI | `/demos/contract-loo` (admin app; deep-link only) |
| API | `GET /v1/admin/demos/contract-loo/fixture`, `GET .../prefill?contractId=`, `POST .../generate` → `.docx` |
| Code | [`apps/api/src/modules/applications/loo/`](../../apps/api/src/modules/applications/loo/) |

**How to try:** open the admin demo page → **Reset fixture** or **Prefill** from a contract id → edit any field → **Download .docx** → open in Word.

Merge tags use `{field_name}` (docxtemplater). Map keys live in `@cashsouk/types` `ContractLooMergeData`.

---

**Scope:** Contract financing / facility offer only (`Contract` + `Contract.offer_details`). Invoice offer letters are out of scope for this template (see [Does this LOO fit invoice financing?](#does-this-loo-fit-invoice-financing) below).

Use this to decide what each yellow / blank / underscore field should resolve to when we wire template generation. Edit the **Your decision** column freely.

**Legend — platform status**


| Status    | Meaning                                                                    |
| --------- | -------------------------------------------------------------------------- |
| `EXISTS`  | Field already stored; can fill from platform data                          |
| `DERIVE`  | Can compute from existing fields (may need formatting rules)               |
| `PARTIAL` | Related data exists but does not match the legal wording / timing          |
| `MISSING` | No platform field today — needs admin input, legal default, or new capture |
| `SIGNEE`  | Leave blank / underscore for wet-ink capture                               |


**Timing note:** For contract financing, commercial offer terms live on `Contract.offer_details` after admin **Send Offer**. Issuer identity lives on `IssuerOrganization`. Guarantors live on `Application.business_details.guarantors` / `ApplicationGuarantor`. Assigned contract / buyer live on `Contract.contract_details` + `Contract.customer_details`. The sample PDF generator (`apps/api/src/modules/applications/offer-letter-pdf.ts`) is separate from this ARF Word demo.

---

## Does this LOO fit invoice financing?

**Short answer: no — not as the invoice offer letter.**

This Word template is written as a **facility** Letter of Offer, not a per-invoice disbursement offer. That matches contract financing on the platform much better than invoice financing.


| Template concept                                                      | Fits contract facility?             | Fits invoice offer?                                                                 |
| --------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| Title / product: Account Receivable Financing-i **Facility**          | Yes                                 | Weak — invoice offer is a draw / utilisation under (or without) a facility          |
| **Financing Limit** (max aggregate utilisation)                       | Yes — `offered_facility`            | No — invoice has `offered_amount` for one invoice                                   |
| **Availability period** (first utilisation within N days)             | Yes — facility drawdown window      | No — invoice is a one-shot offer                                                    |
| **Schedule B — Assigned Contract(s)** + Approved Buyer                | Yes — contract + `customer_details` | Only if invoice is contract-linked; invoice-only apps may have no facility schedule |
| Operation of the Facility / multiple utilisations                     | Yes                                 | No — single invoice amount                                                          |
| MoA for Facility of RM…                                               | Yes                                 | Wrong instrument — would misstate a facility limit                                  |
| Platform invoice terms (amount, ratio %, profit % p.a., platform fee) | Not on `ContractOfferDetails` today | Belong on a **separate invoice offer letter**                                       |


On the platform today:

- **Contract offer** = approve a facility limit, then (often) later invoice offers draw against it.
- **Invoice offer** = per-invoice amount / ratio / profit rate; contract-linked invoices often **do not** get their own signing envelope after the contract package is complete (`docs/integrations/issuer-offer-flow.md`).

**Recommendation:** Keep this ARF-i LOO for **contract facility Send Offer** only. Use a different (shorter) invoice offer letter for invoice financing — the existing sample PDF path already treats invoice terms separately.

---

## How to edit this file

For each row:

1. Confirm or change **Recommended fill**.
2. Put your final rule in **Your decision** (e.g. `use platform`, `admin override`, `legal fixed: 30`, `leave blank`).
3. Use **Notes** for edge cases (multiple contracts, guarantor count, etc.).

---

## 1. Header / letter meta


| ID  | Template location | Placeholder                    | Recommended fill                                                        | Platform source                                                                | Status                  | Your decision                                  | Notes                                                                      |
| --- | ----------------- | ------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------- | ---------------------------------------------- | -------------------------------------------------------------------------- |
| H1  | Header            | `[Under Shoraka’s Letterhead]` | Remove placeholder; apply CashSouk / SSP letterhead asset at generation | Brand / letterhead assets (not application data)                               | `MISSING` as data field | This is pending, we have not received this yet | Template instruction, not issuer data                                      |
| H2  | Issuer ID         | `[Insert]`                     | Issuer org id                                                           | `Application.issuer_organization_id` → `IssuerOrganization.id`                 | `EXISTS`                | Agreed                                         | CUID; confirm if legal wants a human-readable issuer code instead          |
| H3  | Our Reference     | `[Insert]`                     | Contract id as offer reference                                          | `Contract.id` (fallback `Application.id` only if needed)                       | `PARTIAL`               | Agreed                                         | No dedicated LOO reference scheme; contract id is the natural facility key |
| H4  | Date              | `[Insert]`                     | Date offer letter is issued / sent                                      | Prefer `Contract.offer_details.sent_at` (date part); else generation timestamp | `DERIVE`                | Agreed                                         | Format e.g. `16 July 2026`                                                 |


---

## 2. Addressee block


| ID  | Template location  | Placeholder                    | Recommended fill                           | Platform source                                                                                                                                    | Status   | Your decision | Notes                                                       |
| --- | ------------------ | ------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------- | ----------------------------------------------------------- |
| A1  | Recipient name     | `[INSERT ISSUER NAME]`         | Issuer legal name                          | `IssuerOrganization.name`                                                                                                                          | `EXISTS` | Agreed        | Also frozen later as `notes.issuer_snapshot.name`           |
| A2  | Registration no.   | `[ISSUER REGISTRATION NUMBER]` | SSM / registration number                  | `IssuerOrganization.registration_number` (also COD `basicInfo.ssmRegistrationNumber`)                                                              | `EXISTS` | Agreed        |                                                             |
| A3  | Address            | `[ISSUER ADDRESS]`             | Registered address, formatted single block | `IssuerOrganization.corporate_onboarding_data.addresses.registered` (line1, city, postcode, state, country); fallback `IssuerOrganization.address` | `EXISTS` | Agreed        | Prefer registered over business unless legal says otherwise |
| A4  | Attention name     | `[Name]`                       | Application contact person                 | `Application.company_details.contact_person.name`                                                                                                  | `EXISTS` | Agreed        | Not trustee letter config                                   |
| A5  | Attention position | `[Position]`                   | Contact person position                    | `Application.company_details.contact_person.position`                                                                                              | `EXISTS` | Agreed        |                                                             |


---

## 3. Facility schedule (commercial terms)


| ID  | Template location    | Placeholder                                  | Recommended fill                                                  | Platform source                                                                                                           | Status                      | Your decision                                                            | Notes                                                                      |
| --- | -------------------- | -------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| F1  | ISSUER               | `[INSERT ISSUER NAME]`                       | Same as A1                                                        | `IssuerOrganization.name`                                                                                                 | `EXISTS`                    | Agreed                                                                   | Duplicate of A1                                                            |
| F2  | FINANCING LIMIT      | `[insert]`                                   | Offered facility amount as `RM …`                                 | `Contract.offer_details.offered_facility`. After accept also `contract_details.approved_facility`                         | `EXISTS`                    | Agreed                                                                   | Confirm currency formatting and commas                                     |
| F3  | MARGIN OF RECEIVABLE | `[insert] %`                                 | Financing ratio % for utilisations under the facility             | **Not on `ContractOfferDetails` today.** Closest elsewhere: invoice `offered_ratio_percent` (wrong layer for this LOO)    | `MISSING` on contract offer | I think this should be the ratio of Approved Facility to Contract amount | Needs new contract-offer field, admin LOO input, or legal fixed default    |
| F4  | PROFIT RATE          | `[insert]` percent (`[insert]`%) per month   | Profit rate for the facility                                      | **Not on `ContractOfferDetails` today.** Invoice offers store `offered_profit_rate_percent` as **% p.a.**                 | `MISSING` on contract offer | This is pending, unsure of the definition                                | Need new contract-offer field + rule: monthly vs p.a. wording              |
| F5  | TENURE               | `Up to [insert] days`                        | Max facility / receivable tenure in days                          | No contract offer-time day-count. Contract has `start_date` / `end_date` (calendar span, not “up to N days”)              | `MISSING` at LOO time       | This is also pending, unsure of the definition                           | Admin-entered LOO tenure or derive from contract date span if legal agrees |
| F6  | AVAILABILITY PERIOD  | `within thirty (30) days` *(yellow default)* | Keep template default **30** unless product config says otherwise | No facility availability-period field. Closest clocks: `offer_acceptance.acceptance_expires_at` (different legal meaning) | `MISSING` as LOO term       | This is also pending, unsure of the definition                           | Yellow = editable legal default, not empty blank                           |


---

## 4. Guarantors listed under Transaction Documents


| ID  | Template location | Placeholder                         | Recommended fill       | Platform source                                                                                                             | Status   | Your decision | Notes                                                             |
| --- | ----------------- | ----------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------- | ------------- | ----------------------------------------------------------------- |
| G1  | Guarantor line 1  | `[INSERT NAME] (NRIC No. [INSERT])` | Individual guarantor 1 | `business_details.guarantors[]` where `guarantor_type === "individual"` → `name`, `ic_number` (also `ApplicationGuarantor`) | `EXISTS` | Agreed        | Template shows 3 slots; fill N individuals and hide/remove extras |
| G2  | Guarantor line 2  | same                                | Individual guarantor 2 | same                                                                                                                        | `EXISTS` | Agreed        |                                                                   |
| G3  | Guarantor line 3  | same                                | Individual guarantor 3 | same                                                                                                                        | `EXISTS` | Agreed        | If >3, extend list or confirm legal max                           |


---

## 5. Payment / timeline terms


| ID  | Template location                  | Placeholder                          | Recommended fill                               | Platform source                                                                                                                                     | Status    | Your decision                                                                               | Notes                                                                                    |
| --- | ---------------------------------- | ------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| P1  | PAYMENT PERIOD                     | max `[●]` days from disbursement     | No contractual field on contract offer         | Prospectus `averagePaymentPeriodDays` is **not** contractual                                                                                        | `MISSING` | This is also pending, unsure of the definition                                              | Needs admin LOO input or new contract-offer field                                        |
| P2  | GRACE PERIOD                       | `[●] (●) days`                       | Digits + words                                 | Post-note: `Note.grace_period_days` (default from `PlatformFinanceSetting.grace_period_days`, often 7). **Not** on `Contract.offer_details`         | `PARTIAL` | This is also pending, unsure of the definition                                              | Can prefill from platform finance setting if legal agrees grace is known at facility LOO |
| P3  | Execution of Transaction Documents | within `[●] (●) days’` of acceptance | Signing deadline in days                       | Closest: product `signing_deadline` → `offer_acceptance.signing_expires_at` / `SigningEnvelope.expires_at` (absolute datetime, not “N days” clause) | `PARTIAL` | Agreed                                                                                      | Prefer product signing deadline as N days if that is the intent                          |
| P4  | Withdrawal notice                  | `twenty-one (21) days’` *(yellow)*   | Keep **21** as legal default unless ops change | No platform field                                                                                                                                   | `MISSING` | Agreed (We need to add a platform config for this but defer that and keep it fixed for now) | Treat as fixed legal constant unless told otherwise                                      |
| P5  | Offer lapse                        | `seven (7) days` *(yellow)*          | Prefer product acceptance deadline days        | `Contract.offer_details.offer_acceptance.acceptance_expires_at` vs letter date → day count; product acceptance deadline config                      | `PARTIAL` | Agreed with acceptance deadline                                                             | Template hardcodes 7; platform may already use a different acceptance window             |
| P6  | Acceptance window (closing para)   | `seven (7) days` *(yellow)*          | Same as P5                                     | Same as P5                                                                                                                                          | `PARTIAL` | Agreed                                                                                      | Keep P5 and P6 identical                                                                 |


---

## 6. Schedule B — Assigned Contract(s)


| ID  | Template location     | Placeholder           | Recommended fill                               | Platform source                                                       | Status   | Your decision                                      | Notes                                                                   |
| --- | --------------------- | --------------------- | ---------------------------------------------- | --------------------------------------------------------------------- | -------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| C1  | Contract date         | `[●]`                 | Contract start (or award) date                 | `Contract.contract_details.start_date`                                | `EXISTS` | Agreed                                             | Confirm start_date vs document date                                     |
| C2  | Counterparty          | `[●]`                 | Approved buyer / paymaster name                | `Contract.customer_details.name`                                      | `EXISTS` | Agreed                                             |                                                                         |
| C3  | Subject / description | `[●]` (“Contract 1”)  | Contract title (fallback description / number) | `Contract.contract_details.title`; fallback `description` or `number` | `EXISTS` | Agreed                                             | Multi-contract apps: repeat clause or only primary contract             |
| C4  | “Approved Buyer(s)”   | `Buyer(s)` *(yellow)* | Likely emphasis, not a blank                   | N/A                                                                   | —        | Agreed, I think this was a mistake. Keep it as is. | Recommend leave as printed legal text unless counsel wants a named list |


---

## 7. Memorandum of Acceptance


| ID  | Template location            | Placeholder                                          | Recommended fill                       | Platform source                                                                                                             | Status    | Your decision               | Notes                                                                                            |
| --- | ---------------------------- | ---------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| M1  | RE line date                 | `DATED [●]`                                          | Same as letter date H4                 | Same as H4                                                                                                                  | `DERIVE`  | Agreed                      |                                                                                                  |
| M2  | Accepting company            | `_____________________________`                      | Issuer name                            | `IssuerOrganization.name`                                                                                                   | `EXISTS`  | Agreed                      | Can pre-fill; still signable                                                                     |
| M3  | Registration No.             | `____________________`                               | Same as A2                             | `IssuerOrganization.registration_number`                                                                                    | `EXISTS`  | Agreed                      |                                                                                                  |
| M4  | Registered address           | long underscore                                      | Same as A3                             | Same as A3                                                                                                                  | `EXISTS`  | Agreed                      |                                                                                                  |
| M5  | Facility amount              | `RM__________________________`                       | Same as F2                             | `Contract.offer_details.offered_facility`                                                                                   | `EXISTS`  | Agreed                      |                                                                                                  |
| M6  | Signature line               | `……………………………………………`                                  | Leave for signature                    | SigningCloud / wet ink                                                                                                      | `SIGNEE`  | Wet ink                     |                                                                                                  |
| M7  | Signatory company line       | `[Insert Issuer Name] (Company No. insert [insert])` | Name + reg no                          | A1 + A2                                                                                                                     | `EXISTS`  | Agreed                      |                                                                                                  |
| M8  | Authorised signatory name(s) | `[insert authorised person name]`                    | Bound signing recipients (issuer side) | `SigningRecipient.name` for issuer authorised signatories once bound in Offer Review; **before** bind: no durable LOO field | `PARTIAL` | Pending, will confirm this. | Do not confuse with `company_details.contact_person` unless ops confirm they are the same person |


---

## 8. Acknowledgement — individual guarantors


| ID  | Template location | Placeholder                       | Recommended fill               | Platform source                                        | Status               | Your decision                               | Notes                                               |
| --- | ----------------- | --------------------------------- | ------------------------------ | ------------------------------------------------------ | -------------------- | ------------------------------------------- | --------------------------------------------------- |
| IG1 | Name lines        | `Name of Guarantor` ×2 *(yellow)* | Individual guarantor names     | Same as G1–Gn `name`                                   | `EXISTS`             | Agreed                                      | Template shows 2; sync count with actual guarantors |
| IG2 | Recital issuer    | `[Issuer]`                        | Issuer name                    | `IssuerOrganization.name`                              | `EXISTS`             | Agreed                                      |                                                     |
| IG3 | Recital LOO date  | `_______________`                 | Same as H4                     | Same as H4                                             | `DERIVE`             | Agreed                                      |                                                     |
| IG4 | Date              | `Date : ______________________`   | Signing date                   | Leave blank until signed, or envelope completion date  | `SIGNEE` / `PARTIAL` | Agreed, I think we let the issuer fill this |                                                     |
| IG5 | Signature + name  | blank + `[Guarantor’s Name]`      | Guarantor name under signature | Guarantor `name`; signature via SigningCloud / wet ink | `EXISTS` + `SIGNEE`  | Agreed, wet ink                             |                                                     |


---

## 9. Acknowledgement — corporate guarantor


| ID  | Template location    | Placeholder                     | Recommended fill                  | Platform source                                                                                | Status               | Your decision         | Notes                                      |
| --- | -------------------- | ------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------- | --------------------- | ------------------------------------------ |
| CG1 | Company name         | `[NAME OF COMPANY]`             | Corporate guarantor business name | `business_details.guarantors[]` where `guarantor_type === "company"` → `business_name`         | `EXISTS`             | Agreed                | Omit whole section if no company guarantor |
| CG2 | Registration No.     | `●`                             | Corporate guarantor SSM           | same → `ssm_number`                                                                            | `EXISTS`             | Agreed                |                                            |
| CG3 | Recital issuer       | `[Issuer]`                      | Issuer name                       | `IssuerOrganization.name`                                                                      | `EXISTS`             | Agreed                |                                            |
| CG4 | Recital LOO date     | `_______________`               | Same as H4                        | Same as H4                                                                                     | `DERIVE`             | Agreed                |                                            |
| CG5 | Date                 | `Date : ______________________` | Signing date                      | Same as IG4                                                                                    | `SIGNEE` / `PARTIAL` | Agreed                |                                            |
| CG6 | Authorised signatory | `[Authorised Signatory ]` ×2    | Corporate guarantor signers       | No dedicated pre-offer store; at signing use `SigningRecipient` bound for that guarantor party | `PARTIAL`            | Pending, will confirm | May need issuer to bind names before send  |


---

## 10. Odd / cleanup


| ID  | Template location   | Placeholder               | Recommended fill     | Platform source | Status | Your decision                    | Notes            |
| --- | ------------------- | ------------------------- | -------------------- | --------------- | ------ | -------------------------------- | ---------------- |
| X1  | Near Payment Period | `Bullet` *(yellow alone)* | Delete from template | N/A             | —      | Bullet is most likely fixed yes. | Editing leftover |


---

## Summary — fillability (contract financing)

### Can fill from platform today (`EXISTS` / `DERIVE`)

- Issuer id, name, registration number, address
- Attention name + position
- Financing limit (`Contract.offer_details.offered_facility`)
- Individual + corporate guarantor identity fields
- Assigned contract date, buyer, title (`contract_details` + `customer_details`)
- Letter / MoA dates from `Contract.offer_details.sent_at` or generation time
- MoA party + facility amount blocks

### Needs a product/legal rule (`PARTIAL`)

- Grace period ← platform setting / note field, not on contract offer
- Offer validity “7 days” ← vs product `acceptance_expires_at`
- Transaction-docs execution “N days” ← vs `signing_deadline`
- Authorised signatories ← available after envelope bind, not earlier

### Not on contract offer yet (`MISSING`)

- Margin of receivable (ratio exists only on **invoice** offers today)
- Profit rate (exists only on **invoice** offers today, and as **p.a.**)
- Tenure days at facility LOO time
- Payment period (max days from disbursement)
- Availability period as a facility term
- Dedicated LOO / Our Reference scheme (beyond `Contract.id`)
- Letterhead asset (pending)

### Leave for signing (`SIGNEE`)

- Signature underscores / ellipsis lines
- Guarantor / authorised signatory signature marks
- Some “Date : ____” lines at execution (unless auto-stamped on complete)

---

## Suggested unique merge keys (contract LOO)

```
issuer_id
our_reference                 # Contract.id
letter_date
issuer_name
issuer_registration_number
issuer_address
attention_name
attention_position
financing_limit_rm            # offered_facility
margin_of_receivable_percent  # MISSING on contract offer — confirm capture
profit_rate_percent           # MISSING on contract offer — confirm monthly vs p.a.
profit_rate_percent_words
tenure_days
availability_period_days      # default 30?
guarantors_individual[]       # { name, nric }
payment_period_days
grace_period_days
transaction_docs_days
withdrawal_notice_days        # default 21?
offer_validity_days           # default 7 / product deadline
assigned_contracts[]          # { date, counterparty, description }
moa_authorised_signatory_names
corporate_guarantor           # { business_name, ssm_number } | null
corporate_guarantor_signatories[]
```

---

## Related code / docs

- Offer PDF (sample): `apps/api/src/modules/applications/offer-letter-pdf.ts`
- Contract facility flow: `docs/guides/application-flow/contract-offer-facility-flow.md`
- Offer types: `packages/types/src/index.ts` (`ContractOfferDetails`), `packages/types/src/offer-acceptance.ts`
- Guarantor schemas: `apps/api/src/modules/applications/schemas.ts`
- Contract / customer schemas: `apps/api/src/modules/contracts/schemas.ts`
- Offer flow: `docs/integrations/issuer-offer-flow.md`
- Acceptance / signing phases: `docs/guides/application-flow/offer-acceptance-and-signing-phases.md`

---

## Review checklist (for you)

- [ ] Confirm this template is **contract facility only** (invoice offers use a different letter)
- [ ] Confirm how to capture **margin of receivable** + **profit rate** on contract Send Offer (new fields vs admin-only LOO inputs)
- [ ] Confirm profit rate: template monthly vs platform p.a. convention
- [ ] Confirm Our Reference = `Contract.id` or new scheme
- [ ] Confirm defaults: availability 30, notice 21, validity 7
- [ ] Confirm payment period + tenure capture at facility offer
- [ ] Confirm grace: use `PlatformFinanceSetting.grace_period_days` at LOO
- [ ] Confirm guarantor slot count (dynamic vs fixed 2/3)
- [ ] Confirm authorised signatory source (contact person vs SigningRecipient)
- [ ] Delete leftover `Bullet` from Word template