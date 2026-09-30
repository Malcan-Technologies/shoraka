/**
 * SECTION: Note financial snapshot isolation (local DB)
 * WHY: After a Note has a financial snapshot, later application or CTOS changes must not move
 * its Prospectus loader output, fingerprint sources or resolved figures. A legacy Note (no
 * snapshot) on its own graph is the control that proves each mutation is visible to a live read.
 */

import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import {
  buildProspectusDemoCtosFinancials,
  buildProspectusDemoFinancialStatements,
} from "../../../../scripts/seed-prospectus-review-note";
import { prisma } from "../../../lib/prisma";
import {
  NOTE_FINANCIAL_SNAPSHOT_VERSION,
  type NoteFinancialSnapshot,
} from "../note-financial-snapshot.types";
import { loadProspectusNoteIdentityFreeze } from "../prospectus-review/prospectus-approved-snapshot";
import {
  cleanupIsolatedProspectusNote,
  seedIsolatedProspectusNote,
  type IsolatedProspectusNoteGraph,
} from "../prospectus-review/prospectus-review.db-test-support";
import { mapProspectusPageThreeFromNote } from "./prospectus-page-three-mapper";
import { loadProspectusPageThreeData } from "./prospectus-page-three-prisma";
import { mapProspectusPageTwoFromNote } from "./prospectus-page-two-mapper";
import { loadProspectusPageTwoData } from "./prospectus-page-two-prisma";

type ProspectusFinancialView = {
  page2Loaded: { statements: unknown; ctos: unknown; referenceDate: string | null };
  page3Loaded: { statements: unknown; ctos: unknown; referenceDate: string | null };
  fingerprintSources: Record<string, unknown>;
  page2Years: unknown;
  page2Metrics: unknown;
  page3Years: unknown;
};

async function readProspectusFinancialView(noteId: string): Promise<ProspectusFinancialView> {
  const page2Data = await loadProspectusPageTwoData(prisma, noteId);
  const page3Data = await loadProspectusPageThreeData(prisma, noteId);
  const { fingerprintSource } = await loadProspectusNoteIdentityFreeze(noteId);
  const page2 = await mapProspectusPageTwoFromNote(page2Data);
  const page3 = await mapProspectusPageThreeFromNote(page3Data);
  return {
    page2Loaded: {
      statements: page2Data.liveFinancialStatements,
      ctos: page2Data.liveCtosFinancials,
      referenceDate: page2Data.financialReferenceDate?.toISOString() ?? null,
    },
    page3Loaded: {
      statements: page3Data.liveFinancialStatements,
      ctos: page3Data.liveCtosFinancials,
      referenceDate: page3Data.financialReferenceDate?.toISOString() ?? null,
    },
    fingerprintSources: {
      financial_statements: fingerprintSource.financial_statements,
      ctos_financials: fingerprintSource.ctos_financials,
    },
    page2Years: page2.financialComparisonSource.years,
    page2Metrics: page2.financialComparisonMetrics.rows,
    page3Years: page3.financialSource.years,
  };
}

/** Write the contract snapshot from what the graph's application and owned CTOS hold now. */
async function writeFinancialSnapshot(graph: IsolatedProspectusNoteGraph): Promise<void> {
  const [application, ctos] = await Promise.all([
    prisma.application.findUniqueOrThrow({
      where: { id: graph.applicationId },
      select: { financial_statements: true, submitted_at: true },
    }),
    prisma.ctosReport.findUniqueOrThrow({
      where: { id: graph.ctosReportId },
      select: { fetched_at: true, financials_json: true },
    }),
  ]);
  const submittedAt = application.submitted_at!.toISOString();
  const snapshot: NoteFinancialSnapshot = {
    version: NOTE_FINANCIAL_SNAPSHOT_VERSION,
    captured_at: new Date().toISOString(),
    reference_date: submittedAt,
    financial_statements: application.financial_statements,
    ctos: {
      report_id: graph.ctosReportId,
      fetched_at: ctos.fetched_at.toISOString(),
      financials: ctos.financials_json,
    },
    source: {
      application_id: graph.applicationId,
      review_cycle: 1,
      application_submitted_at: submittedAt,
      financial_review: { status: "APPROVED", reviewed_at: submittedAt, reviewer_user_id: null },
    },
  };
  await prisma.note.update({
    where: { id: graph.noteId },
    data: { financial_snapshot: snapshot as unknown as Prisma.InputJsonValue },
  });
}

async function bumpApplicationTurnover(graph: IsolatedProspectusNoteGraph): Promise<void> {
  const application = await prisma.application.findUniqueOrThrow({
    where: { id: graph.applicationId },
    select: { financial_statements: true },
  });
  const statements = application.financial_statements as {
    unaudited_by_year: Record<string, Record<string, unknown>>;
  };
  const year = Object.keys(statements.unaudited_by_year).sort().at(-1)!;
  const block = statements.unaudited_by_year[year]!;
  await prisma.application.update({
    where: { id: graph.applicationId },
    data: {
      financial_statements: {
        ...statements,
        unaudited_by_year: {
          ...statements.unaudited_by_year,
          [year]: { ...block, turnover: Number(block.turnover) + 5_000_000 },
        },
      } as Prisma.InputJsonValue,
    },
  });
}

