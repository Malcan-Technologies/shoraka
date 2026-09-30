/**
 * SECTION: Approved Prospectus renders from its freeze (local DB)
 * WHY: After approval nothing re-resolves sources or years. Approve stores HTML rendered from
 * the stored page_2; GET / preview of a version-2 approval and publish finalization read the
 * approved snapshot only (no application / CTOS read, no live Page 2 / Page 3 resolution).
 */

import { Prisma, ProspectusReviewStatus } from "@prisma/client";
import {
  buildProspectusDemoCtosFinancials,
  buildProspectusDemoFinancialStatements,
} from "../../../../scripts/seed-prospectus-review-note";
import { prisma } from "../../../lib/prisma";
import * as ownedCtosModule from "../../applications/application-owned-ctos";
import { toAdminFinancialComparisonTable } from "../prospectus/prospectus-financial-comparison-metrics";
import * as sourceModule from "../prospectus/prospectus-financial-comparison-source";
import * as pageThreePrismaModule from "../prospectus/prospectus-page-three-prisma";
import * as pageTwoPrismaModule from "../prospectus/prospectus-page-two-prisma";
import {
  buildApprovedFinancialPages,
  parseApprovedFinancialFreeze,
  renderApprovedFinancialPagesHtml,
} from "./prospectus-approved-render";
import {
  computeCurrentRenderFingerprint,
  hashProspectusFingerprint,
  parseApprovedSnapshot,
  type ProspectusApprovedSnapshot,
} from "./prospectus-approved-snapshot";
import {
  toProspectusPublicationContent,
  type ProspectusReviewStoredContent,
} from "./prospectus-review-content";
import {
  approveProspectus,
  cleanupIsolatedProspectusNote,
  getProspectusTestActor,
  makeProspectusDraftApprovable,
  readProspectusReviewRow,
  seedIsolatedProspectusNote,
  writeProspectusNoteFinancialSnapshot,
  type IsolatedProspectusNoteGraph,
  type ProspectusTestActor,
} from "./prospectus-review.db-test-support";
import { prospectusReviewService } from "./prospectus-review.service";

// Final PDF rendering / S3 upload is not under test; the HTML handed to it is.
jest.mock("../prospectus/prospectus-pdf", () => ({
  ...jest.requireActual("../prospectus/prospectus-pdf"),
  generateAndStoreProspectusPdf: jest.fn(async () => ({
    storageBucket: "dbtest-bucket",
    storageKey: "dbtest-key",
    contentType: "application/pdf",
    sizeBytes: 1,
    sha256: "a".repeat(64),
    generatedAt: new Date(),
    generationStatus: "READY",
    snapshotHash: "dbtest",
    pageCount: 5,
  })),
}));

type ReviewRow = Awaited<ReturnType<typeof readProspectusReviewRow>>;

function storedSnapshot(row: ReviewRow): ProspectusApprovedSnapshot {
  const snapshot = parseApprovedSnapshot(row.approved_snapshot);
  if (!snapshot) throw new Error("approved_snapshot missing or malformed");
  return snapshot;
}

function approvedPublication(row: ReviewRow) {
  return toProspectusPublicationContent(
    row.approved_content as unknown as ProspectusReviewStoredContent
  );
}

function withoutBanner(html: string): string {
  return html.replace(/^<div data-prospectus-preview-banner="[^"]*"[^>]*>[^<]*<\/div>/, "");
}

/** Spies on every live financial read and on source / year selection. */
function spyOnLiveFinancialReads() {
  const spies = {
    applicationFindUnique: jest.spyOn(prisma.application, "findUnique"),
    ctosFindFirst: jest.spyOn(prisma.ctosReport, "findFirst"),
    ownedCtos: jest.spyOn(ownedCtosModule, "loadApplicationOwnedCtosFinancialReport"),
    resolver: jest.spyOn(sourceModule, "buildProspectusFinancialComparisonSource"),
    pageTwoLiveLoad: jest.spyOn(pageTwoPrismaModule, "loadProspectusPageTwoData"),
    pageThreeLiveLoad: jest.spyOn(pageThreePrismaModule, "loadProspectusPageThreeData"),
  };
  return {
    spies,
    callCounts: () =>
      Object.fromEntries(Object.entries(spies).map(([name, spy]) => [name, spy.mock.calls.length])),
    restore: () => Object.values(spies).forEach((spy) => spy.mockRestore()),
  };
}

