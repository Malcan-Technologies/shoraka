import {
  extractCtosObservationSnapshot,
  extractRegulatoryPartiesFromCorporateEntities,
  extractRegulatoryPartiesFromCtos,
  mergeRegulatoryPartyCandidates,
} from "./extract-regulatory-parties";

describe("extractRegulatoryPartiesFromCtos", () => {
  it("includes shareholders below 5% and does not copy equity into units", () => {
    const parties = extractRegulatoryPartiesFromCtos({
      directors: [],
      shareholders: [
        {
          party_type: "I",
          nic_brno: "800101-01-1234",
          name: "Small Holder",
          equity_percentage: 3,
          addr: "1 Jalan Test",
        },
        {
          party_type: "C",
          ic_lcno: "1234567X",
          name: "HoldCo Sdn Bhd",
          equity_percentage: 40,
        },
      ],
    });

    expect(parties).toHaveLength(2);
    const individual = parties.find((p) => p.entityType === "INDIVIDUAL");
    expect(individual?.name).toBe("Small Holder");
    expect(individual?.shareholdingPercentage).toBe(3);
    expect(individual).not.toHaveProperty("shareholdingUnits");
    expect(individual?.addressLine1).toBe("1 Jalan Test");
  });

  it("does not invent country of incorporation from an address line", () => {
    const parties = extractRegulatoryPartiesFromCtos({
      shareholders: [
        {
          party_type: "C",
          ic_lcno: "1234567X",
          name: "HoldCo Sdn Bhd",
          equity_percentage: 10,
          addr: "Kuala Lumpur, Malaysia",
        },
      ],
    });
    expect(parties[0]).not.toHaveProperty("countryOfIncorporation");
  });
});

