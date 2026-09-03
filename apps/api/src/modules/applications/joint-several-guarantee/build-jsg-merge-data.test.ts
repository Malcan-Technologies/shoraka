import { buildJsgMergeData, formatJsgFacilityDescription } from "./build-jsg-merge-data";

const CORPORATE_SNAPSHOT = {
  submitted_by_user_id: "user_1",
  submitted_at: "2026-08-21T00:00:00.000Z",
  parties: [
    {
      key: "g_co",
      entity_kind: "CORPORATE_GUARANTOR" as const,
      application_guarantor_id: "g_co",
      representatives: [
        {
          name: "Nora Abdullah",
          email: "nora@holdco.my",
          ic_number: "880101015555",
          capacity: "director" as const,
        },
      ],
    },
  ],
};

describe("formatJsgFacilityDescription", () => {
  it("joins amount and letter date", () => {
    expect(formatJsgFacilityDescription("RM 500,000.00", "16 July 2026")).toBe(
      "Account Receivable Financing-i Facility of RM 500,000.00 as described in the Letter of Offer dated 16 July 2026"
    );
  });

  it("returns empty when amount or date is missing", () => {
    expect(formatJsgFacilityDescription("", "16 July 2026")).toBe("");
    expect(formatJsgFacilityDescription("RM 1.00", "")).toBe("");
  });
});

describe("buildJsgMergeData", () => {
  it("fills identity, LO date/ref, facility, and ordered guarantors", () => {
    const data = buildJsgMergeData({
      contract: {
        id: "ctr_abc",
        issuer_organization_id: "org_1",
        offer_details: {
          offered_facility: 500000,
          sent_at: "2026-07-16T02:00:00.000Z",
          offer_acceptance: {
            status: "PENDING_ISSUER",
            authorized_parties_draft: CORPORATE_SNAPSHOT,
          },
        },
        contract_details: { approved_facility: 1000000 },
      },
      issuerOrganization: {
        id: "org_1",
        name: "Issuer Co",
        registration_number: "123456-A",
        address: "Legacy address",
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
      },
      application: {
        id: "app_1",
        application_guarantors: [
          {
            id: "g_ind",
            guarantor_type: "individual",
            name: "Ali",
            ic_number: "900101145678",
          },
          {
            id: "g_co",
            guarantor_type: "company",
            business_name: "HoldCo",
            ssm_number: "999999-X",
          },
        ],
      },
    });

    expect(data.our_reference).toBe("ctr_abc");
    expect(data.letter_date).toBe(data.guarantee_date);
    expect(data.letter_date).toContain("July 2026");
    expect(data.issuer_name).toBe("Issuer Co");
    expect(data.issuer_registration_number).toBe("123456-A");
    expect(data.issuer_address).toContain("1 Jalan Test");
    expect(data.issuer_business_address).toContain("Jalan Industri");
    expect(data.facility_description).toContain("RM 500,000.00");
    expect(data.facility_description).toContain("Letter of Offer dated");
    expect(data.guarantors_individual).toHaveLength(1);
    expect(data.guarantors_individual[0]?.line).toContain("Ali");
    expect(data.guarantors_corporate).toEqual([
      {
        name: "HoldCo",
        ssm: "999999-X",
        signatories: [
          { name: "Nora Abdullah", nric: "880101015555", capacity: "director" },
        ],
      },
    ]);
    expect(data.schedule_guarantors).toHaveLength(2);
    expect(data.schedule_guarantors[0]?.line).toContain("Ali");
    expect(data.schedule_guarantors[1]?.line).toContain("HoldCo");
    expect(data.schedule_guarantors[1]?.representatives[0]?.rep_line).toContain("Nora");
  });

  it("leaves facility_description empty when the financing amount is missing", () => {
    const data = buildJsgMergeData({
      contract: {
        id: "ctr_abc",
        issuer_organization_id: "org_1",
        offer_details: { sent_at: "2026-07-16T02:00:00.000Z" },
        contract_details: {},
      },
      issuerOrganization: {
        id: "org_1",
        name: "Issuer Co",
        registration_number: "123456-A",
      },
    });
    expect(data.facility_description).toBe("");
    expect(data.letter_date).not.toBe("");
  });

  it("does not fall back org.address for issuer_business_address", () => {
    const data = buildJsgMergeData({
      contract: {
        id: "ctr_abc",
        issuer_organization_id: "org_1",
        offer_details: {
          offered_facility: 1,
          sent_at: "2026-07-16T02:00:00.000Z",
        },
      },
      issuerOrganization: {
        id: "org_1",
        name: "Issuer Co",
        registration_number: "123456-A",
        address: "Legacy registered only",
        corporate_onboarding_data: {
          addresses: {
            registered: {
              line1: "1 Jalan Test",
              city: "Kuala Lumpur",
              country: "Malaysia",
            },
          },
        },
      },
    });
    expect(data.issuer_address).toContain("1 Jalan Test");
    expect(data.issuer_business_address).toBe("");
  });
});
