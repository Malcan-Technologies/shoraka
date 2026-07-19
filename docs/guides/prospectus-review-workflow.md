# Prospectus Review workflow

Pre-marketplace admin workflow between Note draft preparation and marketplace publish.

## Position

```
Note prepared (DRAFT)
→ Prospectus Review Draft
→ Officer selections
→ Preview
→ Prospectus Approved
→ Note published
→ Approved content frozen on notes.prospectus_snapshot.publication_content
```

A Note created on/after `2026-07-19T00:00:00.000Z` cannot publish without an `APPROVED` `NoteProspectusReview`. Historical Notes without a review row remain publishable.

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
- Also logged via `NoteAdminAction` / `NoteEvent`

Never writes into Application financial statements, CTOS, invoice/issuer/paymaster snapshots.

## Option catalogues

Versioned in code: `apps/api/src/modules/notes/prospectus-review/prospectus-option-catalogues.ts`.

Current version uses clearly marked placeholder wording. Not legally approved production copy.

Every dropdown includes `do_not_display`.

## API

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/v1/admin/notes/:id/prospectus-review` | `notes.view` |
| PUT | `/v1/admin/notes/:id/prospectus-review` | `notes.manage` |
| POST | `…/approve` | `notes.manage` |
| POST | `…/reopen` | `notes.manage` |
| GET | `…/preview` | `notes.view` |

Draft save uses `expectedUpdatedAt` optimistic concurrency.

## Admin UI

Route: `/notes/[id]/prospectus`

Steps mirror prospectus pages. Preview uses the same Page 1–3 builders. Banner: “Draft Prospectus — not yet approved”.

## Publication freeze

On publish:

1. Require APPROVED review when the Note is in the new workflow cohort.
2. Re-validate approved content.
3. Freeze page_1 + page_2 as today.
4. Also freeze `publication_content` from approved review.
5. Preserve unknown snapshot branches.

Published renderers read frozen `publication_content` only — never the mutable draft and never development placeholder defaults.

## CTOS

Not used for investor mapping or automatic prefill in this workflow. Future suggestion source only after finance/disclosure approval.

## Reopen

Allowed only while Note is still `DRAFT` and unpublished. Published Notes require a future amendment/republication flow (out of scope).
