#!/usr/bin/env tsx
/**
 * Remove spurious "Acceptance Section Reset to Pending" activity rows.
 *
 * A bug logged SECTION_REVIEWED_PENDING (acceptance_documents, APPROVED -> PENDING) every time an
 * admin approved a supporting document after the offer had been accepted. A row is selected only
 * when all four conditions hold:
 *   1. It is an admin-attributed SECTION_REVIEWED_PENDING row for the acceptance_documents section
 *      with old_status APPROVED.
 *   2. The application's first offer acceptance was logged strictly before the row.
 *   3. The application's offer is still accepted now.
 *   4. The same admin logged an ITEM_REVIEWED_* row on the same application for a non-acceptance
 *      item (scope_key not starting with `acceptance_documents:` or `authorized_representatives`)
 *      within 5 s before the row, inclusive. This keeps deliberate admin resets of the section.
 *
 * Usage:
 *   pnpm --filter @cashsouk/api cleanup-spurious-acceptance-reset-logs
 *   pnpm --filter @cashsouk/api cleanup-spurious-acceptance-reset-logs -- --apply
 *
 * Dry run is the default. Pass --allow-production as well when NODE_ENV=production.
 */

import "dotenv/config";
import { ContractStatus, InvoiceStatus, type Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { ActivityPortal, ApplicationLogEventType } from "../src/modules/applications/logs/types";
import {
  SIBLING_ITEM_WINDOW_MS,
  selectSpuriousAcceptanceResets,
  type SiblingItemLog,
  type SpuriousResetCandidate,
} from "../src/modules/applications/logs/spurious-acceptance-reset-selection";

const CANDIDATE_CAP = 5000;
const SIBLING_ITEM_LOG_CAP = 20000;
const ITEM_REVIEWED_EVENT_PREFIX = "ITEM_REVIEWED_";
const ACCEPTANCE_SCOPE_KEY = "acceptance_documents";
const OFFER_ACCEPTED_EVENTS: string[] = [
  ApplicationLogEventType.CONTRACT_OFFER_ACCEPTED,
  ApplicationLogEventType.INVOICE_OFFER_ACCEPTED,
];

const apply = process.argv.includes("--apply");
const allowProduction = process.argv.includes("--allow-production");

type AppSummary = { displayReference: string | null; offerAcceptedNow: boolean };

async function loadCandidateLogs(): Promise<SpuriousResetCandidate[]> {
  const rows = await prisma.applicationLog.findMany({
    where: {
      event_type: ApplicationLogEventType.SECTION_REVIEWED_PENDING,
      portal: ActivityPortal.ADMIN,
      user_id: { not: null },
      application_id: { not: null },
      AND: [
        { metadata: { path: ["scope"], equals: "section" } },
        { metadata: { path: ["scope_key"], equals: ACCEPTANCE_SCOPE_KEY } },
        { metadata: { path: ["old_status"], equals: "APPROVED" } },
      ],
    },
    select: { id: true, application_id: true, user_id: true, created_at: true },
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    take: CANDIDATE_CAP,
  });
  return rows.flatMap((row) =>
    row.application_id && row.user_id
      ? [
          {
            id: row.id,
            application_id: row.application_id,
            user_id: row.user_id,
            created_at: row.created_at,
          },
        ]
      : []
  );
}

function readScopeKey(metadata: Prisma.JsonValue | null): string | null {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return null;
  const scopeKey = metadata.scope_key;
  return typeof scopeKey === "string" ? scopeKey : null;
}

/** Admin item-review rows on the candidate applications (one query bounded by `take`). */
/** Sibling item reviews, bounded by the candidate ids and by the candidates' time span. */
async function loadSiblingItemLogs(
  applicationIds: string[],
  candidates: readonly SpuriousResetCandidate[]
): Promise<SiblingItemLog[]> {
  const times = candidates.map((row) => row.created_at.getTime());
  const rows = await prisma.applicationLog.findMany({
    where: {
      event_type: { startsWith: ITEM_REVIEWED_EVENT_PREFIX },
      application_id: { in: applicationIds },
      user_id: { not: null },
      created_at: {
        gte: new Date(Math.min(...times) - SIBLING_ITEM_WINDOW_MS),
        lte: new Date(Math.max(...times)),
      },
    },
    select: { application_id: true, user_id: true, created_at: true, metadata: true },
    orderBy: { created_at: "asc" },
    take: SIBLING_ITEM_LOG_CAP,
  });
  if (rows.length === SIBLING_ITEM_LOG_CAP) {
    console.log(
      `Sibling item log cap of ${SIBLING_ITEM_LOG_CAP} rows was hit. Candidates whose only matching item review falls past the cap are not selected.`
    );
  }
  return rows.flatMap((row) =>
    row.application_id && row.user_id
      ? [
          {
            application_id: row.application_id,
            user_id: row.user_id,
            created_at: row.created_at,
            scopeKey: readScopeKey(row.metadata),
          },
        ]
      : []
  );
}

/** Earliest offer-accepted log per application (one grouped query bounded by the id list). */
async function loadFirstOfferAcceptedAt(applicationIds: string[]): Promise<Map<string, Date>> {
  const groups = await prisma.applicationLog.groupBy({
    by: ["application_id"],
    where: { application_id: { in: applicationIds }, event_type: { in: OFFER_ACCEPTED_EVENTS } },
    _min: { created_at: true },
  });
  const result = new Map<string, Date>();
  for (const group of groups) {
    const firstAcceptedAt = group._min.created_at;
    if (group.application_id && firstAcceptedAt) {
      result.set(group.application_id, firstAcceptedAt);
    }
  }
  return result;
}

async function loadApplicationSummaries(
  applicationIds: string[]
): Promise<Map<string, AppSummary>> {
  const apps = await prisma.application.findMany({
    where: { id: { in: applicationIds } },
    select: {
      id: true,
      display_reference: true,
      contract: { select: { status: true } },
      invoices: {
        where: {
          status: InvoiceStatus.APPROVED,
          OR: [{ contract_id: null }, { contract_id: "" }],
        },
        select: { id: true },
        take: 1,
      },
    },
  });
  return new Map(
    apps.map((app) => [
      app.id,
      {
        displayReference: app.display_reference,
        offerAcceptedNow:
          app.contract?.status === ContractStatus.APPROVED || app.invoices.length > 0,
      },
    ])
  );
}

function offerAcceptedNowByApplication(summaries: Map<string, AppSummary>): Map<string, boolean> {
  return new Map(
    [...summaries].map(([applicationId, summary]) => [applicationId, summary.offerAcceptedNow])
  );
}

function printReport(rows: SpuriousResetCandidate[], summaries: Map<string, AppSummary>): void {
  const byApplication = new Map<string, SpuriousResetCandidate[]>();
  for (const row of rows) {
    const list = byApplication.get(row.application_id) ?? [];
    list.push(row);
    byApplication.set(row.application_id, list);
  }
  for (const [applicationId, list] of byApplication) {
    const reference = summaries.get(applicationId)?.displayReference ?? "-";
    const first = list[0].created_at.toISOString();
    const last = list[list.length - 1].created_at.toISOString();
    console.log(
      `${applicationId}  ${reference}  count=${list.length}  first=${first}  last=${last}`
    );
  }
  console.log(`Total candidates: ${rows.length}`);
}

async function deleteRows(ids: string[]): Promise<number> {
  const result = await prisma.applicationLog.deleteMany({ where: { id: { in: ids } } });
  return result.count;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production" && !allowProduction) {
    console.error("NODE_ENV is production. Re-run with --allow-production to proceed.");
    process.exit(1);
  }

  const candidates = await loadCandidateLogs();
  if (candidates.length === CANDIDATE_CAP) {
    console.log(
      `Candidate cap of ${CANDIDATE_CAP} rows was hit. Rows the conditions exclude keep occupying the cap, so re-run after applying and raise CANDIDATE_CAP if the total does not shrink.`
    );
  }

  const applicationIds = [...new Set(candidates.map((row) => row.application_id))];
  const [firstAcceptedAt, summaries, siblingItemLogs] =
    applicationIds.length > 0
      ? await Promise.all([
          loadFirstOfferAcceptedAt(applicationIds),
          loadApplicationSummaries(applicationIds),
          loadSiblingItemLogs(applicationIds, candidates),
        ])
      : [new Map<string, Date>(), new Map<string, AppSummary>(), []];

  const spurious = selectSpuriousAcceptanceResets({
    candidates,
    firstOfferAcceptedAt: firstAcceptedAt,
    offerAcceptedNow: offerAcceptedNowByApplication(summaries),
    siblingItemLogs,
  });
  printReport(spurious, summaries);

  if (!apply) {
    console.log(
      "Dry run: no rows were deleted. Re-run with `-- --apply` to delete the rows listed above."
    );
    return;
  }
  if (spurious.length === 0) {
    console.log("Deleted 0 rows");
    return;
  }
  const deleted = await deleteRows(spurious.map((row) => row.id));
  console.log(`Deleted ${deleted} rows`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
