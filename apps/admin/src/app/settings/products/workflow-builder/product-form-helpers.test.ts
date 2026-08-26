import * as fs from "fs";
import * as path from "path";

describe("product form financing ratio cap", () => {
  const helpers = fs.readFileSync(path.join(__dirname, "product-form-helpers.ts"), "utf8");
  const configUi = fs.readFileSync(
    path.join(__dirname, "step-configs/invoice-details-config.tsx"),
    "utf8"
  );

  it("rejects product max above 80 and defaults blank max to 80", () => {
    expect(helpers).toContain("MAX_INVOICE_FINANCING_RATIO_PERCENT");
    expect(helpers).toContain("DEFAULT_MAX_INVOICE_FINANCING_RATIO_PERCENT");
    expect(helpers).toContain("maximum financing ratio cannot exceed ${MAX_INVOICE_FINANCING_RATIO_PERCENT}");
    expect(helpers).not.toContain("cannot exceed 100");
    expect(configUi).toContain("max={MAX_INVOICE_FINANCING_RATIO_PERCENT}");
    expect(configUi).toContain("Maximum {MAX_INVOICE_FINANCING_RATIO_PERCENT}%");
  });
});
