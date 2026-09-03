import { rewriteOfferLetterSigningDocumentsToFacilityAgreement } from "./facility-agreement-signing-migration";

const OFFER_LETTER_DOC = {
  key: "offer_letter",
  name: "Offer letter",
  source: "GENERATED_OFFER_LETTER",
  required: true,
  order: 0,
  signer_role_keys: ["issuer_director"],
};

describe("rewriteOfferLetterSigningDocumentsToFacilityAgreement", () => {
  it("rewrites a flat signing package Offer Letter to Facility Agreement", () => {
    const workflow = [
      {
        id: "financing_type",
        config: {
          signing_packages: {
            enabled: true,
            documents: [OFFER_LETTER_DOC, { key: "guarantor_agreement", source: "TEMPLATE" }],
          },
        },
      },
    ];

    const first = rewriteOfferLetterSigningDocumentsToFacilityAgreement(workflow);
    expect(first.changed).toBe(true);
    const packages = (first.workflow as Array<{ config: { signing_packages: { documents: Array<Record<string, unknown>> } } }>)[0]
      ?.config.signing_packages.documents;
    expect(packages?.[0]).toMatchObject({
      key: "facility_agreement",
      name: "Facility Agreement",
      source: "TEMPLATE",
      signer_role_keys: ["issuer_director"],
    });
    expect(packages?.[1]).toMatchObject({ key: "guarantor_agreement", source: "TEMPLATE" });

    const second = rewriteOfferLetterSigningDocumentsToFacilityAgreement(first.workflow);
    expect(second.changed).toBe(false);
    expect(second.workflow).toEqual(first.workflow);
  });

  it("rewrites both sides of a legacy dual signing_packages object", () => {
    const workflow = [
      {
        id: "financing_type",
        config: {
          signing_packages: {
            contract: { documents: [OFFER_LETTER_DOC] },
            invoice: {
              documents: [{ ...OFFER_LETTER_DOC, name: "Invoice Offer Letter" }],
            },
          },
        },
      },
    ];

    const result = rewriteOfferLetterSigningDocumentsToFacilityAgreement(workflow);
    expect(result.changed).toBe(true);
    const packages = (
      result.workflow as Array<{
        config: {
          signing_packages: {
            contract: { documents: Array<Record<string, unknown>> };
            invoice: { documents: Array<Record<string, unknown>> };
          };
        };
      }>
    )[0]?.config.signing_packages;
    expect(packages?.contract.documents[0]).toMatchObject({
      key: "facility_agreement",
      name: "Facility Agreement",
      source: "TEMPLATE",
    });
    expect(packages?.invoice.documents[0]).toMatchObject({
      key: "facility_agreement",
      name: "Invoice Offer Letter",
      source: "TEMPLATE",
    });
  });

  it("rewrites legacy signing_template documents", () => {
    const workflow = [
      {
        id: "financing_type",
        config: {
          signing_template: { documents: [OFFER_LETTER_DOC] },
        },
      },
    ];
    const result = rewriteOfferLetterSigningDocumentsToFacilityAgreement(workflow);
    expect(result.changed).toBe(true);
    const documents = (
      result.workflow as Array<{ config: { signing_template: { documents: Array<Record<string, unknown>> } } }>
    )[0]?.config.signing_template.documents;
    expect(documents?.[0]).toMatchObject({
      key: "facility_agreement",
      source: "TEMPLATE",
    });
  });

  it("leaves issuer-upload Offer Letters and envelopes-shaped data alone", () => {
    const workflow = [
      {
        id: "financing_type",
        config: {
          signing_packages: {
            documents: [
              { key: "offer_letter", source: "ISSUER_UPLOAD", name: "Board pack" },
              { key: "facility_agreement", source: "TEMPLATE", name: "Facility Agreement" },
            ],
          },
        },
      },
    ];
    const result = rewriteOfferLetterSigningDocumentsToFacilityAgreement(workflow);
    expect(result.changed).toBe(false);
    expect(result.workflow).toEqual(workflow);
  });
});
