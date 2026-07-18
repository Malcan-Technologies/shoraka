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
  usesAcceptanceFlow: false,
  acknowledgements: [] as Array<{ key: string; name: string; required?: boolean }>,
  acceptanceStatus: null,
  checkedAcknowledgementKeys: new Set<string>(),
  signersLocked: false,
  allDocsSigned: false,
  envelopeCompleted: false,
} as const;

const legacyShellInput = {
  usesAcceptanceFlow: false,
  hasPostDocs: false,
  acknowledgements: [] as Array<{ key: string; name: string; required?: boolean }>,
  acceptanceStatus: null,
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
  it("returns false for missing or empty workflow", () => {
    expect(hasPostApplicationDocuments(undefined)).toBe(false);
    expect(hasPostApplicationDocuments([])).toBe(false);
  });

  it("returns true for financing_type.acceptance_documents", () => {
    expect(
      hasPostApplicationDocuments([
        {
          id: "financing_type_1",
          config: {
            acceptance_documents: [{ name: "Board Resolution", required: true }],
          },
        },
      ])
    ).toBe(true);
  });

  it("returns true for legacy supporting_documents upload_timing post_application", () => {
    expect(
      hasPostApplicationDocuments([
        {
          id: "supporting_documents_1",
          config: {
            financial_docs: [{ name: "Board Resolution", upload_timing: "post_application" }],
          },
        },
      ])
    ).toBe(true);
  });

  it("returns false when only pre_application rows exist and no acceptance_documents key", () => {
    expect(
      hasPostApplicationDocuments([
        {
          id: "supporting_documents_1",
          config: {
            financial_docs: [{ name: "Mgmt accounts", upload_timing: "pre_application" }],
          },
        },
      ])
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
    const withDocs = { ...legacyShellInput, hasPostDocs: true };
    expect(getSigningOfferStepIndex("documents", withDocs)).toBe(0);
    expect(getSigningOfferStepIndex("signers", withDocs)).toBe(1);
    expect(getSigningOfferStepIndex("signing", withDocs)).toBe(2);
    expect(getSigningOfferStepIndex("complete", withDocs)).toBe(3);
    expect(compareSigningOfferStepOrder("documents", "signers", withDocs)).toBeLessThan(0);
    expect(compareSigningOfferStepOrder("signers", "signing", withDocs)).toBeLessThan(0);
    expect(compareSigningOfferStepOrder("signing", "complete", withDocs)).toBeLessThan(0);
  });

  it("returns -1 for documents when hasPostDocs is false", () => {
    expect(getSigningOfferStepIndex("documents", legacyShellInput)).toBe(-1);
    expect(getSigningOfferStepIndex("signers", legacyShellInput)).toBe(0);
  });
});

describe("isSigningOfferStepReachable", () => {
  const withDocs = { ...legacyShellInput, hasPostDocs: true };

  it("only documents reachable when hasPostDocs and domain cursor is documents", () => {
    expect(isSigningOfferStepReachable("documents", "documents", withDocs)).toBe(true);
    expect(isSigningOfferStepReachable("signers", "documents", withDocs)).toBe(false);
    expect(isSigningOfferStepReachable("signing", "documents", withDocs)).toBe(false);
    expect(isSigningOfferStepReachable("complete", "documents", withDocs)).toBe(false);
  });

  it("documents and signers reachable when unlocked domain cursor is signers", () => {
    expect(isSigningOfferStepReachable("documents", "signers", withDocs)).toBe(true);
    expect(isSigningOfferStepReachable("signers", "signers", withDocs)).toBe(true);
    expect(isSigningOfferStepReachable("signing", "signers", withDocs)).toBe(false);
    expect(isSigningOfferStepReachable("complete", "signers", withDocs)).toBe(false);
  });

  it("documents unreachable when hasPostDocs false; signers reachable as current", () => {
    expect(isSigningOfferStepReachable("documents", "signers", legacyShellInput)).toBe(false);
    expect(isSigningOfferStepReachable("signers", "signers", legacyShellInput)).toBe(true);
    expect(isSigningOfferStepReachable("signing", "signers", legacyShellInput)).toBe(false);
  });

  it("documents and signers remain reachable when domain is at signing (locked review)", () => {
    expect(isSigningOfferStepReachable("documents", "signing", withDocs)).toBe(true);
    expect(isSigningOfferStepReachable("signers", "signing", withDocs)).toBe(true);
    expect(isSigningOfferStepReachable("signing", "signing", withDocs)).toBe(true);
    expect(isSigningOfferStepReachable("complete", "signing", withDocs)).toBe(false);
  });
});

