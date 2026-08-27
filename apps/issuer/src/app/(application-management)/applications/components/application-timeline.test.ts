import type { ApplicationLogEntry } from "@/hooks/use-application-logs";
import type { NormalizedApplication } from "../status";
import { buildApplicationTimeline } from "./application-timeline";

function makeApp(overrides: Partial<NormalizedApplication> = {}): NormalizedApplication {
  return {
    id: "app_1",
    type: "Facility financing",
    status: "SUBMITTED",
    cardStatus: {
      badgeKey: "submitted",
      displayLabel: "Submitted",
      showReviewOffer: false,
      showMakeAmendments: false,
    },
    contractTitle: null,
    contractId: null,
    customer: "Acme Trading",
    applicationDate: "2026-08-01",
    submittedAt: "2026-08-01",
    contractValue: null,
    facilityApplied: 125000,
    offeredFacilityAmount: null,
    approvedFacility: "—",
    approvedFacilityAmount: null,
    facilityFeeRatePercent: null,
    facilityFeeCapAmount: null,
    facilityFeePaidAmount: null,
    updatedAt: "2026-08-01",
    invoices: [],
    contractStatus: null,
    signedContractOfferLetterAvailable: false,
    signedContractOfferLetterS3Key: null,
    applicationStatus: "SUBMITTED",
    canWithdraw: true,
    facilityInForceNoInvoices: false,
    ...overrides,
  } as NormalizedApplication;
}

function makeLog(overrides: Partial<ApplicationLogEntry> = {}): ApplicationLogEntry {
  return {
    id: "log_1",
    event_type: "CONTRACT_OFFER_SENT",
    created_at: "2026-08-01T10:00:00.000Z",
    ...overrides,
  } as ApplicationLogEntry;
}

describe("buildApplicationTimeline — newly-approved issuer-visible milestones", () => {
  const NEWLY_VISIBLE_EVENTS = [
    "CONTRACT_OFFER_ACCEPTANCE_SUBMITTED",
    "CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED",
    "CONTRACT_OFFER_EXPIRED",
    "CONTRACT_SIGNING_DEADLINE_EXTENDED",
    "INVOICE_OFFER_ACCEPTANCE_SUBMITTED",
    "INVOICE_OFFER_ACCEPTANCE_RESUBMITTED",
    "INVOICE_OFFER_EXPIRED",
    "INVOICE_SIGNING_DEADLINE_EXTENDED",
  ];

  it.each(NEWLY_VISIBLE_EVENTS)("renders a milestone (not a raw fallback) for %s", (eventType) => {
    const milestones = buildApplicationTimeline([makeLog({ id: "l1", event_type: eventType })], makeApp());
    expect(milestones).toHaveLength(1);
    expect(milestones[0]?.label).not.toBe(eventType.replace(/_/g, " ").toLowerCase());
    expect(milestones[0]?.label.length).toBeGreaterThan(0);
  });

  it("does not expose intentionally admin-only events (approved-for-signing gate)", () => {
    const ADMIN_ONLY_EVENTS = [
      "CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING",
      "INVOICE_ACCEPTANCE_APPROVED_FOR_SIGNING",
    ];
    for (const eventType of ADMIN_ONLY_EVENTS) {
      const milestones = buildApplicationTimeline(
        [makeLog({ id: "l1", event_type: eventType })],
        makeApp()
      );
      // No log-derived milestones means it fell through to the status-fallback timeline instead
      // of rendering the admin-only log row.
      expect(milestones.every((m) => m.source === "status")).toBe(true);
    }
  });

  it("labels AMENDMENTS_SUBMITTED as CashSouk sending an amendment request", () => {
    const milestones = buildApplicationTimeline(
      [makeLog({ id: "amd", event_type: "AMENDMENTS_SUBMITTED" })],
      makeApp()
    );
    expect(milestones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "amd",
          source: "log",
          label: "Amendment Request Sent",
        }),
      ])
    );
    expect(milestones.find((m) => m.id === "amd")?.label).not.toMatch(/you submitted/i);
    expect(milestones.find((m) => m.id === "amd")?.label).not.toMatch(/amendments submitted/i);
  });

  it("keeps APPLICATION_RESUBMITTED as the issuer submitting updated content", () => {
    const milestones = buildApplicationTimeline(
      [makeLog({ id: "resub", event_type: "APPLICATION_RESUBMITTED" })],
      makeApp()
    );
    expect(milestones.find((m) => m.id === "resub")?.label).toBe("You Resubmitted This Application");
  });

  it("keeps a stable mix of milestones visible together in chronological order", () => {
    const milestones = buildApplicationTimeline(
      [
        makeLog({
          id: "l1",
          event_type: "CONTRACT_OFFER_ACCEPTANCE_SUBMITTED",
          created_at: "2026-08-01T10:00:00.000Z",
        }),
        makeLog({
          id: "l2",
          event_type: "CONTRACT_SIGNING_DEADLINE_EXTENDED",
          created_at: "2026-08-05T10:00:00.000Z",
        }),
      ],
      makeApp()
    );
    expect(milestones.map((m) => m.id)).toEqual(["l2", "l1"]);
  });
});
