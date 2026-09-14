# Offer acceptance & signing phases

Standard post-offer flow for **contract** and **invoice-only** offers (same product signing package). Contract-linked invoices stay on direct Accept/Decline after the contract envelope completes (unchanged).

Admin review uses a single **Offer & acceptance** staged tab. The issuer responds on the application-detail **Offer** tab (horizontal stepper). Field and action inventory: [offer-acceptance-tab-inventory.md](./offer-acceptance-tab-inventory.md).

Invoice-only applications allow **at most one invoice** (enforced on create). Legacy multi-invoice rows keep **application-wide** acceptance uploads; admin review and phase sync use each invoice’s own `authorized_parties` so approving invoice B cannot move invoice A to `APPROVED_FOR_SIGNING`. Contract-linked invoices can decline while facility signing still blocks Accept.

## Phase clocks

Configurable on the financing-type step (product builder):

| Clock | Config key | UI tab | Starts when | Default |
|-------|------------|--------|-------------|---------|
| **Acceptance** | `acceptance_deadline` | Acceptance (product builder) | Admin Send Offer; **restamped** on admin `CHANGES_REQUESTED` | 7 days |
| **Signing** | `signing_deadline` | Signing packages | Admin sends signing links → `SIGNING_IN_PROGRESS` | 14 days |

Each deadline has `days` plus optional `reminders: [{ days_before_expiry }]`. Configured **days** are **Malaysia calendar days** (`Asia/Kuala_Lumpur`): an offer sent on 30 Jul with `days: 7` is valid through **6 Aug 11:59 PM** and rejected from **7 Aug 00:00 MYT** onward. The stored `*_expires_at` is the exclusive UTC boundary (`2026-08-07T00:00:00+08:00` → ISO UTC). All gates and the hourly job use **`now >= expiresAt`**. Weekends and holidays count as calendar days.

Runtime stamps:

- `offer_acceptance.acceptance_expires_at` on Send Offer
- Acceptance clock is **active** only for `PENDING_ISSUER` and `CHANGES_REQUESTED` — it **pauses** during `PENDING_ADMIN_REVIEW` (issuer already submitted; CashSouk is reviewing)
- On admin amendment → `CHANGES_REQUESTED`: restamp `acceptance_expires_at` (fresh product window) and clear prior `acceptance:*` reminder keys
- `offer_acceptance.signing_expires_at` when admin **sends signing links** (`SIGNING_IN_PROGRESS`)
- Envelope `expires_at` aligned to `signing_expires_at` when links are sent
- After signing clock passes: admin can **Extend signing deadline** on Offer & acceptance → Signing package (restamps `signing_expires_at`, clears `signing:*` reminders, restores `OFFER_SENT` if durable-expired). Full **Send Offer** on Facility/Invoice remains the commercial reset path.

**Expiry** (API gates + hourly job; boundary `now >= expiresAt`):

- While still `OFFER_SENT` and the **active** clock is past, mutations return `400 OFFER_EXPIRED` and issuer UI shows **Offer Expired** (read-only).
- The hourly job then sets contract/invoice → **`OFFER_EXPIRED`**, keeps full `offer_details`, review → `OFFER_EXPIRED`, application → **`OFFER_EXPIRED`**. Admin can **Send Offer** directly from that status (overwrites terms + new acceptance clock → entity `OFFER_SENT`, application `CONTRACT_SENT` / `INVOICES_SENT`).
- Not terminal `WITHDRAWN`. Reminders and expiry notify via `offer_expiry_reminder_24h` / `offer_expired`. Timeline: `CONTRACT_OFFER_EXPIRED` / `INVOICE_OFFER_EXPIRED`.

**Reminder delivery:** One platform-wide hour (default **09:00** MYT) on **Settings → Platform Finance → Offer Deadlines**. Reminder offsets are relative to the displayed deadline date (`1` = preceding calendar day at that hour; `0` = deadline date at that hour). Signing-link TTL, regeneration, and recipient-token rules are unchanged.

Manual test: `pnpm seed-expired-acceptance-deadline-for-test` then `pnpm run-acceptance-signing-expiry`. Reminder window: `pnpm seed-reminder-window-acceptance-deadline-for-test`.

## Phases

