import {
  compareSigningOfferStepOrder,
  findSupportingDocumentsStepConfig,
  getCurrentSigningOfferStepId,
  getSigningOfferStepIndex,
  getSigningOfferSteps,
  hasCompletedContractEnvelope,
  hasPostApplicationDocuments,
  isSigningOfferStepReachable,
  resolveReviewOfferModalMode,
} from "./signing-offer-steps";

const unlockedBase = {
  signersLocked: false,
  allDocsSigned: false,
  envelopeCompleted: false,
} as const;

describe("getSigningOfferSteps", () => {
  it("includes documents shell before signers when hasPostDocs is true", () => {
    const steps = getSigningOfferSteps({
      hasPostDocs: true,
      postDocsReady: false,
      ...unlockedBase,
    });
    expect(steps.map((s) => s.id)).toEqual([
      "documents",
      "signers",
      "signing",
      "complete",
    ]);
  });

  it("omits documents when hasPostDocs is false", () => {
    const steps = getSigningOfferSteps({
      hasPostDocs: false,
      postDocsReady: true,
      ...unlockedBase,
    });
    expect(steps.map((s) => s.id)).toEqual(["signers", "signing", "complete"]);
  });
});

describe("getCurrentSigningOfferStepId", () => {
  it("returns documents when hasPostDocs and not ready", () => {
    expect(
      getCurrentSigningOfferStepId({
        hasPostDocs: true,
        postDocsReady: false,
        ...unlockedBase,
      })
    ).toBe("documents");
  });

  it("returns signers when hasPostDocs is false", () => {
    expect(
      getCurrentSigningOfferStepId({
        hasPostDocs: false,
        postDocsReady: true,
        ...unlockedBase,
      })
    ).toBe("signers");
  });
});

describe("hasPostApplicationDocuments", () => {
  it("returns false for missing or empty config", () => {
    expect(hasPostApplicationDocuments(undefined)).toBe(false);
    expect(hasPostApplicationDocuments({ config: {} })).toBe(false);
  });

  it("returns true when a category row has upload_timing post_application", () => {
    expect(
      hasPostApplicationDocuments({
        config: {
          financial: [{ upload_timing: "post_application", required: true }],
        },
      })
    ).toBe(true);
  });

  it("returns false when only pre_application rows exist", () => {
    expect(
      hasPostApplicationDocuments({
        config: {
          financial: [{ upload_timing: "pre_application", required: true }],
        },
      })
    ).toBe(false);
  });
});

describe("findSupportingDocumentsStepConfig", () => {
  it("finds supporting_documents or supporting_documents_* step from workflow", () => {
    expect(
      findSupportingDocumentsStepConfig([
        { id: "company_details", config: {} },
        { id: "supporting_documents", config: { financial: [] } },
      ])
    ).toEqual({ id: "supporting_documents", config: { financial: [] } });

    expect(
      findSupportingDocumentsStepConfig([
        { id: "supporting_documents_v2", config: { legal: [] } },
      ])
    ).toEqual({ id: "supporting_documents_v2", config: { legal: [] } });

    expect(findSupportingDocumentsStepConfig([{ id: "other" }])).toBeUndefined();
    expect(findSupportingDocumentsStepConfig(undefined)).toBeUndefined();
  });
});

describe("getSigningOfferStepIndex / compareSigningOfferStepOrder", () => {
  it("orders documents < signers < signing < complete when hasPostDocs", () => {
    expect(getSigningOfferStepIndex("documents", true)).toBe(0);
    expect(getSigningOfferStepIndex("signers", true)).toBe(1);
    expect(getSigningOfferStepIndex("signing", true)).toBe(2);
    expect(getSigningOfferStepIndex("complete", true)).toBe(3);
    expect(compareSigningOfferStepOrder("documents", "signers", true)).toBeLessThan(0);
    expect(compareSigningOfferStepOrder("signers", "signing", true)).toBeLessThan(0);
    expect(compareSigningOfferStepOrder("signing", "complete", true)).toBeLessThan(0);
  });

  it("returns -1 for documents when hasPostDocs is false", () => {
    expect(getSigningOfferStepIndex("documents", false)).toBe(-1);
    expect(getSigningOfferStepIndex("signers", false)).toBe(0);
  });
});

