# Origination locks — test guide

Most of this polish is “this action is blocked / children close together.” Do not originate every file from draft.

**Origination phases** (computed, not stored): `underReview`, `amendment`, `offerLive`, `signing`, `approved`, `closed`, `expired`. Withdraw/reject/archive/reset guards use these — e.g. `approved` means a facility or invoice is `APPROVED` (or signing completed).

**A and F are not seeded.** Skip them unless you need a full happy-path regression. One live `new_contract` file is enough for A.

## 1. Automated (about one minute)

```bash
pnpm --filter @cashsouk/api test -- \
  origination-phase \
  lifecycle-close \
  lifecycle.test \
  acceptance-document-review-sync
```

This proves the phase matrix and the reject JSON helpers. It does not click the UI or write the database cascade.

## 2. Seed fixtures

Needs local API database. Defaults to the Toyota issuer org (`khai.kit@truestack.my`). Re-run replaces the same rows — do that after any withdraw / reject / archive.

```bash
pnpm --filter @cashsouk/api seed-origination-lock-fixtures
```

Optional args: `issuerOrgId`, facility product id, invoice-only product id.

```bash
pnpm --filter @cashsouk/api seed-origination-lock-fixtures \
  <issuerOrgId> <facilityProductId> <invoiceOnlyProductId>
```

The script prints one row per fixture (`B1`, `B2`, …). Titles in the portals start with `[LOCK B3]` so you can find them.

Log in as the **same issuer org the script printed**. If that is not the account you use, pass `issuerOrgId` as the first argument.

- Issuer: `/applications/{id}` (drafts: `/applications/{id}/edit`)
- Admin: `/applications/{productId}/{id}`

Use two browser profiles. Log in as the issuer who owns that org, and as admin.

## 3. What to click (seeded cases)

Do **read-only / disable checks first**, then the cases that consume the file. Re-seed if you burn a fixture you still need.

### Withdraw (B)

| Fixture | Portal | Do this | Expect |
|---|---|---|---|
| **B1** | Issuer detail | Look at actions. Then delete the draft. | **Withdraw is not shown.** Delete draft succeeds. |
| **B2** | Issuer detail | Withdraw. Then check admin queue. | App + non-final children `WITHDRAWN`. File leaves the admin queue. |
| **B3** | Issuer detail | Withdraw. | App `WITHDRAWN`. Facility `WITHDRAWN` / `OFFER_REJECTED`. |
| **B4** | Issuer detail | Withdraw. Admin → Signing package. | Withdraw allowed. Envelope **VOIDED**. Issuer cannot keep signing. |
| **B5** | Issuer detail | Confirm application Withdraw is disabled. Withdraw **one invoice** (ids printed by the seed). | Application Withdraw disabled (API 400 if forced). Per-invoice withdraw works. App stays **not** `WITHDRAWN`. |
| **B6** | Issuer detail | Try Withdraw. | Disabled / API 400. |
| **B7** | Issuer detail | Withdraw **one** of the offer-sent invoices. | App stays open (`INVOICES_SENT` / invoice-pending). |
| **B8** | Issuer detail | Withdraw the remaining live invoice (the other is already withdrawn). | App becomes `WITHDRAWN`. |

### Pending / retract / reopen (C)

| Fixture | Portal | Do this | Expect |
|---|---|---|---|
| **C1** | Admin | Financial is already approved. Reset financial to pending. | Reset works. Tab can lock again if it is a prerequisite. |
| **B3** (before you withdraw it) | Admin | Contract section → reset to pending (retract). | Offer disappears; not a silent review undo. Issuer loses Offer Received. |
| **C3** | Admin | Acceptance docs → set to pending / approve. Check facility status. | Contract stays `WITHDRAWN` + `OFFER_REJECTED`. Must **not** return to `OFFER_SENT`. |
| **C4** | Admin | Acceptance tab → request document changes. | Issuer phase `CHANGES_REQUESTED`. Envelope is still `DRAFT`, so this is allowed. |
| **B4** (before you withdraw it) | Admin | Acceptance amend or reset while envelope is `SENT`. | Blocked until the package is voided. |
| **C6** | Both | Try reset, application Reject, application Withdraw. | All blocked (`approved` / envelope `COMPLETED`). |

### Reject (D)

| Fixture | Portal | Do this | Expect |
|---|---|---|---|
| **D1** | Admin | Already has financial rejected. Do **not** click application Reject yet. Check facility entity. | App still `UNDER_REVIEW`. **Reject is enabled.** Contract still `SUBMITTED` (section reject must not kill the facility). |
| **D2** | Admin | Confirm application Reject. | App `REJECTED`; contract and invoices `REJECTED`; issuer notified; cannot submit / edit / withdraw. |
| **B3** or re-seed then **B3** | Admin | Reject the application (need a rejected section first — reject financial, then Reject). | Offer gone; `offer_acceptance` `REJECTED`; envelopes voided; app `REJECTED`. |
| **B4** or re-seed | Admin | Same application Reject during signing. | Cascade plus signing package `VOIDED`. |
| **D5** | Admin | Look at Reject. Financial is already rejected, so the old two-step rule is satisfied. | Button **disabled**: “Cannot reject after a facility or invoice has been approved.” API 400 if forced. |
| **D6** | Admin | Look at Reject. | Stays disabled (all sections approved, none rejected). |

### Archive, expiry, labels (E)

| Fixture | Portal | Do this | Expect |
|---|---|---|---|
| **E1** | Issuer **edit** (`/applications/{id}/edit`) | Product-updated modal → Restart / archive. | Archive works; you can start again. |
| **B2** (if still submitted) | Issuer | There is no Archive button on in-flight files. From the issuer session: `POST /v1/applications/{id}/archive`. | **400** — only draft or closed files archive. Same for an offer-sent file (**B3**). |
| **E3R** | Issuer list, then archive via `POST /v1/applications/{id}/archive` | Archive a completed or rejected file. | **200.** `archived_at` is set; terminal `status` is preserved. File disappears from the issuer list. |
| **E4** | Admin | Send Offer again. Issuer: Withdraw still available. Admin: Reject still available (reject a section first). | Status `OFFER_EXPIRED` is not hard-final. Resend works; withdraw / reject still allowed. |
| **E5** | Both | Look at the status badge. Try creating a Note. | Copy: **“Facility approved.”** Note create stays blocked (no approved invoice). |

Issuer archive of closed files is API-only today (the UI archive path is the draft version-mismatch restart). E2/E3 are still worth hitting once with the issuer session cookie.

## 4. Not seeded — skip or one live file

**A. Happy path** (unchanged on purpose): draft → pay fee → submit → approve sections → send offer → retract while `PENDING_ISSUER` → accept docs → sign → invoice offers → Note from an approved invoice.

**F. Regression smoke:** amendment resubmit, unpaid fee gate, director/shareholder AML, investor portal has no applications.

## Pass

Every seeded row matches Expect. Re-seed is allowed; the IDs are stable for a given case key.
