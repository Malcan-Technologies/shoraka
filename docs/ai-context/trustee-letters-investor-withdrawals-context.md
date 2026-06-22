# Trustee Letters, Investor Withdrawals, and Platform Finance Settings Context

## Audience

Developers and future AI assistants who need full technical context for trustee instruction letters, investor withdrawals, Platform Finance Settings, and related admin/investor flows.

---

## 1. Scope summary

This implementation covers:

- **Platform Finance Settings** cleanup (Late Payment, Trustee Letter, Money Flow Accounts tabs)
- **Trustee Letter** header/default configuration stored in `PlatformFinanceSetting.trustee_letter_config`
- **Money Flow Accounts** stored in `PlatformFinanceSetting.ledger_bucket_accounts_config` (with hidden legacy `platform_accounts_config` preserved on save)
- **Word-style trustee instruction PDFs** via `apps/api/src/modules/notes/trustee-letters/`
- **Investor withdrawal request flow** (investor portal → balance deduction → `WithdrawalInstruction`)
- **Admin Investor Withdrawals** list page (`/finance/investor-withdrawals`) and detail page (`/finance/investor-withdrawals/[id]`)
- **Sidebar/dashboard pending badge** for investor withdrawals awaiting action
- **Dedicated RBAC permissions** `investor_withdrawals.view` and `investor_withdrawals.manage`
- **Fee row mapping cleanup** so Platform Fee, Facility Fee, and Service Fee render as separate payment rows when separate source amounts exist, reusing **Operating Account** as destination

Out of scope / not implemented:

- Submit-to-trustee email delivery (manual status only)
- Cancellation/reversal/refund of investor withdrawals
- Success Fee (no real field in codebase)
- Repayment-side Platform Fee row (no separate settlement field today)
- Batch settlement workflow
- Letter Templates tab (fields exist in DB but unused by current PDF generation; tab removed from UI)

---

## 2. Final Platform Finance Settings structure

**Page:** Admin → Settings → Platform Finance (`/settings/platform-finance`)

**Permissions:**

- View: `platform_settings.view`
- Save/edit: `platform_settings.manage`
- Read-only when user has view but not manage (inputs and save buttons disabled)

**Tabs (current):**

```txt
Late Payment
Trustee Letter
Money Flow Accounts
```

Removed from UI: Platform Accounts tab, Ledger Buckets tab (renamed/reworked), Letter Templates tab.

### Late Payment

Stores scalar fields on `PlatformFinanceSetting`:

| UI label | API/camelCase field | Prisma snake_case |
|----------|---------------------|-------------------|
| Grace period days | `gracePeriodDays` | `grace_period_days` |
| Arrears threshold days | `arrearsThresholdDays` | `arrears_threshold_days` |
| Ta'widh rate cap % | `tawidhRateCapPercent` | `tawidh_rate_cap_percent` |
| Default Ta'widh rate % | `defaultTawidhRatePercent` | `default_tawidh_rate_percent` |
| Gharamah rate cap % | `gharamahRateCapPercent` | `gharamah_rate_cap_percent` |
| Default Gharamah rate % | `defaultGharamahRatePercent` | `default_gharamah_rate_percent` |

**Hidden but preserved:** `platformFeeRateCapPercent` / `platform_fee_rate_cap_percent` remains in state and is included on Late Payment save for compatibility. It is **not shown** in the Late Payment tab UI.

Save button: `Save Late Payment`

### Trustee Letter

Stored in JSON column `trustee_letter_config` (API: `trusteeLetterConfig`).

| UI label | Config key |
|----------|------------|
| Trustee name | `trusteeName` |
| Trustee address line 1 | `trusteeAddressLine1` |
| Trustee address line 2 | `trusteeAddressLine2` |
| Trustee address line 3 | `trusteeAddressLine3` |
| Attention person | `attentionPerson` |
| Default contact person | `defaultContactPerson` |
| Authorised signatory label | `authorisedSignatoryLabel` |
| Platform display name | `platformDisplayName` |
| Default value date | `defaultValueDateBehavior` (e.g. `T+1`, `same_day`) |
| Default reference prefix | `defaultLetterRefPrefix` |

These populate trustee letter **header and default metadata** (trustee address block, attention, platform name, reference prefix, value date behavior, signatory label). They are **not** money-flow bank accounts.

Save button: `Save Trustee Letter`

### Money Flow Accounts

Stored primarily in `ledger_bucket_accounts_config` (API: `ledgerBucketAccountsConfig`).

