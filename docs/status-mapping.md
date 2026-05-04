# Status Mapping (DB → UI)

This document describes **director/shareholder status display** (badges) and related raw field mapping.

## Overview

Director and shareholder rows in Admin and Issuer are backed by `people[]` (`ApplicationPersonRow`). Each row carries:

- **`screening.status`** — AML / ACURIS-style screening line (from issuer `director_aml_status`, including corporate **business shareholders**).
- **`onboarding.status`** — Individual **KYC** pipeline status from issuer `director_kyc_status`, or for **corporate** rows the **KYB** status derived from `corporate_entities` (same field name; see **§5. Priority rules**).

The **single badge** next to each person (e.g. “Verified”, “Rejected”, “Expired”) comes from **`getFinalStatusLabel({ screening, onboarding })`** shared by Admin and Issuer:

**File:** `packages/types/src/director-shareholder-final-status.ts`  
Effective token: **`getDirectorShareholderEffectiveStatus`** — if normalized **`screening.status`** (AML) is non-empty, **only AML** drives the badge; otherwise **`onboarding.status`** (KYC/KYB) drives it.  
Badge colors: **`getFinalStatusBadgeClassName(tone)`** in the same file (`expired` → violet).

It does **not** read the database directly. It only reads **`screening.status`** and **`onboarding.status`** on the row the API (or issuer client) already built.

**Resend / notify / edit email** (issuer + admin) uses **`canManageDirectorShareholder`** in `packages/types/src/application-people-display.ts`: blocked when AML is terminal reject (**`REJECTED`**, **`FAILED`**, **`DECLINED`**) or AML is cleared (**`APPROVED`**, **`AML_APPROVED`**, **`CLEAR`**) or onboarding is **`WAIT_FOR_APPROVAL`** / **`APPROVED`**; allowed for onboarding **`REJECTED`**, **`EXPIRED`**, **`TIMEOUT`**, in-progress, empty, etc., when AML is not a hard reject.

**Issuer banner** (`DirectorShareholderAlertCard`) and **admin application list flag** `directorShareholderAmlPending` use **`hasActionableDirectorShareholder`** (any visible row with **`canManageDirectorShareholder`**). **Submit** still uses **`isReadyForSubmit`** (onboarding **`WAIT_FOR_APPROVAL`** / **`APPROVED`** only; AML ignored).

The legacy file `director-shareholder-single-status-display.ts` (AML-wins-KYC helpers) is **not** exported from `@cashsouk/types` and is **not** used for portal badges. Keep the file only as an internal reference if needed.

---

## 1. All raw statuses (KYC / AML / KYB)

These are the **issuer-side JSON** fields that ultimately feed the badge (after API mapping and optional supplement overrides).

### KYC (individuals only)

| Location | JSON path | Typical field holding status |
|----------|-----------|--------------------------------|
| `director_kyc_status` | `directors[]` | `kycStatus`, sometimes `status` |
| `director_kyc_status` | `individualShareholders[]` | `kycStatus`, sometimes `status` |

API picks `kycStatus` or `status`, normalizes → **`onboarding.status`** on each **INDIVIDUAL** `people` row (`build-people-list.ts` → `kycSanitizedStatus`).

### AML (individuals + corporate business shareholders)

| Location | JSON path | Field |
|----------|-----------|--------|
| `director_aml_status` | `directors[]` | `amlStatus` |
| `director_aml_status` | `individualShareholders[]` | `amlStatus` |
| `director_aml_status` | `businessShareholders[]` | `amlStatus` |

Normalized → **`screening.status`** (`amlSanitizedStatus`).

### KYB (corporate shareholders only)

| Location | JSON path | Typical status source |
|----------|-----------|------------------------|
| `corporate_entities` | `corporateShareholders[]` | `kybRequestDto.status`, and/or top-level shareholder `status` (via CE merge in API) |

Normalized KYB string → **`onboarding.status`** on **CORPORATE** rows (same property name as individual KYC).

### Supplements (full row when present)

| Storage | Effect |
|---------|--------|
| `ctos_party_supplements` row for party key | **`people[]`** for that `matchKey` is built **only** from `onboarding_json` (via `parseCtosPartySupplement`) for **`requestId`**, **`onboarding.*`**, **`screening.*`**, **`email`** — issuer KYC/AML is not mixed in. If no supplement row exists for the key, issuer JSON is used. |

Any value that ends up in `screening.status` / `onboarding.status` is still normalized and then passed through the same UI rules below.

---

## 2. How statuses are normalized

**Function:** `normalizeRawStatus(v)` — `packages/types/src/status-normalization.ts`

| Step | Rule |
|------|------|
| Input | Any `unknown` / string from DB or JSON |
| Trim | Leading/trailing whitespace removed |
| Case | Entire string uppercased |
| Spaces | Whitespace runs replaced with `_` |
| Output | Token string, or `""` if empty after trim |

**Examples:** `"Rejected"` → `REJECTED`, `"In Progress"` → `IN_PROGRESS`, `"  pending  "` → `PENDING`.

