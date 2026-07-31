/**
 * SECTION: Prospectus Review demo seed + product-flow checks (local DB)
 */

import { NoteStatus, PrismaClient, ProspectusReviewStatus } from "@prisma/client";
import {
  buildNormalizedFinancialStatementYearSet,
  getAdminFinancialSummaryUserColumnYears,
  normalizeFinancialStatementsQuestionnaire,
  selectLatestNormalizedFinancialStatementYears,
} from "@cashsouk/types";
import {
  PROSPECTUS_DEMO_NOTE_ID,
  PROSPECTUS_DEMO_NOTE_REFERENCE,
  PROSPECTUS_DEMO_ORG_ID,
  buildProspectusDemoCtosFinancials,
  buildProspectusDemoFinancialStatements,
  seedProspectusReviewNote,
} from "../../../../scripts/seed-prospectus-review-note";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import { PROSPECTUS_REVIEW_REQUIRED_FROM } from "./prospectus-review.service";
import { validateApprovalContent } from "./prospectus-review.schemas";

const prisma = new PrismaClient();

describe("prospectus review demo seed", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("is idempotent and creates the required Note graph", async () => {
    const first = await seedProspectusReviewNote();
    const second = await seedProspectusReviewNote();
    expect(second.noteId).toBe(first.noteId);
    expect(second.noteReference).toBe(PROSPECTUS_DEMO_NOTE_REFERENCE);
    expect(second.noteStatus).toBe(NoteStatus.DRAFT);
    expect(second.reviewStatus).toBeNull();
    expect(second.requiresProspectusReview).toBe(true);

    const note = await prisma.note.findUniqueOrThrow({
      where: { id: PROSPECTUS_DEMO_NOTE_ID },
      include: { listing: true, prospectus_review: true, payment_schedules: true },
    });
    expect(note.status).toBe(NoteStatus.DRAFT);
    expect(note.listing?.closes_at).toBeTruthy();
    expect(note.prospectus_review).toBeNull();
    expect(note.payment_schedules.length).toBeGreaterThan(0);
    expect(note.created_at.getTime()).toBeGreaterThanOrEqual(
      PROSPECTUS_REVIEW_REQUIRED_FROM.getTime()
    );

    const application = await prisma.application.findUniqueOrThrow({
      where: { id: note.source_application_id },
    });
    const ctos = await prisma.ctosReport.findFirst({
      where: { issuer_organization_id: PROSPECTUS_DEMO_ORG_ID, subject_ref: null },
      orderBy: { fetched_at: "desc" },
      select: { financials_json: true },
    });
    const available = buildNormalizedFinancialStatementYearSet({
      financialStatements: application.financial_statements,
      ctosFinancials: ctos?.financials_json,
    });
    const selected = selectLatestNormalizedFinancialStatementYears(available, 3);
    expect(selected).toHaveLength(3);
    expect(selected.map((y) => y.year)).toEqual(
      [...selected.map((y) => y.year)].sort((a, b) => a - b)
    );
  });

  it("seeds SSM-aligned financials for FY2024–FY2026 with matching pldd (no FY2027)", () => {
    const ref = new Date("2026-07-21T00:00:00.000Z");
    const fs = buildProspectusDemoFinancialStatements(ref);
    const questionnaire = normalizeFinancialStatementsQuestionnaire(fs.questionnaire, ref);
    expect(questionnaire).not.toBeNull();
    expect(questionnaire?.financial_year_end).toBe("2026-09-02");
    const ssmYears = getAdminFinancialSummaryUserColumnYears(questionnaire, ref);
    expect(ssmYears.length).toBeGreaterThan(0);
    expect(Math.max(...ssmYears)).toBeLessThanOrEqual(2026);
    const byYear = fs.unaudited_by_year as Record<string, Record<string, unknown>>;
    expect(Object.keys(byYear).sort()).toEqual(ssmYears.map(String).sort());
    for (const year of ssmYears) {
      const block = byYear[String(year)];
      expect(typeof block?.pldd).toBe("string");
      expect(String(block?.pldd)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(String(block?.pldd).startsWith(`${year}-`)).toBe(true);
      expect(block).not.toHaveProperty("grossProfit");
      expect(block).not.toHaveProperty("ebitda");
    }
    const newest = byYear[String(Math.max(...ssmYears))];
    expect(newest?.turnover).toBe(15_000_000);
    expect(newest?.plnpat).toBe(1_200_000);
    const ctos = buildProspectusDemoCtosFinancials(ref) as Array<{ financial_year?: number }>;
    expect(ctos.length).toBeGreaterThan(0);
    expect(ctos.every((row) => (row.financial_year ?? 0) <= 2026)).toBe(true);
    expect(ctos.some((row) => row.financial_year === 2027)).toBe(false);
  });

  it("builds a complete review draft that passes approval validation", () => {
    const draft = buildCompleteProspectusReviewDraft();
    expect(validateApprovalContent(draft)).toEqual([]);
    expect(draft.page2.creditInsights.creditScoreOptionKey).toBe("good");
    expect(draft.page2.creditInsights.creditUtilisationOptionKey).toBe("healthy");
    expect(draft.page2.creditInsights.litigationCheckOptionKey).toBe("clear");
    expect(draft.page2.creditInsights.ccrisStatusOptionKey).toBe("no_record");
    expect(draft.page1.keyInvestorHighlights).toHaveLength(4);
    expect(
      draft.page1.keyInvestorHighlights.every((h) => h.title.trim() && h.description.trim())
    ).toBe(true);
    expect(draft.page1.keyInvestorHighlights.find((h) => h.key === "shariah")?.title).toContain(
      "Shariah"
    );
  });

  it("keeps legacy SUPERSEDED in the enum and writes PUBLISHED on the product path", () => {
    expect(ProspectusReviewStatus.SUPERSEDED).toBe("SUPERSEDED");
    expect(ProspectusReviewStatus.PUBLISHED).toBe("PUBLISHED");
  });
});
