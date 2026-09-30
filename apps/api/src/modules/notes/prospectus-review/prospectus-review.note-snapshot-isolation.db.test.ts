/**
 * SECTION: Prospectus reads only the Note financial snapshot (local DB)
 * WHY: Once the Note exists, later application edits, newer CTOS pulls or the passing of time must
 * not change what the Prospectus shows, approves or keeps approved (C13 / C14 / F23). A Note
 * without a financial snapshot has nothing to show: GET / preview / approve refuse with 409 and
 * write nothing (C15).
 */

import { ProspectusReviewStatus, type Prisma } from "@prisma/client";
import {
  buildProspectusDemoCtosFinancials,
  buildProspectusDemoFinancialStatements,
} from "../../../../scripts/seed-prospectus-review-note";
import { prisma } from "../../../lib/prisma";
import { buildApprovedFinancialResult } from "../../admin/financial-approved-result";
import { parseNoteFinancialSnapshot } from "../note-financial-snapshot.types";
import { parseApprovedFinancialFreeze } from "./prospectus-approved-render";
import { parseApprovedSnapshot } from "./prospectus-approved-snapshot";
import {
  approveProspectus,
  cleanupIsolatedProspectusNote,
  countProspectusAuditEntries,
  getProspectusTestActor,
  insertNewerOrganizationCtosReport,
  makeProspectusDraftApprovable,
  readProspectusReviewRow,
  seedIsolatedProspectusNote,
  type IsolatedProspectusNoteGraph,
  type ProspectusTestActor,
} from "./prospectus-review.db-test-support";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import { prospectusReviewService } from "./prospectus-review.service";

const DB_TEST_TIMEOUT_MS = 120_000;
const INVALIDATED_SOURCE = "PROSPECTUS_APPROVAL_INVALIDATED_SOURCE";
const SNAPSHOT_MISSING = { code: "NOTE_FINANCIAL_SNAPSHOT_MISSING", statusCode: 409 };

/** Only Date is faked; Prisma's timers and I/O keep running. */
const FAKE_DATE_ONLY = {
  doNotFake: [
    "hrtime",
    "nextTick",
    "performance",
    "queueMicrotask",
    "setImmediate",
    "clearImmediate",
    "setInterval",
    "clearInterval",
    "setTimeout",
    "clearTimeout",
  ],
} satisfies Parameters<typeof jest.useFakeTimers>[0];
const TWO_YEARS_MS = 2 * 366 * 24 * 60 * 60 * 1000;

function withoutBanner(html: string): string {
  return html.replace(/^<div data-prospectus-preview-banner="[^"]*"[^>]*>[^<]*<\/div>/, "");
}

/** Every User Input amount in the application raised, so any live read would show. */
async function editApplicationFinancials(graph: IsolatedProspectusNoteGraph): Promise<void> {
  const application = await prisma.application.findUniqueOrThrow({
    where: { id: graph.applicationId },
    select: { financial_statements: true },
  });
  const statements = application.financial_statements as {
    unaudited_by_year: Record<string, Record<string, unknown>>;
  };
  const unaudited = Object.fromEntries(
    Object.entries(statements.unaudited_by_year).map(([year, block]) => [
      year,
      {
        ...block,
        turnover: Number(block.turnover) + 3_000_000,
        plnpat: Number(block.plnpat) + 500_000,
        bscatot: Number(block.bscatot) + 700_000,
      },
    ])
  );
  await prisma.application.update({
    where: { id: graph.applicationId },
    data: {
      financial_statements: {
        ...statements,
        unaudited_by_year: unaudited,
      } as unknown as Prisma.InputJsonValue,
    },
  });
}

/** A newer CTOS pull with every account doubled. */
function doubledCtosFinancials(): unknown[] {
  return (buildProspectusDemoCtosFinancials() as Array<{ account: Record<string, unknown> }>).map(
    (row) => ({
      ...row,
      account: Object.fromEntries(
        Object.entries(row.account).map(([key, value]) => [
          key,
          typeof value === "number" ? value * 2 : value,
        ])
      ),
    })
  );
}

async function draftView(graph: IsolatedProspectusNoteGraph, actor: ProspectusTestActor) {
  const get = await prospectusReviewService.getOrCreateReview(graph.noteId, actor);
  const preview = await prospectusReviewService.preview(graph.noteId, actor);
  return {
    status: get.review.status,
    financialComparison: get.financialComparison,
    page2: withoutBanner(preview.html.page2),
    page3: withoutBanner(preview.html.page3),
  };
}