describe("getCurrentSigningOfferStepId locked package", () => {
  it("returns signing when package sent and not all docs signed", () => {
    expect(
      getCurrentSigningOfferStepId({
        hasPostDocs: true,
        postDocsReady: true,
        ...unlockedBase,
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
        ...unlockedBase,
        signersLocked: true,
        allDocsSigned: true,
        envelopeCompleted: true,
      })
    ).toBe("complete");
  });
});

describe("per-acknowledgement steps", () => {
  const acceptanceShell = {
    usesAcceptanceFlow: true,
    hasPostDocs: true,
    acknowledgements: [
      { key: "letter_of_offer", name: "Letter of Offer", required: true },
      { key: "guarantee_acknowledgement", name: "Guarantee Acknowledgement", required: true },
    ],
    acceptanceStatus: "PENDING_ISSUER" as const,
  };

  it("creates one shell per acknowledgement then upload", () => {
    const steps = getSigningOfferSteps({
      ...acceptanceShell,
      checkedAcknowledgementKeys: new Set(),
      postDocsReady: false,
      signersLocked: false,
      allDocsSigned: false,
      envelopeCompleted: false,
    });
    expect(steps.map((s) => s.id)).toEqual([
      "acknowledge:letter_of_offer",
      "acknowledge:guarantee_acknowledgement",
      "documents",
    ]);
  });

  it("advances domain cursor to the first unchecked acknowledgement", () => {
    expect(
      getCurrentSigningOfferStepId({
        ...acceptanceShell,
        checkedAcknowledgementKeys: new Set(["letter_of_offer"]),
        postDocsReady: false,
        signersLocked: false,
        allDocsSigned: false,
        envelopeCompleted: false,
      })
    ).toBe("acknowledge:guarantee_acknowledgement");
  });

  it("moves to documents when all required acknowledgements are checked", () => {
    expect(
      getCurrentSigningOfferStepId({
        ...acceptanceShell,
        checkedAcknowledgementKeys: new Set([
          "letter_of_offer",
          "guarantee_acknowledgement",
        ]),
        postDocsReady: false,
        signersLocked: false,
        allDocsSigned: false,
        envelopeCompleted: false,
      })
    ).toBe("documents");
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

describe("acceptance flow never falls through to Configure signers", () => {
  const acceptanceBase = {
    usesAcceptanceFlow: true,
    hasPostDocs: true,
    acknowledgements: [{ key: "letter_of_offer", name: "Letter of Offer", required: true }],
    checkedAcknowledgementKeys: new Set<string>(),
    postDocsReady: true,
    signersLocked: false,
    allDocsSigned: false,
    envelopeCompleted: false,
  };

  it("PENDING_ADMIN_REVIEW only exposes awaiting_review", () => {
    const input = {
      ...acceptanceBase,
      acceptanceStatus: "PENDING_ADMIN_REVIEW" as const,
    };
    expect(getSigningOfferSteps(input).map((s) => s.id)).toEqual(["awaiting_review"]);
    expect(getCurrentSigningOfferStepId(input)).toBe("awaiting_review");
  });

  it("REJECTED does not expose signers (no legacy fallthrough)", () => {
    const input = {
      ...acceptanceBase,
      acceptanceStatus: "REJECTED" as const,
    };
    const ids = getSigningOfferSteps(input).map((s) => s.id);
    expect(ids).toEqual(["awaiting_review"]);
    expect(ids).not.toContain("signers");
    expect(getCurrentSigningOfferStepId(input)).toBe("awaiting_review");
  });
});
