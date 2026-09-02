import {
  extractCtosObservationSnapshot,
  extractRegulatoryPartiesFromCtos,
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
