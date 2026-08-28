import {
  buildSafeSummaryFilename,
  composeApplicationSummary,
} from "./compose-application-summary";
import type { ApplicationSummarySource, ComposeApplicationSummaryInput } from "./types";

function baseApplication(
  overrides: Partial<ApplicationSummarySource> = {}
): ApplicationSummarySource {
  return {
    id: "clappinternalid000000001",
    display_reference: "APP-ARF-2026-0001",
    status: "SUBMITTED",
    created_at: "2026-08-01T02:00:00.000Z",
    updated_at: "2026-08-10T04:00:00.000Z",
    submitted_at: "2026-08-02T03:00:00.000Z",
    financing_type: { product_id: "prod_1", product_code: "ARF" },
    financing_structure: { structure_type: "new_contract" },
    company_details: {
      contact_person: {
        name: "Aisha Tan",
        position: "CFO",
        email: "aisha@issuer.test",
        ic: "900101145678",
      },
    },
    business_details: {
      about_your_business: {
        what_does_company_do: "Wholesale trade",
        main_customers: "Retail chains",
      },
      why_raising_funds: {
        financing_for: "Working capital",
        how_funds_used: "Pay suppliers",
        supporting_documents: [
          { file_name: "plan.pdf", s3_key: "applications/app/plan.pdf" },
        ],
      },
    },
    supporting_documents: {
      categories: [
        {
          name: "Legal Docs",
          documents: [
            {
              title: "Board resolution",
              file: { file_name: "board.pdf", s3_key: "applications/app/board.pdf" },
            },
          ],
        },
      ],
    },
    issuer_organization: { name: "Issuer Sdn Bhd", registration_number: "202001234567" },
    contract: {
      id: "clcontractinternal00001",
      display_reference: "FAC-ARF-2026-0008",
      status: "OFFER_SENT",
      contract_details: { title: "Master facility", facility_fee_rate_percent: 1 },
      offer_details: {
        requested_facility: 200_000,
        offered_facility: 150_000,
        facility_fee_rate_percent: 1,
        facility_fee_upfront_collect_amount: 400,
      },
      customer_details: { customer_name: "Buyer Bhd", ssm_number: "201901111111" },
      approved_facility: 150_000,
      available_facility: 150_000,
    },
    invoices: [
      {
        id: "clinvoiceinternal000001",
        display_reference: "INV-ARF-2026-0012",
        status: "OFFER_SENT",
        details: {
          number: "INV-88",
          value: 80_000,
          maturity_date: "2026-10-15",
          financing_tenure_days: 60,
          document: { file_name: "invoice-88.pdf", s3_key: "applications/app/inv.pdf" },
        },
        offer_details: {
          requested_amount: 48_000,
          offered_amount: 45_000,
          offered_ratio_percent: 56,
          offered_profit_rate_percent: 12,
          financing_tenure_days: 60,
          platform_fee_rate_percent: 2,
        },
      },
    ],
    application_review_remarks: [
      {
        scope: "section",
        scope_key: "invoice_details",
        action_type: "AMENDMENT_REQUESTED",
        remark: "Please attach the latest invoice.",
        author_user_id: "u_admin",
        created_at: "2026-08-08T08:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

function compose(
  overrides: Partial<ComposeApplicationSummaryInput> = {}
) {
  return composeApplicationSummary({
    application: baseApplication(),
    logs: [
      {
        id: "log_1",
        event_type: "APPLICATION_SUBMITTED",
        remark: "Submitted from issuer portal",
        created_at: "2026-08-02T03:00:00.000Z",
      },
    ],
    authorNames: new Map([["u_admin", "Nora Admin"]]),
    generatedAt: new Date("2026-08-24T08:31:00.000Z"),
    ...overrides,
  });
}

describe("composeApplicationSummary", () => {
  it("builds identity, facility, company, invoice, remarks, timeline, and document names", () => {
    const model = compose();

    expect(model.title).toBe("Application Summary");
    expect(model.disclaimer).toMatch(/not an offer letter/i);
    expect(model.filename).toBe("application-summary-APP-ARF-2026-0001.pdf");
    expect(model.identityFields.map((f) => f.label)).toEqual(
      expect.arrayContaining(["Application reference", "Status", "Generated"])
    );
    expect(model.identityFields.find((f) => f.label === "Application reference")?.value).toBe(
      "APP-ARF-2026-0001"
    );
    expect(model.facilityFields.find((f) => f.label === "Facility reference")?.value).toBe(
      "FAC-ARF-2026-0008"
    );
    expect(model.facilityFields.some((f) => f.label === "Proposed offered facility")).toBe(true);
    expect(model.companyFields.find((f) => f.label === "Company name")?.value).toBe("Issuer Sdn Bhd");
    expect(model.companyFields.find((f) => f.label === "Customer name")?.value).toBe("Buyer Bhd");
    expect(model.financingFields.find((f) => f.label === "Financing structure")?.value).toBe(
      "Facility financing (new facility)"
    );
    expect(model.invoices[0]?.heading).toContain("INV-ARF-2026-0012");
    expect(model.invoices[0]?.fields.some((f) => f.label === "Invoice number")).toBe(true);
    expect(model.invoices[0]?.offerTerms.some((f) => f.label === "Proposed financing amount")).toBe(
      true
    );
    expect(model.remarks[0]).toMatchObject({
      subject: "Invoice details",
      action: "Amendment requested",
      remark: "Please attach the latest invoice.",
      authorName: "Nora Admin",
    });
    expect(model.timeline[0]?.label).toBe("You submitted this application");
    expect(model.documentNames).toEqual(
      expect.arrayContaining(["Board resolution", "invoice-88.pdf", "plan.pdf"])
    );
  });

  it("omits missing sections and does not dump internal ids, IC, or storage keys", () => {
    const model = compose({
      application: baseApplication({
        contract: null,
        invoices: [],
        application_review_remarks: [],
        supporting_documents: null,
        acceptance_documents: null,
        business_details: {},
        company_details: {
          contact_person: { name: "Aisha Tan", ic: "900101145678" },
        },
      }),
    });

    expect(model.facilityFields).toEqual([]);
    expect(model.invoices).toEqual([]);
    expect(model.remarks).toEqual([]);
    const serialized = JSON.stringify(model);
    expect(serialized).not.toContain("clappinternalid000000001");
    expect(serialized).not.toContain("900101145678");
    expect(serialized).not.toContain("s3_key");
    expect(serialized).not.toContain("applications/app/");
    expect(serialized).not.toMatch(/"ic"/);
  });

  it("keeps only issuer-visible timeline events and labels", () => {
    const model = compose({
      logs: [
        {
          id: "admin_1",
          event_type: "SECTION_REVIEWED_APPROVED",
          remark: "Internal underwriting note",
          created_at: "2026-08-03T00:00:00.000Z",
        },
        {
          id: "sign_1",
          event_type: "SIGNING_PACKAGE_CREATED",
          remark: "envelope id abc",
          created_at: "2026-08-04T00:00:00.000Z",
        },
        {
          id: "vis_1",
          event_type: "CONTRACT_OFFER_SENT",
          remark: "Offer emailed",
          created_at: "2026-08-05T00:00:00.000Z",
        },
      ],
    });

    expect(model.timeline).toHaveLength(1);
    expect(model.timeline[0]?.label).toBe("Facility financing offer sent");
    expect(model.timeline[0]?.description).toBe("Offer emailed");
    expect(JSON.stringify(model.timeline)).not.toContain("SECTION_REVIEWED_APPROVED");
    expect(JSON.stringify(model.timeline)).not.toContain("SIGNING_PACKAGE_CREATED");
  });

  it("falls back to status milestones when no issuer-visible logs exist", () => {
    const model = compose({
      application: baseApplication({ status: "AMENDMENT_REQUESTED" }),
      logs: [
        {
          id: "hidden",
          event_type: "ITEM_REVIEWED_APPROVED",
          created_at: "2026-08-09T00:00:00.000Z",
        },
      ],
    });

    expect(model.timeline.map((item) => item.label)).toEqual(
      expect.arrayContaining(["Application started", "Needs changes from you"])
    );
  });

  it("prefers log activity summaries over remarks", () => {
    const model = compose({
      logs: [
        {
          id: "resub",
          event_type: "APPLICATION_RESUBMITTED",
          activity: "Updated invoice value",
          remark: "raw remark",
          created_at: "2026-08-09T00:00:00.000Z",
        },
      ],
    });
    expect(model.timeline[0]?.label).toBe("You resubmitted after changes");
    expect(model.timeline[0]?.description).toBe("Updated invoice value");
  });

  it("prefers company-profile about fields over application business_details", () => {
    const model = composeApplicationSummary({
      application: baseApplication({
        issuer_organization: {
          name: "Issuer Sdn Bhd",
          registration_number: "202001234567",
          corporate_onboarding_data: {
            aboutYourBusiness: {
              whatDoesCompanyDo: "Profile description",
              mainCustomers: "Profile customers",
            },
          },
        },
      }),
      logs: [],
      authorNames: new Map(),
      generatedAt: new Date("2026-08-24T08:31:00.000Z"),
    });
    expect(model.companyFields.find((f) => f.label === "What the company does")?.value).toBe(
      "Profile description"
    );
    expect(model.companyFields.find((f) => f.label === "Main customers")?.value).toBe("Profile customers");
  });

  it("falls back to application business_details when the company profile is empty", () => {
    const model = composeApplicationSummary({
      application: baseApplication({
        issuer_organization: {
          name: "Issuer Sdn Bhd",
          registration_number: "202001234567",
          corporate_onboarding_data: { basicInfo: { industry: "Wholesale" } },
        },
      }),
      logs: [],
      authorNames: new Map(),
      generatedAt: new Date("2026-08-24T08:31:00.000Z"),
    });
    expect(model.companyFields.find((f) => f.label === "What the company does")?.value).toBe(
      "Wholesale trade"
    );
    expect(model.companyFields.find((f) => f.label === "Main customers")?.value).toBe("Retail chains");
  });

  it("labels AMENDMENTS_SUBMITTED as an amendment request sent by CashSouk", () => {
    const model = compose({
      logs: [
        {
          id: "amd",
          event_type: "AMENDMENTS_SUBMITTED",
          remark: "2 amendment(s) sent to issuer",
          created_at: "2026-08-09T00:00:00.000Z",
        },
      ],
    });
    expect(model.timeline[0]?.label).toBe("Amendment Request Sent");
    expect(model.timeline[0]?.label).not.toMatch(/issuer submitted/i);
    expect(model.timeline[0]?.label).not.toMatch(/you submitted/i);
    expect(model.timeline[0]?.label).not.toMatch(/amendments submitted/i);
  });
});

describe("buildSafeSummaryFilename", () => {
  it("uses a cleaned display reference", () => {
    expect(buildSafeSummaryFilename("APP-ARF 2026/0001")).toBe(
      "application-summary-APP-ARF-2026-0001.pdf"
    );
  });

  it("falls back when no display reference is available", () => {
    expect(buildSafeSummaryFilename(null)).toBe("application-summary.pdf");
    expect(buildSafeSummaryFilename("///")).toBe("application-summary.pdf");
  });
});
