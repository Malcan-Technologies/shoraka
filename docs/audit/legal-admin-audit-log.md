# LegalAdminAuditLog

Append-only admin audit for legal document definitions and versions. This is the sole Legal admin audit history.

Readers: `GET /v1/admin/legal-document-audit-logs` and `GET /v1/admin/legal-document-audit-logs/export` (table: `legal_admin_audit_logs`).

The legacy `LegalDocumentAuditLog` model and `legal_document_audit_logs` table have been removed. There is no backfill. Old `LEGAL_VERSION_*` event names are retired.

User open/accept evidence stays in `LegalDocumentAcceptance` and is not written here.

## Context

Every event uses `actor_type = ADMIN`, `source = API`, `portal = ADMIN`. `organization_id` and `organization_kind` are null.

Actor display name and email are snapshotted into `metadata.actorName` / `metadata.actorEmail` at write time. `actor_user_id` is a historical scalar with no User FK.

## Transactions

Legal DB mutation and `LegalAdminAuditLog` inserts share one Prisma transaction, including auto-archive rows on publish/restore. S3 upload/hash/delete stay outside that transaction.