| Phase | Actor | UI | Outcome |
|-------|--------|-----|---------|
| **Step 1 — Accept offer** | Issuer | Application-detail **Offer** tab (horizontal stepper) | Two screens, one submit: **Representatives** (issuer directors and individual guarantors show name, email, and IC from records, read-only; corporate guarantor representatives enter name, email, and 12-digit IC), then **Documents** (product acceptance files, e.g. Board Resolution). **Submit** writes `acceptance_documents` and `offer_acceptance.authorized_parties`, then advances the phase. |
| **Step 2 — Review acceptance** | Admin | **Offer & acceptance** → Acceptance documents (parties also on Issuer response after submit) | Approve / request changes on files **and** representative lists, or reject (withdraw). No SigningCloud yet. |
| **Step 3 — Execution pack** | Admin then issuer | Admin **Offer & acceptance** → Signing package; issuer Offer tab **Signing** step | Admin sends signing links to the approved authorised representatives. Issuer tracks progress. No upload or configure-signers step. |

Envelope create/send is an **admin** action, blocked until acceptance docs **and** authorised representative lists are **admin-approved**. Bindings are taken from the approved snapshot’s **will-sign** people (authorised-but-not-signing stay on the snapshot for admin). The issuer does not declare signers again.

## Application status overlay (phased products)

`application.status` mirrors offer phase for admin filters. Entity contract/invoice stays `OFFER_SENT` until envelope completes.

| `offer_acceptance.status` | Contract path | Invoice-only |
|---------------------------|---------------|--------------|
| `PENDING_ISSUER` | `CONTRACT_SENT` | `INVOICES_SENT` |
| `PENDING_ADMIN_REVIEW` / `CHANGES_REQUESTED` | `CONTRACT_ACCEPTED` | `INVOICE_ACCEPTED` |
| `APPROVED_FOR_SIGNING` / `SIGNING_IN_PROGRESS` | `SIGNING_PENDING` | `SIGNING_PENDING` |
| `COMPLETED` + entity `APPROVED` | no invoices → `COMPLETED`; with invoices → `UNDER_REVIEW` → invoice stages | `COMPLETED` |

Helper: `apps/api/src/modules/applications/offer-application-status.ts`. Backfill: `pnpm --filter api backfill-offer-application-statuses -- --dry-run`.

## Status (Option A)

Contract/invoice stay `OFFER_SENT` until the envelope completes (→ `APPROVED`), the offer is declined/withdrawn, or the phase clock expires (→ `OFFER_EXPIRED`). Phase lives on `offer_details.offer_acceptance`:

```ts
type OfferAcceptanceStatus =
  | "PENDING_ISSUER"           // offer sent; Step 1 not submitted
  | "PENDING_ADMIN_REVIEW"     // acceptance uploads submitted
  | "CHANGES_REQUESTED"        // admin amendment on acceptance docs or representative lists
  | "REJECTED"                 // admin rejected acceptance → offer withdrawn as OFFER_REJECTED
  | "APPROVED_FOR_SIGNING"     // admin can send signing links
  | "SIGNING_IN_PROGRESS"      // envelope SENT | IN_PROGRESS
  | "COMPLETED";               // envelope COMPLETED (mirrors offer APPROVED)

type OfferAcceptanceDetails = {
  status: OfferAcceptanceStatus;
  /** Frozen commercial terms at Step 1 submit (audit). */
  acknowledged_terms?: OfferAcknowledgedTermsSnapshot;
  /** Authorised representatives declared at Step 1 (JSON; see packages/types/src/authorized-parties.ts). */
  authorized_parties?: {
    submitted_by_user_id: string;
    submitted_at: string;
    parties: Array<
      | {
          key: "issuer";
          entity_kind: "ISSUER";
          representatives: Array<{
            name: string;
            email: string;
            ic_number: string;
            capacity: "director";
            person_match_key: string;
          }>;
        }
      | {
          key: string;
          entity_kind: "CORPORATE_GUARANTOR";
          application_guarantor_id: string;
          client_guarantor_id?: string;
          representatives: Array<{
            name: string;
            email: string;
            ic_number: string;
            capacity: "director" | "authorised_signatory";
          }>;
        }
      | {
          key: string;
          entity_kind: "INDIVIDUAL_GUARANTOR";
          application_guarantor_id: string;
          client_guarantor_id?: string;
          representatives: Array<{
            name: string;
            email: string;
            ic_number: string;
            capacity: "authorised_signatory";
          }>;
        }
    >;
  };
  submitted_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by_user_id?: string | null;
  acceptance_expires_at?: string | null;
  signing_expires_at?: string | null;
  deadline_reminders_sent?: Record<string, string>;
};
```

