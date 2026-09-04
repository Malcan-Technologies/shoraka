import { addMonths, startOfDay } from "date-fns";
import {
  DEFAULT_MAX_INVOICE_FINANCING_RATIO_PERCENT,
  DEFAULT_MIN_INVOICE_FINANCING_RATIO_PERCENT,
} from "./invoice-financing-ratio";
import {
  contractEndDateMeetsMinimumMonths,
  firstProductRuleMessage,
  maturityMeetsMinimumMonthsFrom,
  parseInvoiceMaturityDate,
  readContractProductRules,
  readInvoiceProductRules,
  readProductLimitViolationMessage,
  validateContractAgainstProductRules,
  validateInvoiceAgainstProductRules,
  type InvoiceProductRules,
} from "./product-workflow-rules";

function invoiceWorkflow(config: Record<string, unknown>) {
  return [{ id: "invoice_details", config }];
}

function defaultRules(overrides: Partial<InvoiceProductRules> = {}): InvoiceProductRules {
  return {
    minInvoiceFaceValue: null,
    maxInvoiceFaceValue: null,
    minFinancingAmount: null,
    maxFinancingAmount: null,
    subLimitPerInvoiceRm: null,
    ratio: {
      min: DEFAULT_MIN_INVOICE_FINANCING_RATIO_PERCENT,
      max: DEFAULT_MAX_INVOICE_FINANCING_RATIO_PERCENT,
    },
    minMonthsApplicationToMaturity: null,
    minMonthsReviewToMaturity: null,
    ...overrides,
  };
}

describe("readInvoiceProductRules", () => {
  it("reads numbers from the invoice_details step", () => {
    const rules = readInvoiceProductRules(
      invoiceWorkflow({
        min_invoice_face_value: 5000,
        max_invoice_face_value: 200000,
        min_invoice_value: 3000,
        max_invoice_value: 160000,
        sub_limit_per_invoice_rm: 75000,
        min_financing_ratio_percent: 50,
        max_financing_ratio_percent: 70,
        min_months_application_to_maturity: 2,
        min_months_review_to_maturity: 3,
      })
    );
    expect(rules).toEqual({
      minInvoiceFaceValue: 5000,
      maxInvoiceFaceValue: 200000,
      minFinancingAmount: 3000,
      maxFinancingAmount: 160000,
      subLimitPerInvoiceRm: 75000,
      ratio: { min: 50, max: 70 },
      minMonthsApplicationToMaturity: 2,
      minMonthsReviewToMaturity: 3,
    });
  });

  it("reads comma-formatted money strings and digit month strings", () => {
    const rules = readInvoiceProductRules(
      invoiceWorkflow({
        min_invoice_face_value: "1,000",
        max_invoice_face_value: "250,000.00",
        min_invoice_value: "800",
        max_invoice_value: "200,000",
        sub_limit_per_invoice_rm: "100,000",
        min_months_application_to_maturity: "4",
        min_months_review_to_maturity: "6",
      })
    );
    expect(rules.minInvoiceFaceValue).toBe(1000);
    expect(rules.maxInvoiceFaceValue).toBe(250000);
    expect(rules.minFinancingAmount).toBe(800);
    expect(rules.maxFinancingAmount).toBe(200000);
    expect(rules.subLimitPerInvoiceRm).toBe(100000);
    expect(rules.minMonthsApplicationToMaturity).toBe(4);
    expect(rules.minMonthsReviewToMaturity).toBe(6);
  });

  it("matches invoice_details by step id suffix, not by name", () => {
    const rules = readInvoiceProductRules([
      {
        id: "invoice_details_1",
        name: "Something else",
        config: { min_invoice_face_value: 2000 },
      },
    ]);
    expect(rules.minInvoiceFaceValue).toBe(2000);
  });

  it("returns nulls and default ratio bounds when the invoice step is missing", () => {
    expect(readInvoiceProductRules([])).toEqual(defaultRules());
    expect(readInvoiceProductRules([{ id: "contract_details", config: {} }])).toEqual(defaultRules());
    expect(readInvoiceProductRules(null)).toEqual(defaultRules());
  });

  it("clamps product max ratio to the platform 80 cap", () => {
    const rules = readInvoiceProductRules(
      invoiceWorkflow({
        min_financing_ratio_percent: 60,
        max_financing_ratio_percent: 90,
      })
    );
    expect(rules.ratio).toEqual({ min: 60, max: 80 });
  });

  it("treats non-positive or non-integer months as unset", () => {
    const rules = readInvoiceProductRules(
      invoiceWorkflow({
        min_months_application_to_maturity: 1.5,
        min_months_review_to_maturity: 0,
      })
    );
    expect(rules.minMonthsApplicationToMaturity).toBeNull();
    expect(rules.minMonthsReviewToMaturity).toBeNull();
  });
});

