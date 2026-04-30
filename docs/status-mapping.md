# Status Mapping (DB → UI)

This document describes **only** display behavior. **No code paths are changed here.**

## Overview

Director and shareholder rows in Admin and Issuer are backed by `people[]` (`ApplicationPersonRow`). Each row carries:

- **`screening.status`** — AML / ACURIS-style screening line (from issuer `director_aml_status`, including corporate **business shareholders**).
- **`onboarding.status`** — Individual **KYC** pipeline status from issuer `director_kyc_status`, or for **corporate** rows the **KYB** status derived from `corporate_entities` (same field name; see **§5. Priority rules**).

The **single badge** next to each person (e.g. “In Progress”, “Rejected”) comes from **one function** shared by Admin and Issuer:

`getDirectorShareholderSingleStatusPresentation({ screening, onboarding })`  
**File:** `packages/types/src/director-shareholder-single-status-display.ts`

It does **not** read the database directly. It only reads **`screening.status`** and **`onboarding.status`** on the row the API (or issuer client) already built.

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

### 3.3 Single badge (UI) — how `screening` / `onboarding` become labels

**`getDirectorShareholderSingleStatusPresentation(person)`**

1. `amlRaw = normalizeRawStatus(person.screening?.status)`
2. `kycRaw = normalizeRawStatus(person.onboarding?.status)`
3. **If `amlRaw` is non-empty** → use **AML** pipeline: `getAmlGroup(amlRaw)` → label = title-case of **group** enum.
4. **Else if `kycRaw` is non-empty** → use **KYC** pipeline (includes corporate KYB-in-onboarding): `getKycGroup(kycRaw)` → label = title-case of group.
5. **Else** → return `null` (no badge).

**Badge colors:** `badgeClassForStatusGroup` → `regtankDisplayStatusBadgeClass` in `packages/types/src/regtank-onboarding-status.ts` (approved = green, rejected = red, empty = muted, everything else = amber).

### Where Admin and Issuer call the same logic

| Surface | File |
|---------|------|
| Admin director/shareholder table | `apps/admin/src/components/admin/director-shareholder-table.tsx` |
| Issuer unified director/shareholders | `apps/issuer/src/components/director-shareholders-unified-section.tsx` |
| Issuer company application step | `apps/issuer/src/app/(application-flow)/applications/steps/company-details-step.tsx` |
| Admin onboarding review people cards | `apps/admin/src/components/onboarding-review-dialog.tsx` |

All import **`getDirectorShareholderSingleStatusPresentation`** from **`@cashsouk/types`** (same implementation).

---

## 4. Status mapping tables (normalized token → UI label)

Labels are **`toTitleCase(group)`** on the internal group enum (e.g. `IN_PROGRESS` → **“In Progress”**).  
Values in the tables below are **after `normalizeRawStatus`** (what `getAmlGroup` / `getKycGroup` compare against).

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

**Note:** There is **no** separate UI label **“Completed”** from this helper; terminal success is **“Approved”** (`APPROVED` group).

---

## 5. Priority rules: AML > KYC > KYB

The UI function implements a **strict two-step** check, not a three-way merge:

```
normalize(screening.status)  →  if non-empty → AML pipeline (getAmlGroup) → badge
else normalize(onboarding.status)  →  if non-empty → same grouping as KYC (getKycGroup) → badge
else → no badge
```

| Priority | Field on `people[]` | Meaning in product terms |
|:--------:|---------------------|---------------------------|
| **1 — wins** | `screening.status` | **AML** (from `director_aml_status`, including `businessShareholders` for corporates) |
| **2** | `onboarding.status` | **KYC** for individuals (`director_kyc_status`) **or KYB** for corporates (`corporate_entities` KYB), same property |
| **3** | *(N/A as separate input)* | **KYB never competes with AML** in code: if AML is non-empty, KYB is ignored for this badge |

So in documentation terms: **AML > (KYC or KYB)**. **KYB** only affects the badge when it is the value in **`onboarding.status`** *and* **AML is empty** after normalization.

