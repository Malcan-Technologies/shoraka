/**
 * SECTION: buildUnifiedPeople stabilization coverage
 * WHY: Lock people-only contract and prevent frontend drift
 * INPUT: CTOS + issuer status + supplement rows
 * OUTPUT: Stable unified `people` rows
 * WHERE USED: Admin/Issuer/Investor director-shareholder rendering
 */

import { buildUnifiedPeople } from "./build-people-list";

describe("buildUnifiedPeople", () => {
  it("merges director + shareholder into one person row", () => {
    const rows = buildUnifiedPeople({
      ctos: {
        directors: [
          {
            party_type: "I",
            nic_brno: "900101-10-1111",
            name: "Merge Person",
            position: "Director",
          },
        ],
        shareholders: [
          {
            party_type: "I",
            nic_brno: "900101101111",
            name: "Merge Person",
            equity_percentage: 10,
          },
        ],
      },
      issuerDirectorKycStatus: null,
      issuerDirectorAmlStatus: null,
      ctosPartySupplements: null,
      corporateEntities: null,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.roles).toEqual(expect.arrayContaining(["DIRECTOR", "SHAREHOLDER"]));
    expect(rows[0]?.sharePercentage).toBe(10);
  });

  it("applies share filter correctly for <5% rules", () => {
    const rows = buildUnifiedPeople({
      ctos: {
        directors: [
          {
            party_type: "I",
            nic_brno: "880202-10-2222",
            name: "Director Low Share",
            position: "Director",
          },
        ],
        shareholders: [
          {
            party_type: "I",
            nic_brno: "770303-10-3333",
            name: "Shareholder Only Low",
            equity_percentage: 3,
          },
          {
            party_type: "I",
            nic_brno: "880202102222",
            name: "Director Low Share",
            equity_percentage: 3,
          },
        ],
      },
      issuerDirectorKycStatus: null,
      issuerDirectorAmlStatus: null,
      ctosPartySupplements: null,
      corporateEntities: null,
    });

    const director = rows.find((r) => r.matchKey === "880202102222");
    const shareholderOnlyLow = rows.find((r) => r.matchKey === "770303103333");

    expect(director).toBeDefined();
    expect(director?.roles).toEqual(["DIRECTOR"]);
    expect(shareholderOnlyLow).toBeUndefined();
  });

  it("uses DB values when DB match exists", () => {
    const rows = buildUnifiedPeople({
      ctos: {
        directors: [
          {
            party_type: "I",
            nic_brno: "660404-10-4444",
            name: "Override Person",
            position: "Director",
          },
        ],
        shareholders: [],
      },
      issuerDirectorKycStatus: {
        directors: [
          {
            governmentIdNumber: "660404104444",
            kycStatus: "PENDING",
            email: "db-kyc@example.com",
          },
        ],
      },
      issuerDirectorAmlStatus: {
        directors: [
          {
            governmentIdNumber: "660404104444",
            amlStatus: "REJECTED",
            email: "db-aml@example.com",
          },
        ],
      },
      ctosPartySupplements: [
        {
          party_key: "660404104444",
          onboarding_json: {
            onboarding: { status: "APPROVED", email: "supplement@example.com" },
            screening: { status: "APPROVED" },
          },
        },
      ],
      corporateEntities: null,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.onboarding?.status).toBe("PENDING");
    expect(rows[0]?.screening?.status).toBe("REJECTED");
    expect(rows[0]?.email).toBe("db-kyc@example.com");
  });

  it("treats unmatched person as NEW_PERSON with null status and email", () => {
    const rows = buildUnifiedPeople({
      ctos: {
        directors: [
          {
            party_type: "I",
            nic_brno: "550505-10-5555",
            name: "New Person",
            position: "Director",
          },
        ],
        shareholders: [],
      },
      issuerDirectorKycStatus: {
        directors: [{ governmentIdNumber: "111111111111", kycStatus: "APPROVED", email: "db@example.com" }],
      },
      issuerDirectorAmlStatus: {
        directors: [{ governmentIdNumber: "111111111111", amlStatus: "APPROVED", email: "db-aml@example.com" }],
      },
      ctosPartySupplements: [
        {
          party_key: "222222222222",
          onboarding_json: { onboarding: { status: "APPROVED", email: "supp@example.com" } },
        },
      ],
      corporateEntities: null,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.matchKey).toBe("550505105555");
    expect(rows[0]?.onboarding?.status).toBeNull();
    expect(rows[0]?.screening?.status).toBeNull();
    expect(rows[0]?.email).toBe("");
  });

  it("sets requestId and AML risk from EOD-linked issuer payloads (user-declared path)", () => {
    const rows = buildUnifiedPeople({
      ctos: null,
      issuerDirectorKycStatus: {
        directors: [
          {
            governmentIdNumber: "050616101789",
            kycStatus: "APPROVED",
            kycId: "KY123",
            eodRequestId: "EOD05278",
            email: "a@b.com",
          },
        ],
      },
      issuerDirectorAmlStatus: {
        directors: [
          {
            governmentIdNumber: "050616101789",
            eodRequestId: "EOD05278",
            amlStatus: "REJECTED",
            amlRiskLevel: "Low",
            amlRiskScore: 12,
          },
        ],
      },
      ctosPartySupplements: null,
      corporateEntities: {
        directors: [
          {
            eodRequestId: "EOD05278",
            personalInfo: {
              fullName: "Lim",
              email: "a@b.com",
              formContent: {
                content: [{ fieldName: "Government ID Number", fieldValue: "050616-10-1789" }],
              },
            },
          },
        ],
        shareholders: [],
        corporateShareholders: [],
      },
    });
    const lim = rows.find((r) => r.entityType === "INDIVIDUAL");
    expect(lim).toBeDefined();
    expect(lim?.requestId).toBe("KY123");
    expect(lim?.screening?.riskLevel).toBe("Low");
    expect(lim?.screening?.riskScore).toBe(12);
    expect(lim?.onboarding?.id).toBe("KY123");
    expect(lim?.screening?.status).toBe("REJECTED");
  });

  it("sets corporate matchKey from Business Number in formContent.displayAreas (case-insensitive)", () => {
    const rows = buildUnifiedPeople({
      ctos: null,
      issuerDirectorKycStatus: { directors: [] },
      issuerDirectorAmlStatus: { directors: [], businessShareholders: [] },
      ctosPartySupplements: null,
      corporateEntities: {
        directors: [],
        shareholders: [],
        corporateShareholders: [
          {
            companyName: "Petronas Sdn Bhd",
            formContent: {
              displayAreas: [
                {
                  displayArea: "Basic Information Setting",
                  content: [
                    { fieldName: "Business Name", fieldType: "text", fieldValue: "Petronas Sdn Bhd" },
                    { fieldName: "BUSINESS NUMBER", fieldType: "text", fieldValue: "123123123" },
                    { fieldName: "% of Shares", fieldType: "number", fieldValue: "10" },
                  ],
                },
              ],
            },
          },
        ],
      },
    });

    const corp = rows.find((r) => r.entityType === "CORPORATE");
    expect(corp).toBeDefined();
    expect(corp?.matchKey).toBe("123123123");
  });

  it("includes individual when Government ID is only in personalInfo.formContent", () => {
    const rows = buildUnifiedPeople({
      ctos: null,
      issuerDirectorKycStatus: { directors: [] },
      issuerDirectorAmlStatus: { directors: [], businessShareholders: [] },
      ctosPartySupplements: null,
      corporateEntities: {
        directors: [
          {
            eodRequestId: "EOD1",
            personalInfo: {
              fullName: "Test Person",
              email: "t@example.com",
              formContent: {
                content: [{ fieldName: "Government ID Number", fieldValue: "050616101789" }],
              },
            },
          },
        ],
        shareholders: [],
        corporateShareholders: [],
      },
    });

    const ind = rows.find((r) => r.entityType === "INDIVIDUAL");
    expect(ind).toBeDefined();
    expect(ind?.matchKey).toBe("050616101789");
  });

  it("omits individual when formContent has no Government ID even if director_kyc_status has IC", () => {
    const rows = buildUnifiedPeople({
      ctos: null,
      issuerDirectorKycStatus: {
        directors: [
          {
            governmentIdNumber: "999999999999",
            kycStatus: "APPROVED",
            email: "sync@example.com",
            eodRequestId: "EOD1",
          },
        ],
      },
      issuerDirectorAmlStatus: { directors: [], businessShareholders: [] },
      ctosPartySupplements: null,
      corporateEntities: {
        directors: [
          {
            eodRequestId: "EOD1",
            personalInfo: {
              fullName: "No IC In Form",
              formContent: {
                content: [{ fieldName: "Email Address", fieldValue: "a@b.com" }],
              },
            },
          },
        ],
        shareholders: [],
        corporateShareholders: [],
      },
    });

    expect(rows.filter((r) => r.entityType === "INDIVIDUAL")).toHaveLength(0);
  });

  it("omits corporate shareholder from people when Business Number in form is empty", () => {
    const rows = buildUnifiedPeople({
      ctos: null,
      issuerDirectorKycStatus: { directors: [] },
      issuerDirectorAmlStatus: { directors: [], businessShareholders: [] },
      ctosPartySupplements: null,
      corporateEntities: {
        directors: [],
        shareholders: [],
        corporateShareholders: [
          {
            companyName: "Ghost Corp",
            registrationNumber: "IGNORED_TOP_LEVEL",
            formContent: {
              displayAreas: [
                {
                  content: [
                    { fieldName: "Business Name", fieldValue: "Ghost" },
                    { fieldName: "Business Number", fieldValue: "" },
                  ],
                },
              ],
            },
          },
        ],
      },
    });

    expect(rows.filter((r) => r.entityType === "CORPORATE")).toHaveLength(0);
  });
});
