import fs from "node:fs";
import path from "node:path";
import type { AdminContractApplicationSummary } from "@cashsouk/types";
import {
  CONTRACT_REFERENCE_TAB_TOKEN,
  contractApplicationsNeedingAction,
  isContractDetailTabId,
  resolveContractApplicationsTabToken,
  resolveContractDetailNextAction,
  resolveContractDocumentsTabToken,
  resolveContractFacilityOfferTabToken,
  resolveContractNotesTabToken,
  resolveContractOverviewTabToken,
} from "./contract-detail-next-action";

function application(
  status: string,
  overrides: Partial<AdminContractApplicationSummary> = {}
): AdminContractApplicationSummary {
  return {
    id: `app-${status}`,
    displayReference: null,
    productId: "invoice-financing",
    status,
    submittedAt: null,
    updatedAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    requestedAmount: 100000,
    ...overrides,
  };
}

describe("isContractDetailTabId", () => {
  it("accepts the contract detail tabs and rejects anything else", () => {
    expect(isContractDetailTabId("overview")).toBe(true);
    expect(isContractDetailTabId("facility-offer")).toBe(true);
    expect(isContractDetailTabId("applications")).toBe(true);
    expect(isContractDetailTabId("notes")).toBe(true);
    expect(isContractDetailTabId("documents")).toBe(true);
    expect(isContractDetailTabId("activity")).toBe(true);
    expect(isContractDetailTabId("ledger")).toBe(false);
    expect(isContractDetailTabId("")).toBe(false);
  });
});

describe("contractApplicationsNeedingAction", () => {
  it("keeps only applications waiting on CashSouk", () => {
    const pending = contractApplicationsNeedingAction([
      application("SUBMITTED"),
      application("OFFER_SENT"),
      application("APPROVED"),
      application("UNDER_REVIEW"),
    ]);

    expect(pending.map((item) => item.status)).toEqual(["SUBMITTED", "UNDER_REVIEW"]);
  });
});

describe("resolveContractApplicationsTabToken", () => {
  it("is neutral without applications", () => {
    expect(resolveContractApplicationsTabToken([])).toBe("neutral");
  });

  it("prefers admin action over waiting and finished states", () => {
    expect(
      resolveContractApplicationsTabToken([
        application("APPROVED"),
        application("OFFER_SENT"),
        application("SUBMITTED"),
      ])
    ).toBe("action");
  });

  it("shows waiting when nothing is on CashSouk", () => {
    expect(
      resolveContractApplicationsTabToken([application("APPROVED"), application("OFFER_SENT")])
    ).toBe("submitted");
  });

  it("shows the finished state when every application is closed out", () => {
    expect(resolveContractApplicationsTabToken([application("APPROVED")])).toBe("success");
    expect(resolveContractApplicationsTabToken([application("REJECTED")])).toBe("rejected");
  });
});

describe("resolveContractDetailNextAction", () => {
  it("returns nothing when no application needs review", () => {
    expect(
      resolveContractDetailNextAction({
        applications: [application("APPROVED"), application("OFFER_SENT")],
      })
    ).toBeNull();
  });

  it("points at the Applications tab for a single pending review", () => {
    const nextAction = resolveContractDetailNextAction({
      applications: [application("APPROVED"), application("SUBMITTED")],
    });

    expect(nextAction).toEqual({
      tabId: "applications",
      title: "An application on this facility needs review",
      description:
        "One linked application is waiting on CashSouk. Open it from the Applications tab to continue the review.",
      ctaLabel: "Open Applications",
    });
  });

  it("counts multiple pending reviews", () => {
    const nextAction = resolveContractDetailNextAction({
      applications: [application("SUBMITTED"), application("RESUBMITTED"), application("APPROVED")],
    });

    expect(nextAction?.title).toBe("2 applications on this facility need review");
    expect(nextAction?.tabId).toBe("applications");
  });
});

