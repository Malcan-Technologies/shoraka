import * as fs from "fs";
import * as path from "path";

describe("issuer invoice details capacity copy", () => {
  const source = fs.readFileSync(path.join(__dirname, "invoice-details-step.tsx"), "utf8");

  it("persists financing_tenure_days on create and update payloads", () => {
    expect(source).toContain("financing_tenure_days: inv.financing_tenure_days");
    expect(source).toContain("validateFinancingTenureAgainstDueDate");
    expect(source).toContain("tenureResult.message");
    expect(source).toContain("hasInvoiceFormRowChanged");
  });

  it("rejects past invoice due dates via the shared tenure helper, not only min-month config", () => {
    expect(source).toContain("validateFinancingTenureAgainstDueDate");
    expect(source).toContain("Invoice ${inv.number}: ${tenureResult.message}");
    expect(source).toContain("Maturity date cannot be in the past.");
    const constraintFn = source.slice(source.indexOf("const validateInvoiceConstraints"));
    expect(constraintFn).toContain("validateFinancingTenureAgainstDueDate");
    expect(constraintFn).toContain("tenureResult.message");
  });

  it("clamps issuer slider and validation max to the shared 80% cap", () => {
    expect(source).toContain("resolveInvoiceFinancingRatioBounds");
    expect(source).not.toContain("maxRatio <= 100");
    expect(source).not.toContain("max_financing_ratio_percent ?? 80");
  });

  it("enables Save and Continue from required fields, not constraint validationError", () => {
    expect(source).toContain("isInvoiceStepContinueReady");
    expect(source).toContain("const isValid = shouldRunValidation ? fieldsReady : !requiresFacilityFeePayment");
    expect(source).not.toContain("!hasPartialRows && !validationError && !requiresFacilityFeePayment");
  });

  it("uses draft saveable warnings and reserved hard errors on the dual-limit preview", () => {
    expect(source).toContain('dualLimitOverageCopy(dualLimitPreview, "draft")');
    expect(source).toContain('dualLimitOverageCopy(dualLimitPreview, "reserved")');
    expect(source).toContain("ExistingFacilityLimitPreview");
    expect(source).toContain("warning={draftOverageCopy}");
    expect(source).toContain("hardError={");
    expect(source).toContain("capacityServerError ?? reservedOverageCopy");
    expect(source).toContain("mapCapacityApiError");
    expect(source).toContain("FACILITY_FEE_DRAWDOWN_BLOCKED_MESSAGE");
    expect(source).toContain("FacilityFeeDrawdownBlockedNotice");
  });
});
