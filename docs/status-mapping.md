# Status Mapping (DB → UI)

## Overview

Director and shareholder rows in Admin and Issuer are backed by `people[]` (`ApplicationPersonRow`). Each row carries:

- **`screening.status`** — AML / ACURIS-style screening line (from issuer `director_aml_status`, including corporate **business shareholders**).
- **`onboarding.status`** — Individual **KYC** pipeline status from issuer `director_kyc_status`, or for **corporate** rows the **KYB** status derived from `corporate_entities` (same field name; see [Corporate nuance](#corporate-nuance-kyb-in-onboardingstatus) below).

The **single badge** next to each person (e.g. “In Progress”, “Rejected”) comes from **one function** shared by Admin and Issuer:

`getDirectorShareholderSingleStatusPresentation({ screening, onboarding })`  
**File:** `packages/types/src/director-shareholder-single-status-display.ts`

It does **not** read the database directly. It only reads **`screening.status`** and **`onboarding.status`** on the row the API (or issuer client) already built.

---

## Data Sources

| Source | Storage | Becomes on `ApplicationPersonRow` | Notes |
|--------|---------|-------------------------------------|--------|
| **KYC (individual onboarding)** | `director_kyc_status` JSON: `directors[]`, `individualShareholders[]` → `kycStatus` / `status` | `onboarding.status` (individuals) | Matched by government ID / EOD in `build-people-list.ts` → `enrichPersonFromIssuerMaps` |
| **AML (screening)** | `director_aml_status` JSON: `directors[]`, `individualShareholders[]`, `businessShareholders[]` → `amlStatus` | `screening.status` | Individuals: AML row by IC / EOD. Corporates: AML by COD or BRN |
| **KYB (corporate onboarding)** | `corporate_entities.corporateShareholders[]` → `kybRequestDto.status` or shareholder `status` (via CE party refs) | `onboarding.status` (corporates) | Same `onboarding` field as KYC; value is normalized KYB status |
| **CTOS party supplements** | `ctos_party_supplements.onboarding_json` | **Overrides** `onboarding.status` and `screening.status` per party key when present | Applied in `normalizeUnifiedPeopleRows` in `apps/api/src/modules/admin/build-people-list.ts` using `getEffectiveCtosPartyOnboarding` / `getEffectiveCtosPartyScreening` from `packages/types/src/ctos-party-supplement-json.ts` |

Raw strings from JSON are passed through **`normalizeRawStatus`** before grouping (see below).

---

## Transformation Pipeline

### 1. Raw → normalized

**`normalizeRawStatus(v)`** — `packages/types/src/status-normalization.ts`

- Trims, uppercases, replaces whitespace with `_`.
- Example: `"Rejected"` → `"REJECTED"`, `"In Progress"` → `"IN_PROGRESS"`.

### 2. Row build (API)

**`buildAdminPeopleList` / `buildUnifiedPeople` / `buildPeopleFromUserDeclaredData`** — `apps/api/src/modules/admin/build-people-list.ts`

- **`enrichPersonFromIssuerMaps`** maps issuer JSON + `corporate_entities` into `screening` (AML) and `onboarding` (KYC or KYB).
- AML display string: `amlSanitizedStatus` → `normalizeRawStatus(amlStatus)` (or empty).
- Individual KYC: `kycSanitizedStatus` → `normalizeRawStatus(kycStatus || status)`.
- Corporate: `onboarding.status` from CE KYB status raw, normalized.

### 3. Supplement overrides (optional)

**`normalizeUnifiedPeopleRows`** merges duplicate rows by `matchKey`, then for each key:

- If a supplement exists for that party key, **`onboarding.status`** and **`screening.status`** are replaced by values read from `onboarding_json` (`getEffectiveCtosPartyOnboarding` / `getEffectiveCtosPartyScreening` + `normalizeRawStatus`).
- If no supplement for that key, issuer-derived `row.onboarding?.status` / `row.screening?.status` stay (still normalized).

### 4. Single badge (UI)

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

## Status Mapping Table

Values below are **after `normalizeRawStatus`**. Group → **label** = `toTitleCase(group)` (e.g. `IN_PROGRESS` → **“In Progress”**).

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

## Priority Rules

**Documented in code** (`director-shareholder-single-status-display.ts`, lines 3–4 and 113–115):

1. **`screening.status` (AML) wins whenever it is non-empty after normalization.**
2. **`onboarding.status` (KYC / KYB)** is used **only if** AML is empty.
3. There is **no** merge of “worst” or “best” of both: AML fully **replaces** KYC/KYB for the badge whenever AML has any normalized value.

**Corporate nuance (`onboarding.status` = KYB):**  
For `entityType === "CORPORATE"`, `onboarding.status` still flows through **`getKycGroup`** when AML is absent. The returned `source` field is typed `"KYC" | "AML"` — for that branch the data is **KYB** from CE, but the **label rules** are the KYC group lists above.

---

## Examples

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

## Edge Cases

| Case | Behavior |
|------|----------|
| **Missing AML** (`screening.status` empty after normalize) | Falls through to **`onboarding.status`** → `getKycGroup` → labels such as **Approved**, **In Progress**, **Pending Review**, **Expired**, **Not Started**. |
| **Missing KYC/KYB** (`onboarding.status` empty) but AML present | AML-only mapping. |
| **Both missing** | `getDirectorShareholderSingleStatusPresentation` returns **`null`** → UI shows **no** badge from this helper (other columns may still show data). |
| **Unknown / unlisted raw token** | **AML:** `getAmlGroup` defaults to **`IN_PROGRESS`** → “In Progress”. **KYC:** `getKycGroup` defaults to **`IN_PROGRESS`** → “In Progress”. |
| **Supplement overrides issuer** | For that `matchKey`, `onboarding_json` drives `onboarding.status` / `screening.status` in `normalizeUnifiedPeopleRows`, then the same presentation rules apply. |

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