const NO_LIVE_READS = {
  applicationFindUnique: 0,
  ctosFindFirst: 0,
  ownedCtos: 0,
  resolver: 0,
  pageTwoLiveLoad: 0,
  pageThreeLiveLoad: 0,
};

describe("approved Prospectus renders from its freeze (local DB)", () => {
  const graphs: IsolatedProspectusNoteGraph[] = [];
  let actor: ProspectusTestActor;

  async function seedApprovedNote(label: string): Promise<IsolatedProspectusNoteGraph> {
    const graph = await seedIsolatedProspectusNote({
      label,
      financialStatements: buildProspectusDemoFinancialStatements(),
      ctosFinancials: buildProspectusDemoCtosFinancials(),
    });
    graphs.push(graph);
    await writeProspectusNoteFinancialSnapshot(graph);
    await makeProspectusDraftApprovable(graph, actor);
    const approved = await approveProspectus(graph, actor);
    expect(approved.status).toBe(ProspectusReviewStatus.READY_FOR_PUBLISH);
    return graph;
  }

  beforeAll(async () => {
    actor = await getProspectusTestActor();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    for (const graph of graphs) {
      await cleanupIsolatedProspectusNote(graph);
    }
    await prisma.$disconnect();
  });

  describe("version-2 approval on a snapshot-backed Note", () => {
    let graph: IsolatedProspectusNoteGraph;
    let approvedRow: ReviewRow;

    beforeAll(async () => {
      actor = await getProspectusTestActor();
      graph = await seedApprovedNote("approved_render_v2");
      approvedRow = await readProspectusReviewRow(graph);
    });

    it("the read spies detect application and CTOS reads (guards the no-read assertions)", async () => {
      const reads = spyOnLiveFinancialReads();
      await prisma.application.findUnique({ where: { id: graph.applicationId } });
      await prisma.ctosReport.findFirst({ where: { id: graph.ctosReportId } });
      expect(reads.callCounts()).toMatchObject({ applicationFindUnique: 1, ctosFindFirst: 1 });
    });

    it("stores a version-2 freeze with the Note's financial reference date", async () => {
      const freeze = parseApprovedFinancialFreeze(storedSnapshot(approvedRow));
      const note = await prisma.note.findUniqueOrThrow({
        where: { id: graph.noteId },
        select: { financial_snapshot: true },
      });
      expect(freeze?.freeze_version).toBe(2);
      expect(freeze?.reference_date).toBe(
        new Date((note.financial_snapshot as { reference_date: string }).reference_date).toISOString()
      );
      expect(freeze?.selected_years.length).toBeGreaterThan(0);
    });

    it("stored approve HTML equals a frozen-mode render of the stored snapshot", async () => {
      const snapshot = storedSnapshot(approvedRow);
      const reads = spyOnLiveFinancialReads();
      const rendered = renderApprovedFinancialPagesHtml(
        await buildApprovedFinancialPages({
          noteId: graph.noteId,
          frozenFinancialComparison: parseApprovedFinancialFreeze(snapshot)!,
          publicationContent: approvedPublication(approvedRow),
        })
      );
      expect(reads.callCounts()).toEqual(NO_LIVE_READS);
      expect(snapshot.html.page2).toBe(rendered.page2);
      expect(snapshot.html.page3).toBe(rendered.page3);

      const publication = await prisma.noteProspectusPublication.findUniqueOrThrow({
        where: { id: approvedRow.approved_publication_id! },
        select: { snapshot: true },
      });
      const published = parseApprovedSnapshot(publication.snapshot)!;
      expect(published.html.page2).toBe(rendered.page2);
      expect(published.html.page3).toBe(rendered.page3);
    });

    it("E19: GET changes nothing and makes no application / CTOS read", async () => {
      const before = await readProspectusReviewRow(graph);
      const reads = spyOnLiveFinancialReads();

      const get = await prospectusReviewService.getOrCreateReview(graph.noteId, actor);

      expect(reads.callCounts()).toEqual(NO_LIVE_READS);
      reads.restore();
      const after = await readProspectusReviewRow(graph);
      expect(get.review.status).toBe(ProspectusReviewStatus.READY_FOR_PUBLISH);
      expect(after.status).toBe(before.status);
      expect(after.updated_at.getTime()).toBe(before.updated_at.getTime());
      expect(after.content_version).toBe(before.content_version);
      expect(after.render_fingerprint).toBe(before.render_fingerprint);
      expect(hashProspectusFingerprint(after.approved_snapshot)).toBe(
        hashProspectusFingerprint(before.approved_snapshot)
      );

      // The admin table is the approved one.
      const pages = await buildApprovedFinancialPages({
        noteId: graph.noteId,
        frozenFinancialComparison: parseApprovedFinancialFreeze(storedSnapshot(after))!,
        publicationContent: approvedPublication(after),
      });
      expect(get.financialComparison.table).toEqual(
        toAdminFinancialComparisonTable(pages.page2.financialComparisonMetrics)
      );
    });

    it("preview renders the approved Page 2 / Page 3 without a live financial read", async () => {
      const reads = spyOnLiveFinancialReads();
      const preview = await prospectusReviewService.preview(graph.noteId, actor);
      expect(reads.callCounts()).toEqual(NO_LIVE_READS);

      const snapshot = storedSnapshot(approvedRow);
      expect(preview.previewSource).toBe("approved");
      expect(withoutBanner(preview.html.page2)).toBe(snapshot.html.page2);
      expect(withoutBanner(preview.html.page3)).toBe(snapshot.html.page3);
    });

    it("D15: publish finalization keeps the approved Page 2–5 HTML and the frozen page_2", async () => {
      const { snapshot, publicationId, reviewId } =
        await prospectusReviewService.getApprovedSnapshotForPublish(graph.noteId);
      const approved = storedSnapshot(approvedRow);
      const reads = spyOnLiveFinancialReads();

      const { updatedSnapshot } = await prospectusReviewService.generateFinalProspectusPdfForPublish({
        noteId: graph.noteId,
        actor,
        approvedSnapshot: snapshot,
        publicationId,
        reviewId,
        listingDates: {
          opensAt: new Date("2026-10-01T00:00:00.000Z"),
          closesAt: new Date("2026-10-15T00:00:00.000Z"),
        },
      });

      expect(reads.callCounts()).toEqual(NO_LIVE_READS);
      for (const page of ["page2", "page3", "page4", "page5"] as const) {
        expect([page, updatedSnapshot.html[page]]).toEqual([page, approved.html[page]]);
      }
      expect(updatedSnapshot.page_2).toEqual(approved.page_2);
      expect(updatedSnapshot.html.page1).not.toBe("");
    });

    it("renders an empty approved Page 2 / Page 3 from the frozen page_2, never live data", async () => {
      const approved = storedSnapshot(approvedRow);
      const emptied: ProspectusApprovedSnapshot = {
        ...approved,
        html: { ...approved.html, page2: "", page3: "" },
      };
      const reads = spyOnLiveFinancialReads();

      const { updatedSnapshot } = await prospectusReviewService.generateFinalProspectusPdfForPublish({
        noteId: graph.noteId,
        actor,
        approvedSnapshot: emptied,
        publicationId: approvedRow.approved_publication_id!,
        reviewId: approvedRow.id,
        listingDates: {
          opensAt: new Date("2026-10-01T00:00:00.000Z"),
          closesAt: new Date("2026-10-15T00:00:00.000Z"),
        },
      });

      expect(reads.callCounts()).toEqual(NO_LIVE_READS);
      expect(updatedSnapshot.html.page2).toBe(approved.html.page2);
      expect(updatedSnapshot.html.page3).toBe(approved.html.page3);
    });
  });

  describe("legacy approval (no freeze_version)", () => {
    /** Rewrite the stored freeze to the pre-version-2 shape and re-seal its fingerprint. */
    async function downgradeToLegacyFreeze(graph: IsolatedProspectusNoteGraph): Promise<void> {
      const row = await readProspectusReviewRow(graph);
      const snapshot = storedSnapshot(row);
      const page2 = structuredClone(snapshot.page_2) as {
        financial_comparison: Record<string, unknown> & {
          selected_years: Array<Record<string, unknown> & { raw_financials: Record<string, unknown> }>;
        };
      };
      const comparison = page2.financial_comparison;
      for (const key of ["freeze_version", "reference_date", "missing_ssm_unaudited_years", "ops_warning"]) {
        delete comparison[key];
      }
      const { PROSPECTUS_PAGE_TWO_RAW_FINANCIAL_KEYS } = await import(
        "../prospectus/prospectus-page-two-snapshot"
      );
      comparison.selected_years = comparison.selected_years.map((year) => {
        const { statement_type: _statementType, ...rest } = year;
        return {
          ...rest,
          raw_financials: Object.fromEntries(
            PROSPECTUS_PAGE_TWO_RAW_FINANCIAL_KEYS.map((key) => [key, year.raw_financials[key] ?? null])
          ),
        };
      });
      const legacy = { ...snapshot, page_2: page2 };
      const fingerprint = await computeCurrentRenderFingerprint({
        noteId: graph.noteId,
        approvedContent: row.approved_content as unknown as ProspectusReviewStoredContent,
        approvedSnapshot: legacy,
      });
      await prisma.noteProspectusReview.update({
        where: { note_id: graph.noteId },
        data: {
          approved_snapshot: { ...legacy, render_fingerprint: fingerprint } as unknown as Prisma.InputJsonValue,
          render_fingerprint: fingerprint,
        },
      });
    }

    it("GET and preview keep today's live path and the approval stands", async () => {
      const graph = await seedApprovedNote("approved_render_legacy");
      await downgradeToLegacyFreeze(graph);
      const before = await readProspectusReviewRow(graph);
      expect(parseApprovedFinancialFreeze(storedSnapshot(before))?.freeze_version).toBeUndefined();

      const reads = spyOnLiveFinancialReads();
      const get = await prospectusReviewService.getOrCreateReview(graph.noteId, actor);
      expect(reads.spies.pageTwoLiveLoad).toHaveBeenCalledTimes(1);
      expect(reads.spies.resolver).toHaveBeenCalled();
      expect(get.review.status).toBe(ProspectusReviewStatus.READY_FOR_PUBLISH);

      reads.spies.pageTwoLiveLoad.mockClear();
      reads.spies.pageThreeLiveLoad.mockClear();
      await prospectusReviewService.preview(graph.noteId, actor);
      expect(reads.spies.pageTwoLiveLoad).toHaveBeenCalledTimes(1);
      expect(reads.spies.pageThreeLiveLoad).toHaveBeenCalledTimes(1);

      reads.restore();
      const after = await readProspectusReviewRow(graph);
      expect(after.updated_at.getTime()).toBe(before.updated_at.getTime());
      expect(after.render_fingerprint).toBe(before.render_fingerprint);

      // Publish still copies the approved HTML and never resolves live Page 2 / Page 3.
      const { snapshot, publicationId, reviewId } =
        await prospectusReviewService.getApprovedSnapshotForPublish(graph.noteId);
      const publishReads = spyOnLiveFinancialReads();
      const emptied = { ...snapshot, html: { ...snapshot.html, page3: "" } };
      const { updatedSnapshot } = await prospectusReviewService.generateFinalProspectusPdfForPublish({
        noteId: graph.noteId,
        actor,
        approvedSnapshot: emptied,
        publicationId,
        reviewId,
        listingDates: {
          opensAt: new Date("2026-10-01T00:00:00.000Z"),
          closesAt: new Date("2026-10-15T00:00:00.000Z"),
        },
      });
      expect(publishReads.callCounts()).toEqual(NO_LIVE_READS);
      expect(updatedSnapshot.html.page2).toBe(snapshot.html.page2);
      // Legacy freeze fallback renders from its 18 frozen keys, not from live data.
      expect(updatedSnapshot.html.page3).toContain("<table");
    });
  });
});