**Source of truth:** `getDirectorShareholderSingleStatusPresentation` in `packages/types/src/director-shareholder-single-status-display.ts` (file header: “AML always wins over KYC”).

**Corporate nuance:** For corporates, KYB still uses **`getKycGroup`** (naming is historical). The returned `source` is `"KYC"` in that branch even when the underlying data is KYB.

**No merge:** If both AML and KYC/KYB are present, **only AML** drives the badge. There is no “pick worst” or “pick best” across the two.

---

## 6. Real examples

### Individual example (Lim Tze Yang)

**Data:**

- `director_kyc_status`: `kycStatus` = `APPROVED` → `onboarding.status` → normalized `APPROVED`.
- `director_aml_status`: `amlStatus` = `Rejected` → `screening.status` → normalized `REJECTED`.

**Steps:**

1. `amlRaw = "REJECTED"` (non-empty).
2. Presentation **does not** consider `kycRaw`.
3. `getAmlGroup("REJECTED")` → group `REJECTED`.
4. Label = **“Rejected”**, `source: "AML"`, rejected badge class.

**Final UI badge:** **Rejected** (AML), even though KYC is approved.

---

### Corporate example (Petronas Sdn Bhd)

**Data:**

- `corporate_entities` / KYB: e.g. `APPROVED` on KYB DTO → `onboarding.status` → normalized `APPROVED`.
- `director_aml_status.businessShareholders`: `amlStatus` = `Pending` → `screening.status` → normalized `PENDING`.

**Steps:**

1. `amlRaw = "PENDING"` (non-empty).
2. KYB line is **not** used for the badge.
3. `getAmlGroup("PENDING")` → `PENDING` is in `AML_IN_PROGRESS` → group `IN_PROGRESS`.
4. Label = **“In Progress”**, `source: "AML"`.

**Final UI badge:** **In Progress** (AML), not “Approved” from KYB.

---

## 7. Edge cases

| Case | Behavior |
|------|----------|
| **Missing AML** (`screening.status` empty after normalize) | Falls through to **`onboarding.status`** → `getKycGroup` → labels such as **Approved**, **In Progress**, **Pending Review**, **Expired**, **Not Started**. |
| **Missing KYC/KYB** (`onboarding.status` empty) but AML present | AML-only mapping. |
| **Both missing** | `getDirectorShareholderSingleStatusPresentation` returns **`null`** → UI shows **no** badge from this helper (other columns may still show data). |
| **Unknown / unlisted raw token** | **AML:** `getAmlGroup` defaults to **`IN_PROGRESS`** → “In Progress”. **KYC:** `getKycGroup` defaults to **`IN_PROGRESS`** → “In Progress”. |
| **Supplement replaces issuer for that party** | For that `matchKey`, a `ctos_party_supplements` row makes `people[]` use **only** parsed `onboarding_json` for RegTank ids and statuses; issuer KYC/AML is not merged. |

---

## Summary

Normalized **AML** (`screening.status`) always drives the single director/shareholder status badge when it is present; otherwise normalized **KYC or KYB** (`onboarding.status`) drives it. Raw values are uppercased and underscored, then bucketed into a small set of **groups** whose **Title Case** names (“In Progress”, “Rejected”, …) are what you see. Admin and Issuer use the **same** `getDirectorShareholderSingleStatusPresentation` from `@cashsouk/types`, so the behavior matches as long as **`people[]`** is built the same way (issuer via API; admin via `buildAdminPeopleList` and related paths).

---

## Reference index (read-only)

| Topic | File |
|------|------|
| Single-badge rules + AML/KYC lists | `packages/types/src/director-shareholder-single-status-display.ts` |
| `normalizeRawStatus` | `packages/types/src/status-normalization.ts` |
| Badge Tailwind classes | `packages/types/src/regtank-onboarding-status.ts` (`regtankDisplayStatusBadgeClass`) |
| `people[]` enrichment | `apps/api/src/modules/admin/build-people-list.ts` (`enrichPersonFromIssuerMaps`, `normalizeUnifiedPeopleRows`) |
| Supplement JSON shape | `packages/types/src/ctos-party-supplement-json.ts` |