Defaults when admin sends offer: `offer_acceptance.status = "PENDING_ISSUER"` and `acceptance_expires_at` from product `acceptance_deadline`.

### Reject / changes (locked)

- **Request change (acceptance docs or representative lists)** — immediate per-item action on **pending or approved** Acceptance rows (docs and `authorized_representatives:*` lists for issuer directors and corporate guarantors; not the underwriting amendment buffer). Individual guarantor rows keep Request change visible but disabled — identity is amended on **Business & Guarantor Details**. Sets item `AMENDMENT_REQUESTED`, phase `CHANGES_REQUESTED`, required remark, restamps `acceptance_expires_at`. In-app notify once when first entering `CHANGES_REQUESTED` (`acceptance_document_changes_requested`; email seed default off). Does **not** set `application.status` to `AMENDMENT_REQUESTED` or grow the underwriting amendment queue. Missing party ids fail closed. Drawdown (inherited) acceptance cannot be amended.
- **Issuer Step 1 while `CHANGES_REQUESTED`:** only flagged document slots and flagged representative lists are editable (API 403 otherwise). The Offer tab lands on **Representatives** if any list is flagged, or **Documents** if only files are flagged. Banner states remaining work across **both** docs and lists on each Step 1 screen. Highlights flagged entity cards or files, and **View Remarks** beside Replace file on flagged documents. A people-only request can **Submit** from the representatives screen without waiting for the hidden upload step to hydrate.
- **Resubmit from `CHANGES_REQUESTED`:** only `AMENDMENT_REQUESTED` acceptance items (docs and party lists) reset to `PENDING` (remarks cleared); previously **APPROVED** items stay approved. First submit from `PENDING_ISSUER` still initializes all uploaded acceptance keys and snapshot party keys to `PENDING`.
- **Reject (admin)** — withdraw offer (`WITHDRAWN` + `OFFER_REJECTED`); set `offer_acceptance.status = "REJECTED"`. No silent “try again” without a new offer.
- **Decline (issuer)** — existing reject offer path; phase ends.

## Acceptance documents (product config)

Configured on the financing-type step **Acceptance** tab in product builder (`acceptance_documents` flat list). Each row: name, required, allow_multiple, allowed_types, optional template (PDF, Word, or Excel).

**Re-send policy:** Once `offer_acceptance` is past `PENDING_ISSUER`, or `submitted_at` exists, admin cannot re-send over the same offer — retract first, then send revised terms. Step 1 submit also freezes `acknowledged_terms` (facility/amount, rates, expiry, offer/product version) under `offer_acceptance` for audit.

**Acceptance documents (issuer):** Leaving Documents (including **Back to applications**) does **not** write `Application.acceptance_documents`. Pending uploads prompt **Unsaved changes** (Discard / Stay); Discard drops the local draft. Submit flushes uploads then calls `POST .../acceptance`. Admin Acceptance documents list requires `submitted_at` or a post-submit phase (`isOfferAcceptanceDocumentsVisibleToAdmin`) — draft uploads while `PENDING_ISSUER` stay hidden.

Stale `offer_acknowledgements` keys on saved products are stripped on product save and ignored at runtime.

**While `PENDING_ADMIN_REVIEW` | `APPROVED_FOR_SIGNING` | `SIGNING_IN_PROGRESS`:** the Offer tab in-page panel shows waiting (CashSouk review) or signing tracking as appropriate. The issuer **Review offer** CTA is hidden while waiting on admin (`PENDING_ADMIN_REVIEW` and `APPROVED_FOR_SIGNING`); it stays available for Step 1 (`PENDING_ISSUER` / `CHANGES_REQUESTED`) and for tracking (`SIGNING_IN_PROGRESS`). When phase is `CHANGES_REQUESTED`, the card/row CTA label switches to **Update requested changes** (same Offer tab; `makeAmendments` button variant + hint “CashSouk requested changes to your acceptance documents or authorised representatives.”). The applications card badge is **Offer Received** (issuer-action amber) for Step 1 (`PENDING_ISSUER`, `CHANGES_REQUESTED`) and while tracking signing (`SIGNING_IN_PROGRESS`); **Under Review** (admin-action blue) while waiting on CashSouk (`PENDING_ADMIN_REVIEW`, `APPROVED_FOR_SIGNING`). Acceptance clock is paused during admin review (no “Accept by” on the card). Resetting the Acceptance **section** resets document **and** representative-list items to pending (Send Offer does the same so leftover `APPROVED` people rows cannot unlock signing). Resetting from Approved rolls `offer_acceptance` back to `PENDING_ADMIN_REVIEW`. Clearing all acceptance-doc **and** representative-list change requests (Set to Pending so no item stays `AMENDMENT_REQUESTED`) also rolls `CHANGES_REQUESTED` → `PENDING_ADMIN_REVIEW`. Admin Acceptance visibility and phase sync both use the application’s **frozen** `product_version`. Acceptance phase badges use the shared four-group taxonomy in [`status-badges.md`](../status-badges.md) (admin-action blue for review/signing phases; issuer-action amber for `CHANGES_REQUESTED`). The Acceptance section badge is derived from **document and party** item rows (a people-only change request marks the section as amendment).

