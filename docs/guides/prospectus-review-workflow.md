# Prospectus Review workflow

Pre-marketplace admin workflow between Note draft preparation and marketplace publish.

Local product-review seed and checklist: [prospectus-review-local-product-review.md](./prospectus-review-local-product-review.md).

## Position

```
Note prepared (DRAFT)
→ Prospectus Review Draft
→ Officer selections + Save Draft
→ Submit for Review (READY_FOR_REVIEW)
→ Approve (APPROVED)
→ Note published
→ Approved content frozen on notes.prospectus_snapshot.publication_content
```

A Note created on/after `PROSPECTUS_REVIEW_REQUIRED_FROM` (`2026-07-19T00:00:00.000Z`) cannot publish without an `APPROVED` `NoteProspectusReview`. Historical Notes without a review row remain publishable. Opening Prospectus Review on an old Note creates a review row and opts that Note into the requirement.

## Status transitions

| From | To | How |
| --- | --- | --- |
| _(none)_ | `DRAFT` | Lazy create on GET review |
| `DRAFT` | `DRAFT` | Save Draft |
| `READY_FOR_REVIEW` | `DRAFT` | Save Draft (edits return to draft) |
| `DRAFT` | `READY_FOR_REVIEW` | Submit for Review (approval-level validation) |
| `READY_FOR_REVIEW` | `APPROVED` | Approve |
| `APPROVED` | `DRAFT` | Reopen (unpublished Notes only) |
| `APPROVED` | _(blocked)_ | Reopen after publish |

`SUPERSEDED` is reserved for a future amendment/republication flow.

## Data categories

| Category | Behaviour |
| --- | --- |
| AUTO_DERIVED | Read-only from Note/listing/Application freeze |
| FIXED_TEMPLATE | Officer picks a code catalogue option |
| OFFICER_SELECTED | Dropdown from versioned code catalogues |
| OFFICER_ENTERED | Manual numeric fills for unsupported financials / paymaster track record |
| HIDDEN | Issuer name, registration/SSM — never in investor prospectus |

## Persistence

Table: `note_prospectus_reviews` (1:1 `note_id`).

- `draft_content` / `approved_content` JSON (option keys, not HTML/PDF)
- `status`: `DRAFT` \| `READY_FOR_REVIEW` \| `APPROVED` \| `SUPERSEDED`
- `option_catalogue_version`, `content_version`
- Actor audit: created/updated/approved by + timestamps
- Also logged via `NoteAuditLog` (`NOTE_PROSPECTUS_REVIEW_CREATED`, `NOTE_PROSPECTUS_APPROVED`, `NOTE_PROSPECTUS_INVALIDATED`). Live unpublish is `NOTE_UNPUBLISHED`. `UNPUBLISH` is an invalidation **reason**, not an event type. Legacy `NoteAdminAction` / `NoteEvent` stores are removed.

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
Live Preview (`POST …/preview`) accepts the same draft body shape, renders Page 1–3 HTML, and never updates the review.

## Admin UI

Route: `/notes/[id]/prospectus`

Steps mirror prospectus pages. Preview uses the same Page 1–3 builders.

- **Preview**: current in-memory form values (including unsaved edits); does not save
- **Save Draft**: persists form values
- **Approve**: confirms first. Clean form approves the saved draft. Dirty form shows Save & Approve, then saves, then approves that saved version (never silently).
- Published: View Prospectus uses GET preview of frozen/approved content

## Publication freeze

On publish:

1. Require APPROVED review when the Note is in the new workflow cohort.
2. Re-validate approved content.
3. Freeze page_1 + page_2 as today.
4. Freeze `publication_content` with both option keys (`content`) and resolved wording (`resolvedPublicationContent`).
5. Preserve unknown snapshot branches.

Published renderers prefer frozen `resolvedPublicationContent` and must not re-resolve from the live catalogue when that branch exists.

## CTOS

Not used for investor mapping or automatic prefill in this workflow. Future suggestion source only after finance/disclosure approval.

## Reopen / unpublish

Pause (commitments held) does **not** invalidate the prospectus freeze.

Unpublish is allowed only with **zero** investor commitments. It:

- Returns the Note to `DRAFT` and hides the listing
- Reopens Prospectus Review as `DRAFT` with previously filled `draft_content` kept
- Clears the current freeze pointers (`approved_content`, `approved_publication_id`, …)
- Keeps prior `note_prospectus_publications` rows for audit
- Logs `UNPUBLISH` and `PROSPECTUS_APPROVAL_INVALIDATED_UNPUBLISH`

The officer must **Approve** again before marketplace publish. Approve creates a new publication id and increments `content_version` (`PROSPECTUS_REVIEW_APPROVE`). Listed notes with investors cannot unpublish, so their freeze cannot change.

Allowed only while Note is still `DRAFT` and unpublished. Published Notes with commitments stay frozen.

## Permissions

- `notes.view`: read review + preview
- `notes.manage`: save, submit, approve, reopen, publish when eligible

Same officer may edit and approve today (no separate approver permission). Separation of duties is a product decision.
