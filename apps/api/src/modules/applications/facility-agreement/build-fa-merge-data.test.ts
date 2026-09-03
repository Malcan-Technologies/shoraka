import { buildFacilityAgreementMergeData } from "./build-fa-merge-data";

const ISSUER_SNAPSHOT = {
  submitted_by_user_id: "user_1",
  submitted_at: "2026-08-21T00:00:00.000Z",
  parties: [
    {
      key: "issuer",
      entity_kind: "ISSUER" as const,
      representatives: [
        {
          name: "Ali Bin Abu",
          email: "ali@co.my",
          ic_number: "820508105871",
          capacity: "director" as const,
        },
        {
          name: "Siti Binti Ahmad",
          email: "siti@co.my",
          ic_number: "900101015555",
          capacity: "authorised_signatory" as const,
        },
      ],
    },
  ],
};

const BASE_ORG = {
  id: "org_1",
  name: "Issuer Co",
  registration_number: "123456-A",
  address: "1 Jalan Test, Kuala Lumpur",
  bank_account_details: {
    bank_name: "Maybank",
    account_holder: "Issuer Co",
    account_number: "1234567890",
  },
  corporate_onboarding_data: {
    addresses: {
      registered: {
        line1: "1 Jalan Test",
        city: "Kuala Lumpur",
        postcode: "50000",
        state: "Wilayah Persekutuan",
        country: "Malaysia",
      },
    },
  },
};

const PRODUCT_WORKFLOW = [
  { id: "invoice_details", config: { sub_limit_per_invoice_rm: 250000 } },
];

describe("buildFacilityAgreementMergeData", () => {
  it("fills contract-facility terms and leaves unsourced FA date and bank SWIFT visible as empty", () => {
    const data = buildFacilityAgreementMergeData({
      offerKind: "contract",
      contract: {
        id: "ctr_abc",
        issuer_organization_id: "org_1",
        contract_details: { approved_facility: 1_000_000, facility_fee_rate_percent: 1 },
        offer_details: {
          offered_facility: 1_000_000,
          facility_fee_rate_percent: 1,
          sent_at: "2026-08-19T02:00:00.000Z",
          offer_acceptance: {
            status: "PENDING_ISSUER",
            authorized_parties_draft: ISSUER_SNAPSHOT,
          },
        },
      },
      issuerOrganization: BASE_ORG,
      application: {
        id: "app_1",
        company_details: { contact_person: { email: "ops@issuer.my" } },
        application_guarantors: [
          {
            id: "g1",
            guarantor_type: "individual",
            name: "Ali Bin Abu",
            ic_number: "900101145678",
          },
        ],
      },
      productWorkflow: PRODUCT_WORKFLOW,
      trusteeDisclosureEmail: "trustee@example.com",
    });

    expect(data.letter_date).toBe("19 August 2026");
    expect(data.our_reference).toBe("ctr_abc");
    expect(data.issuer_name).toBe("Issuer Co");
    expect(data.issuer_registration_number).toBe("123456-A");
    expect(data.financing_limit_rm).toBe("RM 1,000,000.00");
    expect(data.sub_limit_per_invoice_rm).toBe("RM 250,000.00");
    expect(data.facility_fee_rate_percent).toBe("1%");
    expect(data.drawdown_fee).toBe("");
    expect(data.facility_agreement_date).toBe("");
    expect(data.issuer_bank_name).toBe("Maybank");
    expect(data.issuer_bank_account_name).toBe("Issuer Co");
    expect(data.issuer_bank_branch).toBe("");
    expect(data.issuer_bank_swift).toBe("");
    expect(data.trustee_disclosure_email).toBe("trustee@example.com");
    expect(data.issuer_signatories.map((row) => row.name)).toEqual([
      "Ali Bin Abu",
      "Siti Binti Ahmad",
    ]);
    expect(data.guarantors_individual[0]?.name).toBe("Ali Bin Abu");
  });

  it("uses invoice offered amount and platform fee as the invoice-offer terms", () => {
    const data = buildFacilityAgreementMergeData({
      offerKind: "invoice",
      contract: {
        id: "holder_ctr",
        issuer_organization_id: "org_1",
      },
      invoice: {
        id: "inv_1",
        display_reference: "INV-REF-1",
        offer_details: {
          offered_amount: 180000,
          platform_fee_rate_percent: 1.5,
          sent_at: "2026-08-20T02:00:00.000Z",
          offer_acceptance: {
            status: "PENDING_ISSUER",
            authorized_parties_draft: ISSUER_SNAPSHOT,
          },
        },
      },
      issuerOrganization: BASE_ORG,
      application: {
        id: "app_1",
        company_details: { contact_person: { email: "ops@issuer.my" } },
      },
    });

    expect(data.our_reference).toBe("INV-REF-1");
    expect(data.letter_date).toBe("20 August 2026");
    expect(data.financing_limit_rm).toBe("RM 180,000.00");
    expect(data.sub_limit_per_invoice_rm).toBe("RM 180,000.00");
    expect(data.drawdown_fee).toBe("1.5%");
    expect(data.facility_fee_rate_percent).toBe("");
    expect(data.facility_agreement_date).toBe("");
  });
});