describe("validateInvoiceAgainstProductRules", () => {
  const validInput = { invoiceFace: 10000, financingAmount: 7000, ratioPercent: 70 };

  it("returns no violations when nothing is configured and input is within defaults", () => {
    expect(
      validateInvoiceAgainstProductRules(defaultRules(), validInput, {
        mode: "issuer_request",
        hasFacility: false,
      })
    ).toEqual([]);
  });

  it("emits each invoice and financing violation in both modes", () => {
    const rules = defaultRules({
      minInvoiceFaceValue: 5000,
      maxInvoiceFaceValue: 20000,
      minFinancingAmount: 4000,
      maxFinancingAmount: 15000,
      subLimitPerInvoiceRm: 8000,
      ratio: { min: 60, max: 80 },
    });
    const input = { invoiceFace: 1000, financingAmount: 20000, ratioPercent: 50 };

    const issuer = validateInvoiceAgainstProductRules(rules, input, {
      mode: "issuer_request",
      hasFacility: true,
    });
    expect(issuer.map((v) => v.code)).toEqual([
      "INVOICE_FACE_BELOW_MIN",
      "FINANCING_ABOVE_MAX",
      "FINANCING_ABOVE_SUB_LIMIT",
      "RATIO_BELOW_MIN",
    ]);
    expect(issuer[0].message).toBe("Invoice value must be at least RM 5,000.00.");
    expect(issuer[1].message).toBe("Financing amount cannot exceed RM 15,000.00.");
    expect(issuer[2].message).toBe(
      "Financing amount cannot exceed the facility sub-limit of RM 8,000.00 per invoice."
    );
    expect(issuer[3].message).toBe("Financing ratio must be at least 60%.");

    const admin = validateInvoiceAgainstProductRules(rules, input, {
      mode: "admin_offer",
      hasFacility: true,
    });
    expect(admin.map((v) => v.code)).toEqual(issuer.map((v) => v.code));
    expect(admin[0].message).toBe("Invoice value must be at least RM 5,000.00.");
    expect(admin[1].message).toBe("Offered financing cannot exceed RM 15,000.00.");
    expect(admin[2].message).toBe(
      "Offered financing cannot exceed the facility sub-limit of RM 8,000.00 per invoice."
    );
    expect(admin[3].message).toBe("Offered financing ratio must be at least 60%.");
  });

  it("emits face-above-max, financing-below-min, and ratio-above-max in both modes", () => {
    const rules = defaultRules({
      maxInvoiceFaceValue: 8000,
      minFinancingAmount: 5000,
      ratio: { min: 60, max: 70 },
    });
    const input = { invoiceFace: 10000, financingAmount: 1000, ratioPercent: 80 };

    const issuer = validateInvoiceAgainstProductRules(rules, input, {
      mode: "issuer_request",
      hasFacility: false,
    });
    expect(issuer.map((v) => v.code)).toEqual([
      "INVOICE_FACE_ABOVE_MAX",
      "FINANCING_BELOW_MIN",
      "RATIO_ABOVE_MAX",
    ]);
    expect(issuer[0].message).toBe("Invoice value cannot exceed RM 8,000.00.");
    expect(issuer[1].message).toBe("Financing amount must be at least RM 5,000.00.");
    expect(issuer[2].message).toBe("Financing ratio cannot exceed 70%.");

    const admin = validateInvoiceAgainstProductRules(rules, input, {
      mode: "admin_offer",
      hasFacility: false,
    });
    expect(admin[0].message).toBe("Invoice value cannot exceed RM 8,000.00.");
    expect(admin[1].message).toBe("Offered financing must be at least RM 5,000.00.");
    expect(admin[2].message).toBe("Offered financing ratio cannot exceed 70%.");
  });

  it("skips the sub-limit when hasFacility is false", () => {
    const rules = defaultRules({ subLimitPerInvoiceRm: 1000 });
    const violations = validateInvoiceAgainstProductRules(
      rules,
      { invoiceFace: 10000, financingAmount: 5000, ratioPercent: 70 },
      { mode: "issuer_request", hasFacility: false }
    );
    expect(violations).toEqual([]);
  });

  it("does not trip sen rounding on financing vs max", () => {
    const rules = defaultRules({ maxFinancingAmount: 1000 });
    expect(
      validateInvoiceAgainstProductRules(
        rules,
        { invoiceFace: 2000, financingAmount: 1000.004, ratioPercent: 70 },
        { mode: "issuer_request", hasFacility: false }
      )
    ).toEqual([]);
  });

  it("skips face and financing checks when amounts are not positive", () => {
    const rules = defaultRules({
      minInvoiceFaceValue: 1000,
      minFinancingAmount: 500,
    });
    expect(
      validateInvoiceAgainstProductRules(
        rules,
        { invoiceFace: 0, financingAmount: -1, ratioPercent: null },
        { mode: "issuer_request", hasFacility: true }
      )
    ).toEqual([]);
  });
});

