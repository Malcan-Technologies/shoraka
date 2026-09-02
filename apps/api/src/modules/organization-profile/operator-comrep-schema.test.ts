import { operatorFinancialStatementSchema, operatorShareholderSchema } from "./schemas";

describe("operator ComRep schemas", () => {
  it("rejects Beneficial Owner as a corporate entity", () => {
    const result = operatorShareholderSchema.safeParse({
      holderType: "BENEFICIAL_OWNER",
      entityType: "CORPORATE",
      name: "HoldCo",
    });
    expect(result.success).toBe(false);
  });

  it("accepts Shareholder, Member, and Beneficial Owner combinations", () => {
    expect(
      operatorShareholderSchema.safeParse({
        holderType: "MEMBER",
        entityType: "INDIVIDUAL",
        name: "Ahmad",
      }).success
    ).toBe(true);
    expect(
      operatorShareholderSchema.safeParse({
        holderType: "SHAREHOLDER",
        entityType: "CORPORATE",
        name: "HoldCo Sdn Bhd",
      }).success
    ).toBe(true);
    expect(
      operatorShareholderSchema.safeParse({
        holderType: "BENEFICIAL_OWNER",
        entityType: "INDIVIDUAL",
        name: "Ali",
      }).success
    ).toBe(true);
  });

  it("stores Total Revenue and Total Cost as explicit fields", () => {
    const parsed = operatorFinancialStatementSchema.parse({
      totalRevenue: "1000",
      revenueLending: "800",
      revenueFees: "200",
      totalCost: "400",
      costStaff: "250",
      costSystem: "150",
    });
    expect(parsed.totalRevenue).toBe("1000");
    expect(parsed.totalCost).toBe("400");
  });
});
