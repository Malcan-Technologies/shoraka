# Director/Shareholder Pending Guide

This guide explains when the Director/Shareholder pending badge and banners appear.

It covers:
- Admin badge behavior
- Admin Financial tab banner behavior
- Issuer-side warning/block behavior
- What "visible people" means

---

## 1) What "visible people" means

"Visible people" means rows the system can actually build and keep after mapping and filtering.

In simple terms:
- The system first builds `people` rows from available data.
- Then it filters rows using role/share rules (for example, shareholder below 5% can be filtered out).
- The remaining rows are the visible list used by badge/banner/block checks.

Important:
- If data has no usable identity key (like IC for individuals or SSM/business number for companies), some rows may not be created.
- So raw data can exist, but visible rows can still end up empty.

---

## 2) What happens when visible list is empty

Current behavior (after the fix):
- No Director/Shareholder pending badge
- No Admin Financial pending banner
- No block from this specific director/shareholder pending check

This still applies even if CTOS is pulled:
- CTOS can be pulled successfully
- But if no visible rows are produced, pending stays false

---

## 3) When the Admin pending badge appears

Admin pending badge appears when:
- There is at least one visible row, and
- At least one visible row is not fully ready based on pending logic

The pending logic checks both:
- Onboarding readiness
- AML screening approval

So badge shows if any visible row fails either side.

---

## 4) When the Admin Financial banner appears

The Admin Financial tab banner follows the same pending logic as the admin pending badge.

It appears when:
- Visible list has rows, and
- At least one visible row is still pending

It does not appear when:
- Visible list is empty

---

## 5) When issuer-side banner or blocking appears

There are two issuer-side behaviors:

### A) Issuer profile/application warning card (action-required banner)

This banner appears when there is at least one visible row that is still actionable.

"Actionable" here means:
- Onboarding is not yet in a locked done state, and
- AML is not in a terminal state that blocks further action

So this banner is about "you still need to do onboarding actions."

### B) Issuer submit blocking/readiness check

Issuer submit readiness checks visible mapped **individuals**.

Submit is blocked when:
- At least one visible individual is not submit-ready for onboarding

Submit is not blocked by this specific check when:
- There are no visible mapped individuals

Note:
- This submit readiness check is onboarding-focused.
- It does not require AML approval for this specific submit gate.

---

## 6) Easy examples

### Example A: No visible directors/shareholders

Result:
- Admin badge: No
- Admin banner: No
- Issuer blocked by this check: No

### Example B: One visible person, AML not approved

Result:
- Admin badge: Yes
- Admin banner: Yes
- Issuer blocked: Not necessarily (submit check is onboarding-focused)

### Example C: One visible person, onboarding/KYC not submit-ready

Result:
- Admin badge: Yes
- Admin banner: Yes
- Issuer blocked: Yes (for submit readiness check)

### Example D: Old data has names/emails only, no IC/SSM key

Result:
- No visible row may be created
- Admin badge: No
- Admin banner: No
- Issuer blocked by this specific check: No

---

## 7) Old bug and fix (simple summary)

Before:
- Empty visible list was treated as pending.
- This could show pending states even when there were no rows to review.

After:
- Empty visible list is treated as not pending.
- No pending badge/banner from this check when visible list is empty.

---

## 8) Quick decision table

| Situation | Admin badge | Admin banner | Issuer block/banner | Notes |
|---|---|---|---|---|
| No visible rows | No | No | No block from this check | Includes CTOS pulled but still no visible rows |
| Visible rows exist, at least one AML not approved | Yes | Yes | Submit block depends on onboarding readiness | Admin pending check includes AML |
| Visible rows exist, onboarding not submit-ready | Yes | Yes | Yes (submit blocked) | Issuer submit gate uses onboarding readiness |
| Visible rows all ready (onboarding ready + AML approved) | No | No | No block from this check | Ready state |
| Data exists but no usable identity key, so rows not mapped | No | No | No block from this check | Common with missing IC/SSM/business number |

---

## 9) Difference from assumptions

One key difference from common assumption:
- Issuer submit blocking is not the same as admin AML pending.
- Issuer submit gate is based on onboarding submit readiness for visible individuals.
- AML can still affect admin pending state even when issuer submit may pass.

---

## 10) Developer reference

Main functions and files used for this behavior:

- `packages/types/src/application-people-display.ts`
  - `filterVisiblePeopleRows`
  - `computeHasPendingDirectorShareholder`
  - `hasActionableDirectorShareholder`
  - `isReadyForSubmit`
  - `isReadyForFinancialApproval`

- `apps/admin/src/components/application-financial-review-content.tsx`
  - Admin Financial tab pending banner render

- `apps/admin/src/components/application-review/sections/financial-section.tsx`
  - Financial approve button disabled by pending state

- `apps/admin/src/components/applications-table-row.tsx`
  - Admin list pending badge render (`application.directorShareholderAmlPending`)

- `apps/admin/src/app/applications/[productKey]/[id]/page.tsx`
  - Header pending badge render

- `apps/issuer/src/components/director-shareholder-alert-card.tsx`
  - Issuer action-required banner logic (`hasActionableDirectorShareholder`)

- `apps/issuer/src/lib/director-shareholder-onboarding-ui.ts`
  - `areDirectorShareholdersReadyForApplicationSubmit`

- `apps/issuer/src/app/(application-flow)/applications/edit/[id]/page.tsx`
  - Issuer submit button disable + toast message

- `apps/api/src/modules/applications/director-shareholder-onboarding-guard.ts`
  - Backend submit readiness enforcement (`isReadyForSubmit`)

- `packages/types/src/director-shareholder-display.ts`
  - Mapping path where rows can be skipped when identity key is missing