describe("readContractProductRules", () => {
  it("reads min_contract_months from a number or digit string", () => {
    expect(
      readContractProductRules([{ id: "contract_details", config: { min_contract_months: 12 } }])
    ).toEqual({ minContractMonths: 12 });
    expect(
      readContractProductRules([{ id: "contract_details_2", config: { min_contract_months: "6" } }])
    ).toEqual({ minContractMonths: 6 });
  });

  it("accepts the legacy minContractMonths alias", () => {
    expect(
      readContractProductRules([{ id: "contract_details", config: { minContractMonths: 9 } }])
    ).toEqual({ minContractMonths: 9 });
  });

  it("returns null when the contract step is missing or the value is not a positive integer", () => {
    expect(readContractProductRules([])).toEqual({ minContractMonths: null });
    expect(
      readContractProductRules([{ id: "contract_details", config: { min_contract_months: 0 } }])
    ).toEqual({ minContractMonths: null });
    expect(
      readContractProductRules([{ id: "contract_details", config: { min_contract_months: "12.5" } }])
    ).toEqual({ minContractMonths: null });
  });
});

describe("contract duration rules", () => {
  const today = startOfDay(new Date("2026-03-01T00:00:00"));

  it("uses a future startDate as the base instead of referenceDate today", () => {
    const startDate = addMonths(today, 6);
    const endTooSoon = addMonths(startDate, 2);
    const endOk = addMonths(startDate, 3);
    expect(
      contractEndDateMeetsMinimumMonths({
        startDate,
        endDate: endTooSoon,
        minMonths: 3,
        referenceDate: today,
      })
    ).toBe(false);
    expect(
      contractEndDateMeetsMinimumMonths({
        startDate,
        endDate: endOk,
        minMonths: 3,
        referenceDate: today,
      })
    ).toBe(true);

    const violations = validateContractAgainstProductRules(
      { minContractMonths: 3 },
      { startDate, endDate: endTooSoon, referenceDate: today }
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].code).toBe("CONTRACT_DURATION_TOO_SHORT");
    expect(violations[0].field).toBe("end_date");
    expect(violations[0].limit).toBe(3);
    expect(violations[0].actual).toBe(2);
    expect(violations[0].message).toBe(
      "Facility end date must be at least 3 month(s) after the start date."
    );
  });

  it("uses referenceDate today when startDate is in the past", () => {
    const startDate = addMonths(today, -6);
    const endTooSoon = addMonths(today, 2);
    const violations = validateContractAgainstProductRules(
      { minContractMonths: 3 },
      { startDate, endDate: endTooSoon, referenceDate: today }
    );
    expect(violations[0]?.message).toBe(
      "Facility end date must be at least 3 month(s) after today."
    );
  });

  it("returns no violations when endDate is null or min months is unset", () => {
    expect(
      validateContractAgainstProductRules({ minContractMonths: 3 }, { startDate: today, endDate: null })
    ).toEqual([]);
    expect(
      validateContractAgainstProductRules(
        { minContractMonths: null },
        { startDate: today, endDate: addMonths(today, 1) }
      )
    ).toEqual([]);
  });
});