**Where it runs:** When building or overriding rows in `build-people-list.ts` and supplement maps, and inside **`getDirectorShareholderEffectiveStatus`** / **`getFinalStatusLabel`** (via `normalizeRawStatus`).

---

## 3. Transformation pipeline (API + UI)

### 3.1 Row build (issuer JSON → `people[]`)

**`buildAdminPeopleList` / `buildUnifiedPeople` / `buildPeopleFromUserDeclaredData`** — `apps/api/src/modules/admin/build-people-list.ts`

- **`enrichPersonFromIssuerMaps`** maps issuer JSON + `corporate_entities` into `screening` (AML) and `onboarding` (KYC or KYB).
- AML display string: `amlSanitizedStatus` → `normalizeRawStatus(amlStatus)` (or empty).
- Individual KYC: `kycSanitizedStatus` → `normalizeRawStatus(kycStatus || status)`.
- Corporate: `onboarding.status` from CE KYB status raw, normalized.

### 3.2 After row build

**`normalizeUnifiedPeopleRows`** merges duplicate rows by `matchKey` (union roles, max share, strip auxiliary email fields). Supplement vs issuer is already decided **before** this step: supplement row present → row came entirely from `parseCtosPartySupplement`; otherwise from **`enrichPersonFromIssuerMaps`**.

### 3.3 Single badge (UI) — effective status → label

**`getFinalStatusLabel(person)`** in `packages/types/src/director-shareholder-final-status.ts`:

1. Compute **`getDirectorShareholderEffectiveStatus`**: non-empty normalized AML → `{ source: "AML", value }`; else `{ source: "ONBOARDING", value }` (values via **`normalizeRawStatus`**).
2. Map the **single** effective token:
   - Empty → **Not Started**
   - **`EXPIRED`**, **`TIMEOUT`** → **Expired** (recoverable; same resend affordances as onboarding reject when AML allows — see **`canManageDirectorShareholder`**)
   - **`ONBOARDING`** + **`REJECTED`** → **Action Required** (KYC/KYB reject only)
   - **`AML`** + **`REJECTED`** / **`FAILED`** / **`DECLINED`** → **Rejected**; **`ONBOARDING`** + **`FAILED`** / **`DECLINED`** → **Rejected**
   - Pending-review set (incl. **`WAIT_FOR_APPROVAL`**, **`PENDING`**, **`UNRESOLVED`**, **`NO_MATCH`**, …) → **Pending Review**
   - In-progress set → **In Progress**
   - **`APPROVED`**, **`AML_APPROVED`**, **`CLEAR`** → **Verified**
   - Otherwise → **In Progress**

**Badge colors:** `getFinalStatusBadgeClassName(tone)` (green / amber / red / gray / violet for expired).

### Where Admin and Issuer call the same logic

| Surface | File |
|---------|------|
| Admin director/shareholder table | `apps/admin/src/components/admin/director-shareholder-table.tsx` |
| Issuer unified director/shareholders | `apps/issuer/src/components/director-shareholders-unified-section.tsx` |
| Issuer company application step | `apps/issuer/src/app/(application-flow)/applications/steps/company-details-step.tsx` |
| Admin onboarding review people cards | `apps/admin/src/components/onboarding-review-dialog.tsx` |
| Issuer / investor onboarding dashboard (company, pending approval or AML) | `apps/issuer/src/components/onboarding-status-card.tsx`, `apps/investor/src/components/onboarding-status-card.tsx` via **`UnifiedKycAmlReadonlyRows`** (`packages/ui`) |
| Investor profile directors and shareholders | `apps/investor/src/components/directors-shareholders-card.tsx` |

All import **`getFinalStatusLabel`** / **`getFinalStatusBadgeClassName`** from **`@cashsouk/types`** (or the UI wrapper that calls them).

---

## 4. Legacy reference (token buckets — not used for the unified badge)

The tables below describe **`getAmlGroup` / `getKycGroup`** inside `director-shareholder-single-status-display.ts`. They remain useful for understanding **raw RegTank-ish tokens** after **`normalizeRawStatus`**, but **portal badges** use **`getFinalStatusLabel`** instead.

### AML groups (`getAmlGroup`) — source: `screening.status`

| Raw status (normalized) | Group | Final label |
|----------------------|-------|----------------|
| *(empty)* | `NOT_STARTED` | Not Started |
| `APPROVED`, `AML_APPROVED`, `CLEAR` | `APPROVED` | Approved |
| `REJECTED`, `FAILED`, `DECLINED` | `REJECTED` | Rejected |
| `WAIT_FOR_APPROVAL`, `UNDER_REVIEW`, `RISK_ASSESSED`, `PENDING_APPROVAL` | `UNDER_REVIEW` | Under Review |
| `PENDING`, `IN_PROGRESS`, `PROCESSING`, `ID_UPLOADED`, `LIVENESS_STARTED`, `LIVENESS_PASSED`, `EMAIL_SENT`, `SENT`, `FORM_FILLING` | `IN_PROGRESS` | In Progress |
| **Any other non-empty string** | `IN_PROGRESS` | In Progress |

