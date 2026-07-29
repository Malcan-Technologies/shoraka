# Prospectus Review — local product-review guide

Dev-only walkthrough for boss/product review of the pre-marketplace Prospectus Review workflow.

## Seed command

```bash
pnpm seed:prospectus-review
# or
pnpm --filter @cashsouk/api seed:prospectus-review
```

Idempotent. Stable Note reference: `PROSPECTUS-DEMO-001`.  
Resets the Note to unpublished `DRAFT` and removes any prior review/publish state.

### Full lifecycle scenarios (recommended for UAT)

```bash
pnpm --filter @cashsouk/api seed:prospectus-lifecycle
```

Creates Notes `SEED-PROSPECTUS-01` … `09` plus FY display variants.  
Most useful for manual UI: **`SEED-PROSPECTUS-04-READY-APPROVE`** (complete draft — click Approve yourself).

Approve/PDF/publish/invest stages need Playwright Chromium + private S3 (API Docker image).  
If Chromium libs are missing locally, scenarios 05–09 still leave a complete draft; or set `SEED_PROSPECTUS_SKIP_APPROVE=1`.

Blocked in production. Idempotent. Does not invent `pdf_generation_status=READY` without a real PDF.

## Automated product E2E (API layer)

```bash
pnpm --filter @cashsouk/api prospectus-review:product-e2e
```

Walks: seed → lazy review → save → concurrency conflict → submit → draft preview → approve → approved preview → publish → freeze/stability → reopen blocked.

## HTTP smoke (running API + DISABLE_AUTH)

```bash
# Terminal A
DISABLE_AUTH=true NODE_ENV=development pnpm --filter @cashsouk/api dev

# Terminal B
pnpm --filter @cashsouk/api prospectus-review:http-smoke
```

Uses `LOCAL_API_URL` (default `http://127.0.0.1:4000`). Does not use tunnel `API_URL` from `.env`.

## Required services

1. PostgreSQL (local)
2. API: `pnpm --filter @cashsouk/api dev`
3. Admin: `pnpm --filter @cashsouk/admin dev`

Confirm API health: `GET http://localhost:4000/healthz`  
Admin: `http://localhost:3003`

## Admin account convention

Use the local SUPER_ADMIN Cognito user created by `pnpm --filter @cashsouk/api prisma:seed`.  
Do not commit or paste passwords into docs.

## Routes

| Item | Value |
| --- | --- |
| Note ID | `seed_prospectus_demo_note_001` |
| Reference | `PROSPECTUS-DEMO-001` |
| Note detail | `/notes/seed_prospectus_demo_note_001` |
| Prospectus Review | `/notes/seed_prospectus_demo_note_001/prospectus` |

## Expected statuses

| Step | Review status | Note status |
| --- | --- | --- |
| After seed | _(no review row)_ | `DRAFT` |
| Open Prospectus Review | `DRAFT` (lazy create) | `DRAFT` |
| Save Draft | `DRAFT` | `DRAFT` |
| Submit for Review | `READY_FOR_REVIEW` | `DRAFT` |
| Approve | `APPROVED` | `DRAFT` |
| Publish | `APPROVED` | `PUBLISHED` |

Publish is blocked until review is `APPROVED`.

## Manual browser checklist

1. Seed Note (`pnpm seed:prospectus-review`).
2. Sign in to admin; open Note detail → **Open Prospectus Review**.
3. Confirm 7 steps, temporary catalogue notice, empty selections (not pre-approved).
4. Fill Page 1–3 dropdowns + paymaster track record + manual financials (use placeholder options; Credit Insights requires five real assessment values).
5. **Save Draft** → reload → values persist; status stays `DRAFT`.
6. Open two tabs → save A → stale save B → conflict + refresh prompt.
7. **Submit for Review** → status `READY_FOR_REVIEW`; publish from Note detail still blocked.
8. Preview → draft banner; no issuer name/registration; Shariah badge present; no Source Statement / Shared Footer.
9. **Approve** → status `APPROVED`; preview source = Approved; editing requires Reopen.
10. **Publish** from Note detail → succeeds.
11. Confirm DB `prospectus_snapshot.publication_content` has keys + `resolvedPublicationContent`.
12. Attempt Reopen → blocked with amendment message.

## Preview checks

- Closing Date from `note_listings.closes_at`
- Expected Return via portal net-return helper
- Issuer identity hidden
- Shared Shariah badge visible
- Source Statement / Shared Footer absent
- Manual paymaster + financial values render
- No raw option keys / JSON / CTOS payloads

## Publication checks

- Note + listing published timestamps
- Frozen page_1 / page_2 + `publication_content`
- Resolved wording frozen (stable if catalogue later changes)
- No Application/CTOS raw objects in freeze

## Cleanup / reset

```bash
pnpm seed:prospectus-review
```

Re-seeds and resets the demo Note to a clean unpublished draft.

## Known placeholder wording

Catalogue version `2026.07.19.placeholder.v1`. Labels say “Placeholder — …”. Not legally approved copy. Admin shows a temporary-catalogue notice.

## Remaining product decisions

- Final dropdown legal wording
- Whether edit + approve need separation of duties
- When amendment/`SUPERSEDED` flow ships
- Whether Step 0 should show live read-only field values (vs explanatory copy)
- Company Size remains unresolved (`—`) by current portal rules