describe("moved invoice maturity helpers", () => {
  it("parses yyyy-MM-dd and full ISO, and rejects invalid values", () => {
    const parsed = parseInvoiceMaturityDate("2026-09-15");
    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8);
    expect(parsed?.getDate()).toBe(15);
    expect(parseInvoiceMaturityDate("2026-09-15T12:30:00.000Z")).not.toBeNull();
    expect(parseInvoiceMaturityDate("")).toBeNull();
    expect(parseInvoiceMaturityDate("not-a-date")).toBeNull();
    expect(parseInvoiceMaturityDate(null)).toBeNull();
  });

  it("treats the minimum-months boundary as inclusive", () => {
    const reference = startOfDay(new Date("2026-01-15T00:00:00"));
    const onBoundary = addMonths(reference, 3);
    const dayBefore = new Date(onBoundary);
    dayBefore.setDate(dayBefore.getDate() - 1);
    expect(maturityMeetsMinimumMonthsFrom(onBoundary, reference, 3)).toBe(true);
    expect(maturityMeetsMinimumMonthsFrom(dayBefore, reference, 3)).toBe(false);
    expect(maturityMeetsMinimumMonthsFrom(dayBefore, reference, null)).toBe(true);
    expect(maturityMeetsMinimumMonthsFrom(dayBefore, reference, 0)).toBe(true);
  });
});

describe("firstProductRuleMessage", () => {
  it("returns the first message or null", () => {
    expect(firstProductRuleMessage([])).toBeNull();
    expect(
      firstProductRuleMessage(
        validateInvoiceAgainstProductRules(
          defaultRules({ minInvoiceFaceValue: 2000 }),
          { invoiceFace: 500, financingAmount: 400, ratioPercent: null },
          { mode: "issuer_request", hasFacility: false }
        )
      )
    ).toBe("Invoice value must be at least RM 2,000.00.");
  });
});

describe("readProductLimitViolationMessage", () => {
  it("reads the message from an ApiError envelope or inner error", () => {
    expect(
      readProductLimitViolationMessage({
        success: false,
        error: { code: "PRODUCT_LIMIT_VIOLATION", message: "Invoice value cannot exceed RM 1.00." },
      })
    ).toBe("Invoice value cannot exceed RM 1.00.");
    expect(
      readProductLimitViolationMessage({ code: "PRODUCT_LIMIT_VIOLATION", message: "x" })
    ).toBe("x");
    expect(readProductLimitViolationMessage({ code: "OTHER", message: "x" })).toBeNull();
    expect(readProductLimitViolationMessage(null)).toBeNull();
  });
});
