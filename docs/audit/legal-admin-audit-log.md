# LegalAdminAuditLog

Append-only admin audit for legal document definitions and versions. This is the sole Legal admin audit history.

Readers: `GET /v1/admin/legal-document-audit-logs` and `GET /v1/admin/legal-document-audit-logs/export` (table: `legal_admin_audit_logs`). Admin UI: `/audit?tab=legal-documents` (`LegalDocumentAuditPanel` + `ListToolbar`), permission `document_management.view`.

The legacy `LegalDocumentAuditLog` model and `legal_document_audit_logs` table have been removed. There is no backfill. Old `LEGAL_VERSION_*` event names are retired. Live events are `LEGAL_DOCUMENT_*` / `LEGAL_DOCUMENT_VERSION_*`.

User open/accept evidence stays in `LegalDocumentAcceptance` and is not written here.

## Context

Every event uses `actor_type = ADMIN`, `source = API`, `portal = ADMIN`. `organization_id` and `organization_kind` are null.

Actor display name and email are snapshotted into `metadata.actorName` / `metadata.actorEmail` at write time. `actor_user_id` is a historical scalar with no User FK.

## Transactions

Legal DB mutation and `LegalAdminAuditLog` inserts share one Prisma transaction, including auto-archive rows on publish of a **DRAFT**. S3 upload/copy/hash/delete stay outside that transaction. Restore-as-published on the same version id is not a live path and no longer writes auto-archive-on-restore.

## Live events (8)

A056–A062 numbering is unchanged. A179 is appended.

| Event | When it writes |
|---|---|
| `LEGAL_DOCUMENT_CREATED` | Admin creates the document shell |
| `LEGAL_DOCUMENT_UPDATED` | Admin updates shell flags/title/audience |
| `LEGAL_DOCUMENT_VERSION_UPLOADED` | Admin uploads a new draft PDF |
| `LEGAL_DOCUMENT_VERSION_FILE_REPLACED` | Admin replaces a draft PDF in place |
| `LEGAL_DOCUMENT_VERSION_PUBLISHED` | Admin publishes a **DRAFT** (only) |
| `LEGAL_DOCUMENT_VERSION_ARCHIVED` | Manual archive, or auto-archive of the previous published row on publish (`AUTO_ARCHIVED_ON_PUBLISH`). `AUTO_ARCHIVED_ON_RESTORE_PUBLISH` remains in Zod for historical rows only |
| `LEGAL_DOCUMENT_VERSION_RESTORED` | Never-published archived draft restored to `DRAFT` on the **same** id. Previously published archived versions cannot be restored |
| `LEGAL_DOCUMENT_VERSION_CREATED_FROM_VERSION` | Admin creates a **new DRAFT** (new id, next version number, copied S3 object) from the **currently PUBLISHED** version or from a previously published **ARCHIVED** version. Source row and its acceptances are not mutated. Published source stays published. Not an upload; not auto-published |

User acceptance is `LegalDocumentAcceptance` keyed by `legal_document_version_id`. Publishing the cloned draft uses normal publish/reacceptance. Historical V1 acceptance does not satisfy V3.

## Versioning rules (current)

- At most one `PUBLISHED` version per legal document (partial unique index + publish transaction).
- A row with `published_at` set may go `PUBLISHED → ARCHIVED` and then never return to `PUBLISHED` or `DRAFT` (immutable historical record).
- The live `PUBLISHED` version may be used as a clone source. Clone creates a **new** `DRAFT` (new id, next version number, copied file). The published source stays `PUBLISHED` and remains what users see until that draft is published.
- A previously published `ARCHIVED` version may also be used as a clone source. The archived source stays `ARCHIVED`.
- Clone never copies, rewrites, or deletes `LegalDocumentAcceptance` rows. The new draft has a new `legal_document_version_id`, so source acceptance does not satisfy the new version.
- Clone does not auto-publish and does not archive the current published version. The live version is archived only inside the normal publish transaction when the new draft is published (`AUTO_ARCHIVED_ON_PUBLISH`).
- Never-published `ARCHIVED` (`published_at` null) may restore to `DRAFT` on the **same** id if no other draft exists (A062). That path is not used for previously published rows.
- Rolling back content means clone → review → publish, not revive the old published id.

Example: V1 `ARCHIVED`, V2 `PUBLISHED`. Clone from V2 → V3 `DRAFT` while V2 stays live. Publish V3 → V2 `ARCHIVED`, V3 `PUBLISHED`. No zero-published gap is required to prepare V3.

## Admin Legal Documents UX (informational)

**Create New Version From This Version** appears on the live published version and on previously published archived versions. Never-published archives show Restore to draft.

The Admin list also shows an informational **onboarding readiness** warning, computed with the same published-required-document resolver as onboarding, separately for Issuer and Investor:

- Issuer has zero published required legal docs → Issuer onboarding blocked warning
- Investor has zero published required legal docs → Investor onboarding blocked warning
- Both zero → combined warning
- Each has at least one published required legal doc → no warning

Draft and archived versions do not count as published. The warning does not change `getRequiredDocuments`, `all_accepted`, `acceptTnc`, onboarding logic, reacceptance, Application / Note / Investment gates, required type lists, or audience rules. It does not write an audit event.

