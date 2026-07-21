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

  it("uses concise step titles without repeated page prefixes", () => {
    expect(PROSPECTUS_STEP_TITLES[0]).toBe("Note & Investment Details");
    expect(PROSPECTUS_STEP_TITLES[3]).toBe("Credit & Invoice Details");
    expect(PROSPECTUS_STEP_TITLES[6]).toBe("Preview & Approval");
    const mainLabels = PROSPECTUS_STEP_GROUPS.flatMap((g) => g.steps.map((s) => s.label));
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

  it("does not treat incomplete optional sections as submit blockers", () => {
    const draft = emptyDraft();
    draft.page1.keyInvestorHighlights = [
      { key: "paymaster", title: "Paymaster title", description: "Paymaster body" },
      { key: "issuer_fundamentals", title: "Issuer title", description: "Issuer body" },
      { key: "return", title: "Return title", description: "Return body" },
      { key: "shariah", title: "Shariah title", description: "Shariah body" },
    ];
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
      revenueProfitabilityOptionKey: "placeholder_positive",
      liquidityOptionKey: "do_not_display",
      leverageOptionKey: "placeholder_moderate",
      debtServicingCapacityOptionKey: "placeholder_adequate",
      workingCapitalEfficiencyOptionKey: "placeholder_typical",
      overallFinancialProfileOptionKey: "placeholder_balanced",
    };

    const checklist = buildProspectusCompletionChecklist(draft);
    expect(checklist.find((i) => i.id === "paymaster")?.required).toBe(false);
    expect(checklist.find((i) => i.id === "financials")?.required).toBe(false);
    expect(checklist.find((i) => i.id === "highlights")?.complete).toBe(true);
    expect(isProspectusDraftReadyToSubmit(draft)).toBe(true);
  });

  it("uses Complete / Required / Optional without progression icon symbols", () => {
    expect(PROSPECTUS_STEP_STATUS_LABEL).toEqual({
      complete: "Complete",
      required: "Required",
      optional: "Optional",
    });
    expect(Object.values(PROSPECTUS_STEP_STATUS_LABEL).join(" ")).not.toMatch(/[✓!○]/);

    const statuses = getProspectusStepStatuses(emptyDraft());
    expect(statuses[0]).toBe("complete");
    expect(statuses[1]).toBe("required");
    expect(statuses[2]).toBe("optional");
    expect(statuses[3]).toBe("required");
    expect(statuses[4]).toBe("optional");
    expect(statuses[5]).toBe("required");
    expect(statuses[6]).toBeUndefined();
  });

  it("maps checklist rows to workflow steps for navigation", () => {
    expect(CHECKLIST_ITEM_STEP).toEqual({
      core: 0,
      highlights: 1,
      paymaster: 2,
      credit: 3,
      financials: 4,
      takeaways: 5,
    });

    const checklist = buildProspectusCompletionChecklist(emptyDraft());
    expect(checklist.map((i) => i.label)).toEqual([
      "Note & Investment Details",
      "Investor Highlights",
      "Issuer & Paymaster",
      "Credit & Invoice Details",
      "Financial Review",
      "Investor Takeaways",
    ]);
    expect(statusForCompletionItem(checklist[0]!)).toBe("complete");
    expect(statusForCompletionItem(checklist[1]!)).toBe("required");
    expect(statusForCompletionItem(checklist[2]!)).toBe("optional");
  });
});

describe("prospectus review step title icons", () => {
  it("maps every workflow step to an Application Review style icon", () => {
    expect(PROSPECTUS_STEP_ICON_NAMES).toEqual({
      0: "DocumentTextIcon",
      1: "StarIcon",
      2: "BuildingOffice2Icon",
      3: "ClipboardDocumentCheckIcon",
      4: "BanknotesIcon",
      5: "LightBulbIcon",
      6: "EyeIcon",
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
    for (const step of [0, 1, 2, 3, 4, 5, 6] as const) {
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
      step: 6,
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
      step: 6,
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
      step: 6,
      status: "DRAFT",
      canManage: true,
      notePublished: false,
    });
    expect(actions.approve).toBe(true);
  });
});
