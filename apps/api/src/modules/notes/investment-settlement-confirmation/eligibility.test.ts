import { NoteInvestmentStatus } from "@prisma/client";
import { isMaterialTawidh, isPostedSettlementStatus, isSettledInvestmentStatus } from "./eligibility";

describe("investment settlement confirmation eligibility", () => {
  it("treats only POSTED as posted", () => {
    expect(isPostedSettlementStatus("POSTED")).toBe(true);
    expect(isPostedSettlementStatus("APPROVED")).toBe(false);
    expect(isPostedSettlementStatus("PREVIEW")).toBe(false);
  });

  it("requires SETTLED investments", () => {
    expect(isSettledInvestmentStatus(NoteInvestmentStatus.SETTLED)).toBe(true);
    expect(isSettledInvestmentStatus(NoteInvestmentStatus.CONFIRMED)).toBe(false);
  });

  it("hides Ta’widh at the same threshold as the investor breakdown card", () => {
    expect(isMaterialTawidh(0)).toBe(false);
    expect(isMaterialTawidh(0.005)).toBe(false);
    expect(isMaterialTawidh(0.006)).toBe(true);
    expect(isMaterialTawidh(12.5)).toBe(true);
  });
});
