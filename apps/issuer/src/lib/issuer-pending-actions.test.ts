jest.mock("@/app/(application-management)/applications/status", () => ({
  countIssuerApplicationsNeedingAction: () => 0,
  countPendingIssuerOfferReviewItems: () => 0,
  isIssuerApplicationActionable: () => false,
}));

import { actionsRequiredLabel, joinBannerSentences } from "./issuer-action-required";
import { pickIssuerDashboardPendingAction } from "./issuer-pending-actions";

describe("pickIssuerDashboardPendingAction", () => {
  it("keeps a single application action unchanged when financing is already covered there", () => {
    const picked = pickIssuerDashboardPendingAction({
      applications: {
        count: 1,
        title: actionsRequiredLabel(1),
        description: "Update the requested sections and resubmit for review.",
        href: "/applications/app_1/edit",
        ctaLabel: "Make changes",
      },
      financing: {
        count: 1,
        title: actionsRequiredLabel(1),
        description: "Needs attention: 1 facility.",
        href: "/applications/app_1/edit",
        ctaLabel: "Make changes",
        uniqueCount: 0,
        uniqueDescription: null,
      },
    });
    expect(picked).toEqual({
      title: "1 action required",
      description: "Update the requested sections and resubmit for review.",
      href: "/applications/app_1/edit",
      ctaLabel: "Make changes",
      tone: "action",
      source: "applications",
      count: 1,
    });
  });

  it("adds financing-only attention to the same banner as applications", () => {
    const picked = pickIssuerDashboardPendingAction({
      applications: {
        count: 1,
        title: actionsRequiredLabel(1),
        description: "Update the requested sections and resubmit for review.",
        href: "/applications/app_1/edit",
        ctaLabel: "Make changes",
      },
      financing: {
        count: 1,
        title: actionsRequiredLabel(1),
        description:
          "RM 2,500.00 is due now. RM 500.00 will be collected from later drawdowns.",
        href: "/financing/contracts/con_1",
        ctaLabel: "Pay facility fee",
        uniqueCount: 1,
        uniqueDescription:
          "RM 2,500.00 is due now. RM 500.00 will be collected from later drawdowns.",
      },
    });
    expect(picked).toEqual({
      title: "2 actions required",
      description:
        "Update the requested sections and resubmit for review. RM 2,500.00 is due now. RM 500.00 will be collected from later drawdowns.",
      href: "/applications/app_1/edit",
      ctaLabel: "Review now",
      tone: "action",
      source: "applications",
      count: 2,
    });
  });

  it("uses the financing banner when there are no application actions", () => {
    const picked = pickIssuerDashboardPendingAction({
      applications: null,
      financing: {
        count: 1,
        title: actionsRequiredLabel(1),
        description:
          "RM 2,500.00 is due now. RM 500.00 will be collected from later drawdowns.",
        href: "/financing/contracts/con_1",
        ctaLabel: "Pay facility fee",
        uniqueCount: 1,
        uniqueDescription:
          "RM 2,500.00 is due now. RM 500.00 will be collected from later drawdowns.",
      },
    });
    expect(picked?.source).toBe("financing");
    expect(picked?.title).toBe("1 action required");
    expect(picked?.ctaLabel).toBe("Pay facility fee");
    expect(picked?.description).toContain("RM 2,500.00 is due now");
  });

  it("uses the financing banner when only late charges need paying", () => {
    const picked = pickIssuerDashboardPendingAction({
      applications: null,
      financing: {
        count: 1,
        title: actionsRequiredLabel(1),
        description: "Needs attention: 1 invoice.",
        href: "/financing/notes/note_1#late-charges",
        ctaLabel: "Pay outstanding late charges",
        uniqueCount: 1,
        uniqueDescription: "Needs attention: 1 invoice.",
      },
    });
    expect(picked?.source).toBe("financing");
    expect(picked?.ctaLabel).toBe("Pay outstanding late charges");
    expect(picked?.href).toBe("/financing/notes/note_1#late-charges");
  });
});

describe("joinBannerSentences", () => {
  it("drops empty parts so the banner does not repeat blank copy", () => {
    expect(joinBannerSentences("Pay now.", "  ", null, "RM 500.00 later.")).toBe(
      "Pay now. RM 500.00 later."
    );
  });
});
