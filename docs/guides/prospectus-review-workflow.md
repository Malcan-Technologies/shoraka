# Prospectus Review workflow

Pre-marketplace admin workflow between Note draft preparation and marketplace publish.

Local product-review seed and checklist: [prospectus-review-local-product-review.md](./prospectus-review-local-product-review.md).

## Position

```
Application COMPLETED (all required review sections approved)
→ Note created (DRAFT) with notes.financial_snapshot
→ Prospectus Review Draft
→ Officer selections + Save Draft
→ Approve (READY_FOR_PUBLISH): complete Prospectus frozen on note_prospectus_reviews.approved_snapshot
→ Note published (PUBLISHED): approved snapshot copied to notes.prospectus_snapshot, Page 1 re-rendered with listing dates
```

A Note created on/after `PROSPECTUS_REVIEW_REQUIRED_FROM` (`2026-07-19T00:00:00.000Z`) cannot publish without an approved `NoteProspectusReview`. Historical Notes without a review row remain publishable. Opening Prospectus Review on an old Note creates a review row and opts that Note into the requirement.

## Note financial snapshot

Both Note creation paths (from an invoice, from an application) require an `APPROVED` invoice, a `COMPLETED` application (`409 APPLICATION_NOT_COMPLETED`) and every required review section approved (`409 REVIEW_SECTIONS_NOT_APPROVED`, `details.sections` lists the rest). The required sections come from the same policy the Admin review uses: `apps/api/src/modules/admin/review-section-approval.ts`.

`createFromInvoiceSource` (`apps/api/src/modules/notes/service.ts`) then writes `notes.financial_snapshot` (nullable JSON) in the same transaction as the Note. It is written once and never refreshed. It holds:

- the application's `financial_statements` verbatim: issuer User Input, Admin edits to User Input, whole-year Admin Input, Admin CTOS gap-fills, questionnaire
- the application-owned CTOS report: id, fetch time, financials payload
- `reference_date` for year selection
- traceability: application id, review cycle, Financial review status / reviewed time / reviewer id

Type: `apps/api/src/modules/notes/note-financial-snapshot.types.ts`. Builder: `apps/api/src/modules/notes/note-financial-snapshot.ts`.

The Prospectus reads financial inputs through `apps/api/src/modules/notes/prospectus/prospectus-note-financial-inputs.ts`:

- **Snapshot-backed Note**: reads only the snapshot, never the live application or CTOS.
- **Note without a snapshot** (created before the column existed): reads the source application and its owned CTOS report.
- A snapshot that is present but does not parse is an error (`500 NOTE_FINANCIAL_SNAPSHOT_INVALID`); it never falls back to live data.

Year selection uses an explicit reference date, never the current date: the snapshot's `reference_date` (the application's `submitted_at`, i.e. first submission, else the Note creation time); for a Note without a snapshot, the application's `submitted_at`, else the Note's `created_at`. It is the date the issuer's financial-year tabs were validated against, so every submitted year stays selectable and the result is stable for the life of the Note.

Source priority per financial year (`apps/api/src/modules/notes/prospectus/prospectus-financial-comparison-source.ts`): reviewed User Input (including Admin edits) → CTOS plus explicit Admin CTOS gap-fills → active Admin Input → blank.

Admin can edit application financials only while the application is in a reviewable status and the Financial section is not approved (`isAdminFinancialEditOpen` in `packages/types/src/financial-field-resolution.ts`, enforced by `assertAdminFinancialEditsOpen` in `apps/api/src/modules/applications/service.ts`).

Notes without a snapshot: `pnpm --filter @cashsouk/api notes:classify-financial-snapshots` classifies them (dry run by default). With `-- --apply --confirm-class-a-only` it writes a snapshot only for Notes with no approved or published Prospectus whose source application is completed with Financial approved. Notes with an approved or published Prospectus are reported and never written. Script: `apps/api/scripts/classify-note-financial-snapshots.ts`.

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

Approve, not publish, builds the complete approved snapshot (`buildCompleteApprovedProspectusSnapshot` in `apps/api/src/modules/notes/prospectus-review/prospectus-approved-snapshot.ts`):

- `page_1`: issuer track record
- `page_2.financial_comparison` with `freeze_version: 2` (`apps/api/src/modules/notes/prospectus/prospectus-page-two-snapshot.ts`): every raw key of each selected year, the statement type, the reference date, the source footer and the missing-year state
- `publication_content`: option keys (`content`) and resolved wording (`resolvedPublicationContent`)
- `note_identity` and the rendered HTML for all pages; Pages 2 and 3 are rendered from the frozen `page_2` as read back from storage (`apps/api/src/modules/notes/prospectus-review/prospectus-approved-render.ts`)

Numbers in the frozen pages are limited to 15 significant digits (`canonicalizeJsonNumbers`) before they are hashed and stored: a Prisma Json column keeps 16, and a longer value would hash differently after storage.

After approval (`apps/api/src/modules/notes/prospectus-review/prospectus-review.service.ts`):

- GET review and preview of an approved review with a version-2 freeze render from the frozen snapshot, not live sources.
- Publish and extend-listing (`generateFinalProspectusPdfForPublish`) keep the approved HTML for Pages 2–5 and re-render only Page 1 with the listing dates, from the frozen track record. The result is copied to `notes.prospectus_snapshot`.
- A freeze made before version 2 still renders from its 18 stored keys.

Published renderers prefer frozen `resolvedPublicationContent` and must not re-resolve from the live catalogue when that branch exists.

## Approval invalidation

- **Source drift**: on GET of an approved review on an unlisted Note, the render fingerprint is recomputed from the current sources plus the stored pages. A mismatch returns the review to `DRAFT` and records `PROSPECTUS_APPROVAL_INVALIDATED_SOURCE`. The invalidation is a compare-and-set, so concurrent GETs perform it once. Publish rejects the same mismatch (`409 PROSPECTUS_REVIEW_REQUIRED`).
- **Edit**: saving changed content over an approval records `PROSPECTUS_APPROVAL_INVALIDATED_EDIT`.
- **Unpublish**: records `PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH` (below).

For a snapshot-backed Note the financial sources cannot drift; the remaining fingerprinted inputs are the Note's own fields and the issuer's MARC assessment.

## CTOS

The application-owned CTOS report feeds the financial comparison: it is copied into the Note financial snapshot at Note creation and used as the second source in the per-year priority. Prospectus Review never fetches CTOS itself.

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