**Refresh policy:** Detail views poll ~15s; application lists ~60s (focus refetch). Signing envelopes poll only while `SENT` | `IN_PROGRESS`.

**While `APPROVED_FOR_SIGNING` | `SIGNING_IN_PROGRESS`:**

- **Document signing** → **Complete**. No configure-signers step.
- **No** “Upload documents” step.
- Admin sends links from Offer & acceptance → Signing package once docs and representative lists are approved. Voiding the envelope resends to the **same** people; it does not reopen Step 1 or clear the snapshot. Company guarantor signer names come from the named people, never the company `business_name`.

**Contract-linked invoices:** unchanged `accept_decline` mode after contract envelope `COMPLETED` — in-page Confirm & accept on the Offer tab; OTP stays a dialog.

## Admin

Live review collapses Facility / Invoice / Acceptance into one **Offer & acceptance** tab. Comparison modal keeps the uncollapsed Facility / Customer / Invoice / Acceptance tabs. Per-field and action inventory: [offer-acceptance-tab-inventory.md](./offer-acceptance-tab-inventory.md).

**Stages by structure** (reference cards are not numbered workflow stages):

- **new_contract:** Facility review → Send offer → Issuer response → Acceptance documents → Signing package
- **invoice_only:** Customer review → Invoice review → Send offer → Issuer response → Acceptance documents → Signing package
- **existing_contract:** Facility reference (collapsed) → Invoice review → Send offer → Issuer response → Inherited acceptance (collapsed). No live acceptance or signing stages.
- Signing-only products (no acceptance-documents section): omit Acceptance documents and Signing package; stop at Issuer response.
- **Merged notes** at the foot of the tab keep every existing comment thread.

Backend sections (`contract_details`, `invoice_details`, `acceptance_documents`) and their permissions / locks are unchanged. Send Offer still writes those commercial sections (not a new API).

Content that used to sit on the Acceptance tab is now these stages:

1. **Issuer response** — financing-offer status + acceptance deadline; authorised representatives from `authorized_parties` after `submitted_at` (issuer, then each guarantor; same visibility as documents). Everyone named must sign; admin checks the Board Resolution that those people (and their IC numbers) are listed there. Each list has the same item actions as a document row (approve / request change + remark / reset to pending). Item **reject** is hidden; offer-level reject stays withdraw.
2. **Acceptance documents** — when active (`PENDING_ADMIN_REVIEW`+ or uploads exist); Download all beside the documents heading
3. **Signing package** — send links (when `APPROVED_FOR_SIGNING`) / remind / void / history; signed PDF **View / Download** inline on each package document row when `signed_s3_key` is set (including the Facility Agreement or legacy offer letter when keyed). Template docs (Facility Agreement, JSG, Deed of Assignment) generate from the contract offer or, for invoice-only, the invoice offer.

