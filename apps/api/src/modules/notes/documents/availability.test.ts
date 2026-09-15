import {
  facilityAgreementPackageAvailability,
  investmentNoteCertificateAvailability,
  letterOfOfferAvailability,
  prospectusAvailability,
  shorakaGroupAvailability,
  signingDocumentAvailability,
} from "./availability";

describe("note document availability", () => {
  it("explains missing completed envelopes vs missing package documents", () => {
    expect(
      signingDocumentAvailability({
        envelope: null,
        document: null,
        includedLabel: "Joint and Several Guarantee",
        missingFromPackageMessage: "missing jsg",
      }).availabilityReason
    ).toMatch(/signing package/i);
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
        includedLabel: "Joint and Several Guarantee",
        missingFromPackageMessage: "missing jsg",
      }).availabilityReason
    ).toBe("missing jsg");
  });

  it("gates the Letter of Offer on offer send and product declaration", () => {
    expect(
      letterOfOfferAvailability({ hasContract: false, offerSent: false, declaredOnProduct: true })
        .available
    ).toBe(false);
    expect(
      letterOfOfferAvailability({ hasContract: true, offerSent: true, declaredOnProduct: false })
        .availabilityReason
    ).toMatch(/does not include a Letter of Offer/);
    expect(
      letterOfOfferAvailability({ hasContract: true, offerSent: true, declaredOnProduct: true })
        .originLabel
    ).toBe("Generated now");
  });

  it("allows a compiled FA package with zero certificates when FA and LO are ready", () => {
    const ready = facilityAgreementPackageAvailability({
      signedFaAvailable: true,
      letterOfOfferAvailable: true,
      certificateCount: 0,
    });
    expect(ready.available).toBe(true);
    expect(ready.origin).toBe("compiled");
    expect(ready.availabilityReason).toMatch(/No Shoraka certificates/);
    expect(
      facilityAgreementPackageAvailability({
        signedFaAvailable: true,
        letterOfOfferAvailable: false,
        certificateCount: 1,
      }).available
    ).toBe(false);
  });

  it("exposes only approved frozen prospectus and issued certificates", () => {
    expect(prospectusAvailability({ approved: false, pdfReady: false }).available).toBe(false);
    expect(prospectusAvailability({ approved: true, pdfReady: true }).available).toBe(true);
    expect(
      investmentNoteCertificateAvailability({
        issuedReady: false,
        pending: false,
        failed: false,
      }).availabilityReason
    ).toMatch(/issued/);
    expect(
      investmentNoteCertificateAvailability({
        issuedReady: true,
        pending: false,
        failed: false,
      }).available
    ).toBe(true);
  });

  it("explains that only issuer-disbursement Shoraka certificates exist today", () => {
    expect(shorakaGroupAvailability([]).availabilityReason).toMatch(/issuer-disbursement/i);
  });
});
