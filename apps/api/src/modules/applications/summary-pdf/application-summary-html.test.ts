import { buildApplicationSummaryHtml } from "./application-summary-html";
import type { ApplicationSummaryPdfModel } from "./types";

function model(overrides: Partial<ApplicationSummaryPdfModel> = {}): ApplicationSummaryPdfModel {
  return {
    title: "Application Summary",
    disclaimer:
      "This is an issuer-facing summary of your financing application. It is not an offer letter and is not a legal agreement.",
    generatedAtLabel: "24 Aug 2026, 4:31 PM",
    filename: "application-summary.pdf",
    identityFields: [{ label: "Application reference", value: "APP-1" }],
    facilityFields: [{ label: "Facility reference", value: "FAC-1" }],
    companyFields: [{ label: "Company name", value: "Issuer Sdn Bhd" }],
    financingFields: [{ label: "Financing structure", value: "Invoice financing" }],
    invoices: [
      {
        heading: "INV-1",
        fields: [{ label: "Invoice number", value: "88" }],
        offerTerms: [{ label: "Proposed financing amount", value: "RM 45,000.00" }],
      },
    ],
    remarks: [
      {
        subject: "Invoice details",
        action: "Amendment requested",
        remark: "Please attach the latest invoice.",
        authorName: "Nora Admin",
        at: "8 Aug 2026, 4:00 PM",
      },
    ],
    timeline: [
      {
        label: "You submitted this application",
        description: "Submitted from issuer portal",
        at: "2 Aug 2026, 11:00 AM",
      },
    ],
    documentNames: ["Board resolution"],
    ...overrides,
  };
}

describe("buildApplicationSummaryHtml", () => {
  it("renders issuer-facing copy and populated sections", () => {
    const html = buildApplicationSummaryHtml(model());
    expect(html).toContain("APPLICATION SUMMARY");
    expect(html).toContain("not an offer letter");
    expect(html).toContain("Generated 24 Aug 2026, 4:31 PM");
    expect(html).toContain("Application reference");
    expect(html).toContain("APP-1");
    expect(html).toContain("Facility");
    expect(html).toContain("Company and customer");
    expect(html).toContain("Invoices");
    expect(html).toContain("Offer terms and fees");
    expect(html).toContain("Review remarks and amendment requests");
    expect(html).toContain("Application history");
    expect(html).toContain("Documents on file");
    expect(html).toContain("Source files are not attached");
    expect(html).not.toContain("s3_key");
  });

  it("omits unavailable sections instead of empty placeholders", () => {
    const html = buildApplicationSummaryHtml(
      model({
        facilityFields: [],
        invoices: [],
        remarks: [],
        documentNames: [],
      })
    );
    expect(html).toContain("Application");
    expect(html).not.toContain(">Facility<");
    expect(html).not.toContain("Invoices");
    expect(html).not.toContain("Review remarks and amendment requests");
    expect(html).not.toContain("Documents on file");
  });

  it("escapes every dynamic HTML value", () => {
    const html = buildApplicationSummaryHtml(
      model({
        title: "Summary <script>alert(1)</script>",
        disclaimer: "Not <b>legal</b>",
        generatedAtLabel: "now <img>",
        identityFields: [{ label: "Ref", value: "<svg onload=x>" }],
        remarks: [
          {
            subject: "Invoice <details>",
            action: "Amend",
            remark: "<script>steal()</script>",
            authorName: "Ada <Admin>",
            at: null,
          },
        ],
        timeline: [
          {
            label: "Submitted <here>",
            description: "note & more",
            at: "1 < 2",
          },
        ],
        documentNames: ["file<script>.pdf"],
      })
    );

    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Not &lt;b&gt;legal&lt;/b&gt;");
    expect(html).toContain("&lt;svg onload=x&gt;");
    expect(html).toContain("&lt;script&gt;steal()&lt;/script&gt;");
    expect(html).toContain("Ada &lt;Admin&gt;");
    expect(html).toContain("Submitted &lt;here&gt;");
    expect(html).toContain("note &amp; more");
    expect(html).toContain("file&lt;script&gt;.pdf");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<script>steal()</script>");
  });
});
