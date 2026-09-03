import { acceptanceDocumentCategoryEntries } from "@cashsouk/types";
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
  packageSent: false,
  allDocsSigned: false,
  envelopeCompleted: false,
} as const;

const trackingShellInput = {
  usesAcceptanceFlow: false,
  hasPostDocs: false,
  acceptanceStatus: null,
} as const;

describe("getSigningOfferSteps", () => {
  it("shows document signing then complete when there is no acceptance flow", () => {
    const steps = getSigningOfferSteps({
      hasPostDocs: true,
      postDocsReady: false,
      ...unlockedBase,
    });
    expect(steps.map((s) => s.id)).toEqual(["signing", "complete"]);
  });
});

describe("getCurrentSigningOfferStepId", () => {
  it("returns signing while CashSouk has not sent the package", () => {
    expect(
      getCurrentSigningOfferStepId({
        hasPostDocs: true,
        postDocsReady: false,
        ...unlockedBase,
      })
    ).toBe("signing");
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
    expect(acceptanceDocumentCategoryEntries(config.config)).toEqual([
      ["acceptance_documents", rows],
    ]);
  });
});

describe("getSigningOfferStepIndex / compareSigningOfferStepOrder", () => {
  it("orders signing before complete", () => {
    expect(getSigningOfferStepIndex("signing", trackingShellInput)).toBe(0);
    expect(getSigningOfferStepIndex("complete", trackingShellInput)).toBe(1);
    expect(compareSigningOfferStepOrder("signing", "complete", trackingShellInput)).toBeLessThan(0);
  });

  it("returns -1 for removed configure-signers and upload steps", () => {
    expect(getSigningOfferStepIndex("documents", trackingShellInput)).toBe(-1);
    expect(getSigningOfferStepIndex("signers", trackingShellInput)).toBe(-1);
  });
});

describe("isSigningOfferStepReachable", () => {
  it("only signing is reachable until the envelope completes", () => {
    expect(isSigningOfferStepReachable("signing", "signing", trackingShellInput)).toBe(true);
    expect(isSigningOfferStepReachable("complete", "signing", trackingShellInput)).toBe(false);
  });

  it("signing remains reachable when domain is at complete", () => {
    expect(isSigningOfferStepReachable("signing", "complete", trackingShellInput)).toBe(true);
    expect(isSigningOfferStepReachable("complete", "complete", trackingShellInput)).toBe(true);
  });
});

describe("getCurrentSigningOfferStepId locked package", () => {
  it("returns signing when package sent and not all docs signed", () => {
    expect(
      getCurrentSigningOfferStepId({
        hasPostDocs: true,
        postDocsReady: true,
        ...unlockedBase,
        packageSent: true,
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
        packageSent: true,
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
    packageSent: false,
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

describe("acceptance flow never falls through to configure signers", () => {
  const acceptanceBase = {
    usesAcceptanceFlow: true,
    hasPostDocs: true,
    postDocsReady: true,
    packageSent: false,
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

  it("APPROVED_FOR_SIGNING waits on document signing until CashSouk sends links", () => {
    const input = {
      ...acceptanceBase,
      acceptanceStatus: "APPROVED_FOR_SIGNING" as const,
    };
    expect(getSigningOfferSteps(input).map((s) => s.id)).toEqual(["signing", "complete"]);
    expect(getCurrentSigningOfferStepId(input)).toBe("signing");
  });

  it("REJECTED does not expose signing steps", () => {
    const input = {
      ...acceptanceBase,
      acceptanceStatus: "REJECTED" as const,
    };
    const ids = getSigningOfferSteps(input).map((s) => s.id);
    expect(ids).toEqual(["rejected"]);
    expect(ids).not.toContain("signing");
    expect(getCurrentSigningOfferStepId(input)).toBe("rejected");
  });
});