describe("isSigningOfferStepReachable", () => {
  it("only documents reachable when hasPostDocs and domain cursor is documents", () => {
    expect(isSigningOfferStepReachable("documents", "documents", true)).toBe(true);
    expect(isSigningOfferStepReachable("signers", "documents", true)).toBe(false);
    expect(isSigningOfferStepReachable("signing", "documents", true)).toBe(false);
    expect(isSigningOfferStepReachable("complete", "documents", true)).toBe(false);
  });

  it("documents and signers reachable when unlocked domain cursor is signers", () => {
    expect(isSigningOfferStepReachable("documents", "signers", true)).toBe(true);
    expect(isSigningOfferStepReachable("signers", "signers", true)).toBe(true);
    expect(isSigningOfferStepReachable("signing", "signers", true)).toBe(false);
    expect(isSigningOfferStepReachable("complete", "signers", true)).toBe(false);
  });

  it("documents unreachable when hasPostDocs false; signers reachable as current", () => {
    expect(isSigningOfferStepReachable("documents", "signers", false)).toBe(false);
    expect(isSigningOfferStepReachable("signers", "signers", false)).toBe(true);
    expect(isSigningOfferStepReachable("signing", "signers", false)).toBe(false);
  });

  it("documents and signers remain reachable when domain is at signing (locked review)", () => {
    expect(isSigningOfferStepReachable("documents", "signing", true)).toBe(true);
    expect(isSigningOfferStepReachable("signers", "signing", true)).toBe(true);
    expect(isSigningOfferStepReachable("signing", "signing", true)).toBe(true);
    expect(isSigningOfferStepReachable("complete", "signing", true)).toBe(false);
  });
});

describe("getCurrentSigningOfferStepId locked package", () => {
  it("returns signing when package sent and not all docs signed", () => {
    expect(
      getCurrentSigningOfferStepId({
        hasPostDocs: true,
        postDocsReady: true,
        signersLocked: true,
        allDocsSigned: false,
        envelopeCompleted: false,
      })
    ).toBe("signing");
  });

  it("returns complete when envelope completed", () => {
    expect(
      getCurrentSigningOfferStepId({
        hasPostDocs: true,
        postDocsReady: true,
        signersLocked: true,
        allDocsSigned: true,
        envelopeCompleted: true,
      })
    ).toBe("complete");
  });
});

describe("resolveReviewOfferModalMode", () => {
  it("uses contract package stepper for contract offers", () => {
    expect(
      resolveReviewOfferModalMode({
        offerType: "contract",
        invoiceContractId: null,
        hasCompletedContractEnvelope: false,
      })
    ).toEqual({ ui: "signing_stepper", packageKind: "contract" });
  });

  it("uses invoice package stepper for invoice-only offers", () => {
    expect(
      resolveReviewOfferModalMode({
        offerType: "invoice",
        invoiceContractId: null,
        hasCompletedContractEnvelope: false,
      })
    ).toEqual({ ui: "signing_stepper", packageKind: "invoice" });
  });

  it("allows Accept/Decline when contract-linked and contract envelope is COMPLETED", () => {
    expect(
      resolveReviewOfferModalMode({
        offerType: "invoice",
        invoiceContractId: "ctr-1",
        hasCompletedContractEnvelope: true,
      })
    ).toEqual({ ui: "accept_decline", canAccept: true });
  });

  it("blocks Accept when contract-linked but contract envelope is not COMPLETED", () => {
    const mode = resolveReviewOfferModalMode({
      offerType: "invoice",
      invoiceContractId: "ctr-1",
      hasCompletedContractEnvelope: false,
    });
    expect(mode).toMatchObject({ ui: "accept_decline", canAccept: false });
    if (mode.ui === "accept_decline") {
      expect(mode.blockedMessage).toMatch(/contract signing/i);
    }
  });
});

describe("hasCompletedContractEnvelope", () => {
  it("is true when a COMPLETED envelope targets the contract", () => {
    expect(
      hasCompletedContractEnvelope(
        [
          { contract_id: "other", status: "COMPLETED" },
          { contract_id: "ctr-1", status: "COMPLETED" },
        ],
        "ctr-1"
      )
    ).toBe(true);
  });

  it("is false when the contract envelope is not COMPLETED", () => {
    expect(
      hasCompletedContractEnvelope(
        [{ contract_id: "ctr-1", status: "IN_PROGRESS" }],
        "ctr-1"
      )
    ).toBe(false);
  });

  it("is false when contractId is missing", () => {
    expect(
      hasCompletedContractEnvelope([{ contract_id: "ctr-1", status: "COMPLETED" }], null)
    ).toBe(false);
  });
});
