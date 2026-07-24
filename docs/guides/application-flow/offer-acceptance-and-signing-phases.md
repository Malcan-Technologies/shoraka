# Offer acceptance & signing phases

Standard post-offer flow for **contract** and **invoice-only** offers (same product signing package). Contract-linked invoices stay on direct Accept/Decline after the contract envelope completes (unchanged).

Invoice-only applications allow **at most one invoice** (enforced on create).

## Phase clocks

Configurable on the financing-type step (product builder):

| Clock | Config key | UI tab | Starts when | Default |
|-------|------------|--------|-------------|---------|
| **Acceptance** | `acceptance_deadline` | Acknowledgements | Admin Send Offer; **restamped** on admin `CHANGES_REQUESTED` | 7 days |
| **Signing** | `signing_deadline` | Signing packages | Admin BR approve → `APPROVED_FOR_SIGNING` | 14 days |

Each deadline has `days` plus optional `reminders: [{ days_before_expiry }]`. Runtime stamps:

- `offer_acceptance.acceptance_expires_at` on Send Offer
- Acceptance clock is **active** only for `PENDING_ISSUER` and `CHANGES_REQUESTED` — it **pauses** during `PENDING_ADMIN_REVIEW` (issuer already submitted; CashSouk is reviewing)
- On admin amendment → `CHANGES_REQUESTED`: restamp `acceptance_expires_at` (fresh product window) and clear prior `acceptance:*` reminder keys
- `offer_acceptance.signing_expires_at` when entering `APPROVED_FOR_SIGNING`
- Envelope `expires_at` aligned to `signing_expires_at` on package create
- After signing clock passes: admin can **Extend signing deadline** on Acceptance → Signing package (restamps `signing_expires_at`, clears `signing:*` reminders, restores `OFFER_SENT` if durable-expired). Full **Send Offer** on Contract/Invoice remains the commercial reset path.

**Expiry** (exact-time API gates + hourly job):

- While still `OFFER_SENT` and the **active** clock is past, mutations return `400 OFFER_EXPIRED` and issuer UI shows **Offer Expired** (read-only).
- The hourly job then sets contract/invoice → **`OFFER_EXPIRED`**, keeps full `offer_details`, review → `OFFER_EXPIRED`, application → **`OFFER_EXPIRED`**. Admin can **Send Offer** directly from that status (overwrites terms + new acceptance clock → entity `OFFER_SENT`, application `CONTRACT_SENT` / `INVOICES_SENT`).
- Not terminal `WITHDRAWN`. Reminders and expiry notify via `offer_expiry_reminder_24h` / `offer_expired`. Timeline: `CONTRACT_OFFER_EXPIRED` / `INVOICE_OFFER_EXPIRED`.

Manual test: `pnpm seed-expired-acceptance-deadline-for-test` then `pnpm run-acceptance-signing-expiry`.

## Phases

| Phase | Actor | UI | Outcome |
|-------|--------|-----|---------|
| **Step 1 — Accept offer** | Issuer | Shared Review Offer modal | Per-doc in-modal preview + one checkbox each; then upload acceptance docs (e.g. Board Resolution). Submit. |
| **Step 2 — Review acceptance** | Admin | Acceptance Documents review tab | Approve / request changes / reject. No SigningCloud yet. |
| **Step 3 — Execution pack** | Issuer | Same modal, signing steps only | Configure signers → send → track. No upload step (done in Step 1). |

Envelope create/send is blocked until acceptance docs are **admin-approved**.

## Status (Option A)

Contract/invoice stay `OFFER_SENT` until the envelope completes (→ `APPROVED`), the offer is declined/withdrawn, or the phase clock expires (→ `OFFER_EXPIRED`). Phase lives on `offer_details.offer_acceptance`:

