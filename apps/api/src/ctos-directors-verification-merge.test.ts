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
});
