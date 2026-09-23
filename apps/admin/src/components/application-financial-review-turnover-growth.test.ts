import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeTurnoverGrowth } from "@cashsouk/types";

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
    expect(source).toContain("Previous FY revenue unavailable");
  });

  it("removes CTOS/User Input/Admin Input source badges from the Year header", () => {
    const source = readFileSync(
      join(__dirname, "application-financial-review-content.tsx"),
      "utf8"
    );

    // Emerald CTOS badge styling should only appear in the Source row (not the Year header).
    const ctosBadgeCount = (source.match(/border-emerald-500\/40/g) ?? []).length;
    expect(ctosBadgeCount).toBe(1);
  });

  it("standardises year header labels to FY-prefixed years and provides year-level edit action", () => {
    const source = readFileSync(
      join(__dirname, "application-financial-review-content.tsx"),
      "utf8"
    );

    expect(source).toContain("`FY${spec.year}`");
    expect(source).toContain('title="Edit financial statement"');
    expect(source).toContain("AdminEditFinancialStatementDialog");
  });

  it("uses consistent FY header label styling and short action labels without overflow copying", () => {
    const source = readFileSync(
      join(__dirname, "application-financial-review-content.tsx"),
      "utf8"
    );

    // FY label styling is now consistent across year columns.
    expect(source).toContain('className="text-foreground text-[14px] font-normal leading-snug"');
    expect(source).not.toContain('spec.year != null ? "text-foreground" : "text-muted-foreground"');

    // Short, consistent action labels.
    expect(source).toContain("Edit statement");
    expect(source).toContain("Add statement");
    expect(source).not.toContain("Edit Financial Statement");
    expect(source).not.toContain("+ Add Financial Statement");

    // Date range still derived for unaudited FY columns.
    expect(source).toContain("adminFyPeriodLines");
    expect(source).toContain("periodLine");
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

  it("whole-year edit modal excludes calculated metrics from editable inputs", () => {
    const modal = readFileSync(
      join(__dirname, "../notes/prospectus-review/admin-edit-financial-statement-dialog.tsx"),
      "utf8"
    );

    expect(modal).toContain("admin-financial-statements/field");
    expect(modal).not.toContain("turnover_growth");
    expect(modal).not.toContain("receivablesDays");
    expect(modal).not.toContain("profit_margin");
  });

  it("whole-year edit modal disables editing when the application is locked", () => {
    const modal = readFileSync(
      join(__dirname, "../notes/prospectus-review/admin-edit-financial-statement-dialog.tsx"),
      "utf8"
    );

    // When locked, inputs and Save should be disabled.
    expect(modal).toContain("disabled={inputDisabled}");
    expect(modal).toContain("disabled={disabled || saving}");
  });

  it("computes FY2024 Turnover Growth from FY2023 revenue (20%)", () => {
    const g = computeTurnoverGrowth({
      targetYear: 2024,
      targetTurnover: 9_360_000,
      priorYear: 2023,
      priorTurnover: 7_800_000,
    });

    // Component displays g*100 as a percent.
    expect(g).toBeCloseTo(0.2, 8);
  });

  it("returns unavailable when prior FY revenue is missing", () => {
    const g = computeTurnoverGrowth({
      targetYear: 2026,
      targetTurnover: 10_000_000,
      priorYear: 2025,
      priorTurnover: null,
    });

    expect(g).toBeNull();
  });
});

