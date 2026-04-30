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
});
