# ARF LO (19 Aug 2026) — field data sources

Verification map for the tagged production template:

- Untagged source: `apps/api/src/modules/applications/templates/01 LO (Clean Copy) 19 August 2026.docx`
- Tagged merge file: `apps/api/src/modules/applications/templates/arf-contract-facility-lo.docx`
- Rebuild script: `apps/api/scripts/retag-lo-template.ts` (`pnpm --filter @cashsouk/api retag-lo-template`)
- Catalog: `arf_contract_facility_lo` **version 4**
- Builder: `buildFacilityLoMergeData`
- Demo + production both call `renderFacilityLoDocx` on that same tagged file

**Legend**

| Status | Meaning |
|--------|---------|
| `EXISTS` | Filled from platform data today |
| `DERIVE` | Computed from platform data |
| `LEGAL_DEFAULT` | Hardcoded in Word (not a merge tag) or fixture phrase until product config exists |
| `EMPTY` | Merge key present; builder leaves blank until we agree a source |
| `SIGNEE` | Wet ink — intentionally blank |
| `FLAG` | Implemented as empty/partial — **needs your decision** |

---

## Demo ↔ production sync

Already shared (no separate “demo template”):

| Piece | Demo | Production |
|-------|------|------------|
| Word file | `arf-contract-facility-lo.docx` | same |
| Render | `renderFacilityLoDocx` | same |
| Prefill | `buildFacilityLoMergeData` via `GET .../demos/contract-lo/prefill` | same builder inside generate service |
| Editable overrides | Demo form body on `POST .../generate` | Live app/contract only |

**How to test on the fly:** change the tagged `.docx` and/or builder → restart API → open `/demos/contract-lo` → Prefill or Reset fixture → Download. Issuer download uses the same render path after offer send.

---

## Merge fields (tagged `{snake_case}`)

| Merge key | Template location | Status | Data source today | Notes / FLAG |
|-----------|-------------------|--------|-------------------|--------------|
| `issuer_id` | Header — Issuer ID | `EXISTS` | `IssuerOrganization.id` | |
| `our_reference` | Header — Our Reference | `EXISTS` | `Contract.id` | |
| `letter_date` | Header Date; MoA “DATED …” | `DERIVE` | `offer_details.sent_at` → `formatLetterDate`; else today | |
| `issuer_name` | Addressee; ISSUER row; MoA; acks; behalf line | `EXISTS` | `IssuerOrganization.name` | |
| `issuer_registration_number` | Addressee; MoA; behalf “Company No.” | `EXISTS` | `IssuerOrganization.registration_number` | |
| `issuer_address` | Addressee; MoA | `EXISTS` | COD registered address; fallback `org.address` | |
| `attention_name` | Attention | `EXISTS` | `company_details.contact_person.name` | |
| `attention_position` | Attention | `EXISTS` | `company_details.contact_person.position` | |
| `financing_limit_rm` | Main FINANCING LIMIT; Schedule A Part A Financing Limit; MoA | `EXISTS` | `offer_details.offered_facility` else `approved_facility` → `formatRmAmount` | Same value in three places. `formatRmAmount` already prefixes `RM` — MoA must not add another `RM`. Schedule A example text said “up to RM5,000,000” — confirm if that should be a **product ceiling** separate from this deal’s limit. **FLAG** if ceiling ≠ deal limit. |
| `tenure_days` | Main TENURE “Up to N days” | `EMPTY` | — | No contract-offer day count. **FLAG** — admin LO input vs derive from contract dates? |
| `max_invoice_tenure_days` | Schedule A Part A + Part B “up to N” | `EMPTY` | — | **FLAG** — product policy (was “180”) vs per-deal? Both Part A and B share one key today. |
| `sub_limit_per_invoice_rm` | Schedule A Part A Sub-Limit per Invoice | `EMPTY` | — | **FLAG** — product config vs offer field? |
| `part_b_financing_amount_rm` | Schedule A Part B Financing Amount | `EMPTY` | — | **FLAG** — Part B is invoice-based; this LO generate path is contract facility. Leave empty for Part A deals? Auto-hide Part B? |
| `part_a_checkbox` / `part_b_checkbox` | Schedule A Facility Type | `DERIVE` | `readFinancingStructureType(application.financing_structure)` | `new_contract` → Part A `☒`; `invoice_only` / `existing_contract` → Part B `☒`; missing structure → both `☐`. |
| `guarantors_individual[]` | Finance documents list; one acknowledgement page each | `EXISTS` | Individual guarantors `name` + `ic_number` | `{#guarantors_individual}` wraps the whole acknowledgement (heading, recitals, Date, one signature box). `{@page_break}` after every page except the last (and after the last when a corporate block follows). |
| `guarantors_corporate[]` | Corporate acknowledgement pages | `EXISTS` | Company guarantors + `authorized_parties` representatives | `{name, ssm, signatories[]}`. Render flattens to `corporate_guarantor_pages` (up to **four** boxes per page, two per row). Heading + recitals + Date only on a company’s first page; continuation pages keep “For and on behalf of {company_name}”. Zero declared signatories still print one blank box. |
| `payment_period_days` | PAYMENT PERIOD max N days | `EMPTY` | — | **FLAG** — still pending legal definition |
| `grace_period_days` / `_words` | GRACE PERIOD | `PARTIAL` | `PlatformFinanceSetting.grace_period_days` when present | **FLAG** — confirm OK at facility LO time |
| `transaction_docs_days` / `_words` | Execution of Transaction Documents | `DERIVE` | `signing_expires_at` − `sent_at` when both exist | |
| `offer_validity_phrase` | Acceptance window (“within … from the date of this letter”) | `DERIVE` | Acceptance expiry − `sent_at` → `daysPhrase`; else fixture `seven (7) days` | Lapse sentence elsewhere may still hardcode “seven (7) days” in Word — **FLAG** if both must stay identical |
| `assigned_contract_date` | Schedule B | `EXISTS` | `contract_details.start_date` | |
| `assigned_contract_counterparty` | Schedule B | `EXISTS` | `customer_details.name` | |
| `assigned_contract_description` | Schedule B | `EXISTS` | `title` / `description` / `number` | |
| `moa_authorised_signatory_names` | MoA authorised signatory name(s) | `EXISTS` | `authorized_parties` issuer names (comma-separated). Empty until Step 1 snapshot exists. | |

