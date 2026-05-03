# Status Mapping (DB → UI)

This document describes **director/shareholder status display** (badges) and related raw field mapping.

## Overview

Director and shareholder rows in Admin and Issuer are backed by `people[]` (`ApplicationPersonRow`). Each row carries:

- **`screening.status`** — AML / ACURIS-style screening line (from issuer `director_aml_status`, including corporate **business shareholders**).
- **`onboarding.status`** — Individual **KYC** pipeline status from issuer `director_kyc_status`, or for **corporate** rows the **KYB** status derived from `corporate_entities` (same field name; see **§5. Priority rules**).

The **single badge** next to each person (e.g. “Verified”, “Action Required”) comes from **`getFinalStatusLabel({ screening, onboarding })`** shared by Admin and Issuer:

**File:** `packages/types/src/director-shareholder-final-status.ts`  
Badge colors: **`getFinalStatusBadgeClassName(tone)`** in the same file.

It does **not** read the database directly. It only reads **`screening.status`** and **`onboarding.status`** on the row the API (or issuer client) already built. **Both** statuses are combined with fixed priority (rejected/expired → action required; explicit pending-review tokens → pending review; plain `PENDING` → in progress; both verified tokens → verified; both empty → not started).

The legacy helper `getDirectorShareholderSingleStatusPresentation` (AML-wins-KYC) remains in `director-shareholder-single-status-display.ts` for backward compatibility but is **not** used for director/shareholder badges in the portals.

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

**Where it runs:** On `screening.status` and `onboarding.status` **inside** `getDirectorShareholderSingleStatusPresentation`, and earlier when building/overriding rows in `build-people-list.ts` and supplement maps.

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

### 3.3 Single badge (UI) — how `screening` / `onboarding` become one label

**`getFinalStatusLabel(person)`** in `packages/types/src/director-shareholder-final-status.ts`:

1. Normalize each string: trim, uppercase, spaces → underscores (not `normalizeRawStatus`; self-contained for this badge).
2. Build the list of non-empty normalized values from **`onboarding.status`** and **`screening.status`**.
3. Apply priority: rejected/failed/declined → **Action Required**; expired/timeout → **Action Required**; wait-for-approval / pending-approval / under review / risk assessed → **Pending Review**; plain `PENDING` and in-progress-style tokens → **In Progress**; when every non-empty token is approved/aml-approved/clear → **Verified**; both empty → **Not Started**; otherwise → **In Progress**.

**Badge colors:** `getFinalStatusBadgeClassName(tone)` in the same file (green / red / amber / gray).

### Where Admin and Issuer call the same logic

| Surface | File |
|---------|------|
| Admin director/shareholder table | `apps/admin/src/components/admin/director-shareholder-table.tsx` |
| Issuer unified director/shareholders | `apps/issuer/src/components/director-shareholders-unified-section.tsx` |
| Issuer company application step | `apps/issuer/src/app/(application-flow)/applications/steps/company-details-step.tsx` |
| Admin onboarding review people cards | `apps/admin/src/components/onboarding-review-dialog.tsx` |

All import **`getFinalStatusLabel`** / **`getFinalStatusBadgeClassName`** from **`@cashsouk/types`**.

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

**Note:** The unified badge uses fixed English labels (**Verified**, **Action Required**, **Pending Review**, **In Progress**, **Not Started**), not title-case legacy group names.

---

## 5. Priority rules (current): both checks, ordered buckets

**Both** `screening.status` and `onboarding.status` contribute to **`getFinalStatusLabel`**. There is **no** “AML string non-empty therefore ignore KYC” rule.

| Step | Meaning |
|------|--------|
| 1 | Worst outcome wins first: any rejected / failed / declined on either side → **Action Required**. |
| 2 | Then expired / timeout on either side → **Action Required**. |
| 3 | Then explicit “pending review” tokens (not plain `PENDING`) → **Pending Review**. |
| 4 | Then in-progress family (including plain **`PENDING`**) → **In Progress**. |
| 5 | If every non-empty token is approved / aml-approved / clear → **Verified**. |
| 6 | If both sides normalize to empty → **Not Started**. |

**Source of truth (badge):** `packages/types/src/director-shareholder-final-status.ts`.

---

## 6. Real examples

### Individual example (Lim Tze Yang)

**Data:**

- `director_kyc_status`: `kycStatus` = `APPROVED` → `onboarding.status` → normalized `APPROVED`.
- `director_aml_status`: `amlStatus` = `Rejected` → `screening.status` → normalized `REJECTED`.

**Unified badge:** `onboarding` = `APPROVED`, `screening` = `REJECTED` → **Action Required** (rejected on either side wins).

---

### Corporate example (Petronas Sdn Bhd)

**Data:**

- `corporate_entities` / KYB: e.g. `APPROVED` on KYB DTO → `onboarding.status` → normalized `APPROVED`.
- `director_aml_status.businessShareholders`: `amlStatus` = `Pending` → `screening.status` → normalized `PENDING`.

**Unified badge:** `onboarding` = `APPROVED`, `screening` = `PENDING` → **In Progress** (plain pending is in-progress bucket, not pending-review).

---

## 7. Edge cases

| Case | Behavior |
|------|----------|
| **Missing AML** | Only **`onboarding.status`** tokens drive **`getFinalStatusLabel`**. |
| **Missing KYC/KYB** | Only **`screening.status`** tokens drive the label. |
| **Both missing** | **Not Started** (badge always shown). |
| **Unknown / unlisted non-empty token** | **In Progress** (default branch). |
| **Supplement replaces issuer for that party** | For that `matchKey`, a `ctos_party_supplements` row makes `people[]` use **only** parsed `onboarding_json` for RegTank ids and statuses; issuer KYC/AML is not merged. |

---

## Summary

Director/shareholder badges use **`getFinalStatusLabel`**: **both** `screening.status` and `onboarding.status` are normalized and evaluated together with the priority in **§5**. Admin and Issuer import the same helpers from **`@cashsouk/types`**, so the label matches for the same **`people[]`** row.

---

## Reference index (read-only)

| Topic | File |
|------|------|
| Unified director/shareholder badge | `packages/types/src/director-shareholder-final-status.ts` |
| Legacy AML/KYC-only presentation (unused for portal badge) | `packages/types/src/director-shareholder-single-status-display.ts` |
| `normalizeRawStatus` | `packages/types/src/status-normalization.ts` |
| Other RegTank badge classes | `packages/types/src/regtank-onboarding-status.ts` (`regtankDisplayStatusBadgeClass`) |
| `people[]` enrichment | `apps/api/src/modules/admin/build-people-list.ts` (`enrichPersonFromIssuerMaps`, `normalizeUnifiedPeopleRows`) |
| Supplement JSON shape | `packages/types/src/ctos-party-supplement-json.ts` |
