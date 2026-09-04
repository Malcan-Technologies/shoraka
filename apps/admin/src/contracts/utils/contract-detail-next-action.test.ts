import fs from "node:fs";
import path from "node:path";
import type { AdminContractApplicationSummary } from "@cashsouk/types";
import {
  CONTRACT_REFERENCE_TAB_TOKEN,
  contractApplicationsNeedingAction,
  isContractDetailTabId,
  isVisibleContractDetailTabId,
  resolveContractApplicationsTabToken,
  resolveContractDetailHeroNav,
  resolveContractDetailNextAction,
  resolveContractDetailTitle,
  STANDALONE_HOLDER_HIDDEN_TAB_IDS,
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
    kind: "invoice",
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

describe("isVisibleContractDetailTabId", () => {
  it("hides facility and drawdown tabs on standalone holders", () => {
    expect([...STANDALONE_HOLDER_HIDDEN_TAB_IDS]).toEqual(["facility-offer", "notes"]);
    expect(isVisibleContractDetailTabId("overview", { isStandaloneHolder: true })).toBe(true);
    expect(isVisibleContractDetailTabId("applications", { isStandaloneHolder: true })).toBe(true);
    expect(isVisibleContractDetailTabId("documents", { isStandaloneHolder: true })).toBe(true);
    expect(isVisibleContractDetailTabId("activity", { isStandaloneHolder: true })).toBe(true);
    expect(isVisibleContractDetailTabId("facility-offer", { isStandaloneHolder: true })).toBe(
      false
    );
    expect(isVisibleContractDetailTabId("notes", { isStandaloneHolder: true })).toBe(false);
    expect(isVisibleContractDetailTabId("facility-offer")).toBe(true);
    expect(isVisibleContractDetailTabId("notes", { isStandaloneHolder: false })).toBe(true);
    expect(isVisibleContractDetailTabId("ledger", { isStandaloneHolder: true })).toBe(false);
  });
});

describe("resolveContractDetailHeroNav", () => {
  it("keeps facility navigation for real facilities", () => {
    expect(resolveContractDetailHeroNav(false)).toEqual({
      backHref: "/contracts",
      backLabel: "Facilities",
      eyebrow: "Facility detail",
    });
  });

  it("routes standalone holders back to Applications as a customer record", () => {
    expect(resolveContractDetailHeroNav(true)).toEqual({
      backHref: "/applications",
      backLabel: "Applications",
      eyebrow: "Standalone invoice customer",
    });
  });
});

describe("resolveContractDetailTitle", () => {
  it("falls back to the customer name for standalone holders", () => {
    expect(
      resolveContractDetailTitle({
        title: "  ",
        isStandaloneHolder: true,
        customerName: " Acme Trading ",
      })
    ).toBe("Acme Trading");
    expect(
      resolveContractDetailTitle({
        title: null,
        isStandaloneHolder: true,
        customerName: null,
      })
    ).toBe("Untitled customer");
    expect(resolveContractDetailTitle({ title: null, isStandaloneHolder: false })).toBe(
      "Untitled facility"
    );
    expect(
      resolveContractDetailTitle({
        title: "Named facility",
        isStandaloneHolder: true,
        customerName: "Acme Trading",
      })
    ).toBe("Named facility");
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

  it("uses customer wording for standalone holder applications", () => {
    expect(
      resolveContractDetailNextAction(
        { applications: [application("SUBMITTED")] },
        { isStandaloneHolder: true }
      )?.title
    ).toBe("An application for this customer needs review");
  });
});

describe("contract detail default tab", () => {
  const viewSource = fs.readFileSync(
    path.join(__dirname, "../components/contract-detail-view.tsx"),
    "utf8"
  );

  it("defaults to Overview unless ?tab= already names a valid tab", () => {
    expect(viewSource).toContain('computedTab: data ? "overview" : null');
    expect(viewSource).toContain("isVisibleContractDetailTabId(activeTab, { isStandaloneHolder })");
    expect(viewSource).toContain(': "overview"');
    expect(viewSource).not.toContain("computedTab: data ? nextAction?.tabId");
  });

  it("keeps the banner CTA so Overview can switch to Applications", () => {
    expect(viewSource).toContain("ctaLabel={nextAction.ctaLabel}");
    expect(viewSource).toContain("onClick={() => setActiveTab(nextAction.tabId)}");
  });

  it("surfaces a waiting note when the issuer still owes the upfront facility fee", () => {
    expect(viewSource).toContain("resolveContractFacilityFeeWaitingNote");
    expect(viewSource).toContain("facilityFeeWaitingNote");
    expect(viewSource).toContain("Open Facility & Offer");
  });

  it("treats standalone holders as customer records, not facilities", () => {
    expect(viewSource).toContain("isStandaloneHolder");
    expect(viewSource).toContain(
      "Customer record for standalone invoice applications; not a facility."
    );
    expect(viewSource).toContain("isVisibleContractDetailTabId");
    expect(viewSource).toContain("resolveContractDetailTitle");
    expect(viewSource).toContain("resolveContractDetailHeroNav");
    expect(viewSource).toContain("Standalone invoice applications");
    expect(viewSource).toContain("metrics={data.isStandaloneHolder ? [] : headerMetrics}");
    expect(viewSource).toContain("data.isStandaloneHolder ? null : (");
    expect(viewSource).toContain("backHref={heroNav.backHref}");
    expect(viewSource).toContain("backLabel={heroNav.backLabel}");
    expect(viewSource).toContain("eyebrow={heroNav.eyebrow}");
    expect(viewSource).not.toContain('eyebrow="Facility detail"');
    expect(viewSource).not.toContain('backHref="/contracts"');
    expect(viewSource).toContain('role="alert"');
    expect(viewSource).toContain("!data.isStandaloneHolder ? (");
    expect(viewSource).toContain('value="facility-offer"');
    expect(viewSource).toContain('value="notes"');
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
    expect(viewSource).toContain("metrics={data.isStandaloneHolder ? [] : headerMetrics}");
    expect(viewSource).toContain("formatContractFacilityNoteCount");
    expect(viewSource).toContain('setActiveTab("notes")');
    expect(viewSource).not.toContain("Approved Facility");
    expect(viewSource).not.toContain('title="Contract information"');
    expect(viewSource).not.toContain('label="Created"');
    expect(viewSource).not.toContain('label="Last updated"');
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
    expect(resolveContractFacilityOfferTabToken({ status: "SUBMITTED", offerDetails: null })).toBe(
      "submitted"
    );
    expect(resolveContractFacilityOfferTabToken({ status: "DRAFT", offerDetails: null })).toBe(
      "neutral"
    );
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

  it("dots Drawdowns from the highest child-note status", () => {
    expect(resolveContractNotesTabToken([])).toBe("neutral");
    expect(resolveContractNotesTabToken([{ status: "REPAID" }, { status: "FUNDING" }])).toBe(
      "action"
    );
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
