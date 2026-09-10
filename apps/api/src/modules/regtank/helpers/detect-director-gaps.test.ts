import {
  extractCtosIndividuals,
  extractCtosRelatedParties,
  ctosCompanyJsonHasUsableRelatedParties,
} from "./detect-director-gaps";

describe("extractCtosRelatedParties", () => {
  const companyJson = {
    directors: [
      { party_type: "I", nic_brno: "800101011234", name: "Jamie", position: "DO" },
      {
        party_type: "I",
        nic_brno: "850101011111",
        name: "Ali",
        position: "SO",
        equity_percentage: 25,
      },
      {
        party_type: "I",
        nic_brno: "810101011111",
        name: "Small",
        position: "SO",
        equity_percentage: 2,
      },
      {
        party_type: "C",
        ic_lcno: "18335Z",
        brn_ssm: "200501525124",
        name: "ABC Berhad",
        position: "SO",
        equity_percentage: 30,
      },
      {
        party_type: "C",
        ic_lcno: "199901000001",
        name: "Tiny Co",
        position: "SO",
        equity_percentage: 4,
      },
      {
        party_type: "I",
        nic_brno: "820101011111",
        name: "Both",
        position: "DS",
        equity_percentage: 12,
      },
    ],
  };

  it("aliases extractCtosIndividuals onto directors[] including corporate shareholders", () => {
    expect(extractCtosRelatedParties).toBe(extractCtosIndividuals);
    const people = extractCtosRelatedParties(companyJson);
    expect(people.find((p) => p.name === "Jamie")?.type).toBe("DIRECTOR");
    expect(people.find((p) => p.name === "Ali")?.entityType).toBe("INDIVIDUAL");
    expect(people.find((p) => p.name === "Small")).toBeUndefined();
    const abc = people.find((p) => p.name === "ABC Berhad");
    expect(abc?.entityType).toBe("CORPORATE");
    expect(abc?.matchKey).toBe("18335Z");
    expect(people.find((p) => p.name === "Tiny Co")).toBeUndefined();
    const both = people.filter((p) => p.name === "Both");
    expect(both.map((p) => p.type).sort()).toEqual(["DIRECTOR", "SHAREHOLDER"]);
  });

  it("treats empty directors as unusable", () => {
    expect(ctosCompanyJsonHasUsableRelatedParties({ directors: [] })).toBe(false);
    expect(ctosCompanyJsonHasUsableRelatedParties(companyJson)).toBe(true);
  });

  it("reads a corporate shareholder that only has brn_ssm", () => {
    const people = extractCtosRelatedParties({
      directors: [
        {
          party_type: "C",
          ic_lcno: "",
          nic_brno: "",
          brn_ssm: "13570K",
          name: "ECM Libra",
          position: "SO",
          equity_percentage: 40,
        },
      ],
    });
    expect(people).toHaveLength(1);
    expect(people[0]?.entityType).toBe("CORPORATE");
    expect(people[0]?.matchKey).toBe("13570K");
  });
});