### KYC groups (`getKycGroup`) — source: `onboarding.status` (individual KYC **or** corporate KYB string in the same field)

| Raw status (normalized) | Group | Final label |
|----------------------|-------|----------------|
| *(empty)* | `NOT_STARTED` | Not Started |
| `APPROVED` | `APPROVED` | Approved |
| `REJECTED`, `FAILED`, `DECLINED` | `REJECTED` | Rejected |
| `EXPIRED`, `TIMEOUT` | `EXPIRED` | Expired |
| `WAIT_FOR_APPROVAL`, `WAITING_FOR_APPROVAL`, `PENDING_APPROVAL` | `PENDING_REVIEW` | Pending Review |
| `IN_PROGRESS`, `PROCESSING`, `ID_UPLOADED`, `LIVENESS_STARTED`, `LIVENESS_PASSED`, `EMAIL_SENT`, `SENT`, `FORM_FILLING`, `PENDING` | `IN_PROGRESS` | In Progress |
| **Any other non-empty string** | `IN_PROGRESS` | In Progress |

**Note:** The unified badge uses fixed English labels (**Verified**, **Rejected**, **Expired**, **Action Required**, **Pending Review**, **In Progress**, **Not Started**), not title-case legacy group names.

---

## 5. Priority rules (current): AML-first, then onboarding-only fallback

Only **one** normalized token is evaluated per row: **AML if present**, else **onboarding**.

| Rule | Meaning |
|------|--------|
| AML non-empty | Badge follows **AML** only (`source: "AML"`). Onboarding is ignored for the label. |
| AML empty | Badge follows **onboarding** / KYB (`source: "ONBOARDING"`). |
| Onboarding-only **`REJECTED`** | **Action Required** (distinct from AML **Rejected**). |
| **`EXPIRED`** / **`TIMEOUT`** | **Expired** on whichever source is effective (typically onboarding when AML is empty). |

**Source of truth (badge):** `packages/types/src/director-shareholder-final-status.ts`.  
**Source of truth (resend/notify):** `canManageDirectorShareholder` in `application-people-display.ts`.

---

## 6. Real examples

### Individual example (Lim Tze Yang)

**Data:**

- `director_kyc_status`: `kycStatus` = `APPROVED` → `onboarding.status` → normalized `APPROVED`.
- `director_aml_status`: `amlStatus` = `Rejected` → `screening.status` → normalized `REJECTED`.

**Unified badge (AML wins):** `screening` = `REJECTED` (non-empty AML) → **Rejected**; onboarding `APPROVED` is not shown on the badge when AML is present.

---

### Corporate example (Petronas Sdn Bhd)

**Data:**

- `corporate_entities` / KYB: e.g. `APPROVED` on KYB DTO → `onboarding.status` → normalized `APPROVED`.
- `director_aml_status.businessShareholders`: `amlStatus` = `Pending` → `screening.status` → normalized `PENDING`.

**Unified badge (AML wins):** `screening` = `PENDING` → **Pending Review** (onboarding `APPROVED` ignored for label while AML is non-empty).

---

## 7. Edge cases

| Case | Behavior |
|------|----------|
| **Missing AML** (empty after normalize) | **`getFinalStatusLabel`** uses **onboarding** only. |
| **Missing KYC/KYB** but AML present | **AML** only drives the label. |
| **Both missing** | **Not Started**. |
| **Unknown / unlisted non-empty token** on the effective source | **In Progress** (default branch). |
| **Supplement replaces issuer for that party** | For that `matchKey`, screening/onboarding for the row come from parsed supplement JSON for those fields; issuer KYC/AML is not merged into those fields. |

---

## Summary

Director/shareholder badges use **`getFinalStatusLabel`** with **AML-first** effective status (**`getDirectorShareholderEffectiveStatus`**). Admin and Issuer import the same helpers from **`@cashsouk/types`**, so the label matches for the same **`people[]`** row. **Resend / notify / edit email** follows **`canManageDirectorShareholder`**.

---

## Reference index (read-only)

| Topic | File |
|------|------|
| Unified director/shareholder badge + effective status | `packages/types/src/director-shareholder-final-status.ts` |
| Resend / notify / edit-email gate | `packages/types/src/application-people-display.ts` (`canManageDirectorShareholder`) |
| Legacy AML/KYC-only presentation (unused for portal badge) | `packages/types/src/director-shareholder-single-status-display.ts` |
| `normalizeRawStatus` | `packages/types/src/status-normalization.ts` |
| Other RegTank badge classes | `packages/types/src/regtank-onboarding-status.ts` (`regtankDisplayStatusBadgeClass`) |
| `people[]` enrichment | `apps/api/src/modules/admin/build-people-list.ts` (`enrichPersonFromIssuerMaps`, `normalizeUnifiedPeopleRows`) |
| Supplement JSON shape | `packages/types/src/ctos-party-supplement-json.ts` |
