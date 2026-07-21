import {
  formatActorDisplayName,
  formatProspectusReviewStatus,
  looksLikeRawKey,
  PROSPECTUS_STEP_GROUPS,
  PROSPECTUS_STEP_TITLES,
  HIGHLIGHT_FIELD_LABELS,
  INVOICE_WORK_FIELD_LABELS,
} from "./labels";
import {
  CHECKLIST_ITEM_STEP,
  PROSPECTUS_STEP_STATUS_LABEL,
  buildProspectusCompletionChecklist,
  buildProspectusMissingRequiredFields,
  getProspectusStepStatuses,
  isProspectusDraftReadyToSubmit,
  statusForCompletionItem,
} from "./completion";
import { getProspectusActionVisibility } from "./action-visibility";
import {
  PROSPECTUS_STATUS_BADGE_COMPACT_CLASS,
  PROSPECTUS_STATUS_BADGE_TONE,
} from "./status-badge-styles";
import {
  PROSPECTUS_ACTIVE_COLUMN_CLASS,
  PROSPECTUS_STEP_ICON_CLASS,
  PROSPECTUS_STEP_ICON_NAMES,
  PROSPECTUS_STEPS_GRID_CLASS,
} from "./step-icons";
import type { ProspectusReviewStoredContent } from "@cashsouk/types";

describe("prospectus review admin labels", () => {
  it("formats review statuses as Draft | Approved | Published only", () => {
    expect(formatProspectusReviewStatus("DRAFT")).toBe("Draft");
    expect(formatProspectusReviewStatus("READY_FOR_REVIEW")).toBe("Draft");
    expect(formatProspectusReviewStatus("SUPERSEDED")).toBe("Draft");
    expect(formatProspectusReviewStatus("APPROVED")).toBe("Approved");
    expect(formatProspectusReviewStatus("PUBLISHED", true)).toBe("Published");
  });

  it("uses four page-based working-area steps", () => {
    expect(PROSPECTUS_STEP_TITLES[0]).toBe("Investment Overview");
    expect(PROSPECTUS_STEP_TITLES[1]).toBe("Issuer & Credit Review");
    expect(PROSPECTUS_STEP_TITLES[2]).toBe("Financial Review");
    expect(PROSPECTUS_STEP_TITLES[3]).toBe("Preview & Approval");
    const mainLabels = PROSPECTUS_STEP_GROUPS.flatMap((g) => g.steps.map((s) => s.label));
    expect(mainLabels).toEqual([
      "Investment Overview",
      "Issuer & Credit Review",
      "Financial Review",
      "Preview & Approval",
    ]);
    expect(mainLabels.every((label) => !label.startsWith("Page "))).toBe(true);
  });

  it("maps highlight and invoice work keys to business labels", () => {
    expect(HIGHLIGHT_FIELD_LABELS.paymaster).toBe("Paymaster Highlight");
    expect(HIGHLIGHT_FIELD_LABELS.issuer_fundamentals).toBe("Issuer Financial Strength");
    expect(INVOICE_WORK_FIELD_LABELS.work_under_contract).toBe(
      "Work Performed Under Contract"
    );
    expect(Object.values(HIGHLIGHT_FIELD_LABELS).some((v) => looksLikeRawKey(v))).toBe(false);
    expect(Object.values(INVOICE_WORK_FIELD_LABELS).some((v) => looksLikeRawKey(v))).toBe(false);
  });

  it("resolves actor display names without raw ids", () => {
    expect(
      formatActorDisplayName({ first_name: "Amina", last_name: "Tan", email: "a@example.com" })
    ).toBe("Amina Tan");
    expect(formatActorDisplayName({ first_name: null, last_name: null, email: "ops@example.com" })).toBe(
      "ops@example.com"
    );
    expect(formatActorDisplayName(null)).toBe("System");
    expect(formatActorDisplayName({ first_name: "", last_name: "", email: "" })).toBe("System");
  });
});

describe("prospectus review completion checklist", () => {
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

  it("does not treat incomplete optional sections as submit blockers", () => {
    const draft = completeOfficerDraft();

    const checklist = buildProspectusCompletionChecklist(draft);
    expect(checklist.find((i) => i.id === "paymaster")?.required).toBe(false);
    expect(checklist.find((i) => i.id === "financials")?.required).toBe(false);
    expect(checklist.find((i) => i.id === "highlights")?.complete).toBe(true);
    expect(checklist.find((i) => i.id === "credit")?.complete).toBe(true);
    expect(isProspectusDraftReadyToSubmit(draft)).toBe(true);

    const withIncomeYears = buildProspectusCompletionChecklist(draft, {
      incomeStatementYears: ["2022", "2023", "2024"],
    });
    expect(withIncomeYears.find((i) => i.id === "financials")?.required).toBe(true);
    expect(withIncomeYears.find((i) => i.id === "financials")?.complete).toBe(false);
  });

  it("uses Complete / Required / Optional without progression icon symbols", () => {
    expect(PROSPECTUS_STEP_STATUS_LABEL).toEqual({
      complete: "Complete",
      required: "Required",
      optional: "Optional",
    });
    expect(Object.values(PROSPECTUS_STEP_STATUS_LABEL).join(" ")).not.toMatch(/[✓!○]/);

    const statuses = getProspectusStepStatuses(emptyDraft());
    expect(statuses[0]).toBe("required");
    expect(statuses[1]).toBe("required");
    expect(statuses[2]).toBe("required");
    expect(statuses[3]).toBeUndefined();

    const withIncome = getProspectusStepStatuses(emptyDraft(), {
      incomeStatementYears: ["2024"],
    });
    expect(withIncome[2]).toBe("required");
  });

  it("maps checklist rows to workflow steps for navigation", () => {
    expect(CHECKLIST_ITEM_STEP).toEqual({
      core: 0,
      highlights: 0,
      paymaster: 1,
      credit: 1,
      financials: 2,
      takeaways: 2,
    });

    const checklist = buildProspectusCompletionChecklist(emptyDraft());
    expect(checklist.map((i) => i.label)).toEqual([
      "Note & Investment Details",
      "Investor Highlights",
      "Paymaster Track Record",
      "Issuer, Credit & Invoice",
      "Financial Review",
      "Investor Takeaways",
    ]);
    expect(statusForCompletionItem(checklist[0]!)).toBe("complete");
    expect(statusForCompletionItem(checklist[1]!)).toBe("required");
    expect(statusForCompletionItem(checklist[2]!)).toBe("optional");
  });

  it("lists missing required fields without optional paymaster track", () => {
    const missing = buildProspectusMissingRequiredFields(emptyDraft(), {
      incomeStatementYears: ["2024"],
    });
    expect(missing.some((m) => m.section === "Paymaster Track Record")).toBe(false);
    expect(missing.some((m) => m.field === "Company Size")).toBe(true);
    expect(missing.some((m) => m.section === "Financial Comparison")).toBe(true);
    expect(missing.some((m) => m.year === "FY2024")).toBe(true);
  });
});

