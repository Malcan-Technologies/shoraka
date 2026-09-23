import {
  ADMIN_DOCUMENT_DESCRIPTIONS,
  ADMIN_DOCUMENT_UNAVAILABLE_HINTS,
} from "@cashsouk/types";
import {
  facilityAgreementPackageAvailability,
  investmentNoteCertificateAvailability,
  letterOfOfferAvailability,
  prospectusAvailability,
  shorakaGroupAvailability,
  signingDocumentAvailability,
  underlyingContractAvailability,
} from "./availability";

describe("note document availability", () => {
  it("explains missing completed envelopes vs missing package documents", () => {
    expect(
      signingDocumentAvailability({
        envelope: null,
        document: null,
        description: ADMIN_DOCUMENT_DESCRIPTIONS.jsg,
        includedLabel: "Joint and Several Guarantee",
        missingFromPackageMessage: "missing jsg",
      })
    ).toEqual({
      available: false,
      description: ADMIN_DOCUMENT_DESCRIPTIONS.jsg,
      unavailableHint: ADMIN_DOCUMENT_UNAVAILABLE_HINTS.waitingSigningPackage,
    });
    expect(
      signingDocumentAvailability({
        envelope: {
          id: "env",
          status: "COMPLETED",
          application_id: "app",
          contract_id: null,
          invoice_id: "inv",
          completed_at: new Date(),
          documents: [],
        },
        document: null,
        description: ADMIN_DOCUMENT_DESCRIPTIONS.jsg,
        includedLabel: "Joint and Several Guarantee",
        missingFromPackageMessage: "missing jsg",
      }).unavailableHint
    ).toBe("missing jsg");
  });

  it("gates the Letter of Offer on offer send and product declaration", () => {
    expect(
      letterOfOfferAvailability({ hasContract: false, offerSent: false, declaredOnProduct: true })
        .available
    ).toBe(false);
    expect(
      letterOfOfferAvailability({ hasContract: true, offerSent: true, declaredOnProduct: false })
        .unavailableHint
    ).toBe(ADMIN_DOCUMENT_UNAVAILABLE_HINTS.letterOfOfferNotOnProduct);
    expect(
      letterOfOfferAvailability({ hasContract: true, offerSent: true, declaredOnProduct: true })
    ).toEqual({
      available: true,
      description: ADMIN_DOCUMENT_DESCRIPTIONS.letterOfOffer,
      unavailableHint: null,
    });
  });

  it("allows a compiled FA package with zero certificates when FA and LO are ready", () => {
    const ready = facilityAgreementPackageAvailability({
      signedFaAvailable: true,
      letterOfOfferAvailable: true,
    });
    expect(ready.available).toBe(true);
    expect(ready.description).toBe(ADMIN_DOCUMENT_DESCRIPTIONS.facilityAgreementPackage);
    expect(ready.unavailableHint).toBeNull();
    expect(
      facilityAgreementPackageAvailability({
        signedFaAvailable: true,
        letterOfOfferAvailable: false,
      }).unavailableHint
    ).toBe(ADMIN_DOCUMENT_UNAVAILABLE_HINTS.compiledPackageNeedsLetterOfOffer);
  });

  it("exposes only approved frozen prospectus and issued certificates", () => {
    expect(prospectusAvailability({ approved: false, pdfReady: false }).unavailableHint).toBe(
      ADMIN_DOCUMENT_UNAVAILABLE_HINTS.waitingProspectusApproval
    );
    expect(prospectusAvailability({ approved: true, pdfReady: true }).available).toBe(true);
    expect(
      investmentNoteCertificateAvailability({
        issuedReady: false,
        pending: false,
        failed: false,
      }).unavailableHint
    ).toBe(ADMIN_DOCUMENT_UNAVAILABLE_HINTS.waitingCertificateIssued);
    expect(
      investmentNoteCertificateAvailability({
        issuedReady: true,
        pending: false,
        failed: false,
      }).available
    ).toBe(true);
  });

  it("waits for Tawarruq execution when no trade orders exist", () => {
    expect(shorakaGroupAvailability([]).unavailableHint).toBe(
      ADMIN_DOCUMENT_UNAVAILABLE_HINTS.waitingTawarruqExecution
    );
  });

  it("gates the underlying contract on an uploaded file", () => {
    expect(underlyingContractAvailability(false).unavailableHint).toBe(
      ADMIN_DOCUMENT_UNAVAILABLE_HINTS.waitingUnderlyingContract
    );
    expect(underlyingContractAvailability(true).available).toBe(true);
  });
});
