import { addMonths, startOfDay } from "date-fns";
import { PRODUCT_LIMIT_VIOLATION_CODE } from "@cashsouk/types";
import { AppError } from "./http/error-handler";
import { assertContractMeetsProductRules, assertInvoiceMeetsProductRules } from "./product-rule-guard";

function invoiceWorkflow(config: Record<string, unknown>) {
  return [{ id: "invoice_details", config }];
}

function contractWorkflow(config: Record<string, unknown>) {
  return [{ id: "contract_details", config }];
}

const withinLimits = {
  value: 10_000,
  applied_financing: 7_000,
  financing_ratio_percent: 70,
};

describe("assertInvoiceMeetsProductRules", () => {
  it("is a no-op when the workflow has no invoice_details step", () => {
    expect(() =>
      assertInvoiceMeetsProductRules([], withinLimits, { mode: "issuer_request", hasFacility: true })
    ).not.toThrow();
    expect(() =>
      assertInvoiceMeetsProductRules(
        [{ id: "contract_details", config: { min_invoice_value: 1 } }],
        { value: 10, applied_financing: 1, financing_ratio_percent: 10 },
        { mode: "issuer_request", hasFacility: true }
      )
    ).not.toThrow();
  });

  it("applies only the default 60–80% ratio band when invoice_details has no amount limits", () => {
    expect(() =>
      assertInvoiceMeetsProductRules(
        invoiceWorkflow({}),
        { value: 10, applied_financing: 7, financing_ratio_percent: 70 },
        { mode: "issuer_request", hasFacility: false }
      )
    ).not.toThrow();
    expect(() =>
      assertInvoiceMeetsProductRules(
        invoiceWorkflow({}),
        { value: 10, applied_financing: 1, financing_ratio_percent: 10 },
        { mode: "issuer_request", hasFacility: false }
      )
    ).toThrow("Financing ratio must be at least 60%.");
  });

  it("rejects face, financing, and ratio violations for issuer_request", () => {
    try {
      assertInvoiceMeetsProductRules(
        invoiceWorkflow({
          min_invoice_face_value: 5000,
          max_invoice_value: 8000,
          min_financing_ratio_percent: 60,
          max_financing_ratio_percent: 70,
        }),
        { value: 1000, applied_financing: 9000, financing_ratio_percent: 50 },
        { mode: "issuer_request", hasFacility: false }
      );
      throw new Error("expected product limit violation");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect(err).toMatchObject({
        statusCode: 400,
        code: PRODUCT_LIMIT_VIOLATION_CODE,
        message: "Invoice value must be at least RM 5,000.00.",
        details: {
          rule: "INVOICE_FACE_BELOW_MIN",
          field: "invoice_value",
          limit: 5000,
          actual: 1000,
        },
      });
    }
  });

  it("reads financing_ratio_percent from a numeric string", () => {
    expect(() =>
      assertInvoiceMeetsProductRules(
        invoiceWorkflow({ min_financing_ratio_percent: 60, max_financing_ratio_percent: 70 }),
        { value: 10_000, applied_financing: 6_500, financing_ratio_percent: "65" },
        { mode: "issuer_request", hasFacility: false }
      )
    ).not.toThrow();
    expect(() =>
      assertInvoiceMeetsProductRules(
        invoiceWorkflow({ max_financing_ratio_percent: 70 }),
        { value: 10_000, applied_financing: 7_500, financing_ratio_percent: "75" },
        { mode: "issuer_request", hasFacility: false }
      )
    ).toThrow(/cannot exceed 70%/);
  });

  it("does not trip sen rounding on financing vs max", () => {
    expect(() =>
      assertInvoiceMeetsProductRules(
        invoiceWorkflow({ max_invoice_value: 1000 }),
        { value: 2000, applied_financing: 1000.004, financing_ratio_percent: 70 },
        { mode: "issuer_request", hasFacility: false }
      )
    ).not.toThrow();
  });

  it("applies admin_offer financing and derived ratio", () => {
    expect(() =>
      assertInvoiceMeetsProductRules(
        invoiceWorkflow({
          min_invoice_value: 5000,
          max_financing_ratio_percent: 70,
        }),
        { value: 10_000, applied_financing: 8_000, financing_ratio_percent: 80 },
        { mode: "admin_offer", hasFacility: false, offeredAmount: 6_500 }
      )
    ).not.toThrow();
    try {
      assertInvoiceMeetsProductRules(
        invoiceWorkflow({ min_invoice_value: 5000 }),
        { value: 10_000 },
        { mode: "admin_offer", hasFacility: false, offeredAmount: 4000 }
      );
      throw new Error("expected product limit violation");
    } catch (err) {
      expect(err).toMatchObject({
        code: PRODUCT_LIMIT_VIOLATION_CODE,
        message: "Offered financing must be at least RM 5,000.00.",
      });
    }
    expect(() =>
      assertInvoiceMeetsProductRules(
        invoiceWorkflow({ max_financing_ratio_percent: 70 }),
        { value: 10_000 },
        { mode: "admin_offer", hasFacility: false, offeredAmount: 7500 }
      )
    ).toThrow(/Offered financing ratio cannot exceed 70%/);
  });

  it("uses offeredRatioPercent when provided for admin_offer", () => {
    expect(() =>
      assertInvoiceMeetsProductRules(
        invoiceWorkflow({ max_financing_ratio_percent: 70 }),
        { value: 10_000 },
        {
          mode: "admin_offer",
          hasFacility: false,
          offeredAmount: 6500,
          offeredRatioPercent: 75,
        }
      )
    ).toThrow(/Offered financing ratio cannot exceed 70%/);
  });

  it("enforces sub-limit only when hasFacility is true", () => {
    const workflow = invoiceWorkflow({ sub_limit_per_invoice_rm: 4000 });
    const details = { value: 10_000, applied_financing: 6000, financing_ratio_percent: 60 };
    expect(() =>
      assertInvoiceMeetsProductRules(workflow, details, { mode: "issuer_request", hasFacility: false })
    ).not.toThrow();
    expect(() =>
      assertInvoiceMeetsProductRules(workflow, details, { mode: "issuer_request", hasFacility: true })
    ).toThrow(/sub-limit/);
  });
});

