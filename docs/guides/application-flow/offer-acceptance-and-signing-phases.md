# Offer acceptance & signing phases

Standard post-offer flow for **contract** and **invoice-only** offers (same product signing package). Contract-linked invoices stay on direct Accept/Decline after the contract envelope completes (unchanged).

Invoice-only applications allow **at most one invoice** (enforced on create). Clocks (7-day / 14-day) are deferred.

## Phases

| Phase | Actor | UI | Outcome |
|-------|--------|-----|---------|
| **Step 1 — Accept offer** | Issuer | Shared Review Offer modal | Per-doc in-modal preview + one checkbox each; then upload acceptance docs (e.g. Board Resolution). Submit. |
| **Step 2 — Review acceptance** | Admin | Acceptance Documents review tab | Approve / request changes / reject. No SigningCloud yet. |
| **Step 3 — Execution pack** | Issuer | Same modal, signing steps only | Configure signers → send → track. No upload step (done in Step 1). |

Envelope create/send is blocked until acceptance docs are **admin-approved**.

## Status (Option A)

Contract/invoice stay `OFFER_SENT` until the envelope completes (→ `APPROVED`) or the offer is declined/withdrawn. Phase lives on `offer_details.offer_acceptance`:

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
};
```

Defaults when admin sends offer: `offer_acceptance.status = "PENDING_ISSUER"`.

### Reject / changes (locked)

- **Request changes** — existing acceptance-doc amendment path; set `CHANGES_REQUESTED`; issuer reopens Step 1 on the upload sub-step (acknowledgements stay recorded unless product forces re-ack).
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
| **`html_template`** | In-modal HTML from a built-in `template_key` (`letter_of_offer` / `guarantee_acknowledgement`). **This pass:** hardcoded placeholders in `OFFER_ACKNOWLEDGEMENT_HTML_PLACEHOLDERS`. Later: real templated HTML with merge fields. | Letter of Offer, Guarantee Acknowledgement |
| **`generated_offer_letter`** | In-modal PDF preview of the system offer letter. | Optional alternative for LOO |
| **`template_pdf`** | In-modal PDF preview of a product-uploaded template. | Fixed forms |
| **`static_text`** | Admin-authored plain text. | Short boilerplate |

Default pair: use **Add LO + Guarantee Acknowledgement** in product settings (`DEFAULT_OFFER_ACKNOWLEDGEMENTS`).

**HTML-from-template with merge fields** is deferred; keep `template_key` stable when swapping placeholder bodies.

    Prefer **one stepper step per acknowledgement document** (sidebar labels use the document name), then upload.

**While `PENDING_ADMIN_REVIEW`:** modal shows waiting state (no signing). The issuer **Review Offer** CTA is hidden until admin requests changes (`CHANGES_REQUESTED`) or approves for signing (`APPROVED_FOR_SIGNING`); it stays visible for Step 1 (`PENDING_ISSUER`) and Step 3 (`APPROVED_FOR_SIGNING` / `SIGNING_IN_PROGRESS`). Resetting Acceptance review items/section from Approved rolls `offer_acceptance` back to `PENDING_ADMIN_REVIEW` (CTA hidden again). Admin Acceptance visibility and phase sync both use the application’s **frozen** `product_version` (not the live catalog row).

**While `APPROVED_FOR_SIGNING` | `SIGNING_IN_PROGRESS` (Step 3):**

- Existing: Configure signers → Document signing → Complete.
- **No** “Upload documents” step.

**Contract-linked invoices:** unchanged `accept_decline` mode after contract envelope `COMPLETED`.

## Admin

- Acceptance tab: review uploads; actions drive `CHANGES_REQUESTED` / `APPROVED_FOR_SIGNING` / reject-withdraw.
- Signing package panel: show phase badge; disable create/send messaging until `APPROVED_FOR_SIGNING`.
- Show recorded acknowledgement timestamps read-only when present.
- Tab visibility: show Acceptance when `workflowUsesOfferAcceptanceFlow` (acknowledgements and/or acceptance documents).
- **Structure-aware tab order** (`getReviewSectionOrder`):
  - Contract / default: `… → Contract → Acceptance → Invoice`
  - Invoice-only: `… → Customer → Invoice → Acceptance`
- **Acceptance unlock prerequisites** (`getAcceptanceDocumentsPrerequisites`):
  - Contract: underwriting + Contract approved
  - Invoice-only: underwriting + Customer + Invoice approved
- Acceptance stays **visible-only** (not required for final application approval). Send Offer remains on Contract / Invoice (v1).

## Gates

| Action | Requires |
|--------|----------|
| Submit Step 1 | All required acks checked + required acceptance files present |
| Create / send envelope | `offer_acceptance.status` ∈ `APPROVED_FOR_SIGNING` \| `SIGNING_IN_PROGRESS` **and** acceptance review keys approved (same note-publish style keys) |
| Auto-accept on envelope COMPLETED | Existing behaviour; set `offer_acceptance.status = COMPLETED` |

Presence-only gate for send is **replaced** by admin-approved for this flow when acknowledgements and/or acceptance docs are configured. If a frozen product has neither, keep legacy behaviour (direct signing stepper / accept as today).

## Slices

1. **Config + types + Step 1 UI + submit API** — `offer_acknowledgements`, `offer_acceptance` on `offer_details`, issuer Step 1, remove upload from Step 3 when acceptance phase applies.
2. **Admin gate** — block create/send until approved; wire review outcomes to `offer_acceptance.status`; admin panel copy.
3. **Admin review linearity (Slice A)** — structure-aware tab order + Acceptance prerequisites + tab visibility via `workflowUsesOfferAcceptanceFlow`.
4. **Deferred** — 7/14-day clocks; HTML merge templates; move Signing package into Acceptance hub (Slice B); Send Offer → Acceptance (v2).
