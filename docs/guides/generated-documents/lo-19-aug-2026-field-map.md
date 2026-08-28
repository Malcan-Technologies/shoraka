# ARF LO (19 Aug 2026) — field data sources

Verification map for the tagged production template:

- Untagged source: `apps/api/src/modules/applications/templates/01 LO (Clean Copy) 19 August 2026.docx`
- Tagged merge file: `apps/api/src/modules/applications/templates/arf-contract-facility-lo.docx`
- Rebuild script: `apps/api/scripts/retag-lo-template.ts` (`pnpm --filter @cashsouk/api retag-lo-template`)
- Catalog: `arf_contract_facility_lo` **version 8**
- Builder: `buildFacilityLoMergeData`
- Demo + production both call `renderFacilityLoDocx` on that same tagged file
- Required commercial / party data fails generation (`GENERATED_DOCUMENT_DATA_INCOMPLETE`) instead of issuing a letter with blank slots
- Empty optional / unwired fields print the merge tag or legal placeholder, yellow-highlighted, so missing merges are obvious

**Legend**

| Status | Meaning |
|--------|---------|
| `EXISTS` | Filled from platform data |
| `DERIVE` | Computed from platform data |
| `LEGAL_DEFAULT` | Hardcoded in Word (not a merge tag) or platform constant |
| `SIGNEE` | Wet ink — intentionally blank |

---

## Demo ↔ production sync

Already shared (no separate “demo template”):

| Piece | Demo | Production |
|-------|------|------------|
| Word file | `arf-contract-facility-lo.docx` | same |
| Render | `renderFacilityLoDocx` | same |
| Prefill | `buildFacilityLoMergeData` via `GET .../demos/contract-lo/prefill` | same builder inside generate service |
| Editable overrides | Demo form body on `POST .../generate` | Live app/contract only |

**How to test on the fly:** change the tagged `.docx` and/or builder → restart API → open `/demos/contract-lo` → Prefill or Reset fixture → Download. Issuer download uses the same render path after offer send **and** a saved authorised-representatives draft.

---

## Merge fields (tagged `{snake_case}`)

| Merge key | Template location | Status | Data source | Notes |
|-----------|-------------------|--------|-------------|-------|
| `issuer_id` | Header — Issuer ID | `EXISTS` | `IssuerOrganization.id` | |
| `our_reference` | Header — Our Reference | `EXISTS` | `Contract.id` | |
| `letter_date` | Header Date; MoA “DATED …”; acknowledgement “dated …” | `DERIVE` | `offer_details.sent_at` → `formatLetterDate` | Required |
| `issuer_name` | Addressee; ISSUER row; MoA; acks; behalf line | `EXISTS` | `IssuerOrganization.name` | |
| `issuer_registration_number` | Addressee; MoA; behalf “Company No.” | `EXISTS` | Org `registration_number`, else COD `basicInfo.ssmRegistrationNumber` / `ssmRegisterNumber` | |
| `issuer_address` | Addressee; MoA | `EXISTS` | COD registered address; fallback `org.address` | |
| `attention_name` | Attention | `EXISTS` | `company_details.contact_person.name` | |
| `attention_position` | Attention | `EXISTS` | `company_details.contact_person.position` | |
| `financing_limit_rm` | Main FINANCING LIMIT; Schedule A Part A; MoA | `EXISTS` | `offered_facility` else `approved_facility` → `formatRmAmount` | `formatRmAmount` already prefixes `RM` |
| `tenure_days` | Main TENURE “Up to N days” | `LEGAL_DEFAULT` | `FINANCING_TENURE_MAX_DAYS` (180) | |
| `max_invoice_tenure_days` | Schedule A Part A + Part B “up to N” | `LEGAL_DEFAULT` | same 180 | |
| `sub_limit_per_invoice_rm` | Schedule A Part A Sub-Limit per Invoice | `EXISTS` | Frozen product `invoice_details.sub_limit_per_invoice_rm` | Required when the product declares this LO. Legacy versions must be backfilled. |
| `part_b_financing_amount_rm` | Schedule A Part B Financing Amount | `EXISTS` | Same value as sub-limit | |
| `part_a_checkbox` / `part_b_checkbox` | Schedule A Facility Type | `DERIVE` | `readFinancingStructureType` | `new_contract` → Part A `☒`; `invoice_only` / `existing_contract` → Part B `☒` |
| `finance_documents_guarantors[]` | Finance Documents list | `EXISTS` | Ordered `application_guarantors` | Individual `{line}`; corporate company/registration `{line}` plus nested `{rep_line}` (name + NRIC). Entities `i. ii. iii.`; reps under a company `a. b. c.`. Empty list → `[INSERT NAME] (NRIC No. [INSERT])` |
| `guarantors_individual[]` | One acknowledgement page each | `EXISTS` | Live individual rows | `{@page_break}` after every page except the last (and after the last when a corporate block follows) |
| `guarantors_corporate[]` | Corporate acknowledgement pages | `EXISTS` | Live company rows + draft/canonical authorised parties | `{name, ssm, signatories[{name,nric,capacity}]}`. While Step 1 is editable the saved draft is used. Render paginates four boxes per page. Registration number prints under “For and on behalf of …”. |
| `payment_period_days` | PAYMENT PERIOD max N days | `LEGAL_DEFAULT` | 180 | |
| `grace_period_days` / `_words` | GRACE PERIOD | `EXISTS` | `PlatformFinanceSetting.grace_period_days` | |
| `transaction_docs_days` / `_words` | Execution of Transaction Documents | `EXISTS` | Frozen `signing_deadline.days` (default 14) | |
| `offer_validity_phrase` | Acceptance window **and** lapse sentence | `DERIVE` | Acceptance expiry − `sent_at` → `daysPhrase` | Same phrase in both clauses |
| `assigned_contract_date` | Schedule B | `EXISTS` | `contract_details.start_date` | |
| `assigned_contract_counterparty` | Schedule B | `EXISTS` | `customer_details.name` | |
| `assigned_contract_description` | Schedule B | `EXISTS` | `title` / `description` / `number` | |

