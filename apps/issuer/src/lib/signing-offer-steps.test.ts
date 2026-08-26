import {
  compareSigningOfferStepOrder,
  buildAcceptanceDocumentsStepConfig,
  getCurrentSigningOfferStepId,
  getSigningOfferStepIndex,
  getSigningOfferSteps,
  hasCompletedContractEnvelope,
  hasAcceptanceDocuments,
  isSigningOfferStepReachable,
  resolveAcceptanceStep1Screen,
  resolveReviewOfferModalMode,
} from "./signing-offer-steps";

const unlockedBase = {
  usesAcceptanceFlow: false,
  acceptanceStatus: null,
  signersLocked: false,
  allDocsSigned: false,
  envelopeCompleted: false,
} as const;

const legacyShellInput = {
  usesAcceptanceFlow: false,
  hasPostDocs: false,
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

describe("hasAcceptanceDocuments", () => {
  it("returns false for missing or empty workflow", () => {
    expect(hasAcceptanceDocuments(undefined)).toBe(false);
    expect(hasAcceptanceDocuments([])).toBe(false);
  });

  it("returns true for financing_type.acceptance_documents", () => {
    expect(
      hasAcceptanceDocuments([
        {
          id: "financing_type_1",
          config: {
            acceptance_documents: [{ name: "Board Resolution", required: true }],
          },
        },
      ])
    ).toBe(true);
  });

  it("returns false when acceptance_documents is absent", () => {
    expect(
      hasAcceptanceDocuments([
        {
          id: "supporting_documents_1",
          config: {
            financial_docs: [{ name: "Mgmt accounts" }],
          },
        },
      ])
    ).toBe(false);
  });
});

describe("buildAcceptanceDocumentsStepConfig", () => {
  it("includes generated_document_type on acceptance rows", () => {
    const config = buildAcceptanceDocumentsStepConfig([
      {
        id: "financing_type_1",
        config: {
          acceptance_documents: [
            {
              name: "Letter of Offer",
              generated_document_type: "arf_contract_facility_lo",
            },
          ],
        },
      },
    ]);

    const rows = config.config.acceptance_documents as Array<Record<string, unknown>>;
    expect(rows[0]?.generated_document_type).toBe("arf_contract_facility_lo");
    expect(rows[0]?.template).toBeUndefined();
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

describe("resolveAcceptanceStep1Screen", () => {
  it("starts on representatives until the issuer continues", () => {
    expect(
      resolveAcceptanceStep1Screen({
        hasPostDocs: true,
        peopleStepConfirmed: false,
        flaggedPartyCount: 0,
        flaggedDocumentCount: 0,
      })
    ).toBe("representatives");
  });

  it("moves to documents after the people screen is confirmed", () => {
    expect(
      resolveAcceptanceStep1Screen({
        hasPostDocs: true,
        peopleStepConfirmed: true,
        flaggedPartyCount: 0,
        flaggedDocumentCount: 0,
      })
    ).toBe("documents");
  });

  it("lands on representatives when only a party list is flagged", () => {
    expect(
      resolveAcceptanceStep1Screen({
        hasPostDocs: true,
        peopleStepConfirmed: false,
        flaggedPartyCount: 1,
        flaggedDocumentCount: 0,
      })
    ).toBe("representatives");
  });

  it("lands on documents when only acceptance files are flagged", () => {
    expect(
      resolveAcceptanceStep1Screen({
        hasPostDocs: true,
        peopleStepConfirmed: false,
        flaggedPartyCount: 0,
        flaggedDocumentCount: 1,
      })
    ).toBe("documents");
  });
});

describe("acceptance flow Step 1 stepper", () => {
  const acceptanceShell = {
    usesAcceptanceFlow: true,
    hasPostDocs: true,
    acceptanceStatus: "PENDING_ISSUER" as const,
  };
  const cursorRest = {
    postDocsReady: false,
    signersLocked: false,
    allDocsSigned: false,
    envelopeCompleted: false,
  };

  it("shows representatives then documents while Step 1 is editable", () => {
    const steps = getSigningOfferSteps({
      ...acceptanceShell,
      ...cursorRest,
    });
    expect(steps.map((s) => s.id)).toEqual(["representatives", "documents"]);
    expect(
      getCurrentSigningOfferStepId({
        ...acceptanceShell,
        ...cursorRest,
      })
    ).toBe("representatives");
  });

  it("keeps documents pending until the people screen is confirmed", () => {
    const steps = getSigningOfferSteps({
      ...acceptanceShell,
      ...cursorRest,
      acceptanceStep1Screen: "representatives",
    });
    expect(steps.find((s) => s.id === "representatives")?.status).toBe("current");
    expect(steps.find((s) => s.id === "documents")?.status).toBe("pending");
  });

  it("lands on representatives when only a party list is flagged", () => {
    expect(
      getCurrentSigningOfferStepId({
        ...acceptanceShell,
        ...cursorRest,
        acceptanceStatus: "CHANGES_REQUESTED",
        acceptanceStep1Screen: "representatives",
      })
    ).toBe("representatives");
  });

  it("lands on documents when only acceptance files are flagged", () => {
    expect(
      getCurrentSigningOfferStepId({
        ...acceptanceShell,
        ...cursorRest,
        acceptanceStatus: "CHANGES_REQUESTED",
        acceptanceStep1Screen: "documents",
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
      expect(mode.blockedMessage).toMatch(/facility signing/i);
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
    expect(ids).toEqual(["rejected"]);
    expect(ids).not.toContain("signers");
    expect(getCurrentSigningOfferStepId(input)).toBe("rejected");
  });
});
