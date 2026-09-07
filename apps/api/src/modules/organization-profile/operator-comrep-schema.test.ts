import {
  operatorAdvisorSchema,
  operatorFinancialStatementSchema,
  operatorInterestSchema,
  operatorOfficerSchema,
  operatorShareCapitalPatchSchema,
  operatorShareholderSchema,
  parseOperatorBody,
} from "./schemas";

describe("operator ComRep schemas", () => {
  it("rejects Type of Shares Others without specify text", () => {
    const result = operatorShareholderSchema.safeParse({
      holderType: "SHAREHOLDER",
      entityType: "INDIVIDUAL",
      name: "Aisha",
      shareType: "OTHERS",
      shareTypeOther: "",
    });
    expect(result.success).toBe(false);
  });

  it("clears Type of Shares other text when the type is not Others", () => {
    const parsed = operatorShareholderSchema.parse({
      holderType: "SHAREHOLDER",
      entityType: "INDIVIDUAL",
      name: "Aisha",
      shareType: "ORDINARY",
      shareTypeOther: "leftover",
    });
    expect(parsed.shareTypeOther).toBeNull();
  });

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

  it("rejects share-capital payloads that still contain id", () => {
    const result = operatorShareCapitalPatchSchema.safeParse({
      id: "cap_1",
      ordinaryUnits: "50",
    });
    expect(result.success).toBe(false);
    expect(result.success ? "" : result.error.issues[0]?.message).toMatch(/Unrecognized key/i);
  });

  it("strips DTO id then accepts a share-capital save", () => {
    const parsed = parseOperatorBody(operatorShareCapitalPatchSchema, {
      id: "cap_1",
      ordinaryUnits: "50",
      ordinaryAmount: "50",
      totalPaidUpCapital: "50",
    });
    expect(parsed.ordinaryUnits).toBe("50");
    expect(parsed.totalPaidUpCapital).toBe("50");
  });

  it("rejects share counts with decimal points", () => {
    const result = operatorShareCapitalPatchSchema.safeParse({
      ordinaryUnits: "50.5",
    });
    expect(result.success).toBe(false);
  });

  it("strips id from shareholder update bodies without loosening unknown keys", () => {
    const parsed = parseOperatorBody(operatorShareholderSchema, {
      id: "sh_1",
      holderType: "SHAREHOLDER",
      entityType: "INDIVIDUAL",
      name: "Aisha",
    });
    expect(parsed.name).toBe("Aisha");
    const extra = operatorShareholderSchema.safeParse({
      holderType: "SHAREHOLDER",
      entityType: "INDIVIDUAL",
      name: "Aisha",
      unknownField: true,
    });
    expect(extra.success).toBe(false);
  });

  it("strips DTO id from officer, adviser, interest, and financial statement bodies", () => {
    expect(
      parseOperatorBody(operatorOfficerSchema, {
        id: "of_1",
        personKind: "BOARD",
        name: "Aisha",
        isResponsiblePerson: true,
      }).name
    ).toBe("Aisha");
    expect(
      parseOperatorBody(operatorAdvisorSchema, {
        id: "ad_1",
        advisorType: "AUDITOR",
        name: "Audit Co",
      }).name
    ).toBe("Audit Co");
    expect(
      parseOperatorBody(operatorInterestSchema, {
        id: "in_1",
        name: "HoldCo",
        shareType: "ORDINARY",
      }).name
    ).toBe("HoldCo");
    expect(
      parseOperatorBody(operatorFinancialStatementSchema, {
        id: "fs_1",
        totalRevenue: "1000",
        totalAssets: "1",
      }).totalRevenue
    ).toBe("1000");
  });

  it("still rejects unknown keys on officer, adviser, interest, and financial bodies", () => {
    expect(
      operatorOfficerSchema.safeParse({
        personKind: "BOARD",
        name: "Aisha",
        extra: true,
      }).success
    ).toBe(false);
    expect(
      operatorAdvisorSchema.safeParse({
        advisorType: "AUDITOR",
        name: "Audit Co",
        extra: true,
      }).success
    ).toBe(false);
    expect(
      operatorInterestSchema.safeParse({
        name: "HoldCo",
        extra: true,
      }).success
    ).toBe(false);
    expect(
      operatorFinancialStatementSchema.safeParse({
        totalRevenue: "1000",
        extra: true,
      }).success
    ).toBe(false);
  });
});