**Visible account sections:**

- Investor Pool (`INVESTOR_POOL`)
- Repayment Pool (`REPAYMENT_POOL`)
- Operating Account (`OPERATING_ACCOUNT`)
- Ta'widh Account (`TAWIDH_ACCOUNT`)
- Gharamah Account (`GHARAMAH_ACCOUNT`)

**Visible fields per account:**

- Bank name (`bankName`)
- Account name (`accountName`)
- Account number (`accountNumber`)

**Hidden but preserved on save:**

- `displayName` — not shown in UI; on save, existing values kept or defaulted to section title if empty
- `remarks` — not shown in UI; preserved if present in loaded config

**Not shown as separate visible account sections:**

- Service Fee, Platform Fee, Facility Fee (fee categories reuse Operating Account in PDF rows)
- Issuer Payable (`ISSUER_PAYABLE`) — internal liability bucket; config support preserved but not a main editable section

On save, Operating Account bank fields are also synced into hidden `platform_accounts_config` keys (`platformOperating`, `serviceFee`, `platformFee`, `facilityFee`) for backward compatibility with older config shape.

Save button: `Save Money Flow Accounts`

---

## 3. Trustee letter account concept

### Source (debit) vs destination (payee)

In every trustee instruction PDF:

- **Top block** (`Instruction of Payment` / Account No / Account Name) = **source account to debit**
- **Payment table rows** = **destination/payee accounts**

### Source account mapping

| Letter type | Source/debit account |
|-------------|----------------------|
| Issuer disbursement | Investor Pool |
| Investor withdrawal | Investor Pool |
| Repayment / settlement / service-fee trustee letter | Repayment Pool |

### Destination row mapping (high level)

| Letter type | Destination rows |
|-------------|------------------|
| Issuer disbursement | Issuer/borrower bank account; Platform Fee → Operating Account; Facility Fee → Operating Account |
| Investor withdrawal | Investor beneficiary bank account |
| Repayment/settlement | Investor Pool (principal+profit); Service Fee → Operating Account; Ta'widh → Ta'widh Account; Gharamah → Gharamah Account; issuer residual → issuer beneficiary bank (or ISSUER_PAYABLE fallback) |

**Important:** Same Operating Account bank details may appear on **multiple rows** with different remarks when fee amounts are separate. Account setup answers *which bank account*; rows answer *what the payment is for*.

Config loader: `loadTrusteeLetterConfig()` merges DB settings with mock defaults in `trustee-letter.mock-config.ts`.

---

## 4. Trustee letter types

PDF renderer: `trustee-letter-pdf.renderer.ts`  
Data mappers: `trustee-letter-data.mapper.ts`

### Issuer disbursement letter

**Purpose:** `Disbursement to Borrower and Platform`

**Withdrawal type:** `ISSUER_DISBURSEMENT`

**Source/debit:** Investor Pool (`ledgerBucketAccountsConfig.INVESTOR_POOL`)

**Destination rows** (from `mapDisbursementLetterData`):

1. **Disbursement to Borrower** — net amount to issuer beneficiary snapshot (`metadata.netIssuerDisbursement` or withdrawal amount)
2. **Platform Fee to Platform** — if `metadata.platformFeeAmount > 0` → Operating Account
3. **Facility Fee to Platform** — if `metadata.facilityFeeCharged > 0` → Operating Account

**Source metadata** (set at funding close in `service.ts` when creating disbursement withdrawal):

- `grossFundedAmount`
- `platformFeeAmount`
- `facilityFeeCharged`
- `facilityFeeRatePercent`, `facilityFeeCap`, `facilityFeePaidBefore`, `facilityFeeRemainingAfter`
- `netIssuerDisbursement`

**Constraints:**

- No Success Fee row or field
- Platform Fee and Facility Fee are separate rows when both amounts > 0
- Both fee rows use Operating Account destination details

**Shoraka guard:** For `ISSUER_DISBURSEMENT`, trustee letter generation may require Tawarruq certificate before letter generate (existing Shoraka STP integration — unchanged by this work).

### Repayment / settlement letter

**Purpose:** `Repayment to Investors and Platform`

**Generated from:** `generateServiceFeeTrusteeLetter(noteId, settlementId)` — produces combined repayment waterfall PDF when settlement is POSTED and has trustee-relevant amounts.

**Source/debit:** Repayment Pool

**Destination rows** (from `mapRepaymentLetterData`):

