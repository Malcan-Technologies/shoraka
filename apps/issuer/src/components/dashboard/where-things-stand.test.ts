import {
  DRAWDOWN_ORIGINATION_STEPS,
  FACILITY_ORIGINATION_STEPS,
  INVOICE_ONLY_ORIGINATION_STEPS,
  NOTE_PIPELINE_STEPS,
  DASHBOARD_LIST_PAGE_SIZE,
  effectiveOriginationKind,
  isInFlightApplicationBadge,
  isOfferAccepted,
  nextDashboardVisibleCount,
  originationBadgeFromInvoiceStatus,
  originationKindLabel,
  pipelineStepLabel,
  pipelineStepStates,
  resolveNotePipeline,
  resolveOriginationKind,
  resolveOriginationPipeline,
  shouldShowWhereThingsStandApplication,
  takeDashboardPreview,
} from "./where-things-stand";

describe("where things stand origination", () => {
  it("keeps closed, completed, and draft applications off the origination list", () => {
    expect(isInFlightApplicationBadge("completed")).toBe(false);
    expect(isInFlightApplicationBadge("draft")).toBe(false);
    expect(isInFlightApplicationBadge("offer_sent")).toBe(true);
    expect(shouldShowWhereThingsStandApplication("completed")).toBe(false);
    expect(shouldShowWhereThingsStandApplication("amendment_requested")).toBe(true);
  });

  it("does not keep completed facilities on the application list because a note is raising", () => {
    expect(shouldShowWhereThingsStandApplication("completed")).toBe(false);
  });

  it("uses facility signing only for a new facility", () => {
    expect(resolveOriginationKind({ structureType: "new_contract" })).toBe("new_contract");
    expect(resolveOriginationPipeline({
      kind: "new_contract",
      badgeKey: "offer_sent",
      offerAccepted: false,
      signed: false,
    })).toEqual({ steps: FACILITY_ORIGINATION_STEPS, currentIndex: 2 });
    expect(resolveOriginationPipeline({
      kind: "new_contract",
      badgeKey: "offer_sent",
      offerAccepted: true,
      signed: false,
    }).currentIndex).toBe(3);
    expect(resolveOriginationPipeline({
      kind: "new_contract",
      badgeKey: "under_review",
      offerAccepted: true,
      signed: true,
    }).currentIndex).toBe(4);
  });

  it("stops invoice-under-facility origination at offer accepted, with no facility signing", () => {
    expect(resolveOriginationKind({ structureType: "existing_contract" })).toBe("existing_contract");
    const pipeline = resolveOriginationPipeline({
      kind: "existing_contract",
      badgeKey: "offer_sent",
      offerAccepted: false,
      signed: false,
    });
    expect(pipeline.steps).toEqual(DRAWDOWN_ORIGINATION_STEPS);
    expect(pipeline.currentIndex).toBe(2);
    expect(pipeline.steps).not.toContain("Facility signed");
    expect(
      resolveOriginationPipeline({
        kind: "existing_contract",
        badgeKey: "offer_sent",
        offerAccepted: true,
        signed: false,
      }).currentIndex
    ).toBe(3);
  });

  it("uses offer signed, not facility signed, for standalone invoices", () => {
    const pipeline = resolveOriginationPipeline({
      kind: "invoice_only",
      badgeKey: "offer_sent",
      offerAccepted: true,
      signed: false,
    });
    expect(pipeline.steps).toEqual(INVOICE_ONLY_ORIGINATION_STEPS);
    expect(pipeline.steps).toContain("Offer signed");
    expect(pipeline.steps).not.toContain("Facility signed");
    expect(pipeline.currentIndex).toBe(3);
  });

  it("switches a signed facility to the drawdown stepper when invoices still need origination", () => {
    expect(
      effectiveOriginationKind({
        structureType: "new_contract",
        facilitySigned: true,
        hasOpenInvoiceOrigination: true,
      })
    ).toBe("existing_contract");
    expect(originationKindLabel("existing_contract")).toBe("Invoice under a facility");
  });

  it("maps invoice statuses onto origination badges", () => {
    expect(originationBadgeFromInvoiceStatus("AMENDMENT_REQUESTED")).toBe("amendment_requested");
    expect(originationBadgeFromInvoiceStatus("OFFER_SENT")).toBe("offer_sent");
    expect(originationBadgeFromInvoiceStatus("SUBMITTED")).toBe("under_review");
  });

  it("turns Offer accepted green only after the issuer accepts", () => {
    expect(isOfferAccepted("PENDING_ISSUER", false)).toBe(false);
    expect(isOfferAccepted("PENDING_ADMIN_REVIEW", false)).toBe(true);
  });

  it("maps note marketplace states onto listing → funding → disbursement", () => {
    expect(resolveNotePipeline("pending_listing")).toEqual({
      steps: NOTE_PIPELINE_STEPS,
      currentIndex: 0,
      failed: false,
    });
    expect(resolveNotePipeline("open").currentIndex).toBe(1);
    expect(resolveNotePipeline("funded").currentIndex).toBe(2);
    expect(pipelineStepStates(3, 1, true, 1)).toEqual(["done", "failed", "upcoming"]);
    expect(pipelineStepLabel("Funding in progress", "failed")).toBe("Funding unsuccessful");
    expect(pipelineStepLabel("Offer accepted", "current")).toBe("Accept offer");
    expect(pipelineStepLabel("Offer accepted", "upcoming")).toBe("Accept offer");
    expect(pipelineStepLabel("Offer accepted", "done")).toBe("Offer accepted");
    expect(pipelineStepLabel("Facility signed", "current")).toBe("Sign facility");
    expect(pipelineStepLabel("Offer signed", "current")).toBe("Sign offer");
    expect(pipelineStepLabel("Reviewed", "current", false)).toBe("Under review");
    expect(pipelineStepLabel("Reviewed", "current", true)).toBe("Make changes");
    expect(pipelineStepLabel("Reviewed", "done")).toBe("Reviewed");
    expect(pipelineStepLabel("Pending listing", "current")).toBe("Awaiting listing");
    expect(pipelineStepLabel("Pending listing", "done")).toBe("Listed");
    expect(pipelineStepLabel("Funding in progress", "current")).toBe("Raising funds");
    expect(pipelineStepLabel("Funds disbursed", "current")).toBe("Awaiting disbursement");
  });

  it("pages origination rows five at a time", () => {
    const preview = takeDashboardPreview(["a", "b", "c", "d", "e", "f"], DASHBOARD_LIST_PAGE_SIZE);
    expect(preview.visible).toHaveLength(5);
    expect(nextDashboardVisibleCount(preview.visible.length, 6)).toBe(6);
  });
});
