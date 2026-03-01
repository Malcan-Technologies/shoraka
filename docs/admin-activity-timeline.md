# Admin Activity Timeline — Guide

## Change summary
- Timeline now reads only application-scoped logs (API: `GET /v1/applications/:id/logs`).
- Component prop changed from `organizationId` → `applicationId`.
- UI badge shows the count of returned application logs (client-side count).

Pros:
- Shows only application events (no cross-adapter noise).
- Simpler UI and accurate application-level total.

Cons:
- Removes organization-wide aggregated entries.
- Server must provide paging if large volumes are expected.

## What this component tracks
- Events originating from application audit logs. Examples:
  - APPLICATION_APPLICATION_CREATED
  - APPLICATION_APPLICATION_SUBMITTED
  - APPLICATION_APPLICATION_RESUBMITTED
  - APPLICATION_APPLICATION_APPROVED
  - APPLICATION_APPLICATION_REJECTED

These are application-level actions (submission, approval, rejection, resubmit, etc.) and are recorded in the `application_logs` table (source_table: "application_logs").

## Data shape (expected)
- id: string
- event_type: string
- activity?: string (human-readable description; may be produced server-side)
- metadata?: object | null
- ip_address?: string | null
- user_agent?: string | null
- device_info?: string | null
- created_at: ISO timestamp

## Common metadata fields
- applicationId: string — primary association to an application.
- actorName: string — display name for the actor who triggered the event.
- actorRole: string — user's role (e.g., "ISSUER_ADMIN").
- remark or note: string — reviewer/admin remarks; shown in "View details".
- portal / portalType: string — "issuer" or "investor".
- device_type / device_info: string — optional device context.

## API endpoint used by the component
- GET /v1/applications/:applicationId/logs
- The hook `useApplicationLogs(applicationId)` calls this endpoint and returns an array of normalized log objects.

Notes:
- The UI currently expects the server to return the relevant application logs in a single request (no client-side infinite scroll). If you need server-side pagination, update the API to return a paginated envelope and update the hook/component accordingly.

## How to add new application activity events (server-side)

1) Choose an event_type string
- Use a clear namespacing pattern. Example: "APPLICATION_APPLICATION_APPROVED", "APPLICATION_APPLICATION_REJECTED".

2) Persist via Prisma (recommended)

Example (TypeScript / Prisma):

```ts
await prisma.applicationLog.create({
  data: {
    id: cuid(),
    user_id: adminId,
    application_id: applicationId,
    event_type: "APPLICATION_APPLICATION_APPROVED",
    metadata: { applicationId, actorName, actorRole, remark },
    ip_address: ip,
    user_agent: userAgent,
    device_info: deviceInfo,
    created_at: new Date(),
  },
});
```

3) Add event to application-log adapter (if necessary)
- Server adapter: `apps/api/src/modules/activity/adapters/application-log.ts`
- Add the new event_type to `getEventTypes()` if you want adapter filtering to include it.
- Update `buildDescription(eventType, metadata)` to return a human-friendly `activity` string, if desired.

4) If you want UI-specific labels/icons, update the admin UI:
- `apps/admin/src/components/admin-activity-timeline.tsx` maps event types to icons/labels in `getEventIcon`, `getEventLabel`, and `getEventDotColor`.

## How to add a UI mapping for a new event
1. Add a label in `getEventLabel(eventType)` for the new `eventType`.
2. Add a matching icon in `getEventIcon(eventType)` and a color in `getEventDotColor(eventType)`.
3. If the event contains a `remark` or `entityId` in metadata, the "View details" inline panel will show it automatically.

## Pagination & totals
- Current implementation: client fetch returns an array of logs for the application and the UI shows `logs.length` as the badge count.
- If your application can produce many logs, implement server-side pagination at `/v1/applications/:id/logs` and return metadata (total/pagination). Then:
  - Update `useApplicationLogs` to return the paginated envelope.
  - Update the component to render the server-provided total in the badge and show "Load more" controls.

## Example payload (recommended)
- Single log item:

```json
{
  "id": "cui_abc123",
  "event_type": "APPLICATION_APPLICATION_APPROVED",
  "activity": "Application approved",
  "metadata": { "applicationId": "app_123", "actorName": "Jane Doe", "actorRole": "ISSUER_ADMIN", "remark": "All good" },
  "ip_address": "203.0.113.1",
  "created_at": "2026-03-02T08:15:30.000Z"
}
```

## Troubleshooting
- Missing actor name:
  - Ensure `metadata.actorName` is set when creating the log.
- Totals mismatch:
  - If you previously used the aggregated activities endpoint, totals included multiple adapters. The new implementation counts only application logs.
  - For accurate server totals, return pagination metadata from `/v1/applications/:id/logs`.
- Events not visible:
  - Confirm `event_type` is included in the adapter's supported types or that `buildDescription` generates the activity text.

## Security & privacy
- Avoid storing PII in `metadata` unless necessary.
- Mask or avoid exposing user identifiers in UI where not required.

## If you want to re-enable aggregated (organization) events
- Use the aggregated activities endpoint (`/v1/activities`) which merges multiple adapters. Note that counts include all active adapters unless the API is extended to filter by source_table.

