# Admin Activity Timeline — Kid Guide (Very Simple)

Short: remark is top-level. Metadata is free.

1) The rule (one line)
- Always put remarks in the top-level `remark` column.
- Metadata (JSON) is free for other extra info.

2) Why this rule (one line)
- The UI reads `remark` from the top-level field. This keeps things simple and consistent.

3) What one log row must have (simple)
- id — unique id.
- user_id — who did the action.
- application_id — which application.
- event_type — short code like APPLICATION_APPLICATION_APPROVED.
- remark — text note (top-level, REQUIRED if you want a visible remark).
- metadata — free JSON for extra bits (optional).
- created_at — time.

4) Examples (how rows look) — use top-level remark

- Created (no remark)
```json
{
  "id":"c1",
  "user_id":"u1",
  "application_id":"app_123",
  "event_type":"APPLICATION_APPLICATION_CREATED",
  "remark": null,
  "metadata": null,
  "created_at":"2026-03-02T10:00:00Z"
}
```

- Submitted (with remark)
```json
{
  "id":"c2",
  "user_id":"u1",
  "application_id":"app_123",
  "event_type":"APPLICATION_APPLICATION_SUBMITTED",
  "remark": "All documents attached",
  "metadata": { "actorName": "Jane" },
  "created_at":"2026-03-02T10:05:00Z"
}
```

- Approved (note top-level remark)
```json
{
  "id":"c4",
  "user_id":"admin1",
  "application_id":"app_123",
  "event_type":"APPLICATION_APPLICATION_APPROVED",
  "remark": "Approved by Joe",
  "metadata": { "approvedAmount": 10000 },
  "created_at":"2026-03-04T12:00:00Z"
}
```

5) How UI shows the remark (very short)
- UI reads `log.remark` (top-level).
- UI shows "View details" with that text.
- Metadata is not used for the main remark text.

6) Exact files to edit (if you add/change events)
- To create a log (server): apps/api/src/modules/applications/logs/repository.ts
  - Make sure you set `remark: "text"` at top-level in prisma create.
  - You can set `metadata` too, but do not put the main remark there.

- To change how the timeline shows labels/icons: apps/admin/src/components/admin-activity-timeline.tsx
  - `getEventLabel` (add friendly text)
  - `getEventIcon` (pick an icon)
  - `getEventDotColor` (pick a color)

- Adapter (server side): apps/api/src/modules/activity/adapters/application-log.ts
  - Adapter uses top-level `record.remark` when building activity text.
  - Do not rely on metadata.remark here.

7) Exact small change example (server)
- Where: apps/api/src/modules/applications/logs/repository.ts
- Put remark at top-level like this:
```ts
await prisma.applicationLog.create({
  data: {
    id: cuid(),
    user_id: reviewerId,
    application_id: applicationId,
    event_type: "APPLICATION_APPLICATION_FLAGGED",
    remark: "Suspicious documents",
    metadata: { actorName: reviewerName, severity: "high" },
    created_at: new Date(),
  }
});
```

8) Tests to run (tiny)
- Create a log with top-level remark.
- Open application page.
- Click "View details". You should see the remark text.

9) Why this is better (baby words)
- One place for the main note. Easy to find.
- Metadata stays free for extra info like numbers or flags.

If you want, I will:
- Update any server code that still writes remark only into metadata (I can change it to write top-level remark).
- Or keep current code if you already write top-level remark.

DONE

Expanded: Every field in ApplicationLog (very simple)

Here is each field and what it means. Read one line at a time.

- id
  - Unique id for this row. Auto created by the database.

- user_id
  - Who did the action. Use the user's id string.

- application_id
  - Which application the log is about. Put the application id here.

- event_type
  - Short code for the action. Example: APPLICATION_APPLICATION_APPROVED.
  - UI and server use this to know what happened.

- ip_address
  - Optional. Put the IP address of the user or server if you have it.

- user_agent
  - Optional. Browser or client info string.

- device_info
  - Optional. Extra device text (phone model, etc).

- metadata (Json)
  - Free JSON for any extra data you want to store.
  - Use this for non-essential extras (numbers, flags, long objects).
  - Do NOT put the main remark here anymore.

- review_cycle (Int)
  - Optional. Which review round this belongs to (1,2,...).

- level (enum ActivityLevel)
  - One of APPLICATION, TAB, ITEM. Use to say if log is for whole app, a tab, or a specific item.

- target (enum ActivityTarget)
  - One of APPLICATION, FINANCIAL, CONTRACT, INVOICE, SUPPORTING_DOCUMENT.
  - Use to explain what part of the app the action targeted.

- action (enum ActivityAction)
  - One of CREATED, SUBMITTED, RESUBMITTED, APPROVED, REJECTED, REQUESTED_AMENDMENT.
  - This plus level/target builds event_type.

- entity_id
  - Optional id for a related entity (invoice id, document id).

- remark
  - TOP-LEVEL text note. Put the human note here if you want it shown in UI.
  - REQUIRED when you want visible remark in timeline.

- portal
  - Where the action came from: e.g. ISSUER or ADMIN.

- created_at
  - When the log was made.

