# NotificationBroadcastAuditLog

Append-only admin audit for bulk notification broadcasts. This is the live writer and reader for admin send history.

Reader: `GET /v1/notifications/admin/logs` (table: `notification_broadcast_audit_logs`). No export in this phase. Admin UI: `/audit?tab=notifications`, permission `notifications.view`.

The legacy `NotificationLog` model and `notification_logs` table have been **removed**. There is no backfill. `NotificationBroadcastAuditLog` is the sole admin broadcast history.

Per-user inbox/delivery stays in `Notification`. Type/group/preference configuration is audited on `SecurityAuditLog` (`NOTIFICATION_TYPE_UPDATED`, `NOTIFICATION_GROUP_*`, `USER_NOTIFICATION_PREFERENCE_UPDATED`), not on this table.

## Event

Exactly one event:

`NOTIFICATION_BROADCAST_PROCESSED`

Meaning: the admin bulk-notification operation finished processing its resolved audience. Valid when `targetedCount` is 0, when some recipients fail, and when all recipients fail.

Do not emit `NOTIFICATION_BROADCAST_FAILED`. Do not emit per-recipient or per-email events.

## Context

Every event uses `actor_type = ADMIN`, `source = API`, `portal = ADMIN`. `organization_id` and `organization_kind` are null. `idempotency_key` is null (duplicate re-submit is an existing limitation; Phase 3 does not add bulk-send idempotency).

`target_type = NOTIFICATION_BROADCAST`. The audit id is generated before insert and stored as `target_id` (no Broadcast SOT table).

Actor display name and email are snapshotted into `metadata.actorName` / `metadata.actorEmail`. Notification type name and `portalTargets` are snapshotted. `actor_user_id` and `notification_type_id` are historical scalars with no FKs.

## Count semantics

- `targetedCount` — resolved target user ids
- `createdCount` — `Notification` rows successfully created (`create()` returned a row)
- `skippedCount` — intentional skip (`create()` returned null, typically both channels off)
- `failedCount` — recipient `create()` exceptions

Invariant: `createdCount + skippedCount + failedCount = targetedCount`.

These are not successful-email counts. Email success remains `Notification.email_sent_at`.

## Channel metadata

- `EXPLICIT_OVERRIDE` — request supplied `sendToPlatform` and/or `sendToEmail`; those requested booleans are stored
- `TYPE_AND_USER_PREFERENCES` — channel flags omitted; `sendToPlatform` / `sendToEmail` are null because effective channels can vary per recipient

## Transactions

Sequence: resolve audience → process each Notification/email as before (not one large transaction) → calculate aggregates → write one audit row.

If the audit insert fails after deliveries, already-created `Notification` rows are **not** rolled back.

Inbox cleanup (`runCleanup`) deletes `Notification` rows only. It must never delete `notification_broadcast_audit_logs`. Type-removal migrations must not be copied or extended to delete this table.

## Known product-control issues (unchanged)

- Admin UI type picker is limited to MARKETING/ANNOUNCEMENT; the API still accepts any `typeId`.
- `ALL_USERS` includes admin users.
- Re-submitting the same send creates additional `Notification` rows and another `NOTIFICATION_BROADCAST_PROCESSED` row.