describe("Prospectus reads only the Note financial snapshot (local DB)", () => {
  const graphs: IsolatedProspectusNoteGraph[] = [];
  let actor: ProspectusTestActor;

  beforeAll(async () => {
    actor = await getProspectusTestActor();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(async () => {
    for (const graph of graphs) {
      await cleanupIsolatedProspectusNote(graph);
    }
    await prisma.$disconnect();
  });

  it(
    "C13 / C14 / F23: application edits, a newer CTOS pull and a later clock change nothing",
    async () => {
      const graph = await seedIsolatedProspectusNote({
        label: "snapshot_isolation",
        financialStatements: buildProspectusDemoFinancialStatements(),
        ctosFinancials: buildProspectusDemoCtosFinancials(),
      });
      graphs.push(graph);
      await makeProspectusDraftApprovable(graph, actor);
      const note = await prisma.note.findUniqueOrThrow({
        where: { id: graph.noteId },
        select: { financial_snapshot: true },
      });
      const noteSnapshot = parseNoteFinancialSnapshot(note.financial_snapshot)!;
      const before = await draftView(graph, actor);

      await editApplicationFinancials(graph);
      await insertNewerOrganizationCtosReport(graph, doubledCtosFinancials());

      // Guard: the edits are real — the application's live result now differs from the Note copy.
      const liveResult = await buildApprovedFinancialResult({
        db: prisma,
        applicationId: graph.applicationId,
        approvedAt: new Date(),
        reviewerUserId: null,
      });
      expect(liveResult.years.map((year) => year.calculated_values)).not.toEqual(
        noteSnapshot.approved_financial_result.years.map((year) => year.calculated_values)
      );

      // C13 / C14: draft GET and preview are unchanged.
      expect(await draftView(graph, actor)).toEqual(before);

      // Approve freezes the Note snapshot's years and values, not the edited sources.
      const approved = await approveProspectus(graph, actor);
      expect(approved.status).toBe(ProspectusReviewStatus.READY_FOR_PUBLISH);
      const approvedRow = await readProspectusReviewRow(graph);
      const approvedSnapshot = parseApprovedSnapshot(approvedRow.approved_snapshot)!;
      const freeze = parseApprovedFinancialFreeze(approvedSnapshot)!;
      const noteYears = noteSnapshot.approved_financial_result.years.filter(
        (year) => year.selected
      );
      expect(freeze.selected_years.map((year) => [year.year, year.calculated_values])).toEqual(
        noteYears.map((year) => [year.year, year.calculated_values])
      );
      // Approved HTML is the draft preview the officer saw.
      expect(approvedSnapshot.html.page2).toBe(before.page2);
      expect(approvedSnapshot.html.page3).toBe(before.page3);
      const approvedGet = await prospectusReviewService.getOrCreateReview(graph.noteId, actor);
      expect(approvedGet.review.status).toBe(ProspectusReviewStatus.READY_FOR_PUBLISH);
      expect(approvedGet.financialComparison).toEqual(before.financialComparison);

      // F23: two years later the approved years and figures are the same and the approval stands.
      const realNow = Date.now();
      jest.useFakeTimers(FAKE_DATE_ONLY);
      jest.setSystemTime(new Date(realNow + TWO_YEARS_MS));
      expect(new Date().getTime()).toBeGreaterThanOrEqual(realNow + TWO_YEARS_MS);
      const later = await prospectusReviewService.getOrCreateReview(graph.noteId, actor);
      const laterPreview = await prospectusReviewService.preview(graph.noteId, actor);
      jest.useRealTimers();

      expect(later.review.status).toBe(ProspectusReviewStatus.READY_FOR_PUBLISH);
      expect(later.financialComparison).toEqual(approvedGet.financialComparison);
      expect(withoutBanner(laterPreview.html.page2)).toBe(approvedSnapshot.html.page2);
      expect(withoutBanner(laterPreview.html.page3)).toBe(approvedSnapshot.html.page3);
      const laterRow = await readProspectusReviewRow(graph);
      expect(laterRow.updated_at.getTime()).toBe(approvedRow.updated_at.getTime());
      expect(laterRow.render_fingerprint).toBe(approvedRow.render_fingerprint);
      expect(await countProspectusAuditEntries(graph, INVALIDATED_SOURCE)).toEqual({
        adminActions: 0,
        events: 0,
      });
    },
    DB_TEST_TIMEOUT_MS
  );

  it(
    "F23: a later clock does not move the draft years either",
    async () => {
      const graph = await seedIsolatedProspectusNote({
        label: "snapshot_clock_draft",
        financialStatements: buildProspectusDemoFinancialStatements(),
        ctosFinancials: buildProspectusDemoCtosFinancials(),
      });
      graphs.push(graph);
      await makeProspectusDraftApprovable(graph, actor);
      const before = await draftView(graph, actor);

      const realNow = Date.now();
      jest.useFakeTimers(FAKE_DATE_ONLY);
      jest.setSystemTime(new Date(realNow + TWO_YEARS_MS));
      expect(new Date().getTime()).toBeGreaterThanOrEqual(realNow + TWO_YEARS_MS);
      const later = await draftView(graph, actor);
      jest.useRealTimers();

      expect(later.financialComparison.years.map((year) => year.calendarYear)).toEqual(
        before.financialComparison.years.map((year) => year.calendarYear)
      );
      expect(later.financialComparison).toEqual(before.financialComparison);
      expect(later.page2).toBe(before.page2);
      expect(later.page3).toBe(before.page3);
    },
    DB_TEST_TIMEOUT_MS
  );

  describe("C15: Note without a financial snapshot", () => {
    let graph: IsolatedProspectusNoteGraph;

    beforeAll(async () => {
      graph = await seedIsolatedProspectusNote({
        label: "snapshot_missing",
        financialStatements: buildProspectusDemoFinancialStatements(),
        ctosFinancials: buildProspectusDemoCtosFinancials(),
        withFinancialSnapshot: false,
      });
      graphs.push(graph);
    });

    async function writeCounts() {
      const [reviews, publications, adminActions, events, note] = await Promise.all([
        prisma.noteProspectusReview.findMany({
          where: { note_id: graph.noteId },
          select: { updated_at: true, status: true, content_version: true, draft_content: true },
        }),
        prisma.noteProspectusPublication.count({ where: { note_id: graph.noteId } }),
        prisma.noteAdminAction.count({ where: { note_id: graph.noteId } }),
        prisma.noteEvent.count({ where: { note_id: graph.noteId } }),
        prisma.note.findUniqueOrThrow({
          where: { id: graph.noteId },
          select: { updated_at: true, financial_snapshot: true },
        }),
      ]);
      return { reviews, publications, adminActions, events, note };
    }

    it(
      "GET refuses with 409 before creating the review",
      async () => {
        const before = await writeCounts();
        expect(before.note.financial_snapshot).toBeNull();
        await expect(
          prospectusReviewService.getOrCreateReview(graph.noteId, actor)
        ).rejects.toMatchObject(SNAPSHOT_MISSING);
        const after = await writeCounts();
        expect(after).toEqual(before);
        expect(after.reviews).toHaveLength(0);
      },
      DB_TEST_TIMEOUT_MS
    );

    it(
      "GET, preview and approve refuse with 409 on an existing review and write nothing",
      async () => {
        await prisma.noteProspectusReview.create({
          data: {
            note_id: graph.noteId,
            status: ProspectusReviewStatus.DRAFT,
            option_catalogue_version: "dbtest",
            draft_content: buildCompleteProspectusReviewDraft() as unknown as Prisma.InputJsonValue,
            created_by_user_id: actor.userId,
            updated_by_user_id: actor.userId,
          },
        });
        const before = await writeCounts();

        await expect(
          prospectusReviewService.getOrCreateReview(graph.noteId, actor)
        ).rejects.toMatchObject(SNAPSHOT_MISSING);
        await expect(prospectusReviewService.preview(graph.noteId, actor)).rejects.toMatchObject(
          SNAPSHOT_MISSING
        );
        await expect(prospectusReviewService.approve(graph.noteId, actor)).rejects.toMatchObject(
          SNAPSHOT_MISSING
        );
        // With a draft body: fails before the draft save.
        const edited = buildCompleteProspectusReviewDraft();
        edited.page2.issuerProfile = { ...edited.page2.issuerProfile, companySize: "Small" };
        await expect(
          prospectusReviewService.approve(graph.noteId, actor, { draftContent: edited })
        ).rejects.toMatchObject(SNAPSHOT_MISSING);

        expect(await writeCounts()).toEqual(before);
      },
      DB_TEST_TIMEOUT_MS
    );
  });
});
