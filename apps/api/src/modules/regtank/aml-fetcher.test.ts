import { mergeRoleLabels } from "./aml-fetcher";

describe("mergeRoleLabels (AMLFetcher director/shareholder role merge)", () => {
  it("merges Director with Shareholder (60%) once", () => {
    expect(mergeRoleLabels("Director", "Shareholder (60%)")).toBe("Director, Shareholder (60%)");
  });

  it("does not duplicate Shareholder (60%) when already present", () => {
    expect(mergeRoleLabels("Director, Shareholder (60%)", "Shareholder (60%)")).toBe(
      "Director, Shareholder (60%)"
    );
  });

  it("is idempotent across repeated refresh merges", () => {
    let role = "Director";
    role = mergeRoleLabels(role, "Shareholder (60%)");
    role = mergeRoleLabels(role, "Shareholder (60%)");
    role = mergeRoleLabels(role, "Shareholder (60%)");
    expect(role).toBe("Director, Shareholder (60%)");
  });

  it("preserves different legitimate labels", () => {
    expect(mergeRoleLabels("Director", "Shareholder (10%)")).toBe("Director, Shareholder (10%)");
    expect(mergeRoleLabels("Director, Shareholder (10%)", "Shareholder (60%)")).toBe(
      "Director, Shareholder (10%), Shareholder (60%)"
    );
  });

  it("ignores empty or undefined role values without adding commas", () => {
    expect(mergeRoleLabels("Director", "")).toBe("Director");
    expect(mergeRoleLabels("Director", undefined)).toBe("Director");
    expect(mergeRoleLabels("", "Shareholder (60%)")).toBe("Shareholder (60%)");
    expect(mergeRoleLabels(null, null)).toBe("");
    expect(mergeRoleLabels("Director, ", " , Shareholder (60%)")).toBe(
      "Director, Shareholder (60%)"
    );
  });

  it("only affects the role string — merge input objects keep KYC/AML fields unchanged", () => {
    const existing = {
      eodRequestId: "EOD04651",
      name: "Lucas Yi Jin",
      email: "lucas@example.com",
      role: "Director, Shareholder (60%)",
      kycStatus: "APPROVED",
      kycId: "KYC00073",
      governmentIdNumber: "900101101111",
      lastUpdated: "2026-07-14T00:00:00.000Z",
    };
    const nextRole = mergeRoleLabels(existing.role, "Shareholder (60%)");
    const merged = { ...existing, role: nextRole };

    expect(merged.role).toBe("Director, Shareholder (60%)");
    expect(merged.kycStatus).toBe("APPROVED");
    expect(merged.kycId).toBe("KYC00073");
    expect(merged.governmentIdNumber).toBe("900101101111");
    expect(merged.eodRequestId).toBe("EOD04651");
    expect(merged.lastUpdated).toBe(existing.lastUpdated);
  });
});