describe("contract detail default tab", () => {
  const viewSource = fs.readFileSync(
    path.join(__dirname, "../components/contract-detail-view.tsx"),
    "utf8"
  );

  it("defaults to Overview unless ?tab= already names a valid tab", () => {
    expect(viewSource).toContain('computedTab: data ? "overview" : null');
    expect(viewSource).toContain("const resolvedTab: ContractDetailTabId = activeTab ?? \"overview\"");
    expect(viewSource).not.toContain("computedTab: data ? nextAction?.tabId");
  });

  it("keeps the banner CTA so Overview can switch to Applications", () => {
    expect(viewSource).toContain("ctaLabel={nextAction.ctaLabel}");
    expect(viewSource).toContain("onClick={() => setActiveTab(nextAction.tabId)}");
  });

  it("does not preserve-mount contract panels", () => {
    expect(viewSource).not.toContain("preserveMount");
  });

  it("dots every tab and uses the header utilization bar", () => {
    expect(viewSource).toContain("resolveContractOverviewTabToken");
    expect(viewSource).toContain("resolveContractFacilityOfferTabToken");
    expect(viewSource).toContain("resolveContractNotesTabToken");
    expect(viewSource).toContain("resolveContractDocumentsTabToken");
    expect(viewSource).toContain("CONTRACT_REFERENCE_TAB_TOKEN");
    expect(viewSource).toContain('id: "activity"');
    expect(viewSource).toContain("AdminDetailCardHeader");
    expect(viewSource).toContain("ContractActivityPanel");
    expect(viewSource).not.toContain("ContractTabHeading");
    expect(viewSource).toContain("AdminMetricProgress");
    expect(viewSource).toContain('variant="hero"');
    expect(viewSource).toContain("AdminEntitySummaryCard");
    expect(viewSource).toContain("getContractHeaderEndDate");
    expect(viewSource).toContain("getContractHeaderMetrics");
    expect(viewSource).toContain("metrics={headerMetrics}");
    expect(viewSource).toContain("formatContractFacilityNoteCount");
    expect(viewSource).toContain('setActiveTab("notes")');
    expect(viewSource).not.toContain("Approved Facility");
    expect(viewSource).not.toContain("title=\"Contract information\"");
    expect(viewSource).not.toContain("label=\"Created\"");
    expect(viewSource).not.toContain("label=\"Last updated\"");
  });
});

describe("admin detail tab dots", () => {
  const tabsSource = fs.readFileSync(
    path.join(__dirname, "../../components/admin-detail/admin-detail-tabs.tsx"),
    "utf8"
  );

  it("centers the strip and uses the same bare status dots as application review tabs", () => {
    expect(tabsSource).toContain("justify-center gap-2");
    expect(tabsSource).toContain("STATUS_BADGE_GROUPS");
    expect(tabsSource).toContain("h-2 w-2 shrink-0 rounded-full");
    expect(tabsSource).toContain("bg-amber-400 dark:bg-amber-300");
    expect(tabsSource).toContain("STATUS_BADGE_GROUPS.completed.dotClass");
    expect(tabsSource).toContain("STATUS_BADGE_GROUPS.admin_action.dotClass");
    expect(tabsSource).not.toContain("STATUS_TOKEN_DOT_CLASS");
    expect(tabsSource).not.toContain("STATUS_TOKEN_BG_CLASS");
  });
});

describe("contract tab dots", () => {
  it("maps the overview dot from contract status", () => {
    expect(resolveContractOverviewTabToken("UNDER_REVIEW")).toBe("action");
    expect(resolveContractOverviewTabToken("ACTIVE")).toBe("active");
    expect(resolveContractOverviewTabToken("DRAFT")).toBe("neutral");
  });

  it("treats an unsent offer as waiting when the contract still needs work elsewhere", () => {
    expect(
      resolveContractFacilityOfferTabToken({ status: "SUBMITTED", offerDetails: null })
    ).toBe("submitted");
    expect(
      resolveContractFacilityOfferTabToken({ status: "DRAFT", offerDetails: null })
    ).toBe("neutral");
    expect(
      resolveContractFacilityOfferTabToken({
        status: "OFFER_SENT",
        offerDetails: { sent_at: "2026-01-01" },
      })
    ).toBe("submitted");
    expect(
      resolveContractFacilityOfferTabToken({
        status: "ACTIVE",
        offerDetails: { sent_at: "2026-01-01", responded_at: "2026-01-02" },
      })
    ).toBe("success");
  });

  it("dots Notes from the highest child-note status", () => {
    expect(resolveContractNotesTabToken([])).toBe("neutral");
    expect(
      resolveContractNotesTabToken([{ status: "REPAID" }, { status: "FUNDING" }])
    ).toBe("action");
    expect(resolveContractNotesTabToken([{ status: "PUBLISHED" }])).toBe("submitted");
  });

  it("dots Documents green only when a file is on record", () => {
    expect(resolveContractDocumentsTabToken(false)).toBe("neutral");
    expect(resolveContractDocumentsTabToken(true)).toBe("success");
  });

  it("keeps Activity grey because it has no workflow status", () => {
    expect(CONTRACT_REFERENCE_TAB_TOKEN).toBe("neutral");
  });
});