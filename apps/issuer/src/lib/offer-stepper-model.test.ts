import { buildHorizontalOfferSteps } from "./offer-stepper-model";

const signingBase = {
  kind: "signing" as const,
  offerType: "contract" as const,
  hasPostDocs: true,
  usesAcceptanceFlow: true,
  isExpired: false,
};

describe("buildHorizontalOfferSteps — direct accept", () => {
  it("shows Review terms, Confirm & accept, Listed to investors with accept current", () => {
    const steps = buildHorizontalOfferSteps({
      kind: "direct_accept",
      offerType: "invoice",
      hasPostDocs: false,
      usesAcceptanceFlow: false,
      currentSigningStepId: null,
      isExpired: false,
    });
    expect(steps.map((step) => step.id)).toEqual([
      "review_terms",
      "confirm_accept",
      "listed",
    ]);
    expect(steps.map((step) => step.status)).toEqual(["completed", "current", "pending"]);
    expect(steps.every((step) => step.clickable === false)).toBe(true);
  });

  it("marks Confirm & accept blocked when the offer is expired", () => {
    const steps = buildHorizontalOfferSteps({
      kind: "direct_accept",
      offerType: "invoice",
      hasPostDocs: false,
      usesAcceptanceFlow: false,
      currentSigningStepId: null,
      isExpired: true,
    });
    expect(steps.map((step) => step.status)).toEqual(["pending", "blocked", "pending"]);
  });
});

describe("buildHorizontalOfferSteps — signing", () => {
  it("uses the full facility pipeline including Facility in force", () => {
    const steps = buildHorizontalOfferSteps({
      ...signingBase,
      currentSigningStepId: "representatives",
      clickableSigningStepIds: ["representatives"],
    });
    expect(steps.map((step) => [step.id, step.label])).toEqual([
      ["review_terms", "Review terms"],
      ["representatives", "Representatives"],
      ["documents", "Documents"],
      ["awaiting_review", "CashSouk review"],
      ["signing", "Signing"],
      ["complete", "Facility in force"],
    ]);
    expect(steps[0]?.status).toBe("completed");
    expect(steps[1]?.status).toBe("current");
    expect(steps[1]?.clickable).toBe(true);
    expect(steps[2]?.clickable).toBe(false);
  });

  it("labels the last invoice step Offer complete and skips documents when none are required", () => {
    const steps = buildHorizontalOfferSteps({
      kind: "signing",
      offerType: "invoice",
      hasPostDocs: false,
      usesAcceptanceFlow: true,
      currentSigningStepId: "awaiting_review",
      isExpired: false,
      clickableSigningStepIds: ["awaiting_review"],
    });
    expect(steps.map((step) => step.id)).toEqual([
      "review_terms",
      "representatives",
      "awaiting_review",
      "signing",
      "complete",
    ]);
    expect(steps.at(-1)?.label).toBe("Offer complete");
    expect(steps.find((step) => step.id === "awaiting_review")?.status).toBe("current");
    expect(steps.find((step) => step.id === "awaiting_review")?.clickable).toBe(true);
  });

  it("marks complete when the envelope is finished", () => {
    const steps = buildHorizontalOfferSteps({
      ...signingBase,
      currentSigningStepId: "complete",
      envelopeCompleted: true,
    });
    expect(steps.at(-1)).toMatchObject({ id: "complete", status: "completed" });
    expect(steps.slice(0, -1).every((step) => step.status === "completed")).toBe(true);
  });

  it("uses the legacy signing pair when there is no acceptance flow", () => {
    const steps = buildHorizontalOfferSteps({
      kind: "signing",
      offerType: "invoice",
      hasPostDocs: true,
      usesAcceptanceFlow: false,
      currentSigningStepId: "signing",
      isExpired: false,
      clickableSigningStepIds: ["signing"],
    });
    expect(steps.map((step) => step.id)).toEqual(["review_terms", "signing", "complete"]);
    expect(steps[1]?.status).toBe("current");
    expect(steps[1]?.clickable).toBe(true);
  });

  it("lands declined/rejected on the first action step without advancing later stages", () => {
    const steps = buildHorizontalOfferSteps({
      ...signingBase,
      currentSigningStepId: "declined",
    });
    expect(steps.find((step) => step.id === "representatives")?.status).toBe("current");
    expect(steps.find((step) => step.id === "complete")?.status).toBe("pending");
  });

  it("blocks the action step when a signing offer expires", () => {
    const steps = buildHorizontalOfferSteps({
      ...signingBase,
      currentSigningStepId: "representatives",
      isExpired: true,
    });
    expect(steps.map((step) => step.status)).toEqual([
      "pending",
      "blocked",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
  });
});