describe("prospectus review step title icons", () => {
  it("maps every workflow step to an Application Review style icon", () => {
    expect(PROSPECTUS_STEP_ICON_NAMES).toEqual({
      0: "DocumentTextIcon",
      1: "BuildingOffice2Icon",
      2: "BanknotesIcon",
      3: "EyeIcon",
    });
    expect(PROSPECTUS_STEP_ICON_CLASS).toBe("h-5 w-5 shrink-0 text-primary");
  });

  it("keeps layout tokens for aligned steps and active cards", () => {
    expect(PROSPECTUS_STEPS_GRID_CLASS).toContain("items-start");
    expect(PROSPECTUS_STEPS_GRID_CLASS).toContain("grid");
    expect(PROSPECTUS_ACTIVE_COLUMN_CLASS).toContain("flex");
    expect(PROSPECTUS_ACTIVE_COLUMN_CLASS).toContain("gap-4");
    expect(PROSPECTUS_ACTIVE_COLUMN_CLASS).not.toContain("space-y");
    expect(PROSPECTUS_ACTIVE_COLUMN_CLASS).not.toMatch(/mt-|pt-/);
  });
});

describe("prospectus review compact status badges", () => {
  it("uses compact badge sizing and existing workflow tones", () => {
    expect(PROSPECTUS_STATUS_BADGE_COMPACT_CLASS).toContain("h-5");
    expect(PROSPECTUS_STATUS_BADGE_COMPACT_CLASS).toContain("text-[10px]");
    expect(PROSPECTUS_STATUS_BADGE_COMPACT_CLASS).toContain("px-1.5");
    expect(PROSPECTUS_STATUS_BADGE_COMPACT_CLASS).toContain("shrink-0");
    expect(PROSPECTUS_STATUS_BADGE_TONE.complete).toMatch(/success/);
    expect(PROSPECTUS_STATUS_BADGE_TONE.required).toMatch(/amber/);
    expect(PROSPECTUS_STATUS_BADGE_TONE.optional).toMatch(/neutral/);
  });
});

describe("prospectus review action visibility", () => {
  it("shows Save Draft, Save & Preview, and Approve for DRAFT while unpublished", () => {
    for (const step of [0, 1, 2, 3] as const) {
      const actions = getProspectusActionVisibility({
        step,
        status: "DRAFT",
        canManage: true,
        notePublished: false,
      });
      expect(actions.saveDraft).toBe(true);
      expect(actions.saveAndPreview).toBe(true);
      expect(actions.approve).toBe(true);
      expect(actions.viewProspectus).toBe(false);
    }
  });

  it("maps legacy READY_FOR_REVIEW to Draft actions (editable, no submit path)", () => {
    const actions = getProspectusActionVisibility({
      step: 3,
      status: "READY_FOR_REVIEW",
      canManage: true,
      notePublished: false,
    });
    expect(actions.saveDraft).toBe(true);
    expect(actions.saveAndPreview).toBe(true);
    expect(actions.approve).toBe(true);
    expect(actions.viewProspectus).toBe(false);
  });

  it("keeps Save & Preview on APPROVED until Note is published", () => {
    const approved = getProspectusActionVisibility({
      step: 2,
      status: "APPROVED",
      canManage: true,
      notePublished: false,
    });
    expect(approved.saveDraft).toBe(true);
    expect(approved.saveAndPreview).toBe(true);
    expect(approved.approve).toBe(true);
    expect(approved.backToNote).toBe(true);
    expect(approved.viewProspectus).toBe(false);

    const published = getProspectusActionVisibility({
      step: 3,
      status: "APPROVED",
      canManage: true,
      notePublished: true,
    });
    expect(published.saveDraft).toBe(false);
    expect(published.saveAndPreview).toBe(false);
    expect(published.approve).toBe(false);
    expect(published.viewProspectus).toBe(true);
  });

  it("blocks approval readiness when required checklist items are incomplete", () => {
    const draft: ProspectusReviewStoredContent = {
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
    expect(isProspectusDraftReadyToSubmit(draft)).toBe(false);
    expect(buildProspectusCompletionChecklist(draft).find((i) => i.id === "highlights")?.complete).toBe(
      false
    );
    const actions = getProspectusActionVisibility({
      step: 3,
      status: "DRAFT",
      canManage: true,
      notePublished: false,
    });
    expect(actions.approve).toBe(true);
  });
});
