import fs from "node:fs";
import path from "node:path";
import type { ProspectusReviewStoredContent } from "@cashsouk/types";
import {
  buildProspectusMissingRequiredFields,
  isProspectusDraftReadyToSubmit,
} from "./completion";

const previewSource = fs.readFileSync(
  path.join(__dirname, "working-area-preview-approval.tsx"),
  "utf8"
);
const pageSource = fs.readFileSync(
  path.join(__dirname, "../../app/notes/[id]/prospectus/page.tsx"),
  "utf8"
);

function emptyDraft(): ProspectusReviewStoredContent {
  return {
    page1: {
      keyInvestorHighlights: [
        { key: "paymaster", title: "", description: "" },
        { key: "issuer_fundamentals", title: "", description: "" },
        { key: "return", title: "", description: "" },
        { key: "shariah", title: "", description: "" },
      ],
    },
    page2: {
      creditInsights: {},
      aboutInvoice: {
        items: [
          { id: "work_under_contract", text: "", sourceType: "SYSTEM_SUGGESTION" },
          { id: "certification_acceptance", text: "", sourceType: "SYSTEM_SUGGESTION" },
          { id: "paymaster_trust_account", text: "", sourceType: "SYSTEM_SUGGESTION" },
          { id: "deed_of_assignment", text: "", sourceType: "SYSTEM_SUGGESTION" },
        ],
      },
    },
    page3: {
      investorTakeaways: {},
    },
  };
}

function completeOfficerDraft(): ProspectusReviewStoredContent {
  const draft = emptyDraft();
  draft.page1.keyInvestorHighlights = [
    { key: "paymaster", title: "Paymaster title", description: "Paymaster body" },
    { key: "issuer_fundamentals", title: "Issuer title", description: "Issuer body" },
    { key: "return", title: "Return title", description: "Return body" },
    { key: "shariah", title: "Shariah title", description: "Shariah body" },
  ];
  draft.page2.issuerProfile = { companySize: "Medium" };
  draft.page2.invoicePaymaster = {
    deedOfAssignment: "Yes",
    paymasterRating: "PM1",
    confidenceGrading: "High",
  };
  draft.page2.creditInsights = {
    creditScoreOptionKey: "good",
    paymentBehaviourOptionKey: "good",
    creditUtilisationOptionKey: "healthy",
    litigationCheckOptionKey: "clear",
    ccrisStatusOptionKey: "no_record",
  };
  draft.page2.aboutInvoice = {
    items: [
      {
        id: "work_under_contract",
        text: "Confirmed work under contract.",
        sourceType: "OFFICER_ENTERED",
      },
      {
        id: "certification_acceptance",
        text: "Confirmed certification and acceptance.",
        sourceType: "OFFICER_ENTERED",
      },
      {
        id: "paymaster_trust_account",
        text: "Confirmed trust-account payment path.",
        sourceType: "OFFICER_ENTERED",
      },
      {
        id: "deed_of_assignment",
        text: "Confirmed deed of assignment.",
        sourceType: "OFFICER_ENTERED",
      },
    ],
  };
  draft.page3.investorTakeaways = {
    revenueProfitabilityOptionKey: "steady_growth",
    liquidityOptionKey: "do_not_display",
    leverageOptionKey: "conservative_improving",
    debtServicingCapacityOptionKey: "adequate_improving",
    receivablesCollectionOptionKey: "improving",
    overallFinancialProfileOptionKey: "strengthening",
  };
  return draft;
}

describe("Preview & Approval page simplification", () => {
  it("removes the Completion checklist and its six category rows", () => {
    expect(previewSource).not.toContain("Completion checklist");
    expect(previewSource).not.toContain("Note & Investment Details");
    expect(previewSource).not.toContain('"Investor Highlights"');
    expect(previewSource).not.toContain("Paymaster Track Record");
    expect(previewSource).not.toContain("Issuer, Credit & Invoice");
    expect(previewSource).not.toContain('"Financial Review"');
    expect(previewSource).not.toContain("Investor Takeaways");
    expect(previewSource).not.toContain("CHECKLIST_ITEM_STEP");
    expect(previewSource).not.toContain("buildProspectusCompletionChecklist");
  });

  it("keeps readiness, missing fields, exact counts, and approval messages", () => {
    expect(previewSource).toContain("Readiness by page");
    expect(previewSource).toContain("Missing required fields");
    expect(previewSource).toContain("required field");
    expect(previewSource).toContain("Complete");
    expect(previewSource).toContain("Approval unavailable");
    expect(previewSource).toContain("Ready for approval");
    expect(previewSource).toContain("are still missing.");
    expect(previewSource).toContain("The Prospectus is ready for approval.");
    expect(previewSource).toContain("onNavigate(item.pageStep, item.tabId)");
    expect(previewSource).toContain('data-prospectus-approval-readiness={isReady ? "ready" : "unavailable"}');
  });

  it("keeps Approve disabled when required fields are missing", () => {
    expect(pageSource).toContain("requiredMissingCount > 0");
    expect(pageSource).toContain("buildProspectusMissingRequiredFields");
    const incomplete = emptyDraft();
    const missing = buildProspectusMissingRequiredFields(incomplete, {
      incomeStatementYears: ["2024"],
    });
    expect(missing.length).toBeGreaterThan(0);
    expect(isProspectusDraftReadyToSubmit(incomplete, { incomeStatementYears: ["2024"] })).toBe(
      false
    );
  });

  it("keeps Approve available when required fields are complete and paymaster is optional", () => {
    const draft = completeOfficerDraft();
    draft.page2.paymasterTrackRecord = undefined;
    const missing = buildProspectusMissingRequiredFields(draft);
    expect(missing).toHaveLength(0);
    expect(missing.some((m) => m.section.includes("Paymaster"))).toBe(false);
    expect(isProspectusDraftReadyToSubmit(draft)).toBe(true);
    expect(pageSource).toContain('onClick={openApproveDialog}');
  });

  it("keeps preview sheet page tabs unchanged", () => {
    const previewSheet = fs.readFileSync(
      path.join(__dirname, "preview-sheet.tsx"),
      "utf8"
    );
    const previewPage = fs.readFileSync(path.join(__dirname, "preview-page.ts"), "utf8");
    expect(pageSource).toContain("ProspectusPreviewSheet");
    expect(previewSheet).toContain("resolvePreviewPageForStep");
    expect(previewSheet).toContain("PROSPECTUS_PREVIEW_TABS");
    expect(previewPage).toContain('"page1"');
    expect(previewPage).toContain('"page2"');
    expect(previewPage).toContain('"page3"');
    expect(previewPage).toContain('"allPages"');
  });
});
