# ARF LO (16 Aug 2026) — field data sources

Verification map for the tagged production template:

- Untagged source: `apps/api/src/modules/applications/templates/01 LO (Clean Copy) 16 August 2026.docx`
- Tagged merge file: `apps/api/src/modules/applications/templates/arf-contract-facility-lo.docx`
- Catalog: `arf_contract_facility_lo` **version 3**
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
| `financing_limit_rm` | Main FINANCING LIMIT; Schedule A Part A Financing Limit; MoA RM | `EXISTS` | `offer_details.offered_facility` else `approved_facility` → `formatRmAmount` | Same value in three places. Schedule A example text said “up to RM5,000,000” — confirm if that should be a **product ceiling** separate from this deal’s limit. **FLAG** if ceiling ≠ deal limit. |
| `tenure_days` | Main TENURE “Up to N days” | `EMPTY` | — | No contract-offer day count. **FLAG** — admin LO input vs derive from contract dates? |
| `max_invoice_tenure_days` | Schedule A Part A + Part B “up to N” | `EMPTY` | — | **FLAG** — product policy (was “180”) vs per-deal? Both Part A and B share one key today. |
| `sub_limit_per_invoice_rm` | Schedule A Part A Sub-Limit per Invoice | `EMPTY` | — | **FLAG** — product config vs offer field? |
| `part_b_financing_amount_rm` | Schedule A Part B Financing Amount | `EMPTY` | — | **FLAG** — Part B is invoice-based; this LO generate path is contract facility. Leave empty for Part A deals? Auto-hide Part B? |
| `guarantors_individual[]` | Finance documents list; ack name list; signature pages | `EXISTS` | Individual guarantors `name` + `ic_number` | Looped in Word — one signature page per guarantor |
| `payment_period_days` | PAYMENT PERIOD max N days | `EMPTY` | — | **FLAG** — still pending legal definition |
| `grace_period_days` / `_words` | GRACE PERIOD | `PARTIAL` | `PlatformFinanceSetting.grace_period_days` when present | **FLAG** — confirm OK at facility LO time |
| `transaction_docs_days` / `_words` | Execution of Transaction Documents | `DERIVE` | `signing_expires_at` − `sent_at` when both exist | |
| `offer_validity_phrase` | Acceptance window (“within … from the date of this letter”) | `DERIVE` | Acceptance expiry − `sent_at` → `daysPhrase`; else fixture `seven (7) days` | Lapse sentence elsewhere may still hardcode “seven (7) days” in Word — **FLAG** if both must stay identical |
| `assigned_contract_date` | Schedule B | `EXISTS` | `contract_details.start_date` | |
| `assigned_contract_counterparty` | Schedule B | `EXISTS` | `customer_details.name` | |
| `assigned_contract_description` | Schedule B | `EXISTS` | `title` / `description` / `number` | |
| `moa_authorised_signatory_names` | MoA authorised signatory name(s) | `EXISTS` | `authorized_parties` issuer names (comma-separated). Empty until Step 1 snapshot exists. | |
| `corporate_guarantor_name` / `_ssm` | Corporate ack | `EXISTS` | First company guarantor | |
| `corporate_signatory_1_name` / `_2_name` | Corporate ack signatory labels | `EXISTS` | First corporate guarantor’s declared people (first two names). Empty until snapshot exists. | |

---

## Legal text no longer merged (changed in 16 Aug LO)

These were merge tags on the July template; the revised LO hardcodes them:

| Former key | Now in Word | Notes |
|------------|-------------|--------|
| `margin_of_receivable_percent` | **MAXIMUM FINANCING MARGIN** — “Up to eighty per cent (80%) …” | Per-utilization margin disclosed in Utilization Offer |
| `profit_rate_percent` | Annual profit rate range **8%–18% p.a.**, set per Utilization Offer | No facility-level monthly % insert |
| `availability_period_phrase` | Part A availability: **thirty (30) days** hardcoded | |
| `withdrawal_notice_phrase` | **twenty-one (21) days’** hardcoded | |

---

## Not tagged (left for discussion)

| Item | Status | Notes |
|------|--------|-------|
| Facility Type ☐ Part A / ☐ Part B | `FLAG` | Checkboxes left as printed. Contract facility generate should mark Part A — needs checkbox/unicode approach or PDF post-process. |
| Signature lines / dates | `SIGNEE` | Wet ink |
| “This offer shall lapse automatically after seven (7) days” (non-yellow body copy) | `LEGAL_DEFAULT` | Only the yellow acceptance-window phrase is `{offer_validity_phrase}` |

---

## How to verify

1. `docker compose -f docker-compose.gotenberg.yml up -d` and set `GOTENBERG_URL` if testing PDF.
2. Admin → `/demos/contract-lo` → Reset fixture or Prefill contract → Download `.docx` / `.pdf`.
3. Spot-check each row in the table above against the downloaded file.
4. Mark **FLAG** rows with your decision; we then wire EXISTS/DERIVE/LEGAL_DEFAULT and bump catalog `version` if the Word file changes again.