describe("assertContractMeetsProductRules", () => {
  const start = "2026-01-01";

  it("is a no-op when min_contract_months is unset", () => {
    expect(() =>
      assertContractMeetsProductRules(contractWorkflow({}), {
        start_date: start,
        end_date: "2026-02-01",
      })
    ).not.toThrow();
    expect(() =>
      assertContractMeetsProductRules([], { start_date: start, end_date: "2026-02-01" })
    ).not.toThrow();
  });

  it("rejects end on or before start", () => {
    expect(() =>
      assertContractMeetsProductRules(contractWorkflow({ min_contract_months: 3 }), {
        start_date: start,
        end_date: start,
      })
    ).toThrow(AppError);
    try {
      assertContractMeetsProductRules(contractWorkflow({ min_contract_months: 3 }), {
        start_date: "01/06/2026",
        end_date: "31/05/2026",
      });
    } catch (err) {
      expect(err).toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Facility end date must be after the start date.",
      });
    }
  });

  it("parses ISO and d/M/yyyy dates", () => {
    expect(() =>
      assertContractMeetsProductRules(contractWorkflow({ min_contract_months: 3 }), {
        start_date: "2026-01-01",
        end_date: "2026-04-01",
      })
    ).not.toThrow();
    expect(() =>
      assertContractMeetsProductRules(contractWorkflow({ min_contract_months: 3 }), {
        start_date: "1/1/2026",
        end_date: "1/4/2026",
      })
    ).not.toThrow();
  });

  it("uses startDate as the base when referenceDate is omitted", () => {
    expect(() =>
      assertContractMeetsProductRules(contractWorkflow({ min_contract_months: 6 }), {
        start_date: "2026-01-01",
        end_date: "2026-07-01",
      })
    ).not.toThrow();
    expect(() =>
      assertContractMeetsProductRules(contractWorkflow({ min_contract_months: 6 }), {
        start_date: "2026-01-01",
        end_date: "2026-06-01",
      })
    ).toThrow(/after the start date/);
  });

  it("uses max(referenceDate, startDate) when referenceDate is given", () => {
    const today = startOfDay(new Date("2026-03-01T00:00:00"));
    const futureStart = addMonths(today, 6);
    const startIso = futureStart.toISOString().slice(0, 10);
    const endTooSoon = addMonths(futureStart, 2).toISOString().slice(0, 10);
    const endOk = addMonths(futureStart, 3).toISOString().slice(0, 10);
    expect(() =>
      assertContractMeetsProductRules(
        contractWorkflow({ min_contract_months: 3 }),
        { start_date: startIso, end_date: endTooSoon },
        { referenceDate: today }
      )
    ).toThrow(/after the start date/);
    expect(() =>
      assertContractMeetsProductRules(
        contractWorkflow({ min_contract_months: 3 }),
        { start_date: startIso, end_date: endOk },
        { referenceDate: today }
      )
    ).not.toThrow();

    const pastStart = "2025-01-01";
    const endFromTodayTooSoon = addMonths(today, 2).toISOString().slice(0, 10);
    expect(() =>
      assertContractMeetsProductRules(
        contractWorkflow({ min_contract_months: 3 }),
        { start_date: pastStart, end_date: endFromTodayTooSoon },
        { referenceDate: today }
      )
    ).toThrow(/after today/);
  });
});
