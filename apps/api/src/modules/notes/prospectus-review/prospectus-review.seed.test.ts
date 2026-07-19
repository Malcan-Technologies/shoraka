/**
 * SECTION: Prospectus Review demo seed + product-flow checks (local DB)
 */

import { NoteStatus, PrismaClient, ProspectusReviewStatus } from "@prisma/client";
import {
  PROSPECTUS_DEMO_NOTE_ID,
  PROSPECTUS_DEMO_NOTE_REFERENCE,
  buildProspectusDemoFinancialStatements,
  seedProspectusReviewNote,
} from "../../../../scripts/seed-prospectus-review-note";
import { buildCompleteProspectusReviewDraft } from "./prospectus-review.demo-fixtures";
import { PROSPECTUS_REVIEW_REQUIRED_FROM } from "./prospectus-review.service";
import { selectProspectusFinancialComparisonYears } from "../prospectus/prospectus-financial-comparison-source";
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
    const fs = application.financial_statements as {
      unaudited_by_year?: Record<string, unknown>;
    };
    const years = selectProspectusFinancialComparisonYears(
      Object.keys(fs.unaudited_by_year ?? {})
    );
    expect(years).toEqual([2022, 2023, 2024]);
  });

  it("seeds three-year financials with derived fields only", () => {
    const fs = buildProspectusDemoFinancialStatements();
    const y2024 = (fs.unaudited_by_year as Record<string, Record<string, unknown>>)["2024"];
    expect(y2024?.turnover).toBe(15_000_000);
    expect(y2024?.plnpat).toBe(1_200_000);
    expect(y2024).not.toHaveProperty("grossProfit");
    expect(y2024).not.toHaveProperty("ebitda");
  });

  it("builds a complete review draft that passes approval validation", () => {
    const draft = buildCompleteProspectusReviewDraft();
    expect(validateApprovalContent(draft)).toEqual([]);
    expect(draft.page2.creditInsights.creditUtilisationOptionKey).toBe("do_not_display");
    expect(draft.page1.keyInvestorHighlights.some((h) => h.optionKey === "do_not_display")).toBe(
      true
    );
  });

  it("leaves SUPERSEDED unused for the normal product path", () => {
    expect(ProspectusReviewStatus.SUPERSEDED).toBe("SUPERSEDED");
  });
});