1. **Repayment to Investors / Deposit Account** — `investor_principal + investor_profit_net` → Investor Pool account details
2. **Service Fee to Platform** — `note_settlements.service_fee_amount` → Operating Account
3. **Ta'widh** — `note_settlements.tawidh_account_amount` → Ta'widh Account
4. **Gharamah** — `note_settlements.gharamah_amount` → Gharamah Account
5. **Issuer residual/refund** — `note_settlements.issuer_residual_amount` → issuer org `bank_account_details` via `buildBeneficiarySnapshot`, else ISSUER_PAYABLE bucket fallback

**Supporting paragraph payer priority:**

1. Paymaster name from note list item
2. Issuer name
3. Payment reference from linked `NotePayment`

**Future-ready:** `borrowerEntries` array in mapper supports multi-payer wording; runtime path is single entry today.

**Not included:**

- Repayment-side Platform Fee (no `platform_fee_amount` on `NoteSettlement`)
- Success Fee

### Investor withdrawal letter

**Purpose:** `Withdrawal by Investors`

**Withdrawal type:** `INVESTOR_WITHDRAWAL`

**Source/debit:** Investor Pool

**Destination:** Single row to investor beneficiary snapshot (account holder, bank name, account number)

Mapper: `mapInvestorWithdrawalLetterData`

---

## 5. Fee terminology

Current CashSouk fee terms used in trustee letter context:

| Term | When used in letters |
|------|---------------------|
| **Platform Fee** | Disbursement letter row; from `metadata.platformFeeAmount` |
| **Facility Fee** | Disbursement letter row; from `metadata.facilityFeeCharged` |
| **Service Fee** | Repayment/settlement letter row; from `service_fee_amount` |
| **Ta'widh** | Late-payment compensation; repayment letter row |
| **Gharamah** | Penalty/charity portion; repayment letter row |
| **Issuer Onboarding Fee** | Flows to Operating Account in money flow docs; not part of these trustee letter mappers unless future workflow adds rows |
| **Financing Processing Fee** | Same as above |

**Do not use:** Success Fee — no real field in codebase.

---

## 6. Investor withdrawal flow

### End-to-end

```txt
Investor submits withdrawal (Investor portal)
  → balance debited once (INVESTOR_WITHDRAWAL_REQUEST)
  → WithdrawalInstruction DRAFT created
Admin views list / opens detail
  → DRAFT: edit beneficiary, generate letter
  → LETTER_GENERATED: download, submit to trustee
  → SUBMITTED_TO_TRUSTEE: download, mark completed
  → COMPLETED: download only
```

### Investor-side

- **UI:** Investor Transactions page withdrawal modal
- **API:** `POST /v1/investor/balance/withdraw`
- **Auth:** `requireRole(INVESTOR)` — not admin RBAC
- **Validations:** org membership, bank details present, minimum amount, sufficient balance
- **Balance:** `debitInvestorBalanceForWithdrawal()` in `investor-balance.ts` — single deduction at request; idempotent via idempotency key
- **Creates:** `WithdrawalInstruction` with `withdrawal_type = INVESTOR_WITHDRAWAL`, `status = DRAFT`
- **Creates:** `InvestorBalanceTransaction` with source `INVESTOR_WITHDRAWAL_REQUEST`

### Admin-side

- **List:** `/finance/investor-withdrawals`
- **Detail:** `/finance/investor-withdrawals/[id]`
- List is overview only; all processing actions on detail page

### Status / action rules

| Status | Actions (requires `investor_withdrawals.manage`) |
|--------|--------------------------------------------------|
| DRAFT | Edit beneficiary, Generate letter |
| LETTER_GENERATED | Download letter, Submit to trustee |
| SUBMITTED_TO_TRUSTEE | Download letter, Mark completed |
| COMPLETED | Download letter |
| CANCELLED | No processing actions |

**No cancel/reversal/refund** implemented. Mistakes require a separately designed reversal flow (out of scope).

### Submit to trustee

Manual status update only. TODO in backend for future email integration with PDF attachment.

---

## 7. Admin Investor Withdrawals UI

### List page (`apps/admin/src/app/finance/investor-withdrawals/page.tsx`)

**Columns:**

- Reference (clickable link to detail)
- Investor
- Amount
- Bank / Account (masked account number)
- Requested
- Status
- Submitted (`submittedToTrusteeAt`, or `—`)
- Open (ghost button with external icon — matches Issuer Payouts style)

**Removed:** Letter icon column; row action dropdown (replaced by Open only)

**Summary cards:** counts by status + total amount

