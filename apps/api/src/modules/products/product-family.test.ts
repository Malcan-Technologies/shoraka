import {
  auditProductFamilies,
  applyProductCodeBackfill,
  checkProductCodeReadiness,
  effectiveFamilyId,
  parseProductCodeMappingInput,
  planProductCodeBackfill,
} from "./product-family";

const mockDb: any = {
  product: {
    findMany: jest.fn(),
  },
  displayReferenceAllocation: {
    findMany: jest.fn(),
    groupBy: jest.fn(),
    findFirst: jest.fn(),
  },
  application: {
    groupBy: jest.fn(),
  },
  productUpdateMany: jest.fn(),
};

mockDb.product.updateMany = jest.fn();

describe("product-family utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.product.findMany.mockResolvedValue([
      {
        id: "fam_a_v1",
        base_id: "fam_a",
        version: 1,
        status: "INACTIVE",
        workflow: [{ config: { name: "Accounts Receivable Financing" } }],
        product_code: "ARF",
      },
      {
        id: "fam_a_v2",
        base_id: "fam_a",
        version: 2,
        status: "ACTIVE",
        workflow: [{ config: { name: "Receivables Financing" } }],
        product_code: "ARF",
      },
      {
        id: "fam_b_v1",
        base_id: "fam_b",
        version: 1,
        status: "ACTIVE",
        workflow: [{ config: { name: "Unmapped Product" } }],
        product_code: null,
      },
    ]);
    mockDb.displayReferenceAllocation.groupBy.mockResolvedValue([
      { product_code: "ARF", _count: { _all: 2 } },
    ]);
    mockDb.application.groupBy.mockResolvedValue([]);
    mockDb.product.updateMany.mockResolvedValue({ count: 2 });
  });

  it("resolves effectiveFamilyId as base_id ?? id", () => {
    expect(effectiveFamilyId({ id: "x", base_id: "fam" })).toBe("fam");
    expect(effectiveFamilyId({ id: "x", base_id: null })).toBe("x");
  });

  it("audits families with code and allocation metadata", async () => {
    const families = await auditProductFamilies(mockDb);
    const arfFamily = families.find((family) => family.familyId === "fam_a");
    const unmapped = families.find((family) => family.familyId === "fam_b");

    expect(arfFamily?.productCode).toBe("ARF");
    expect(arfFamily?.referencesAllocated).toBe(true);
    expect(arfFamily?.allocationCount).toBe(2);
    expect(unmapped?.codeMissing).toBe(true);
    expect(unmapped?.referencesAllocated).toBe(false);
  });

  it("parses explicit mapping input without guessing", () => {
    const mapping = parseProductCodeMappingInput(`
      # comment
      fam_b=RCF
      fam_c:INV
    `);
    expect(mapping.get("fam_b")).toBe("RCF");
    expect(mapping.get("fam_c")).toBe("INV");
  });

  it("reports unmapped families and refuses locked code changes in dry-run plan", async () => {
    const mapping = new Map([
      ["fam_a", "RCF"],
      ["fam_b", "RCF"],
    ]);
    const plan = await planProductCodeBackfill(mockDb, mapping);

    const locked = plan.rows.find((row) => row.familyId === "fam_a");
    const unmapped = plan.unmappedFamilies.find((family) => family.familyId === "fam_b");

    expect(locked?.action).toBe("skip");
    expect(locked?.reason).toContain("locked");
    expect(unmapped).toBeUndefined();
    expect(plan.rows.find((row) => row.familyId === "fam_b")?.action).toBe("apply");
  });

  it("detects missing active product code in readiness report", async () => {
    const report = await checkProductCodeReadiness(mockDb);
    const blocked = report.families.find((family) => family.familyId === "fam_b");
    const ready = report.families.find((family) => family.familyId === "fam_a");

    expect(report.ready).toBe(false);
    expect(blocked?.ready).toBe(false);
    expect(blocked?.blockers).toContain("PRODUCT_CODE_MISSING");
    expect(ready?.ready).toBe(true);
  });

  it("applies family code updates transactionally per family", async () => {
    mockDb.displayReferenceAllocation.groupBy.mockResolvedValue([]);
    const mapping = new Map([["fam_b", "RCF"]]);
    const result = await applyProductCodeBackfill(mockDb, mapping, false);

    expect(result.applied).toBe(1);
    expect(mockDb.product.updateMany).toHaveBeenCalledWith({
      where: { OR: [{ id: "fam_b" }, { base_id: "fam_b" }] },
      data: { product_code: "RCF" },
    });
  });
});
