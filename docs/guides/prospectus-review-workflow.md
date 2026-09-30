# Prospectus Review workflow

Pre-marketplace admin workflow between Note draft preparation and marketplace publish.

Local product-review seed and checklist: [prospectus-review-local-product-review.md](./prospectus-review-local-product-review.md).

## Position

```
Financial section APPROVED: result stored on application_reviews.approved_snapshot
→ Note created (DRAFT): result copied to notes.financial_snapshot
→ Prospectus Review Draft
→ Officer selections + Save Draft
→ Approve (READY_FOR_PUBLISH): complete Prospectus frozen on note_prospectus_reviews.approved_snapshot
→ Note published (PUBLISHED): approved snapshot copied to notes.prospectus_snapshot, Page 1 re-rendered with listing dates
```

A Note created on/after `PROSPECTUS_REVIEW_REQUIRED_FROM` (`2026-07-19T00:00:00.000Z`) cannot publish without an approved `NoteProspectusReview`. Historical Notes without a review row remain publishable. Opening Prospectus Review on an old Note creates a review row and opts that Note into the requirement.

## Financial data

Financial Review owns the review decision. Each later stage copies the result; none resolves or recalculates it.

### 1. Financial Review resolves and calculates

`resolveFinancialReviewResult` (`packages/types/src/financial-review-result.ts`) is the one shared resolver and calculator, built only from the existing formula helpers. The Admin Financial Review screen displays from it (`apps/admin/src/components/application-financial-review-content.tsx`). For every reviewed or selected financial year it returns:

- effective raw values, after Admin edits and CTOS gap-fills
- a per-field source trace: User Input, User Input edited by Admin, CTOS, CTOS gap-fill, Admin Input
- calculated metrics (`FINANCIAL_REVIEW_CALCULATED_KEYS`, 18 keys; percent metrics in percent points)
- the selected-years flag: latest three years, one source per year (reviewed User Input, else CTOS, else Admin Input)

Precedence per metric: CTOS direct figure, else CTOS stylesheet formula, else CashSouk formula. Missing input means "cannot calculate" (`null`), never 0.

### 2. Financial approval stores the result