### Detail page (`apps/admin/src/app/finance/investor-withdrawals/[id]/page.tsx`)

**Sections:**

- Header: reference, status, amount, requested date, back link
- Withdrawal Summary
- Investor Details (org id, requested by user)
- Beneficiary / Bank Details (+ edit dialog when DRAFT + manage permission)
- Trustee Letter (state, download, generate/submit/complete actions)
- Processing Timeline (requested, letter generated, submitted, completed)

**View-only:** Users with `investor_withdrawals.view` only see detail; manage actions hidden/disabled with messaging.

### Hooks / API client

- `useInvestorWithdrawals()` — list
- `useAdminWithdrawal(id)` — detail via `getAdminWithdrawal(id)`
- `usePendingInvestorWithdrawals()` — badge count
- Mutations: `useGenerateWithdrawalLetter`, `useUpdateWithdrawalBeneficiary`, `useMarkWithdrawalSubmitted`, `useMarkWithdrawalCompleted`

---

## 8. Dashboard / sidebar

**Dashboard quick action:** Investor Withdrawals card with pending count (`quick-actions-section.tsx`)

**Sidebar:** Finance → Investor Withdrawals with badge (`app-sidebar.tsx`, `badgeKey: pendingInvestorWithdrawals`)

**Pending count definition** (`getPendingInvestorWithdrawalsCount`):

- Type: `INVESTOR_WITHDRAWAL`
- Status in: `DRAFT`, `LETTER_GENERATED`, `SUBMITTED_TO_TRUSTEE`
- Excludes: `COMPLETED`, `CANCELLED`

**Endpoint:** `GET /v1/admin/withdrawals/pending-investor-withdrawals`  
**Permission:** `investor_withdrawals.view`

---

## 9. RBAC

### Dedicated investor withdrawal permissions

```txt
investor_withdrawals.view
investor_withdrawals.manage
```

| Permission | Grants |
|------------|--------|
| `investor_withdrawals.view` | List/detail pages, pending count endpoint, sidebar badge, dashboard quick action |
| `investor_withdrawals.manage` | Generate letter, edit beneficiary, submit to trustee, mark completed |

**Group:** Finance (in `packages/types/src/rbac.ts`)

**Backfill** (`apps/api/src/lib/auth/rbac.ts` `backfillInvestorWithdrawalPermissions`):

- Roles with `disbursements.view` → add `investor_withdrawals.view`
- Roles with `notes.disbursement.manage` → add `investor_withdrawals.manage`
- `SUPER_ADMIN` gets all permissions via template

### Generic withdrawal action routes

Routes like `POST /:id/generate-letter`, `PATCH /:id/beneficiary`, etc. are shared with issuer disbursement. Backend uses `assertWithdrawalManagePermission()`:

- `INVESTOR_WITHDRAWAL` → requires `investor_withdrawals.manage`
- Other types (e.g. `ISSUER_DISBURSEMENT`) → requires `notes.disbursement.manage`

### Platform Finance Settings

- View: `platform_settings.view`
- Manage: `platform_settings.manage`

### Portals

- **Investor portal:** `requireRole(INVESTOR)` for withdrawal request — not admin RBAC
- **Issuer portal:** issuer role logic — not admin RBAC for these admin finance pages

---

## 10. Backend / API context

### Admin withdrawal routes (`withdrawalsRouter` in `controller.ts`)

| Method | Path | Permission (investor-specific) |
|--------|------|--------------------------------|
| GET | `/v1/admin/withdrawals` | `investor_withdrawals.view` (lists INVESTOR_WITHDRAWAL only) |
| GET | `/v1/admin/withdrawals/:id` | `investor_withdrawals.view` (404 if not INVESTOR_WITHDRAWAL) |
| GET | `/v1/admin/withdrawals/pending-investor-withdrawals` | `investor_withdrawals.view` |
| POST | `/v1/admin/withdrawals/:id/generate-letter` | branched by withdrawal type |
| PATCH | `/v1/admin/withdrawals/:id/beneficiary` | branched |
| POST | `/v1/admin/withdrawals/:id/mark-submitted-to-trustee` | branched |
| POST | `/v1/admin/withdrawals/:id/mark-completed` | branched |

Issuer payout list still uses `GET /v1/admin/withdrawals/pending-issuer-payouts` with `disbursements.view`.

### Investor withdrawal

- `POST /v1/investor/balance/withdraw` — `requireRole(INVESTOR)`

### Platform Finance Settings

