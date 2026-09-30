/**
 * SECTION: Approve → stored snapshot → GET keeps approval (local DB)
 * WHY: Prisma Json columns round 17-significant-digit numbers to 16 on write. The approval
 * fingerprint must be computed from the exact page_1 / page_2 that survive storage, or the next
 * GET recomputes a different hash and resets READY_FOR_PUBLISH to DRAFT.
 */

import { ProspectusReviewStatus } from "@prisma/client";
import {
  buildProspectusDemoCtosFinancials,
  buildProspectusDemoFinancialStatements,
} from "../../../../scripts/seed-prospectus-review-note";
import { prisma } from "../../../lib/prisma";
import { buildProspectusPage2Snapshot } from "../prospectus/prospectus-page-two-snapshot";
import {
  buildCompleteApprovedProspectusSnapshot,
  computeCurrentRenderFingerprint,
  hashDraftContent,
  hashProspectusFingerprint,
  loadProspectusNoteIdentityFreeze,
  parseApprovedSnapshot,
  type ProspectusApprovedSnapshot,
} from "./prospectus-approved-snapshot";
import type { ProspectusReviewStoredContent } from "./prospectus-review-content";
import {
  approveProspectus,
  cleanupIsolatedProspectusNote,
  countProspectusAuditEntries,
  getProspectusTestActor,
  makeProspectusDraftApprovable,
  readProspectusReviewRow,
  seedIsolatedProspectusNote,
  type IsolatedProspectusNoteGraph,
  type ProspectusTestActor,
} from "./prospectus-review.db-test-support";
import { prospectusReviewService } from "./prospectus-review.service";

const INVALIDATED_SOURCE = "PROSPECTUS_APPROVAL_INVALIDATED_SOURCE";

function significantDigits(n: number): number {
  const [mantissa] = Math.abs(n).toExponential().split("e");
  return mantissa!.replace(".", "").length;
}

/** Every finite number whose shortest round-trip form needs 17 significant digits. */
function seventeenDigitNumbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === "number") {
    if (Number.isFinite(value) && significantDigits(value) >= 17) out.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => seventeenDigitNumbers(item, out));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => seventeenDigitNumbers(item, out));
  }
  return out;
}

function storedSnapshot(value: unknown): ProspectusApprovedSnapshot {
  const snapshot = parseApprovedSnapshot(value);
  if (!snapshot) throw new Error("approved_snapshot missing or malformed");
  return snapshot;
}