---

## Acknowledgement pagination

| Party | Pages | Boxes |
|-------|-------|-------|
| Each individual guarantor | 1 full page (heading + “We, the undersigned” + that person’s name + recitals dated `{letter_date}` + Date + one wet-ink box) | 1 |
| Corporate, 1–4 signatories | 1 page | Two-cell table rows; signature line then name; trailing odd count leaves the right cell empty of tags |
| Corporate, 5+ signatories | `ceil(n / 4)` pages | First page: heading + recitals + Date + up to 4 boxes; later pages: “For and on behalf of …” + registration number + remaining boxes |
| No corporate guarantors | Corporate block omitted | — |
| Annexure | Always starts on a new page | Unconditional page break after the last acknowledgement |

---

## Legal text hardcoded in Word (19 Aug)

| Topic | Template text |
|-------|----------------|
| Maximum financing margin | Up to eighty per cent (80%) of Eligible Invoice Value |
| Profit rate | 8%–18% p.a., set per Utilization Offer |
| Part A availability | thirty (30) days from acceptance |
| Withdrawal notice | twenty-one (21) days’ prior written notice |
| Application Fee | **RM150**, payable on application (Schedule A Part A and Part B) |
| Electronic execution | OPERATION OF THE FACILITY — Platform-created records equal written form; acceptance of a Utilisation Offer constitutes the Purchase Requisition and Wa'd |

---

## Not tagged

| Item | Status | Notes |
|------|--------|-------|
| Signature lines / dates / NRIC / Designation | `SIGNEE` | Wet ink |
| MoA “Name of Authorised Signatory (ies)” | `SIGNEE` | Blank for issuer completion |
| Annexure GTC “seven (7) days” (distress/execution, posting) | `LEGAL_DEFAULT` | Different legal concept from offer validity |

---

## Verification matrix

| Case | Expect |
|------|--------|
| Individual-only (3 people) | 3 acknowledgement pages; Finance Documents lists each name/NRIC; Annexure on its own page |
| Corporate-only, 2 signatories | 1 corporate page, 2 boxes, signature line above names, SSM under “For and on behalf of” |
| Corporate-only, 5 signatories (odd) | 2 pages; heading only on first; last row has empty right cell (no leftover tags) |
| Mixed individuals + corporate | Individual pages, then corporate pages, then Annexure break |
| Missing `sent_at`, registration, draft, or sub-limit | HTTP 400 `GENERATED_DOCUMENT_DATA_INCOMPLETE` — required fields do not download as blanks |

1. `docker compose -f docker-compose.gotenberg.yml up -d` and set `GOTENBERG_URL` if testing PDF.
2. Save authorised representatives (Continue) so the contract offer stores `authorized_parties_draft`.
3. Issuer/admin download `.docx` / `.pdf`, or Admin → `/demos/contract-lo`.
4. Spot-check letterhead, Part A tick, MoA amount (single `RM`), blank MoA signatory line, RM150 fees, both validity clauses, Finance Documents nesting, and guarantor pagination.
