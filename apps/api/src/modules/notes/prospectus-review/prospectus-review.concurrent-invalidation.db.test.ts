/**
 * SECTION: Source-drift invalidation on GET is exactly-once under concurrency (local DB)
 * WHY: The admin UI fires two GETs at once. When both load the approved row and both see a
 * fingerprint mismatch, only one may invalidate: one status change, content_version + 1 and one
 * audit pair. The other must leave the row alone and answer with the row as it now is.
 * Financial sources cannot drift any more (the Prospectus reads the Note financial snapshot), so
 * the genuine change here is a Note identity field (the title) that the fingerprint covers.
 */

import { randomBytes } from "node:crypto";
import { ProspectusReviewStatus } from "@prisma/client";
import {
  buildProspectusDemoCtosFinancials,
  buildProspectusDemoFinancialStatements,
} from "../../../../scripts/seed-prospectus-review-note";
import { prisma } from "../../../lib/prisma";
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
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import { prospectusReviewService } from "./prospectus-review.service";

const INVALIDATED_SOURCE = "PROSPECTUS_APPROVAL_INVALIDATED_SOURCE";
const INVALIDATED_EDIT = "PROSPECTUS_APPROVAL_INVALIDATED_EDIT";
const CONCURRENT_ROUNDS = 5;
const DB_TEST_TIMEOUT_MS = 120_000;

/** Genuine source change: a Note identity field the render fingerprint covers. */
async function changeNoteIdentity(graph: IsolatedProspectusNoteGraph): Promise<void> {
  await prisma.note.update({
    where: { id: graph.noteId },
    data: { title: `Prospectus DB Test — ${graph.noteReference} — ${randomBytes(4).toString("hex")}` },
  });
}

