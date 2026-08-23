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
| `LEGAL_DOCUMENT_VERSION_CREATED_FROM_VERSION` | Admin creates a **new DRAFT** (new id, next version number, copied S3 object) from an archived previously published version. Source row and its acceptances are not mutated. Not an upload; not auto-published |

User acceptance is `LegalDocumentAcceptance` keyed by `legal_document_version_id`. Publishing the cloned draft uses normal publish/reacceptance. Historical V1 acceptance does not satisfy V3.

## Versioning rules (current)

- At most one `PUBLISHED` version per legal document (partial unique index + publish transaction).
- A row with `published_at` set may go `PUBLISHED → ARCHIVED` and then never return to `PUBLISHED` or `DRAFT`.
- Never-published `ARCHIVED` (`published_at` null) may restore to `DRAFT` if no other draft exists.
- Rolling back content means clone → review → publish, not revive the old id.