describe("director vs board vs shareholder mapping", () => {
  it("does not treat a RegTank director as Board, and keeps shareholder >=5% (scenario C)", () => {
    const parties = extractRegulatoryPartiesFromCorporateEntities({
      directors: [
        {
          personalInfo: {
            fullName: "Nur Aina Farisha Binti Salleh",
            governmentIdNumber: "950829083430",
          },
        },
      ],
      shareholders: [
        {
          personalInfo: {
            fullName: "Nur Aina Farisha Binti Salleh",
            governmentIdNumber: "950829083430",
          },
          sharePercentage: 6,
        },
      ],
      corporateShareholders: [],
    });
    expect(parties).toHaveLength(1);
    expect(parties[0]?.isDirector).toBe(true);
    expect(parties[0]?.isShareholder).toBe(true);
    expect(parties[0]?.isBoard).toBe(false);
    expect(parties[0]?.shareholdingPercentage).toBe(6);
    expect(parties[0]?.identityPrefix).toBe("NRIC");
  });

  it("includes a corporate shareholder at 10% as a company party (scenario D)", () => {
    const parties = extractRegulatoryPartiesFromCorporateEntities({
      directors: [],
      shareholders: [],
      corporateShareholders: [
        {
          businessName: "ApexStar Holdings Sdn. Bhd.",
          ssmRegistrationNumber: "202001234567",
          sharePercentage: 10,
        },
      ],
    });
    expect(parties).toHaveLength(1);
    expect(parties[0]?.entityType).toBe("CORPORATE");
    expect(parties[0]?.name).toBe("ApexStar Holdings Sdn. Bhd.");
    expect(parties[0]?.isShareholder).toBe(true);
    expect(parties[0]?.isDirector).toBe(false);
    expect(parties[0]?.isBoard).toBe(false);
    expect(parties[0]?.identityPrefix).toBe("ROC");
    expect(parties[0]?.shareholdingPercentage).toBe(10);
  });

  it("merges CTOS directors with RegTank corporate shareholders instead of dropping them", () => {
    const fromCtos = extractRegulatoryPartiesFromCtos({
      directors: [
        {
          party_type: "I",
          nic_brno: "950829083430",
          name: "Nur Aina Farisha Binti Salleh",
          position: "DO",
        },
      ],
      shareholders: [],
    });
    const fromRegtank = extractRegulatoryPartiesFromCorporateEntities({
      directors: [
        {
          personalInfo: {
            fullName: "Nur Aina Farisha Binti Salleh",
            governmentIdNumber: "950829083430",
          },
        },
      ],
      shareholders: [
        {
          personalInfo: {
            fullName: "Nur Aina Farisha Binti Salleh",
            governmentIdNumber: "950829083430",
          },
          sharePercentage: 6,
        },
      ],
      corporateShareholders: [
        {
          businessName: "ApexStar Holdings Sdn. Bhd.",
          ssmRegistrationNumber: "202001234567",
          sharePercentage: 10,
        },
      ],
    });
    const merged = mergeRegulatoryPartyCandidates(fromCtos, fromRegtank);
    const aina = merged.find((p) => p.entityType === "INDIVIDUAL");
    const apex = merged.find((p) => p.entityType === "CORPORATE");
    expect(aina?.isDirector).toBe(true);
    expect(aina?.isShareholder).toBe(true);
    expect(aina?.isBoard).toBe(false);
    expect(apex?.name).toBe("ApexStar Holdings Sdn. Bhd.");
    expect(apex?.shareholdingPercentage).toBe(10);
  });

  it("reads ApexStar SSM and 10% from KYB displayAreas when top-level fields are missing", () => {
    const parties = extractRegulatoryPartiesFromCorporateEntities({
      directors: [],
      shareholders: [],
      corporateShareholders: [
        {
          formContent: {
            displayAreas: [
              {
                displayArea: "Basic Information Setting",
                content: [
                  { fieldName: "Business Name", fieldValue: "ApexStar Holdings Sdn. Bhd." },
                  { fieldName: "Business Number", fieldValue: "7321984G" },
                  { fieldName: "% of Shares", fieldValue: "10" },
                ],
              },
            ],
          },
        },
      ],
    });
    expect(parties).toHaveLength(1);
    expect(parties[0]?.partyKey).toBe("7321984G");
    expect(parties[0]?.name).toBe("ApexStar Holdings Sdn. Bhd.");
    expect(parties[0]?.shareholdingPercentage).toBe(10);
    expect(parties[0]?.entityType).toBe("CORPORATE");
  });

  it("reads Nur Aina 6% from personalInfo.formContent when sharePercentage is absent", () => {
    const parties = extractRegulatoryPartiesFromCorporateEntities({
      directors: [
        {
          personalInfo: {
            fullName: "Nur Aina Farisha Binti Salleh",
            governmentIdNumber: "950829083430",
          },
        },
      ],
      shareholders: [
        {
          personalInfo: {
            fullName: "Nur Aina Farisha Binti Salleh",
            governmentIdNumber: "950829083430",
            formContent: {
              content: [{ fieldName: "% of Shares", fieldValue: "6" }],
            },
          },
        },
      ],
      corporateShareholders: [],
    });
    expect(parties).toHaveLength(1);
    expect(parties[0]?.shareholdingPercentage).toBe(6);
    expect(parties[0]?.isDirector).toBe(true);
    expect(parties[0]?.isShareholder).toBe(true);
  });

  it("prefers RegTank form share % over a later CTOS equity figure", () => {
    const fromCtos = extractRegulatoryPartiesFromCtos({
      shareholders: [
        {
          party_type: "C",
          ic_lcno: "7321984G",
          name: "ApexStar Holdings Sdn. Bhd.",
          equity_percentage: 50,
        },
        {
          party_type: "I",
          nic_brno: "950829083430",
          name: "Nur Aina Farisha Binti Salleh",
          equity_percentage: 5,
        },
      ],
    });
    const fromRegtank = extractRegulatoryPartiesFromCorporateEntities({
      directors: [],
      shareholders: [
        {
          personalInfo: {
            fullName: "Nur Aina Farisha Binti Salleh",
            governmentIdNumber: "950829083430",
            formContent: {
              content: [{ fieldName: "% of Shares", fieldValue: "6" }],
            },
          },
        },
      ],
      corporateShareholders: [
        {
          formContent: {
            displayAreas: [
              {
                displayArea: "Basic Information Setting",
                content: [
                  { fieldName: "Business Name", fieldValue: "ApexStar Holdings Sdn. Bhd." },
                  { fieldName: "Business Number", fieldValue: "7321984G" },
                  { fieldName: "% of Shares", fieldValue: "10" },
                ],
              },
            ],
          },
        },
      ],
    });
    const merged = mergeRegulatoryPartyCandidates(fromCtos, fromRegtank);
    expect(merged.find((p) => p.partyKey === "7321984G")?.shareholdingPercentage).toBe(10);
    expect(merged.find((p) => p.partyKey === "950829083430")?.shareholdingPercentage).toBe(6);
  });
});

describe("extractCtosObservationSnapshot", () => {
  it("keys observations by party key without 5% filtering", () => {
    const snapshot = extractCtosObservationSnapshot({
      shareholders: [
        { party_type: "I", nic_brno: "900101101111", name: "A", equity_percentage: 2 },
      ],
    });
    expect(snapshot.size).toBe(1);
    const row = [...snapshot.values()][0];
    expect(row?.name).toBe("A");
    expect(row?.shareholdingPercentage).toBe(2);
  });
});