describe("prospectus GET source-drift invalidation under concurrency (local DB)", () => {
  const graphs: IsolatedProspectusNoteGraph[] = [];
  let actor: ProspectusTestActor;

  /** Snapshot-backed graph approved to READY_FOR_PUBLISH. */
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

  it(
    "G24: invalidates exactly once when two GETs race after a genuine source change",
    async () => {
      const graph = await seedAndApprove("concurrent_get");

      for (let round = 1; round <= CONCURRENT_ROUNDS; round += 1) {
        if (round > 1) {
          const reapproved = await approveProspectus(graph, actor);
          expect(reapproved.status).toBe(ProspectusReviewStatus.READY_FOR_PUBLISH);
        }
        const approvedRow = await readProspectusReviewRow(graph);
        expect(approvedRow.status).toBe(ProspectusReviewStatus.READY_FOR_PUBLISH);

        await changeNoteIdentity(graph);
        const [first, second] = await Promise.all([
          prospectusReviewService.getOrCreateReview(graph.noteId, actor),
          prospectusReviewService.getOrCreateReview(graph.noteId, actor),
        ]);

        const afterRow = await readProspectusReviewRow(graph);
        expect({ round, status: afterRow.status }).toEqual({
          round,
          status: ProspectusReviewStatus.DRAFT,
        });
        expect({ round, contentVersion: afterRow.content_version }).toEqual({
          round,
          contentVersion: approvedRow.content_version + 1,
        });
        expect(afterRow.render_fingerprint).toBeNull();
        expect({ round, audit: await countProspectusAuditEntries(graph, INVALIDATED_SOURCE) }).toEqual({
          round,
          audit: { adminActions: round, events: round },
        });

        for (const response of [first, second]) {
          expect(response.review.status).toBe(ProspectusReviewStatus.DRAFT);
          expect(response.review.contentVersion).toBe(afterRow.content_version);
          expect(response.review.updatedAt).toBe(afterRow.updated_at.toISOString());
        }
      }
    },
    DB_TEST_TIMEOUT_MS
  );

  it(
    "invalidates once when two GETs run one after the other after a genuine change",
    async () => {
      const graph = await seedAndApprove("sequential_get");
      const approvedRow = await readProspectusReviewRow(graph);

      await changeNoteIdentity(graph);
      const first = await prospectusReviewService.getOrCreateReview(graph.noteId, actor);
      const second = await prospectusReviewService.getOrCreateReview(graph.noteId, actor);

      const afterRow = await readProspectusReviewRow(graph);
      expect(afterRow.status).toBe(ProspectusReviewStatus.DRAFT);
      expect(afterRow.content_version).toBe(approvedRow.content_version + 1);
      expect(await countProspectusAuditEntries(graph, INVALIDATED_SOURCE)).toEqual({
        adminActions: 1,
        events: 1,
      });
      expect(first.review.status).toBe(ProspectusReviewStatus.DRAFT);
      expect(second.review.status).toBe(ProspectusReviewStatus.DRAFT);
      expect(first.review.contentVersion).toBe(afterRow.content_version);
      expect(second.review.contentVersion).toBe(afterRow.content_version);
    },
    DB_TEST_TIMEOUT_MS
  );

  it(
    "does not suppress a genuine invalidation on a single GET",
    async () => {
      const graph = await seedAndApprove("single_get");
      const approvedRow = await readProspectusReviewRow(graph);

      await changeNoteIdentity(graph);
      const get = await prospectusReviewService.getOrCreateReview(graph.noteId, actor);

      const afterRow = await readProspectusReviewRow(graph);
      expect(get.review.status).toBe(ProspectusReviewStatus.DRAFT);
      expect(get.review.contentVersion).toBe(approvedRow.content_version + 1);
      expect(afterRow.status).toBe(ProspectusReviewStatus.DRAFT);
      expect(afterRow.content_version).toBe(approvedRow.content_version + 1);
      expect(afterRow.approved_content).toBeNull();
      expect(afterRow.approved_snapshot).toBeNull();
      expect(afterRow.approved_publication_id).toBeNull();
      expect(afterRow.approved_at).toBeNull();
      expect(afterRow.approved_by_user_id).toBeNull();
      expect(afterRow.render_fingerprint).toBeNull();
      expect(afterRow.updated_by_user_id).toBe(actor.userId);
      // updated_at is the save/approve optimistic-lock token; the guarded write must still move it.
      expect(afterRow.updated_at.getTime()).toBeGreaterThan(approvedRow.updated_at.getTime());
      expect(get.review.updatedAt).toBe(afterRow.updated_at.toISOString());
      expect(await countProspectusAuditEntries(graph, INVALIDATED_SOURCE)).toEqual({
        adminActions: 1,
        events: 1,
      });
    },
    DB_TEST_TIMEOUT_MS
  );

  it(
    "leaves an approval with unchanged sources untouched under concurrent GETs",
    async () => {
      const graph = await seedAndApprove("concurrent_noop");
      const approvedRow = await readProspectusReviewRow(graph);

      const responses = await Promise.all([
        prospectusReviewService.getOrCreateReview(graph.noteId, actor),
        prospectusReviewService.getOrCreateReview(graph.noteId, actor),
      ]);

      const afterRow = await readProspectusReviewRow(graph);
      expect(afterRow.status).toBe(approvedRow.status);
      expect(afterRow.content_version).toBe(approvedRow.content_version);
      expect(afterRow.updated_at.getTime()).toBe(approvedRow.updated_at.getTime());
      expect(afterRow.render_fingerprint).toBe(approvedRow.render_fingerprint);
      expect(await countProspectusAuditEntries(graph, INVALIDATED_SOURCE)).toEqual({
        adminActions: 0,
        events: 0,
      });
      for (const response of responses) {
        expect(response.review.status).toBe(ProspectusReviewStatus.READY_FOR_PUBLISH);
        expect(response.review.contentVersion).toBe(approvedRow.content_version);
      }
    },
    DB_TEST_TIMEOUT_MS
  );

  it(
    "keeps the save path invalidating an approved review on a content edit",
    async () => {
      const graph = await seedAndApprove("save_edit");
      const approvedRow = await readProspectusReviewRow(graph);

      const edited = buildCompleteProspectusReviewDraft();
      edited.page2.issuerProfile = { ...edited.page2.issuerProfile, companySize: "Small" };
      const saved = await prospectusReviewService.saveDraft(
        graph.noteId,
        { draftContent: edited, expectedUpdatedAt: approvedRow.updated_at.toISOString() },
        actor
      );

      const afterRow = await readProspectusReviewRow(graph);
      expect(saved.status).toBe(ProspectusReviewStatus.DRAFT);
      expect(afterRow.status).toBe(ProspectusReviewStatus.DRAFT);
      expect(afterRow.content_version).toBe(approvedRow.content_version + 1);
      expect(afterRow.render_fingerprint).toBeNull();
      expect(afterRow.approved_content).toBeNull();
      expect(
        (afterRow.draft_content as { page2: { issuerProfile: { companySize: string } } }).page2
          .issuerProfile.companySize
      ).toBe("Small");
      expect(await countProspectusAuditEntries(graph, INVALIDATED_EDIT)).toEqual({
        adminActions: 1,
        events: 1,
      });
      expect(await countProspectusAuditEntries(graph, INVALIDATED_SOURCE)).toEqual({
        adminActions: 0,
        events: 0,
      });
    },
    DB_TEST_TIMEOUT_MS
  );
});
