import { mapExcessLateChargesDto, resolveExcessLateChargeOutstanding } from "./excess-late-charges";

describe("excess late charges DTO", () => {
  it("computes outstanding as max(0, owed - paid)", () => {
    expect(resolveExcessLateChargeOutstanding(100, 40)).toBe(60);
    expect(resolveExcessLateChargeOutstanding(40, 100)).toBe(0);
  });

  it("only maps posted settlements with a positive frozen total", () => {
    expect(
      mapExcessLateChargesDto({
        status: "APPROVED",
        excessLateChargeAmount: 80,
        excessLateChargePaidAmount: 0,
        noteReference: "NOTE-1",
      })
    ).toBeNull();
    expect(
      mapExcessLateChargesDto({
        status: "POSTED",
        excessLateChargeAmount: 0,
        excessLateChargePaidAmount: 0,
        noteReference: "NOTE-1",
      })
    ).toBeNull();
    expect(
      mapExcessLateChargesDto({
        status: "POSTED",
        excessLateChargeAmount: 80,
        excessLateChargePaidAmount: 20,
        noteReference: "NOTE-1",
      })
    ).toEqual({
      owed: 80,
      paid: 20,
      outstanding: 60,
      noteReference: "NOTE-1",
    });
  });
});
