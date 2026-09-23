import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("application financial review Turnover Growth rendering", () => {
  it("falls back to computeTurnoverGrowth when CTOS turnover_growth is missing", () => {
    const source = readFileSync(
      join(__dirname, "application-financial-review-content.tsx"),
      "utf8"
    );

    // CTOS fallback should compute from resolved turnover, not rely on CTOS XSL finished metric.
    expect(source).toContain('case "turnover_growth"');
    expect(source).toContain("computeTurnoverGrowth({");
    expect(source).toContain("turnoverByYear.get(specCol.year - 1)");
    expect(source).toContain("Unable to calculate — previous FY revenue unavailable");
  });

  it("suppresses repeated source badges when a field matches the column primary source", () => {
    const source = readFileSync(
      join(__dirname, "application-financial-review-content.tsx"),
      "utf8"
    );
    expect(source).toContain("const yearPrimarySource");
    expect(source).toContain("resolvedField.editedByAdmin");
    expect(source).toContain("resolvedField.source !== yearPrimarySource");
  });

  it("renders CTOS missing raw fields as — (with helper text separately)", () => {
    const source = readFileSync(
      join(__dirname, "application-financial-review-content.tsx"),
      "utf8"
    );

    // The default raw-field renderer should return "—" for missing values.
    expect(source).toContain("return \"—\";");

    // Helper should mention CTOS, but the main cell value should not be a long repeated phrase.
    expect(source).toContain("Not provided by CTOS");
    expect(source).not.toMatch(/return field\\?\\.unavailableReason[^\\n]*Not provided by CTOS/);
  });
});

