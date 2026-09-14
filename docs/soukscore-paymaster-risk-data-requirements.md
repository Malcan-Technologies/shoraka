# SoukScore — Paymaster Risk: Data Requirements

Source: *SoukScore Master Risk Scoring Module* (internal Word document).
Pillar weight in total SoukScore: **35%** (of 100% before guarantor adjustment).

Within the **Paymaster Risk** pillar, sub-weights are:

| Sub-component | Weight (within pillar) |
|---------------|------------------------:|
| Paymaster Category | 40% |
| Payment Reliability Assessment | 40% |
| Paymaster Concentration | 20% |

---

## 1. Paymaster Category (40% of pillar)

**Purpose:** Classify the Paymaster into a category; each maps to a fixed score.

**Output scores (for reference):** Federal/State Government 100 · GLC/Statutory Body 90 · Public Listed/MNC 85 · Large Private (&gt;RM50m revenue) 70 · SME/Unrated 50 · Related Party 20.

### Data and evidence required to classify

| Data need | Description |
|-----------|-------------|
| **Paymaster legal identity** | Name, registration number, jurisdiction, entity type (company / statutory body / government unit, etc.). |
| **Government / statutory classification** | Whether the Paymaster is a Federal or State ministry, department, agency, or statutory body under Malaysian law; funding/control by government. |
| **GLC / GLIC linkage** | Government controlling stake; ability to appoint board/management; ownership trail (Khazanah, MoF Inc, KWAP, BNM, GLICs); subsidiary/affiliate relationships. |
| **Listed company status** | Whether shares are listed on Bursa Malaysia or another recognised exchange; regulatory disclosure regime. |
| **MNC criteria (if claiming MNC)** | Number of countries of operation (≥2); consolidated annual revenue &gt; RM500m; audited financials or equivalent public disclosures. |
| **Large private company criteria** | Not listed; annual revenue &gt; RM50m from **latest audited financial statements**; operational track record 3–5 years; verifiable financial information available. |
| **SME / unrated fallback** | Revenue &lt; RM50m and/or limited history and/or lack of audited financials or external credit assessment — used when higher categories are not met. |
| **Related-party assessment** | Structured evidence for each applicable limb: **(A)** common ownership (e.g. ≥20% cross-holdings or significant influence); **(B)** common directorship / key management across Issuer and Paymaster; **(C)** control relationship (Companies Act 2016 style); **(D)** significant influence (shareholding, contracts, management, financing dependency); **(E)** family relationships among key shareholders/directors/beneficial owners; **(F)** economic dependence and non–arm’s-length risk. |

---

## 2. Payment Reliability Assessment (40% of pillar)

**Purpose:** Assign an evidence tier for historical payment behaviour between Issuer and Paymaster; tier maps to a score.

**Output scores (for reference):** Observed on-time (≥2 cycles) 100 · Observed minor delays (&lt;14 days) 80 · Issuer-documented history 70 · Market-inferred (Gov/GLC/PLC) 75 · Unobservable 50.

### Data and evidence required

| Evidence tier | Inputs the platform must be able to observe or record |
|---------------|------------------------------------------------------|
| **Observed on-time payments (≥2 cycles)** | At least **two prior invoices** between the **same Issuer and Paymaster**; each **fully settled on or before contractual due date**; **verified** records: bank statements, remittance advice, or **platform transaction data**. |
| **Observed minor delays (&lt;14 days)** | Prior invoices paid **after due date** but within **14 calendar days**; **verifiable** payment records. |
| **Issuer-documented history** | Issuer-supplied payment proof: payment confirmations, bank-in slips, remittance records, signed acknowledgements — where **not** independently validated by the platform. |
| **Market-inferred (Gov / GLC / PLC)** | No direct payment history, but Paymaster profile supports inference (government, GLC, or PLC); relies on **institutional profile** (overlaps with Paymaster Category data). |
| **Unobservable** | No payment history and **no** reasonable profile-based inference (typical for private/unrated/new Paymasters). |

**Implicit data fields:** per-invoice **due dates**, **actual settlement dates**, **cycle count** with same Paymaster, and whether evidence is **platform-verified** vs **issuer-provided only**.

---

## 3. Paymaster Concentration (20% of pillar)

**Purpose:** Measure Issuer dependency on a single Paymaster as a share of total revenue.

**Formula (from methodology):**

```text
Concentration % = Revenue from this Paymaster ÷ Total annual revenue of the Issuer
```

### Data required

| Data need | Description |
|-----------|-------------|
| **Revenue from Paymaster** | Annual (or policy-defined period) revenue attributable to the Paymaster in scope for the note. |
| **Issuer total revenue** | Denominator: Issuer’s **total** annual revenue for the same period. |
| **Consistency** | Clear definition of period (e.g. fiscal year) and whether revenue is audited / management / projected. |

**Output scores (for reference):** &lt;20% → 100 · 20–40% → 80 · 40–60% → 60 · &gt;60% → 40.

---

## 4. Relationship to CTOS and `ctos-sample`

The **Paymaster Risk** pillar is **not** satisfied by issuer-only CTOS credit data.

- **`apps/api/src/ctos-test/ctos-sample`** and the CTOS parser in **`ctos.ts`** primarily support **Issuer** attributes (e.g. FICO/SME score, legal sums, accounts, CCRIS-style limits) used under **Issuer Risk** and **Mandatory Eligibility** gates, not Paymaster category, concentration, or Issuer–Paymaster payment history.
- **`ctos.ts`** explicitly scopes out Paymaster/invoice business logic at the parser layer (see file header); SoukScore rules belong in a **scoring service** with data from onboarding, contracts, invoices, and bank/platform evidence.

To score Paymaster Risk end-to-end you still need **application/contract/invoice** data (and optionally **separate KYB/credit** on the Paymaster entity if you classify category from external sources).

---

## 5. Initial codebase alignment (high level)

This is a **snapshot** for follow-up mapping work; it is not exhaustive.

| Data theme | Where it may appear today |
|------------|---------------------------|
| Paymaster **name** (display) | `Contract.customer_details` / `Application.company_details` — admin UI resolves a “Paymaster” label from `customer_name` / `name` / `company_name` (see admin application detail page). |
| **Financing structure** (e.g. invoice-only vs contract) | `Application.financing_structure` JSON (`structure_type`, `existing_contract_id`). |
| **Invoices** | `Invoice.details` JSON per application; supports historical amounts and timing **if** those fields are populated consistently. |
| **Issuer financials** | `Application.financial_statements` and related JSON blobs — may feed **total revenue** and concentration if revenue-by-customer is captured. |
| **CTOS** | Parsed issuer report — **does not** replace Paymaster-specific inputs. |

**Likely gaps vs methodology:** structured Paymaster **category** rules (Gov/GLC/PLC/MNC/large private/related party), **platform-verified** payment dates across ≥2 cycles, and **revenue share** from one Paymaster vs issuer total revenue may require explicit fields or workflows not yet centralised in Prisma models.

---

## 6. Checklist — minimum data to implement Paymaster Risk

- [ ] Paymaster entity identity + classification inputs for **category** (and **related-party** screening).
- [ ] Per-invoice (or payment) **due date**, **paid date**, and **verification source** (platform vs issuer).
- [ ] Count of **completed cycles** with same Paymaster meeting on-time or &lt;14-day delay rules.
- [ ] **Revenue from Paymaster** and **issuer total revenue** for the same reporting period.
- [ ] Optional: store **evidence tier** chosen by policy when inferring from Gov/GLC/PLC profile or marking **unobservable**.
