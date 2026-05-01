import { mergeCtosDirectorsForVerification } from "@cashsouk/types";

describe("mergeCtosDirectorsForVerification", () => {
  it("dedupes two CTOS rows with the same nic_brno into one", () => {
    const merged = mergeCtosDirectorsForVerification([
      {
        name: "HARI",
        ic_lcno: null,
        nic_brno: "630615075495",
        brn_ssm: null,
        position: "DO",
        party_type: "I",
        equity_percentage: 0,
        equity: 0,
        remark: null,
      },
      {
        name: "HARI",
        ic_lcno: null,
        nic_brno: "630615075495",
        brn_ssm: null,
        position: "DO",
        party_type: "I",
        equity_percentage: 0,
        equity: 0,
        remark: "Da team",
      },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].nic_brno).toBe("630615075495");
    expect(merged[0].position?.toUpperCase()).toBe("DO");
    expect(merged[0].remark).toBe("Da team");
  });

  it("merges DO + SO on same person into DS with max equity", () => {
    const merged = mergeCtosDirectorsForVerification([
      {
        name: "PERSON A",
        ic_lcno: null,
        nic_brno: "123",
        brn_ssm: null,
        position: "DO",
        party_type: "I",
        equity_percentage: 10,
        equity: 0,
      },
      {
        name: "PERSON A",
        ic_lcno: null,
        nic_brno: "123",
        brn_ssm: null,
        position: "SO",
        party_type: "I",
        equity_percentage: 40,
        equity: 0,
      },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].position?.toUpperCase()).toBe("DS");
    expect(merged[0].equity_percentage).toBe(40);
  });

  it("dedupes two corporate CTOS rows with the same nic_brno into one", () => {
    const merged = mergeCtosDirectorsForVerification([
      {
        name: "FOO BHD",
        ic_lcno: null,
        nic_brno: "130586H",
        brn_ssm: "999",
        party_type: "C",
        position: "SO",
        equity_percentage: 5,
        equity: 0,
      },
      {
        name: "FOO BHD",
        ic_lcno: null,
        nic_brno: "130586H",
        brn_ssm: "888",
        party_type: "C",
        position: "SO",
        equity_percentage: 10,
        equity: 0,
        remark: "merged",
      },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].nic_brno).toBe("130586H");
    expect(merged[0].equity_percentage).toBe(10);
    expect(merged[0].remark).toBe("merged");
  });

  it("dedupes two corporate CTOS rows without nic_brno but same ic_lcno into one", () => {
    const merged = mergeCtosDirectorsForVerification([
      {
        name: "BAR SDN BHD",
        ic_lcno: "198401018032",
        nic_brno: null,
        brn_ssm: "X1",
        party_type: "C",
        position: "SO",
        equity_percentage: 3,
        equity: 0,
      },
      {
        name: "BAR SDN BHD",
        ic_lcno: "198401018032",
        nic_brno: "",
        brn_ssm: "X2",
        party_type: "C",
        position: "SO",
        equity_percentage: 7,
        equity: 0,
      },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].ic_lcno).toBe("198401018032");
    expect(merged[0].equity_percentage).toBe(7);
  });

  it("excludes rows with missing party_type from verification merge", () => {
    const merged = mergeCtosDirectorsForVerification([
      {
        name: "A",
        ic_lcno: "900101011234",
        nic_brno: null,
        brn_ssm: null,
        party_type: null,
        position: "DO",
        equity_percentage: 0,
        equity: 0,
      },
      {
        name: "A",
        ic_lcno: "900101011234",
        nic_brno: null,
        brn_ssm: null,
        party_type: null,
        position: "DO",
        equity_percentage: 0,
        equity: 0,
      },
    ]);
    expect(merged).toHaveLength(0);
  });

  it("excludes rows with invalid party_type from verification merge", () => {
    const merged = mergeCtosDirectorsForVerification([
      {
        name: "X",
        ic_lcno: "111",
        nic_brno: null,
        brn_ssm: null,
        party_type: "X",
        position: "DO",
        equity_percentage: 0,
        equity: 0,
      },
      {
        name: "X",
        ic_lcno: "111",
        nic_brno: null,
        brn_ssm: null,
        party_type: "X",
        position: "DO",
        equity_percentage: 0,
        equity: 0,
      },
    ]);
    expect(merged).toHaveLength(0);
  });

  it("merges duplicate corporate SC rows without synthetic shareholder position", () => {
    const merged = mergeCtosDirectorsForVerification([
      {
        name: "FOO BHD",
        ic_lcno: null,
        nic_brno: "130586H",
        brn_ssm: null,
        party_type: "C",
        position: "SC",
        equity_percentage: 10,
        equity: 0,
      },
      {
        name: "FOO BHD",
        ic_lcno: null,
        nic_brno: "130586H",
        brn_ssm: null,
        party_type: "C",
        position: "SC",
        equity_percentage: 5,
        equity: 0,
      },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].position?.toUpperCase()).toBe("SC");
    expect(merged[0].equity_percentage).toBe(10);
  });
});
