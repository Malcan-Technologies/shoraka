import {
  isNewContractFinancingStructure,
  isTerminalOriginatingApplicationStatus,
  pickEarliestOriginatingApplication,
} from "@cashsouk/types";

describe("contract originating application helpers", () => {
  it("detects new_contract financing structure", () => {
    expect(isNewContractFinancingStructure({ structure_type: "new_contract" })).toBe(true);
    expect(isNewContractFinancingStructure({ structure_type: "existing_contract" })).toBe(false);
  });

  it("treats APPROVED and COMPLETED as terminal origin statuses", () => {
    expect(isTerminalOriginatingApplicationStatus("APPROVED")).toBe(true);
    expect(isTerminalOriginatingApplicationStatus("COMPLETED")).toBe(true);
    expect(isTerminalOriginatingApplicationStatus("UNDER_REVIEW")).toBe(false);
  });

  it("picks earliest submitted new_contract origin candidate", () => {
    const picked = pickEarliestOriginatingApplication([
      {
        id: "later",
        submitted_at: new Date("2026-02-01"),
        updated_at: new Date("2026-02-02"),
      },
      {
        id: "earlier",
        submitted_at: new Date("2026-01-01"),
        updated_at: new Date("2026-01-02"),
      },
    ]);
    expect(picked?.id).toBe("earlier");
  });
});
