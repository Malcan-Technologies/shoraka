/**
 * SECTION: buildUnifiedPeople stabilization coverage
 * WHY: Lock people-only contract and prevent frontend drift
 * INPUT: CTOS + issuer status + supplement rows
 * OUTPUT: Stable unified `people` rows
 * WHERE USED: Admin/Issuer/Investor director-shareholder rendering
 */

import { buildUnifiedPeople, buildDirectorShareholderPeopleList } from "./build-people-list";
import { CTOS_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING } from "@cashsouk/types";

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

  it("uses supplement only when a ctos_party_supplements row exists for the matchKey (ignores issuer KYC/AML)", () => {
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
            kycId: "KY999",
            email: "db-kyc@example.com",
          },
        ],
      },
      issuerDirectorAmlStatus: {
        directors: [
          {
            governmentIdNumber: "660404104444",
            amlStatus: "REJECTED",
            amlRiskLevel: "High",
            amlRiskScore: 99,
            email: "db-aml@example.com",
          },
        ],
      },
      ctosPartySupplements: [
        {
          party_key: "660404104444",
          onboarding_json: {
            requestId: "LD80084",
            status: "WAIT_FOR_APPROVAL",
            email: "supplement@example.com",
            verifyLink: "https://verify.example/v",
            updatedAt: "2026-01-01T00:00:00.000Z",
            screening: {
              requestId: "AMLREQ1",
              status: "PENDING",
              riskLevel: "Low",
              riskScore: 3,
            },
          },
        },
      ],
      corporateEntities: null,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.requestId).toBe("AMLREQ1");
    expect(rows[0]?.requestIdType).toBe("SCREENING");
    expect(rows[0]?.onboarding?.status).toBe("WAIT_FOR_APPROVAL");
    expect(rows[0]?.onboarding?.verifyLink).toBe("https://verify.example/v");
    expect(rows[0]?.screening?.status).toBe("PENDING");
    expect(rows[0]?.screening?.riskLevel).toBe("Low");
    expect(rows[0]?.screening?.riskScore).toBe(3);
    expect(rows[0]?.screening?.id).toBe("AMLREQ1");
    expect(rows[0]?.email).toBe("supplement@example.com");
  });

  it("uses top-level supplement requestId when screening has no requestId", () => {
    const rows = buildUnifiedPeople({
      ctos: {
        directors: [
          {
            party_type: "I",
            nic_brno: "770707-10-7777",
            name: "Pre Aml",
            position: "Director",
          },
        ],
        shareholders: [],
      },
      issuerDirectorKycStatus: {
        directors: [{ governmentIdNumber: "770707107777", kycId: "KY_SHOULD_NOT_APPEAR", kycStatus: "APPROVED" }],
      },
      issuerDirectorAmlStatus: { directors: [{ governmentIdNumber: "770707107777", amlStatus: "APPROVED" }] },
      ctosPartySupplements: [
        {
          party_key: "770707107777",
          onboarding_json: {
            requestId: "LD80084-R07",
            status: "IN_PROGRESS",
            screening: null,
          },
        },
      ],
      corporateEntities: null,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.requestId).toBe("LD80084-R07");
    expect(rows[0]?.requestIdType).toBe("ONBOARDING");
  });

  it("uses issuer KYC/AML when no supplement row exists for the matchKey", () => {
    const rows = buildUnifiedPeople({
      ctos: {
        directors: [
          {
            party_type: "I",
            nic_brno: "660404-10-4444",
            name: "Issuer Only",
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
            kycId: "KY1",
            email: "db-kyc@example.com",
          },
        ],
      },
      issuerDirectorAmlStatus: {
        directors: [
          {
            governmentIdNumber: "660404104444",
            amlStatus: "REJECTED",
            amlRiskLevel: "Med",
            amlRiskScore: 1,
            email: "db-aml@example.com",
          },
        ],
      },
      ctosPartySupplements: null,
      corporateEntities: null,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.onboarding?.status).toBe("PENDING");
    expect(rows[0]?.screening?.status).toBe("REJECTED");
    expect(rows[0]?.requestId).toBe("KY1");
    expect(rows[0]?.screening?.riskLevel).toBe("Med");
    expect(rows[0]?.screening?.riskScore).toBe(1);
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

  it("merges COD director + shareholder (same person, different EOD IDs) into one visible row", () => {
    const rows = buildUnifiedPeople({
      ctos: null,
      issuerDirectorKycStatus: {
        directors: [
          {
            eodRequestId: "EOD04651",
            governmentIdNumber: "900101101111",
            kycStatus: "APPROVED",
            kycId: "KY-COD04000",
            email: "lucas@example.com",
          },
        ],
        individualShareholders: [
          {
            shareholderEodRequestId: "EOD04650",
            governmentIdNumber: "900101101111",
            kycStatus: "APPROVED",
            kycId: "KY-COD04000-SH",
            email: "lucas@example.com",
          },
        ],
      },
      issuerDirectorAmlStatus: {
        directors: [],
        individualShareholders: [],
        businessShareholders: [],
      },
      ctosPartySupplements: null,
      corporateEntities: {
        directors: [
          {
            eodRequestId: "EOD04651",
            personalInfo: {
              fullName: "Lucas Yi Jin",
              email: "lucas@example.com",
              formContent: {
                content: [{ fieldName: "Government ID Number", fieldValue: "900101-10-1111" }],
              },
            },
          },
        ],
        shareholders: [
          {
            eodRequestId: "EOD04650",
            personalInfo: {
              fullName: "Lucas Yi Jin",
              email: "lucas@example.com",
              formContent: {
                content: [
                  { fieldName: "Government ID Number", fieldValue: "900101-10-1111" },
                  { fieldName: "% of Shares", fieldValue: "60" },
                ],
              },
            },
          },
        ],
        corporateShareholders: [],
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Lucas Yi Jin");
    expect(rows[0]?.matchKey).toBe("900101101111");
    expect(rows[0]?.roles).toEqual(expect.arrayContaining(["DIRECTOR", "SHAREHOLDER"]));
    expect(rows[0]?.sharePercentage).toBe(60);
  });

  it("buildDirectorShareholderPeopleList: COD05079 same-email people stay separate; EXPIRED without KYC still listed", () => {
    const sharedEmail = "shared@example.com";
    const result = buildDirectorShareholderPeopleList({
      ctos: null,
      issuerDirectorKycStatus: {
        directors: [
          {
            eodRequestId: "EOD06284",
            shareholderEodRequestId: "EOD06283",
            governmentIdNumber: "900101101111",
            kycStatus: "EXPIRED",
            email: sharedEmail,
            name: "Lim Tze Yang",
            role: "Director, Shareholder (30%)",
          },
          {
            eodRequestId: "EOD06286",
            shareholderEodRequestId: "EOD06285",
            governmentIdNumber: "800202102222",
            kycStatus: "EXPIRED",
            email: sharedEmail,
            name: "Ahmad Shahril",
            role: "Director, Shareholder (30%)",
          },
        ],
      },
      issuerDirectorAmlStatus: {
        directors: [],
        individualShareholders: [],
        businessShareholders: [],
      },
      ctosPartySupplements: null,
      corporateEntities: {
        directors: [
          {
            eodRequestId: "EOD06284",
            status: "EXPIRED",
            personalInfo: {
              fullName: "Lim Tze Yang",
              email: sharedEmail,
              formContent: {
                content: [{ fieldName: "Government ID Number", fieldValue: "900101-10-1111" }],
              },
            },
          },
          {
            eodRequestId: "EOD06286",
            status: "EXPIRED",
            personalInfo: {
              fullName: "Ahmad Shahril",
              email: sharedEmail,
              formContent: {
                content: [{ fieldName: "Government ID Number", fieldValue: "800202-10-2222" }],
              },
            },
          },
        ],
        shareholders: [
          {
            eodRequestId: "EOD06283",
            status: "EXPIRED",
            personalInfo: {
              fullName: "Lim Tze Yang",
              email: sharedEmail,
              formContent: {
                content: [
                  { fieldName: "Government ID Number", fieldValue: "900101-10-1111" },
                  { fieldName: "% of Shares", fieldValue: "30" },
                ],
              },
            },
          },
          {
            eodRequestId: "EOD06285",
            status: "EXPIRED",
            personalInfo: {
              fullName: "Ahmad Shahril",
              email: sharedEmail,
              formContent: {
                content: [
                  { fieldName: "Government ID Number", fieldValue: "800202-10-2222" },
                  { fieldName: "% of Shares", fieldValue: "30" },
                ],
              },
            },
          },
        ],
        corporateShareholders: [
          {
            name: "ABC Berhad",
            isPrimary: false,
            corporateOnboardingRequest: { requestId: "COD05080", status: "WAIT_FOR_APPROVAL" },
          },
        ],
      },
    });

    expect(result.listSource).toBe("ONBOARDING");
    expect(result.people).toHaveLength(2);
    const lim = result.people.find((p) => p.name === "Lim Tze Yang");
    const ahmad = result.people.find((p) => p.name === "Ahmad Shahril");
    expect(lim).toBeDefined();
    expect(ahmad).toBeDefined();
    expect(lim!.roles).toEqual(expect.arrayContaining(["DIRECTOR", "SHAREHOLDER"]));
    expect(ahmad!.roles).toEqual(expect.arrayContaining(["DIRECTOR", "SHAREHOLDER"]));
    expect(lim!.sharePercentage).toBe(30);
    expect(ahmad!.sharePercentage).toBe(30);
    expect(lim!.onboarding?.status).toBe("EXPIRED");
    expect(ahmad!.onboarding?.status).toBe("EXPIRED");
    expect(lim!.screening?.status ?? null).toBeNull();
    expect(ahmad!.screening?.status ?? null).toBeNull();
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

  it("returns unresolved identity when formContent has no Government ID even if director_kyc_status has IC", () => {
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

    const individuals = rows.filter((r) => r.entityType === "INDIVIDUAL");
    expect(individuals).toHaveLength(1);
    expect(individuals[0]?.identityWarning).toBe("MISSING_GOVERNMENT_ID");
    expect(individuals[0]?.matchKey).toBe("");
    expect(individuals[0]?.requestId).toBe("EOD1");
    // KYC IC must not become a trusted matchKey without form government ID
    expect(individuals[0]?.matchKey).not.toBe("999999999999");
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

  it("uses onboarding corporate_entities when no CTOS company_json exists", () => {
    const result = buildDirectorShareholderPeopleList({
      ctos: null,
      issuerDirectorKycStatus: { directors: [] },
      issuerDirectorAmlStatus: { directors: [], businessShareholders: [] },
      ctosPartySupplements: null,
      corporateEntities: {
        directors: [
          {
            eodRequestId: "EOD1",
            personalInfo: {
              fullName: "Onboarding Director",
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

    expect(result.listSource).toBe("ONBOARDING");
    expect(result.ctosDirectorShareholderWarning).toBeNull();
    expect(result.people.some((r) => r.matchKey === "050616101789")).toBe(true);
  });

  it("uses CTOS people when company_json has directors", () => {
    const result = buildDirectorShareholderPeopleList({
      ctos: {
        directors: [
          {
            party_type: "I",
            nic_brno: "900101-10-1111",
            name: "CTOS Director",
            position: "DO",
          },
        ],
        shareholders: [],
      },
      issuerDirectorKycStatus: null,
      issuerDirectorAmlStatus: null,
      ctosPartySupplements: null,
      corporateEntities: {
        directors: [
          {
            personalInfo: {
              fullName: "Should Not Appear",
              formContent: {
                content: [{ fieldName: "Government ID Number", fieldValue: "111111111111" }],
              },
            },
          },
        ],
      },
    });

    expect(result.listSource).toBe("CTOS");
    expect(result.ctosDirectorShareholderWarning).toBeNull();
    expect(result.people).toHaveLength(1);
    expect(result.people[0]?.name).toBe("CTOS Director");
  });

  it("returns empty people and warning when CTOS report exists but has no usable directors/shareholders", () => {
    const result = buildDirectorShareholderPeopleList({
      ctos: { directors: [], shareholders: [] },
      issuerDirectorKycStatus: null,
      issuerDirectorAmlStatus: null,
      ctosPartySupplements: null,
      corporateEntities: {
        directors: [
          {
            personalInfo: {
              fullName: "Onboarding Only",
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

    expect(result.listSource).toBe("CTOS_EMPTY");
    expect(result.people).toEqual([]);
    expect(result.ctosDirectorShareholderWarning).toBe(CTOS_DIRECTOR_SHAREHOLDER_DATA_EMPTY_WARNING);
  });

  it("COD04000: missing government ID returns two unresolved identity rows (no name merge)", () => {
    const result = buildDirectorShareholderPeopleList({
      ctos: null,
      issuerDirectorKycStatus: {
        directors: [
          {
            eodRequestId: "EOD04651",
            shareholderEodRequestId: "EOD04650",
            kycStatus: "APPROVED",
            kycId: "KYC00073",
            email: "denglucasyijin@gmail.com",
            name: "Lucas Yi Jin",
            role: "Director, Shareholder (60%)",
          },
        ],
      },
      issuerDirectorAmlStatus: {
        directors: [
          {
            eodRequestId: "EOD04650",
            kycId: "KYC00073",
            amlStatus: "Unresolved",
            name: "Lucas Yi Jin",
            email: "denglucasyijin@gmail.com",
          },
        ],
      },
      ctosPartySupplements: null,
      corporateEntities: {
        directors: [
          {
            eodRequestId: "EOD04651",
            status: "APPROVED",
            personalInfo: {
              fullName: "Lucas  Yi Jin",
              email: "denglucasyijin@gmail.com",
              governmentIdNumber: null,
              formContent: {
                content: [
                  { fieldName: "First Name", fieldValue: "Lucas" },
                  { fieldName: "Last Name", fieldValue: "Yi Jin" },
                  { fieldName: "Designation", fieldValue: "Director" },
                  { fieldName: "Email Address", fieldValue: "denglucasyijin@gmail.com" },
                ],
              },
            },
          },
        ],
        shareholders: [
          {
            eodRequestId: "EOD04650",
            status: "APPROVED",
            personalInfo: {
              fullName: "Lucas  Yi Jin",
              email: "denglucasyijin@gmail.com",
              governmentIdNumber: null,
              formContent: {
                content: [
                  { fieldName: "First Name", fieldValue: "Lucas" },
                  { fieldName: "Last Name", fieldValue: "Yi Jin" },
                  { fieldName: "% of Shares", fieldValue: "60" },
                  { fieldName: "Email Address", fieldValue: "denglucasyijin@gmail.com" },
                ],
              },
            },
          },
        ],
        corporateShareholders: [],
      },
    });

    expect(result.listSource).toBe("ONBOARDING");
    expect(result.people).toHaveLength(2);
    expect(result.people.every((p) => p.identityWarning === "MISSING_GOVERNMENT_ID")).toBe(true);
    expect(result.people.every((p) => p.matchKey === "")).toBe(true);
    const eods = result.people.map((p) => p.requestId).sort();
    expect(eods).toEqual(["EOD04650", "EOD04651"]);
    const director = result.people.find((p) => p.requestId === "EOD04651");
    const shareholder = result.people.find((p) => p.requestId === "EOD04650");
    expect(director?.roles).toEqual(["DIRECTOR"]);
    expect(shareholder?.roles).toEqual(["SHAREHOLDER"]);
    expect(shareholder?.sharePercentage).toBe(60);
    expect(director?.onboarding?.status).toBe("APPROVED");
    expect(shareholder?.onboarding?.status).toBe("APPROVED");
  });

  it("same name and email without government ID remain separate unresolved rows", () => {
    const result = buildDirectorShareholderPeopleList({
      ctos: null,
      issuerDirectorKycStatus: null,
      issuerDirectorAmlStatus: null,
      ctosPartySupplements: null,
      corporateEntities: {
        directors: [
          {
            eodRequestId: "EOD-A",
            status: "WAIT_FOR_APPROVAL",
            personalInfo: {
              fullName: "Same Name",
              email: "shared@example.com",
              formContent: { content: [{ fieldName: "Designation", fieldValue: "Director" }] },
            },
          },
          {
            eodRequestId: "EOD-B",
            status: "WAIT_FOR_APPROVAL",
            personalInfo: {
              fullName: "Same Name",
              email: "shared@example.com",
              formContent: { content: [{ fieldName: "Designation", fieldValue: "Director" }] },
            },
          },
        ],
        shareholders: [],
        corporateShareholders: [],
      },
    });

    expect(result.people).toHaveLength(2);
    expect(result.people.map((p) => p.requestId).sort()).toEqual(["EOD-A", "EOD-B"]);
    expect(result.people.every((p) => p.identityWarning === "MISSING_GOVERNMENT_ID")).toBe(true);
  });

  it("mixed verified and unresolved identity rows both appear", () => {
    const result = buildDirectorShareholderPeopleList({
      ctos: null,
      issuerDirectorKycStatus: null,
      issuerDirectorAmlStatus: null,
      ctosPartySupplements: null,
      corporateEntities: {
        directors: [
          {
            eodRequestId: "EOD-VERIFIED",
            status: "APPROVED",
            personalInfo: {
              fullName: "Has IC",
              formContent: {
                content: [
                  { fieldName: "Designation", fieldValue: "Director" },
                  { fieldName: "Government ID Number", fieldValue: "900101-10-1111" },
                ],
              },
            },
          },
          {
            eodRequestId: "EOD-MISSING",
            status: "APPROVED",
            personalInfo: {
              fullName: "No IC",
              formContent: {
                content: [{ fieldName: "Designation", fieldValue: "Director" }],
              },
            },
          },
        ],
        shareholders: [],
        corporateShareholders: [],
      },
    });

    expect(result.listSource).toBe("ONBOARDING");
    expect(result.people).toHaveLength(2);
    const verified = result.people.find((p) => !p.identityWarning);
    const unresolved = result.people.find((p) => p.identityWarning === "MISSING_GOVERNMENT_ID");
    expect(verified?.matchKey).toBe("900101101111");
    expect(verified?.name).toBe("Has IC");
    expect(unresolved?.matchKey).toBe("");
    expect(unresolved?.requestId).toBe("EOD-MISSING");
  });

  it("empty corporate_entities still yields empty people (empty state)", () => {
    const result = buildDirectorShareholderPeopleList({
      ctos: null,
      issuerDirectorKycStatus: { directors: [] },
      issuerDirectorAmlStatus: { directors: [] },
      ctosPartySupplements: null,
      corporateEntities: { directors: [], shareholders: [], corporateShareholders: [] },
    });
    expect(result.listSource).toBe("ONBOARDING");
    expect(result.people).toEqual([]);
  });
});