```ts
type OfferAcceptanceStatus =
  | "PENDING_ISSUER"           // offer sent; Step 1 not submitted
  | "PENDING_ADMIN_REVIEW"     // acknowledgements + uploads submitted
  | "CHANGES_REQUESTED"        // admin amendment on acceptance docs
  | "REJECTED"                 // admin rejected acceptance → offer withdrawn as OFFER_REJECTED
  | "APPROVED_FOR_SIGNING"     // Step 3 unlocked
  | "SIGNING_IN_PROGRESS"      // envelope SENT | IN_PROGRESS
  | "COMPLETED";               // envelope COMPLETED (mirrors offer APPROVED)

type OfferAcceptanceDetails = {
  status: OfferAcceptanceStatus;
  acknowledgements?: Array<{
    document_key: string;
    accepted_at: string;
    accepted_by_user_id: string;
  }>;
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

- **Request changes** — existing acceptance-doc amendment path; set `CHANGES_REQUESTED`; restamp `acceptance_expires_at` (fresh product acceptance window); issuer reopens Step 1 on the upload sub-step (acknowledgements stay recorded unless product forces re-ack).
- **Reject (admin)** — withdraw offer (`WITHDRAWN` + `OFFER_REJECTED`); set `offer_acceptance.status = "REJECTED"`. No silent “try again” without a new offer.
- **Decline (issuer)** — existing reject offer path; phase ends.

## Acknowledgement documents (product config)

Configured next to `acceptance_documents` / signing packages on the financing-type step:

```ts
type OfferAcknowledgementDocument = {
  key: string;           // stable id, e.g. "letter_of_offer"
  name: string;          // UI label
  required: boolean;     // default true
  /** How in-modal preview content is produced */
  content_source: "generated_offer_letter" | "template_pdf" | "static_text";
  /** Required when content_source === "static_text" */
  static_text?: string;
  /** Required when content_source === "template_pdf" */
  template?: { s3_key: string; file_name: string; file_size?: number };
};
```

Workflow key: `offer_acknowledgements` (flat list on financing_type config).

### Content source (what the issuer sees)

| Source | Meaning | Best for |
|--------|---------|----------|
| **`generated_offer_letter`** | In-modal PDF preview of the system offer letter (actual offer amounts). | **Default for Letter of Offer** |
| **`template_pdf`** | In-modal PDF preview of a product-uploaded template. | Fixed forms / guarantee packs |
| **`static_text`** | Admin-authored plain text (required non-empty on product save). | **Default for Guarantee Acknowledgement** until legal PDF exists |
| **`html_template`** | Built-in `template_key` HTML. **Blocked on product save** — only engineering placeholders exist today. | Deferred until legal merge-field copy |

Default pair: use **Add LO + Guarantee Acknowledgement** in product settings (`DEFAULT_OFFER_ACKNOWLEDGEMENTS`: LOO → `generated_offer_letter`; Guarantee → `static_text` that admin must fill or switch to `template_pdf`).

**HTML-from-template with merge fields** is deferred; do not re-enable `html_template` until legal supplies production copy. Keep `template_key` stable when that lands.

**Re-send policy:** Once `offer_acceptance` is past `PENDING_ISSUER`, or acknowledgements/`submitted_at` exist, admin cannot re-send over the same offer — retract first, then send revised terms. Step 1 submit also freezes `acknowledged_terms` (facility/amount, rates, expiry, offer/product version) under `offer_acceptance` for audit.

    Prefer **one stepper step per acknowledgement document** (sidebar labels use the document name), then upload.

**While `PENDING_ADMIN_REVIEW`:** modal shows waiting state (no signing). The issuer **Review Offer** CTA is hidden; the applications card badge uses **Under Review**. Acceptance clock is paused (no “Accept by” on the card). CTA returns on `CHANGES_REQUESTED` or `APPROVED_FOR_SIGNING`. Resetting Acceptance review items/section from Approved rolls `offer_acceptance` back to `PENDING_ADMIN_REVIEW` (CTA hidden again). Admin Acceptance visibility and phase sync both use the application’s **frozen** `product_version` (not the live catalog row). Admin Acceptance status badges use distinct colors for `PENDING_ADMIN_REVIEW` (sky), `CHANGES_REQUESTED` (amber), and `SIGNING_IN_PROGRESS` (indigo).

**Refresh policy:** Detail views poll ~15s; application lists ~60s (focus refetch). Signing envelopes poll only while `SENT` | `IN_PROGRESS`.

**While `APPROVED_FOR_SIGNING` | `SIGNING_IN_PROGRESS` (Step 3):**

- Existing: Configure signers → Document signing → Complete.
- **No** “Upload documents” step.

**Contract-linked invoices:** unchanged `accept_decline` mode after contract envelope `COMPLETED`.

## Admin

- Acceptance tab is the **primary-offer hub** (single outer card). Layout:
  1. **Offer acceptance** — financing-offer status + acknowledgement progress
  2. **Acceptance documents** — nested under offer acceptance when active (`PENDING_ADMIN_REVIEW`+ or uploads exist); Download all beside the documents heading
  3. **Signing package** — remind / void / history; signed PDF **View / Download** inline on each package document row when `signed_s3_key` is set (including the offer letter when keyed)
- Actions on acceptance docs drive `CHANGES_REQUESTED` / `APPROVED_FOR_SIGNING` / reject-withdraw.
- Signing package create/send messaging stays issuer-side; admin panel disables until `APPROVED_FOR_SIGNING`.
- Tab visibility: show Acceptance when `workflowUsesOfferAcceptanceFlow` (acknowledgements and/or acceptance documents).
- **Structure-aware tab order** (`getReviewSectionOrder`):
  - Contract / default: `… → Contract → Acceptance → Invoice`
  - Invoice-only: `… → Customer → Invoice → Acceptance`
- **Acceptance unlock prerequisites** (`getAcceptanceDocumentsPrerequisites` + `isPrerequisiteSectionSatisfied`):
  - Contract: underwriting approved + Contract `OFFER_SENT` or `APPROVED` (Send Offer unlocks Acceptance; Contract cannot be manually approved)
  - Invoice-only: underwriting + Customer approved + Invoice `OFFER_SENT` or `APPROVED`
- **Post-send handoff (v1):** after successful Send Offer on Contract, or on Invoice for invoice-only, toast + switch to the Acceptance tab. Contract-linked invoice send does **not** jump.
- On envelope / primary-offer accept: Contract (or Invoice) review → `APPROVED`; Acceptance review section → `APPROVED`. Doc-item sync does not finalize Acceptance to `APPROVED` while `offer_acceptance` is still in progress.
- Acceptance stays **visible-only** (not required for final application approval). Send Offer remains on Contract / Invoice (v1).

## Gates

| Action | Requires |
|--------|----------|
| Submit Step 1 | All required acks checked + required acceptance files present |
| Create / send envelope | `offer_acceptance.status` ∈ `APPROVED_FOR_SIGNING` \| `SIGNING_IN_PROGRESS` **and** acceptance review keys approved (same note-publish style keys) |
| Auto-accept on envelope COMPLETED | Existing behaviour; set `offer_acceptance.status = COMPLETED`; Contract + Acceptance review sections → `APPROVED` |

Presence-only gate for send is **replaced** by admin-approved for this flow when acknowledgements and/or acceptance docs are configured. If a frozen product has neither, keep legacy behaviour (direct signing stepper / accept as today).

## Slices

1. **Done — Config + types + Step 1 UI + submit API** — `offer_acknowledgements`, `offer_acceptance` on `offer_details`, issuer Step 1, remove upload from Step 3 when acceptance phase applies.
2. **Done — Admin gate** — block create/send until approved; wire review outcomes to `offer_acceptance.status`; admin panel copy.
3. **Done — Admin review linearity (Slice A)** — structure-aware tab order + Acceptance prerequisites + tab visibility via `workflowUsesOfferAcceptanceFlow`.
4. **Done — Acceptance hub (Slice B)** — Signing package + offer-acceptance summary in the Acceptance tab (status → docs → signing); no page-level signing panel.
5. **Done — Signed downloads + post-send handoff (Slice C)** — inline View/Download on Signing package document rows when `signed_s3_key` is set; after Send Offer (Contract / invoice-only), toast + focus Acceptance.
6. **Done — Phase clocks** — Acceptance + signing deadlines (product config, stamps, API gates, hourly job with reminders, durable `OFFER_EXPIRED` + resend). Still deferred: HTML merge templates; Send Offer → Acceptance (v2).