- Existing admin notes router endpoints for get/update platform finance settings (used by settings page)

### Key files

| Area | Path |
|------|------|
| Business logic | `apps/api/src/modules/notes/service.ts` |
| Routes | `apps/api/src/modules/notes/controller.ts` |
| Investor balance | `apps/api/src/modules/notes/investor-balance.ts` |
| Letter mappers | `apps/api/src/modules/notes/trustee-letters/trustee-letter-data.mapper.ts` |
| PDF renderer | `apps/api/src/modules/notes/trustee-letters/trustee-letter-pdf.renderer.ts` |
| Config loader | `apps/api/src/modules/notes/trustee-letters/trustee-letter-config.loader.ts` |
| Mock defaults | `apps/api/src/modules/notes/trustee-letters/trustee-letter.mock-config.ts` |
| Admin settings UI | `apps/admin/src/app/settings/platform-finance/page.tsx` |
| Admin list UI | `apps/admin/src/app/finance/investor-withdrawals/page.tsx` |
| Admin detail UI | `apps/admin/src/app/finance/investor-withdrawals/[id]/page.tsx` |
| API client | `packages/config/src/api-client.ts` |
| Shared types | `packages/types/src/notes.ts`, `packages/types/src/rbac.ts` |
| Admin hooks | `apps/admin/src/notes/hooks/use-notes.ts` |

---

## 11. Schema / config context

### WithdrawalInstruction

Key fields: `withdrawal_type`, `status`, `amount`, `beneficiary_snapshot`, `letter_s3_key`, `generated_at`, `submitted_to_trustee_at`, `completed_at`, `investor_organization_id`, `metadata`

**WithdrawalType values used:**

- `INVESTOR_WITHDRAWAL`
- `ISSUER_DISBURSEMENT` (and others for issuer flows)

**WithdrawalStatus lifecycle:**

```txt
DRAFT → LETTER_GENERATED → SUBMITTED_TO_TRUSTEE → COMPLETED
(CANCELLED exists but no admin cancel action in this feature)
```

### Investor balance

- `InvestorBalanceTransactionSource.INVESTOR_WITHDRAWAL_REQUEST` — created on investor withdrawal request

### PlatformFinanceSetting JSON columns

| Prisma snake_case | API camelCase | Purpose |
|-------------------|---------------|---------|
| `trustee_letter_config` | `trusteeLetterConfig` | Header/default letter fields |
| `platform_accounts_config` | `platformAccountsConfig` | Legacy/hidden fee account mirrors |
| `ledger_bucket_accounts_config` | `ledgerBucketAccountsConfig` | Money flow bucket bank details |

Scalar letter template columns (`withdrawal_letter_template`, etc.) remain in schema but Letter Templates UI removed; not used by current PDF mappers.

### Naming convention

- Prisma schema: snake_case column names
- API/types: camelCase in responses; manual mapping in `getPlatformFinanceSettings` / `updatePlatformFinanceSettings`

### Save compatibility rules

- Partial PATCH per tab
- Hidden fields (`displayName`, `remarks`, `platformFeeRateCapPercent`, legacy platform account keys) must not be wiped when saving visible tabs
- Money Flow save normalizes `displayName` and syncs Operating Account into hidden platform account config

---

## 12. Important non-goals / constraints

- **Submit to trustee:** Manual status tracking only; no email sending in this implementation
- **No cancellation/reversal/refund** for investor withdrawals
- **No Success Fee** terminology or invented amount fields
- **No separate visible** Platform Fee / Facility Fee / Service Fee account config sections in settings UI
- **No batch settlement** workflow or multi-settlement trustee letter batching
- **Do not invent** settlement amount fields (only use existing `NoteSettlement` columns and disbursement metadata)
- **Shoraka guard** for issuer disbursement certificate unchanged
- **Investor withdrawal balance:** deducted once at request; admin completion does not deduct again
- **Letter Templates tab:** removed from UI; DB fields preserved
- **Help article** for operators: `packages/help-content/markdown/admin-platform-finance-and-withdrawals.md`

---

## Related docs

- `docs/ai-context/shoraka-stp-integration-context.md` — Shoraka certificate before issuer disbursement completion
- `packages/help-content/markdown/admin-trustee-instruction-letters.md` — older note-centric trustee letter help (note detail panel flows)
- `packages/help-content/markdown/admin-note-money-flow.md` — broader note money flow guide
- `packages/help-content/markdown/admin-platform-finance-and-withdrawals.md` — operator guide for settings + investor withdrawals