`apps/api/src/modules/admin/financial-approved-result.ts`: approving the Financial section locks the application row, builds the result (year-selection reference date = the application's first submission date), limits numbers to 15 significant digits and writes status `APPROVED` plus `application_reviews.approved_snapshot` in one row write.

- Every path that moves Financial out of `APPROVED` clears the stored result: reject, request amendment, remove draft amendment, reset to pending, automatic CTOS/AML reset, issuer resubmit.
- `loadCurrentApprovedFinancialResult` returns a result only while the row is `APPROVED`.
- Admin financial edits are allowed only while the application is reviewable and Financial is not `APPROVED` (`FINANCIAL_REVIEW_LOCKED`), re-checked inside the write transaction.

### 3. Note creation copies it

`createFromApplication` needs a `COMPLETED` application (`409 APPLICATION_NOT_COMPLETED`); both creation paths need an `APPROVED` invoice (`409 INVOICE_NOT_APPROVED`). After these checks, `createFromInvoiceSource` (`apps/api/src/modules/notes/service.ts`) requires a current approved result (`409 FINANCIAL_APPROVED_RESULT_REQUIRED`) and stores it with the Note:

```
notes.financial_snapshot = { version: 2, captured_at, approved_financial_result }
```

Type: `apps/api/src/modules/notes/note-financial-snapshot.types.ts`. Written once, never refreshed.

### 4. Prospectus reads only the Note snapshot

`readProspectusNoteFinancialSnapshot` (`apps/api/src/modules/notes/prospectus/prospectus-note-financial-inputs.ts`):

- missing snapshot: `409 NOTE_FINANCIAL_SNAPSHOT_MISSING`
- malformed snapshot: `500 NOTE_FINANCIAL_SNAPSHOT_INVALID`
- no fallback to the application or CTOS

Pages 2 and 3 display the stored calculated values (`prospectus-financial-comparison-metrics.ts`, `prospectus-page-three-*.ts`). Nothing under `notes/prospectus/` calculates, except `prospectus-legacy-frozen-financials.ts`, which renders Prospectus freezes made before this design from their own frozen data. Published Notes render from their frozen Prospectus snapshot.

Prospectus Review never fetches CTOS. CTOS reaches the Prospectus only through the approved Financial Review result.

### Seeds

`apps/api/scripts/lib/seed-note-financial-snapshot.ts` approves Financial through the real approval function and copies the result onto seeded Notes. Used by the Prospectus seeds (`seed-prospectus-demo`, `seed-prospectus-lifecycle`, `seed-prospectus-review-note`), `seed-approved-invoices-for-notes` and `seed-paymaster-assignment-scenarios`. Other seed scripts that insert Notes directly do not; their Notes fail in the Prospectus with `NOTE_FINANCIAL_SNAPSHOT_MISSING`.

### Existing data

No backfill.

- Financial sections approved before this design have no stored result. Re-approve while the application is reviewable. A `COMPLETED` application is not reviewable (`prepareForReviewAction` throws `400 INVALID_STATE`), so an application completed before this design cannot create Notes without a data fix.
- Notes without a financial snapshot fail in the Prospectus with `409 NOTE_FINANCIAL_SNAPSHOT_MISSING`. The API cannot recreate them: Note creation returns the existing Note for the same invoice (`noteRepository.findBySource`), and there is no delete-Note endpoint. Handle them with a data reset (delete those Notes / re-seed on staging).
- Prospectus approvals made before this design: on a Note with a snapshot, the changed fingerprint sources invalidate the approval once at the next GET (back to `DRAFT`). On a Note without a snapshot, GET and publish fail with `409 NOTE_FINANCIAL_SNAPSHOT_MISSING` before invalidation runs, so the review stays approved but unpublishable until the data is reset.

## Status transitions

| From | To | How |
| --- | --- | --- |
| _(none)_ | `DRAFT` | Lazy create on GET review |
| `DRAFT` | `DRAFT` | Save Draft |
| `DRAFT` | `READY_FOR_PUBLISH` | Approve (approval-level validation, builds the freeze) |
| `READY_FOR_PUBLISH` | `DRAFT` | Save Draft with changed content, source drift, or unpublish |
| `READY_FOR_PUBLISH` | `PUBLISHED` | Note publish (same transaction) |
| `PUBLISHED` | `DRAFT` | Unpublish (zero investors) |

`APPROVED` is a legacy value treated like `READY_FOR_PUBLISH`. `READY_FOR_REVIEW` and `SUPERSEDED` remain in the enum but are not written by the current flow.

## Data categories

| Category | Behaviour |
| --- | --- |
| AUTO_DERIVED | Read-only from Note/listing and the Note financial snapshot |
| FIXED_TEMPLATE | Officer picks a code catalogue option |
| OFFICER_SELECTED | Dropdown from versioned code catalogues |
| OFFICER_ENTERED | Manual numeric fills for unsupported financials / paymaster track record |
| HIDDEN | Issuer name, registration/SSM — never in investor prospectus |

## Persistence

Table: `note_prospectus_reviews` (1:1 `note_id`).

- `draft_content` / `approved_content` JSON (option keys, not HTML/PDF)
- `approved_snapshot` (complete freeze built at Approve), `approved_publication_id`, `render_fingerprint`
- `status`: `DRAFT` \| `READY_FOR_PUBLISH` \| `PUBLISHED` (plus legacy/reserved values above)
- `option_catalogue_version`, `content_version`
- Actor audit: created/updated/approved by + timestamps
- Each Approve also creates an immutable `note_prospectus_publications` row
- Also logged via `NoteAdminAction` / `NoteEvent`

Never writes into Application financial statements, CTOS, invoice/issuer/paymaster snapshots.

## Option catalogues

Versioned in code: `apps/api/src/modules/notes/prospectus-review/prospectus-option-catalogues.ts`.

Current version uses clearly marked placeholder wording. Not legally approved production copy. Admin UI shows a temporary-catalogue notice.

Most catalogues include `do_not_display` where omission is allowed. Credit Insights is an exception: all five rows are mandatory assessment values (no hide option).

## API

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/v1/admin/notes/:id/prospectus-review` | `notes.view` |
| PUT | `/v1/admin/notes/:id/prospectus-review` | `notes.manage` |
| POST | `…/approve` | `notes.manage` |
| GET | `…/preview` | `notes.view` (saved draft/approved content) |
| POST | `…/preview` | `notes.manage` (live unsaved form payload; no DB write) |

Draft save uses `expectedUpdatedAt` optimistic concurrency (`409 CONFLICT` on stale save).
Live Preview (`POST …/preview`) accepts the same draft body shape, renders the Prospectus HTML, and never updates the review.

## Admin UI

Route: `/notes/[id]/prospectus`

Steps mirror prospectus pages. Preview uses the same page builders.

- **Preview**: current in-memory form values (including unsaved edits); does not save
- **Save Draft**: persists form values
- **Approve**: confirms first. Clean form approves the saved draft. Dirty form shows Save & Approve, then saves, then approves that saved version (never silently).
- Approved / published: View Prospectus uses GET preview of the frozen approved content

## Approval freeze

Prospectus approval is the second freeze. Approve, not publish, builds the complete approved snapshot (`buildCompleteApprovedProspectusSnapshot` in `apps/api/src/modules/notes/prospectus-review/prospectus-approved-snapshot.ts`):

- `page_1`: issuer track record
- `page_2.financial_comparison` with `freeze_version: 2` (`apps/api/src/modules/notes/prospectus/prospectus-page-two-snapshot.ts`): every selected year's raw values and `calculated_values`, the statement type, the reference date and the missing-year state, all taken from the Note financial snapshot
- `publication_content`: option keys (`content`) and resolved wording (`resolvedPublicationContent`)
- `note_identity` and the rendered HTML for all pages

Numbers in the frozen pages are limited to 15 significant digits (`canonicalizeJsonNumbers`) before they are hashed and stored: a Prisma Json column keeps 16, and a longer value would hash differently after storage.

The render fingerprint is `sha256({ draft, sources: { note_identity, financial_snapshot }, page_1, page_2 })`.

After approval (`apps/api/src/modules/notes/prospectus-review/prospectus-review.service.ts`):

- GET review and preview of an approved review render from the frozen result, not live sources.
- Publish and extend-listing keep the approved `html.page2`–`page5` and re-render only Page 1 with the real listing dates, from the frozen track record. The result is copied to `notes.prospectus_snapshot`.

Published renderers prefer frozen `resolvedPublicationContent` and must not re-resolve from the live catalogue when that branch exists.

## Approval invalidation

- **Source drift**: on GET of an approved review on an unlisted Note, the render fingerprint is recomputed from the current sources plus the stored pages. A mismatch returns the review to `DRAFT` and records `PROSPECTUS_APPROVAL_INVALIDATED_SOURCE`. The invalidation is a compare-and-set, so concurrent GETs transition once. Publish rejects the same mismatch (`409 PROSPECTUS_REVIEW_REQUIRED`).
- **Edit**: saving changed content over an approval records `PROSPECTUS_APPROVAL_INVALIDATED_EDIT`.
- **Unpublish**: records `PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH` (below).

The Note financial snapshot never changes after Note creation, so genuine drift comes only from the Note's own fields and the issuer's MARC assessment (`note_identity`).

## Reopen / unpublish

Pause (commitments held) does **not** invalidate the prospectus freeze.

Unpublish is allowed only with **zero** investor commitments. It:

- Returns the Note to `DRAFT` and hides the listing
- Reopens Prospectus Review as `DRAFT` with previously filled `draft_content` kept
- Clears the current freeze pointers (`approved_content`, `approved_snapshot`, `approved_publication_id`, `render_fingerprint`)
- Keeps prior `note_prospectus_publications` rows for audit
- Logs `UNPUBLISH` and `PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH`

The officer must **Approve** again before marketplace publish. Approve creates a new publication id and increments `content_version` (`PROSPECTUS_REVIEW_APPROVE`). Listed notes with investors cannot unpublish, so their freeze cannot change. Approved content on a listed Note cannot be edited or re-approved (`409 PROSPECTUS_PUBLISHED_LOCKED`).

## Permissions

- `notes.view`: read review + preview
- `notes.manage`: save, approve, publish when eligible

Same officer may edit and approve today (no separate approver permission). Separation of duties is a product decision.
