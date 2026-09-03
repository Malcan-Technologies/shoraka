import { buildDeedOfAssignmentMergeData } from "./build-doa-merge-data";

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
  address: "Legacy address",
  phone_number: "+60 3-1111 2222",
  corporate_onboarding_data: {
    addresses: {
      registered: {
        line1: "1 Jalan Test",
        city: "Kuala Lumpur",
        postcode: "50000",
        state: "Wilayah Persekutuan",
        country: "Malaysia",
      },
      business: {
        line1: "Lot 2, Jalan Industri",
        city: "Shah Alam",
        postcode: "40150",
        state: "Selangor",
        country: "Malaysia",
      },
    },
  },
};

describe("buildDeedOfAssignmentMergeData", () => {
  it("fills assignor identity, trust account, debtor, and invoice rows", () => {
    const data = buildDeedOfAssignmentMergeData({
      contract: {
        id: "ctr_abc",
        issuer_organization_id: "org_1",
        offer_details: {
          offered_facility: 500000,
          sent_at: "2026-07-16T02:00:00.000Z",
          offer_acceptance: {
            status: "PENDING_ISSUER",
            authorized_parties_draft: ISSUER_SNAPSHOT,
          },
        },
        customer_details: { name: "Buyer Co", ssm_number: "202134567890" },
      },
      issuerOrganization: BASE_ORG,
      application: {
        id: "app_1",
        company_details: {
          contact_person: { email: "ops@issuer.my", contact: "+60 3-9999 0000" },
        },
        invoices: [
          {
            display_reference: "INV-REF-1",
            details: {
              invoice_number: "INV-001",
              issued_date: "2026-07-01",
              value: 50000,
              due_date: "2026-08-30",
            },
          },
        ],
      },
      ledgerBucketAccountsConfig: {
        REPAYMENT_POOL: {
          bankName: "Demo Trustee Bank",
          accountName: "CashSouk Repayment Pool",
          accountNumber: "1234567890",
        },
      },
    });

    expect(data.assignment_date).toBe("16 July 2026");
    expect(data.assignor_company_name).toBe("Issuer Co");
    expect(data.assignor_registration_number).toBe("123456-A");
    expect(data.assignor_registered_address).toContain("1 Jalan Test");
    expect(data.assignor_business_postal_address).toContain("Jalan Industri");
    expect(data.assignor_email).toBe("ops@issuer.my");
    expect(data.assignor_contact_number).toBe("+60 3-9999 0000");
    expect(data.assignor_signatories).toEqual([
      {
        name: "Ali Bin Abu",
        identity_number: "820508105871",
        designation: "Director",
      },
      {
        name: "Siti Binti Ahmad",
        identity_number: "900101015555",
        designation: "Authorised Signatory",
      },
    ]);
    expect(data.trust_bank_name).toBe("Demo Trustee Bank");
    expect(data.trust_account_name).toBe("CashSouk Repayment Pool");
    expect(data.trust_account_number).toBe("1234567890");
    expect(data.trust_swift_code).toBe("");
    expect(data.debtor_company_name).toBe("Buyer Co");
    expect(data.debtor_registration_number).toBe("202134567890");
    expect(data.debtor_address).toBe("");
    expect(data.notice_date).toBe("");
    expect(data.transaction_documents).toEqual([
      {
        transaction_document_name_number: "INV-001",
        transaction_document_date: "1 July 2026",
        debtor_name: "Buyer Co",
        transaction_document_value: "RM 50,000.00",
        due_date: "30 August 2026",
      },
    ]);
  });

  it("leaves Schedule 3 empty when the application has no invoices", () => {
    const data = buildDeedOfAssignmentMergeData({
      contract: {
        id: "ctr_abc",
        issuer_organization_id: "org_1",
        offer_details: { sent_at: "2026-07-16T02:00:00.000Z" },
        customer_details: { name: "Buyer Co" },
      },
      issuerOrganization: { id: "org_1", name: "Issuer Co", registration_number: "123456-A" },
    });
    expect(data.transaction_documents).toEqual([]);
  });

  it("maps every issuer authorised representative, not only the first two", () => {
    const data = buildDeedOfAssignmentMergeData({
      contract: {
        id: "ctr_abc",
        issuer_organization_id: "org_1",
        offer_details: {
          sent_at: "2026-07-16T02:00:00.000Z",
          offer_acceptance: {
            status: "PENDING_ISSUER",
            authorized_parties_draft: {
              ...ISSUER_SNAPSHOT,
              parties: [
                {
                  ...ISSUER_SNAPSHOT.parties[0]!,
                  representatives: [
                    ISSUER_SNAPSHOT.parties[0]!.representatives[0]!,
                    ISSUER_SNAPSHOT.parties[0]!.representatives[1]!,
                    {
                      name: "Tan Mei Ling",
                      email: "mei@co.my",
                      ic_number: "880101145555",
                      capacity: "director" as const,
                    },
                  ],
                },
              ],
            },
          },
        },
      },
      issuerOrganization: BASE_ORG,
    });
    expect(data.assignor_signatories.map((signatory) => signatory.name)).toEqual([
      "Ali Bin Abu",
      "Siti Binti Ahmad",
      "Tan Mei Ling",
    ]);
  });

  it("maps a single authorised representative without padding a second block", () => {
    const data = buildDeedOfAssignmentMergeData({
      contract: {
        id: "ctr_abc",
        issuer_organization_id: "org_1",
        offer_details: {
          sent_at: "2026-07-16T02:00:00.000Z",
          offer_acceptance: {
            status: "PENDING_ISSUER",
            authorized_parties_draft: {
              ...ISSUER_SNAPSHOT,
              parties: [
                {
                  ...ISSUER_SNAPSHOT.parties[0]!,
                  representatives: [ISSUER_SNAPSHOT.parties[0]!.representatives[0]!],
                },
              ],
            },
          },
        },
      },
      issuerOrganization: BASE_ORG,
    });
    expect(data.assignor_signatories).toEqual([
      {
        name: "Ali Bin Abu",
        identity_number: "820508105871",
        designation: "Director",
      },
    ]);
  });

  it("falls back to the organisation phone when contact_person.contact is empty", () => {
    const data = buildDeedOfAssignmentMergeData({
      contract: {
        id: "ctr_abc",
        issuer_organization_id: "org_1",
        offer_details: { sent_at: "2026-07-16T02:00:00.000Z" },
      },
      issuerOrganization: BASE_ORG,
      application: {
        id: "app_1",
        company_details: { contact_person: { email: "ops@issuer.my", contact: "" } },
      },
    });
    expect(data.assignor_contact_number).toBe("+60 3-1111 2222");
    expect(data.assignor_email).toBe("ops@issuer.my");
  });

  it("does not invent SWIFT, debtor address, or notice particulars", () => {
    const data = buildDeedOfAssignmentMergeData({
      contract: {
        id: "ctr_abc",
        issuer_organization_id: "org_1",
        offer_details: { sent_at: "2026-07-16T02:00:00.000Z" },
        customer_details: { name: "Buyer Co" },
      },
      issuerOrganization: BASE_ORG,
    });
    expect(data.trust_swift_code).toBe("");
    expect(data.debtor_address).toBe("");
    expect(data.debtor_attention).toBe("");
    expect(data.notice_date).toBe("");
    expect(data.outstanding_amount).toBe("");
  });
});