/** Scale every CTOS turnover on the owned report so any CTOS-sourced year changes. */
async function changeOwnedCtosFinancials(graph: IsolatedProspectusNoteGraph): Promise<void> {
  const report = await prisma.ctosReport.findUniqueOrThrow({
    where: { id: graph.ctosReportId },
    select: { financials_json: true },
  });
  const rows = report.financials_json as { account: Record<string, unknown> }[];
  await prisma.ctosReport.update({
    where: { id: graph.ctosReportId },
    data: {
      financials_json: rows.map((row) => ({
        ...row,
        account: { ...row.account, turnover: Number(row.account.turnover) * 3 },
      })) as Prisma.InputJsonValue,
    },
  });
}

describe("Note financial snapshot isolation (local DB)", () => {
  const graphs: IsolatedProspectusNoteGraph[] = [];
  const extraCtosReportIds: string[] = [];

  async function seed(label: string, withSnapshot: boolean): Promise<IsolatedProspectusNoteGraph> {
    const graph = await seedIsolatedProspectusNote({
      label,
      financialStatements: buildProspectusDemoFinancialStatements(),
      ctosFinancials: buildProspectusDemoCtosFinancials(),
    });
    graphs.push(graph);
    if (withSnapshot) await writeFinancialSnapshot(graph);
    return graph;
  }

  async function addNewerCtosReport(graph: IsolatedProspectusNoteGraph): Promise<void> {
    const id = `dbtest_prospectus_${graph.runId}_ctos_newer_${randomBytes(4).toString("hex")}`;
    extraCtosReportIds.push(id);
    const stub = {} as Prisma.InputJsonValue;
    await prisma.ctosReport.create({
      data: {
        id,
        issuer_organization_id: graph.organizationId,
        subject_ref: null,
        fetched_at: new Date(Date.now() + 60_000),
        financials_json: [] as Prisma.InputJsonValue,
        summary_json: stub,
        legal_json: stub,
        ccris_json: stub,
        company_json: stub,
        raw_xml: "<dbtest-newer/>",
      },
    });
  }

  afterAll(async () => {
    await prisma.ctosReport.deleteMany({ where: { id: { in: extraCtosReportIds } } });
    for (const graph of graphs) {
      await cleanupIsolatedProspectusNote(graph);
    }
    await prisma.$disconnect();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("C11: application changes after the snapshot do not move the Prospectus", async () => {
    const graph = await seed("fs_snapshot_app", true);
    const before = await readProspectusFinancialView(graph.noteId);
    expect(before.page2Loaded.referenceDate).not.toBeNull();
    expect((before.page2Years as unknown[]).length).toBeGreaterThan(0);

    await bumpApplicationTurnover(graph);

    const applicationRead = jest.spyOn(prisma.application, "findUnique");
    const ctosRead = jest.spyOn(prisma.ctosReport, "findFirst");
    const after = await readProspectusFinancialView(graph.noteId);

    expect(after).toEqual(before);
    expect(applicationRead).not.toHaveBeenCalled();
    expect(ctosRead).not.toHaveBeenCalled();
  });

  it("C11 control: a legacy Note sees the same application change", async () => {
    const graph = await seed("fs_legacy_app", false);
    const before = await readProspectusFinancialView(graph.noteId);

    await bumpApplicationTurnover(graph);
    const applicationRead = jest.spyOn(prisma.application, "findUnique");
    const after = await readProspectusFinancialView(graph.noteId);

    expect(after.fingerprintSources).not.toEqual(before.fingerprintSources);
    expect(after.page2Years).not.toEqual(before.page2Years);
    expect(applicationRead).toHaveBeenCalled();
  });

  it("C12: a newer CTOS report and a changed owned report do not move the Prospectus", async () => {
    const graph = await seed("fs_snapshot_ctos", true);
    const before = await readProspectusFinancialView(graph.noteId);

    await addNewerCtosReport(graph);
    await changeOwnedCtosFinancials(graph);

    const ctosRead = jest.spyOn(prisma.ctosReport, "findFirst");
    const after = await readProspectusFinancialView(graph.noteId);

    expect(after).toEqual(before);
    expect(ctosRead).not.toHaveBeenCalled();
  });

  it("C12 control: a legacy Note sees the owned CTOS change", async () => {
    const graph = await seed("fs_legacy_ctos", false);
    const before = await readProspectusFinancialView(graph.noteId);

    await addNewerCtosReport(graph);
    await changeOwnedCtosFinancials(graph);
    const after = await readProspectusFinancialView(graph.noteId);

    expect(after.fingerprintSources.ctos_financials).not.toEqual(
      before.fingerprintSources.ctos_financials
    );
    expect(after.page2Years).not.toEqual(before.page2Years);
  });
});