How to decide where to put new info
- If the info is the main human note that should show in the timeline → put it in top-level `remark`.
- If the info is extra, structured data (numbers, object) → put in `metadata`.
- If the info is important for filters or queries (like section name or tab) → add top-level column (clean) so you can index it.

How to add a new top-level field (step-by-step, exact)
1) Edit Prisma schema
   - File: `apps/api/prisma/schema.prisma`
   - In model `ApplicationLog` add a new field. Example to add `section`:
     `section String?`
   - Save file.
2) Create a migration
   - Run locally: `pnpm -w prisma migrate dev --name add-applicationlog-section`
   - This updates the DB and generates a migration file.
3) Update types for create function
   - File: `apps/api/src/modules/applications/logs/types.ts`
   - Add the new param: `section?: string`
4) Update repository create
   - File: `apps/api/src/modules/applications/logs/repository.ts`
   - Add the field to prisma create: `section: params.section ?? null,`
   - Keep remark at top-level and metadata free.
5) Update adapter transform (so UI can read it)
   - File: `apps/api/src/modules/activity/adapters/application-log.ts`
   - The adapter returns the DB row to the aggregator. Ensure it includes `record.section` in returned unified activity (you can expose as `section: record.section`).
6) Update frontend UI if you want to show it
   - File: `apps/admin/src/components/admin-activity-timeline.tsx`
   - Read `log.section` and render it where you want.
7) Test
   - Create a log with the new field set.
   - Open the app page and verify the UI shows the new value.

Exact small example: add `section`

A) Prisma change (in `model ApplicationLog`):
  - Add line: `section String?`

B) types.ts change:
  - Add `section?: string` to `CreateApplicationLogParams`.

C) repository.ts change:
```ts
await prisma.applicationLog.create({
  data: {
    ...,
    section: params.section ?? null,
    remark: params.remark ?? null,
    metadata: params.metadata ?? null,
  }
});
```

D) adapter change:
  - In transform(...) return `section: record.section` in the unified activity.

E) UI change:
  - In `admin-activity-timeline.tsx` add `log.section` where you want to show it.

If you want, I will make these small code edits for `section` now. Which do you want:
- "add-section" — I will add schema + types + repo + adapter + UI example changes
- "docs-only" — just add more docs and examples (no code)

How LEVEL + TARGET + ACTION make event_type (super simple)

1) What the three words mean (one line each)
- LEVEL: where the action happens. Values: APPLICATION, TAB, ITEM.
- TARGET: what part is affected. Values: APPLICATION, FINANCIAL, CONTRACT, INVOICE, SUPPORTING_DOCUMENT.
- ACTION: what happened. Values: CREATED, SUBMITTED, RESUBMITTED, APPROVED, REJECTED, REQUESTED_AMENDMENT.

2) How they join into event_type
- The server builds one short string by joining them with underscores:
  `${level}_${target}_${action}`
- This is the event_type stored in the DB and used in the UI.

3) Simple examples
- If whole application was submitted:
  - level = APPLICATION
  - target = APPLICATION
  - action = SUBMITTED
  - event_type = APPLICATION_APPLICATION_SUBMITTED

- If invoice item was approved:
  - level = ITEM
  - target = INVOICE
  - action = APPROVED
  - event_type = ITEM_INVOICE_APPROVED

- If supporting document tab was resubmitted:
  - level = TAB
  - target = SUPPORTING_DOCUMENT
  - action = RESUBMITTED
  - event_type = TAB_SUPPORTING_DOCUMENT_RESUBMITTED

4) Where this is created in code (exact file)
- File: `apps/api/src/modules/applications/logs/repository.ts`
- Look for the line that builds event_type:
  ```ts
  event_type: `${params.level ?? ""}_${params.target ?? ""}_${params.action ?? ""}`,
  ```

5) If you want to add a new level/target/action (exact steps)
1. Add new enum value in Prisma schema:
   - File: `apps/api/prisma/schema.prisma`
   - Edit the enum (ActivityLevel / ActivityTarget / ActivityAction) and add the value.
2. Run migration:
   - `pnpm -w prisma migrate dev --name add-new-activity-value`
3. Update server types:
   - File: `apps/api/src/modules/applications/logs/types.ts` — add new value to the enum type if duplicated here.
4. Update any code that builds or expects event_type:
   - Repository: `apps/api/src/modules/applications/logs/repository.ts` (nothing needed if you use params)
   - Adapter: `apps/api/src/modules/activity/adapters/application-log.ts` — ensure `getEventTypes()` returns any new event strings you want to allow, or handle in `buildDescription`.
5. Update UI mapping (labels/icons/colors):
   - File: `apps/admin/src/components/admin-activity-timeline.tsx`
   - Add friendly label in `getEventLabel`, icon in `getEventIcon`, and color in `getEventDotColor`.
6. Test end-to-end: create a log, open app page, check timeline.

6) Why this pattern is good (simple)
- It keeps event names consistent and machine readable.
- The UI can switch labels/icons based on event_type only.

If you want I can add one example now:
- "add-LEVEL_TAB_TARGET_SUPPORTING_DOCUMENT" — I can add schema + types + repo + adapter + UI examples for a sample new value.