---

## Acknowledgement pagination

| Party | Pages | Boxes |
|-------|-------|-------|
| Each individual guarantor | 1 full page (heading + “We, the undersigned” + that person’s name + recitals + Date + one wet-ink box) | 1 |
| Corporate, 1–4 signatories | 1 page | Two per row; trailing odd count hides the empty right box |
| Corporate, 5+ signatories | `ceil(n / 4)` pages | First page: heading + recitals + Date + up to 4 boxes; later pages: “For and on behalf of …” + remaining boxes |
| No corporate guarantors | Corporate block omitted | — |

Signature boxes stay wet-ink: printed name above the line; `NRIC :` / `Designation :` blank.

---

## Legal text hardcoded in Word (19 Aug)

| Topic | Template text |
|-------|----------------|
| Maximum financing margin | Up to eighty per cent (80%) of Eligible Invoice Value |
| Profit rate | 8%–18% p.a., set per Utilization Offer |
| Part A availability | thirty (30) days from acceptance |
| Withdrawal notice | twenty-one (21) days’ prior written notice |
| Application Fee | **RM150**, payable on application (Schedule A Part A and Part B) |
| Electronic execution | OPERATION OF THE FACILITY — Platform-created records equal written form; acceptance of a Utilisation Offer constitutes the Purchase Requisition and Wa'd; Clause 3A.4 of the Facility Agreement; Platform audit records conclusive except for fraud, unauthorised access, system failure, corrupted/duplicated records, or mismatch with Trustee records |

---

## Not tagged (left for discussion)

| Item | Status | Notes |
|------|--------|-------|
| Signature lines / dates | `SIGNEE` | Wet ink |
| “This offer shall lapse automatically after seven (7) days” (non-yellow body copy) | `LEGAL_DEFAULT` | Only the yellow acceptance-window phrase is `{offer_validity_phrase}` |

---

## How to verify

1. `docker compose -f docker-compose.gotenberg.yml up -d` and set `GOTENBERG_URL` if testing PDF.
2. Admin → `/demos/contract-lo` → Reset fixture or Prefill contract → Download `.docx` / `.pdf`.
3. Spot-check letterhead, Part A tick, MoA amount (single `RM`), RM150 fees, e-execution paragraph, and guarantor pagination (3 individuals → 3 pages; 2-signatory company → 1 page / 2 boxes; 5-signatory company → 2 pages).
4. Mark **FLAG** rows with your decision; we then wire EXISTS/DERIVE/LEGAL_DEFAULT and bump catalog `version` if the Word file changes again.
