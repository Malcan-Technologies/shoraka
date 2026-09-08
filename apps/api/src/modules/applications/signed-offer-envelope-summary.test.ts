import {
  groupSigningEnvelopeOfferSummariesByApplication,
  toSigningEnvelopeOfferSummaries,
} from "./signed-offer-envelope-summary";

describe("signing envelope offer summaries", () => {
  it("maps signed_s3_key to has_signed_pdf and drops the key", () => {
    const summaries = toSigningEnvelopeOfferSummaries([
      {
        application_id: "app-1",
        status: "COMPLETED",
        contract_id: "c1",
        invoice_id: null,
        documents: [
          {
            source: "TEMPLATE",
            template_ref: "facility_agreement",
            signed_s3_key: "applications/app-1/signing/env/doc.pdf",
          },
          {
            source: "TEMPLATE",
            template_ref: "guarantor_agreement",
            signed_s3_key: null,
          },
        ],
      },
    ]);

    expect(summaries).toEqual([
      {
        status: "COMPLETED",
        contract_id: "c1",
        invoice_id: null,
        documents: [
          {
            source: "TEMPLATE",
            template_ref: "facility_agreement",
            has_signed_pdf: true,
          },
          {
            source: "TEMPLATE",
            template_ref: "guarantor_agreement",
            has_signed_pdf: false,
          },
        ],
      },
    ]);
    expect(JSON.stringify(summaries)).not.toContain("applications/app-1");
  });

  it("groups summaries by application id", () => {
    const grouped = groupSigningEnvelopeOfferSummariesByApplication([
      {
        application_id: "app-1",
        status: "COMPLETED",
        contract_id: "c1",
        invoice_id: null,
        documents: [],
      },
      {
        application_id: "app-2",
        status: "SENT",
        contract_id: null,
        invoice_id: "i1",
        documents: [],
      },
      {
        application_id: "app-1",
        status: "DRAFT",
        contract_id: "c1",
        invoice_id: null,
        documents: [],
      },
    ]);

    expect(grouped.get("app-1")?.map((row) => row.status)).toEqual(["COMPLETED", "DRAFT"]);
    expect(grouped.get("app-2")?.map((row) => row.status)).toEqual(["SENT"]);
  });
});