describe("prospectus approve storage round-trip (local DB)", () => {
  const graphs: IsolatedProspectusNoteGraph[] = [];
  let actor: ProspectusTestActor;

  async function seedAndApprove(label: string): Promise<IsolatedProspectusNoteGraph> {
    const graph = await seedIsolatedProspectusNote({
      label,
      financialStatements: buildProspectusDemoFinancialStatements(),
      ctosFinancials: buildProspectusDemoCtosFinancials(),
    });
    graphs.push(graph);
    await makeProspectusDraftApprovable(graph, actor);
    const approved = await approveProspectus(graph, actor);
    expect(approved.status).toBe(ProspectusReviewStatus.READY_FOR_PUBLISH);
    return graph;
  }

  beforeAll(async () => {
    actor = await getProspectusTestActor();
  });

  afterAll(async () => {
    for (const graph of graphs) {
      await cleanupIsolatedProspectusNote(graph);
    }
    await prisma.$disconnect();
  });

  it("keeps READY_FOR_PUBLISH across repeated GETs after approve", async () => {
    const graph = await seedAndApprove("approve_get");

    // Guard: the fixture must still produce numbers Prisma Json rounds, or this test stops covering the bug.
    const { financialStatements, ctosFinancials, financialReferenceDate } =
      await loadProspectusNoteIdentityFreeze(graph.noteId);
    const rawPage2 = buildProspectusPage2Snapshot({
      financialStatements,
      ctosFinancials,
      referenceDate: financialReferenceDate,
    });
    expect(seventeenDigitNumbers(rawPage2).length).toBeGreaterThan(0);

    const approvedRow = await readProspectusReviewRow(graph);
    expect(approvedRow.status).toBe(ProspectusReviewStatus.READY_FOR_PUBLISH);
    const snapshot = storedSnapshot(approvedRow.approved_snapshot);
    expect(seventeenDigitNumbers(snapshot.page_2)).toEqual([]);

    const freshFingerprint = await computeCurrentRenderFingerprint({
      noteId: graph.noteId,
      approvedContent: approvedRow.approved_content as unknown as ProspectusReviewStoredContent,
      approvedSnapshot: snapshot,
    });
    expect(freshFingerprint).toBe(approvedRow.render_fingerprint);

    const firstGet = await prospectusReviewService.getOrCreateReview(graph.noteId, actor);
    const secondGet = await prospectusReviewService.getOrCreateReview(graph.noteId, actor);
    for (const get of [firstGet, secondGet]) {
      expect(get.review.status).toBe(ProspectusReviewStatus.READY_FOR_PUBLISH);
      expect(get.review.contentVersion).toBe(approvedRow.content_version);
    }

    const afterRow = await readProspectusReviewRow(graph);
    expect(afterRow.status).toBe(ProspectusReviewStatus.READY_FOR_PUBLISH);
    expect(afterRow.content_version).toBe(approvedRow.content_version);
    expect(afterRow.render_fingerprint).toBe(approvedRow.render_fingerprint);
    expect(await countProspectusAuditEntries(graph, INVALIDATED_SOURCE)).toEqual({
      adminActions: 0,
      events: 0,
    });
  });

  it("still invalidates the approval when a real financial source amount changes", async () => {
    const graph = await seedAndApprove("approve_source_change");
    const approvedRow = await readProspectusReviewRow(graph);

    const application = await prisma.application.findUniqueOrThrow({
      where: { id: graph.applicationId },
      select: { financial_statements: true },
    });
    const statements = application.financial_statements as {
      unaudited_by_year: Record<string, Record<string, unknown>>;
    };
    const newestYear = Object.keys(statements.unaudited_by_year).sort().at(-1)!;
    const block = statements.unaudited_by_year[newestYear]!;
    await prisma.application.update({
      where: { id: graph.applicationId },
      data: {
        financial_statements: {
          ...statements,
          unaudited_by_year: {
            ...statements.unaudited_by_year,
            [newestYear]: { ...block, turnover: Number(block.turnover) + 1_000 },
          },
        },
      },
    });

    const get = await prospectusReviewService.getOrCreateReview(graph.noteId, actor);
    expect(get.review.status).toBe(ProspectusReviewStatus.DRAFT);

    const afterRow = await readProspectusReviewRow(graph);
    expect(afterRow.status).toBe(ProspectusReviewStatus.DRAFT);
    expect(afterRow.render_fingerprint).toBeNull();
    expect(afterRow.content_version).toBe(approvedRow.content_version + 1);
    expect(await countProspectusAuditEntries(graph, INVALIDATED_SOURCE)).toEqual({
      adminActions: 1,
      events: 1,
    });
  });

  it("stores exactly the page_1 / page_2 that were hashed at approve", async () => {
    const graph = await seedAndApprove("approve_storage_exact");
    const row = await readProspectusReviewRow(graph);
    const stored = storedSnapshot(row.approved_snapshot);
    const approvedContent = row.approved_content as unknown as ProspectusReviewStoredContent;

    // Deterministic rebuild with approve's inputs reproduces the in-memory approval objects.
    const rebuilt = await buildCompleteApprovedProspectusSnapshot({
      noteId: graph.noteId,
      publicationId: row.approved_publication_id!,
      contentVersion: row.content_version,
      approvedContent,
      approvedAt: row.approved_at!,
      approvedByUserId: row.approved_by_user_id!,
      optionCatalogueVersion: row.option_catalogue_version,
    });
    expect(rebuilt.render_fingerprint).toBe(row.render_fingerprint);
    expect(hashProspectusFingerprint(stored.page_1)).toBe(hashProspectusFingerprint(rebuilt.page_1));
    expect(hashProspectusFingerprint(stored.page_2)).toBe(hashProspectusFingerprint(rebuilt.page_2));
    expect(stored.page_2).toEqual(rebuilt.page_2);

    const { fingerprintSource } = await loadProspectusNoteIdentityFreeze(graph.noteId);
    const fromStored = hashProspectusFingerprint({
      draft: hashDraftContent(approvedContent),
      sources: fingerprintSource,
      page_1: stored.page_1,
      page_2: stored.page_2,
    });
    expect(fromStored).toBe(row.render_fingerprint);

    const publication = await prisma.noteProspectusPublication.findUniqueOrThrow({
      where: { id: row.approved_publication_id! },
      select: { snapshot: true, render_fingerprint: true },
    });
    const published = storedSnapshot(publication.snapshot);
    expect(publication.render_fingerprint).toBe(row.render_fingerprint);
    expect(hashProspectusFingerprint(published.page_2)).toBe(
      hashProspectusFingerprint(rebuilt.page_2)
    );
  });
});