- Actions on acceptance docs **and** representative lists drive `CHANGES_REQUESTED` / `APPROVED_FOR_SIGNING` / reject-withdraw. `APPROVED_FOR_SIGNING` requires every acceptance doc key **and** every party item key `APPROVED`.
- Guarantor identity: review item ids use stable `client_guarantor_id`. Step 1 submit rewrites snapshot `application_guarantor_id` to the live Prisma row id. Signing accepts either id and stores the live Prisma id. Matching never pairs leftover parties by kind/order.
- Signing package create/send is an admin action on Offer & acceptance → Signing package (`POST /v1/admin/signing/applications/:id/envelopes/send`). Bindings are built from the approved `authorized_parties` snapshot. The send button shows at `APPROVED_FOR_SIGNING` when there is no draft, sent, in-progress, or completed envelope. A leftover **draft** keeps Send on that card. Voided (or expired/declined) packages unlock send again. If send fails before the package is live, the leftover draft is voided automatically.
- Tab visibility: show the unified tab when any merged section would have shown. Acceptance documents / Signing package stages appear when `workflowShowsAcceptanceReviewSection` (product has `acceptance_documents` **or** a signing package with documents). Signing-only products skip the documents block and show the signing hub only.
- Issuer with no acceptance documents still uses the same authorised-representatives submit when that flow applies; there is no issuer configure-signers path.
- **Structure-aware order** (`getReviewSectionOrder` then collapse): Contract / Invoice / Acceptance sections merge into **Offer & acceptance** at the first original position (`… → Offer & acceptance` on both contract and invoice-only paths).
- **Acceptance unlock prerequisites** (`getAcceptanceDocumentsPrerequisites` + `isPrerequisiteSectionSatisfied`):
  - Contract: underwriting approved + Contract `OFFER_SENT` or `APPROVED` (Send Offer unlocks Acceptance documents / Signing package; admin Approves facility details first, which is a separate review `APPROVED`)
  - Invoice-only: underwriting + Customer approved + Invoice `OFFER_SENT` or `APPROVED` (admin Approves invoice details before Send offer)
- **Post-send handoff:** after successful Send Offer on Facility, or on Invoice for invoice-only, toast + stay on Offer & acceptance and expand **Acceptance documents** (or **Issuer response** if that stage is absent). Contract-linked invoice send does **not** jump.
- On envelope / primary-offer accept: Contract (or Invoice) review → `APPROVED`; Acceptance review section → `APPROVED` (including signing-only products with no acceptance documents).
- Acceptance stays **visible-only** (not required for final application approval). Send Offer remains the Facility / Invoice commercial action on this tab.

## Gates

| Action | Requires |
|--------|----------|
| Submit Step 1 | Required acceptance files present **and** at least one issuer director in `authorized_parties` (plus one party per guarantor). Corporate guarantor representatives need a 12-digit IC. Everyone declared must sign. Unflagged lists/docs are immutable on resubmit from `CHANGES_REQUESTED`. |
| Create / send envelope | Admin. `offer_acceptance.status` ∈ `APPROVED_FOR_SIGNING` (create) or `APPROVED_FOR_SIGNING` \| `SIGNING_IN_PROGRESS` (send leftover draft) **and** acceptance review keys **and** authorised-representative keys approved. Bindings are the approved snapshot (`400 SIGNING_BINDINGS_INVALID` / `OFFER_ACCEPTANCE_PARTIES_MISSING` if empty). Unapproved people → `400 OFFER_ACCEPTANCE_PARTIES_NOT_APPROVED`. |
| Auto-accept on envelope COMPLETED | Existing behaviour; set `offer_acceptance.status = COMPLETED`; Contract + Acceptance review sections → `APPROVED` |

Presence-only gate for send is **replaced** by admin-approved when acceptance documents are configured. Admin sends the package; the issuer does not configure signers.

## Slices

1. **Done — Config + types + Step 1 UI + submit API** — `acceptance_documents`, `offer_acceptance` on `offer_details`, issuer Step 1 (authorised representatives then uploads), remove upload from Step 3 when acceptance phase applies.
2. **Done — Admin gate** — block create/send until approved; wire review outcomes to `offer_acceptance.status`; admin panel copy.
3. **Done — Admin review linearity (Slice A)** — structure-aware tab order + Acceptance prerequisites + tab visibility via `workflowShowsAcceptanceReviewSection`.
4. **Done — Acceptance hub (Slice B)** — Signing package + offer-acceptance summary as stages on **Offer & acceptance** (status → docs → signing); no page-level signing panel.
5. **Done — Signed downloads + post-send handoff (Slice C)** — inline View/Download on Signing package document rows when `signed_s3_key` is set; after Send Offer (Facility / invoice-only), toast + expand Acceptance documents on Offer & acceptance.
6. **Done — Phase clocks** — Acceptance + signing deadlines (product config, stamps, API gates, hourly job with reminders, durable `OFFER_EXPIRED` + resend). Still deferred: HTML merge templates.
