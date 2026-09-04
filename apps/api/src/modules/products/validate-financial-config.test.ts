import { addMonths, startOfDay } from "date-fns";
import { AppError } from "../../lib/http/error-handler";
import {
  assertMaturityForApplication,
  assertMaturityForSendInvoiceOffer,
  validateFinancialConfig,
  validateWorkflowFinancialConfig,
} from "./validate-financial-config";

function invoiceWorkflow(config: Record<string, unknown>) {
  return [{ id: "invoice_details", config }];
}

describe("validateWorkflowFinancialConfig financing ratio cap", () => {
  it("accepts 80 and a lower product max of 70", () => {
    expect(() =>
      validateWorkflowFinancialConfig(invoiceWorkflow({ max_financing_ratio_percent: 80 }))
    ).not.toThrow();
    expect(() =>
      validateWorkflowFinancialConfig(
        invoiceWorkflow({ min_financing_ratio_percent: 60, max_financing_ratio_percent: 70 })
      )
    ).not.toThrow();
  });

  it("rejects product max above 80", () => {
    for (const max of [80.01, 81, 100]) {
      expect(() =>
        validateWorkflowFinancialConfig(invoiceWorkflow({ max_financing_ratio_percent: max }))
      ).toThrow(AppError);
      try {
        validateWorkflowFinancialConfig(invoiceWorkflow({ max_financing_ratio_percent: max }));
      } catch (err) {
        expect(err).toMatchObject({
          statusCode: 400,
          code: "VALIDATION_ERROR",
          message: "Invalid financing ratio configuration",
        });
      }
    }
  });
});

describe("validateFinancialConfig invoice sub-limit", () => {
  function loWorkflow(invoiceConfig: Record<string, unknown>) {
    return [
      {
        id: "financing_type",
        config: {
          acceptance_documents: [
            { name: "Letter of Offer", generated_document_type: "arf_contract_facility_lo" },
          ],
          acceptance_deadline: { days: 7, reminders: [{ days_before_expiry: 1 }] },
          signing_deadline: { days: 14, reminders: [{ days_before_expiry: 3 }] },
        },
      },
      { id: "financing_structure", config: {} },
      { id: "contract_details", config: {} },
      { id: "invoice_details", config: invoiceConfig },
    ];
  }

  it("requires a positive sub-limit when the workflow declares the ARF facility LO", () => {
    expect(() => validateFinancialConfig({ workflow: loWorkflow({}) })).toThrow(
      /sub-limit per invoice/
    );
    expect(() =>
      validateFinancialConfig({ workflow: loWorkflow({ sub_limit_per_invoice_rm: 1000000 }) })
    ).not.toThrow();
  });

  it("rejects a non-positive sub-limit even without an LO row", () => {
    expect(() =>
      validateWorkflowFinancialConfig(invoiceWorkflow({ sub_limit_per_invoice_rm: 0 }))
    ).toThrow(/sub-limit/);
  });
});

describe("validateWorkflowFinancialConfig invoice and financing limits", () => {
  it("accepts positive face-value and financing pairs", () => {
    expect(() =>
      validateWorkflowFinancialConfig(
        invoiceWorkflow({
          min_invoice_face_value: 1000,
          max_invoice_face_value: "250,000",
          min_invoice_value: 800,
          max_invoice_value: 200000,
          sub_limit_per_invoice_rm: 200000,
        })
      )
    ).not.toThrow();
  });

  it("rejects non-positive invoice face-value limits", () => {
    expect(() =>
      validateWorkflowFinancialConfig(invoiceWorkflow({ min_invoice_face_value: 0 }))
    ).toThrow(AppError);
    try {
      validateWorkflowFinancialConfig(invoiceWorkflow({ max_invoice_face_value: -1 }));
    } catch (err) {
      expect(err).toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invoice value limits must be positive RM amounts",
      });
    }
  });

  it("rejects min invoice face value above max", () => {
    try {
      validateWorkflowFinancialConfig(
        invoiceWorkflow({ min_invoice_face_value: 10000, max_invoice_face_value: 1000 })
      );
    } catch (err) {
      expect(err).toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Minimum invoice value cannot exceed maximum invoice value",
      });
    }
  });

  it("rejects non-positive financing amount limits", () => {
    expect(() =>
      validateWorkflowFinancialConfig(invoiceWorkflow({ min_invoice_value: "" }))
    ).not.toThrow();
    expect(() =>
      validateWorkflowFinancialConfig(invoiceWorkflow({ min_invoice_value: 0 }))
    ).toThrow(/Financing amount limits must be positive RM amounts/);
  });

  it("rejects min financing above max and max financing above sub-limit", () => {
    expect(() =>
      validateWorkflowFinancialConfig(
        invoiceWorkflow({ min_invoice_value: 5000, max_invoice_value: 1000 })
      )
    ).toThrow(/Minimum financing amount cannot exceed maximum financing amount/);
    expect(() =>
      validateWorkflowFinancialConfig(
        invoiceWorkflow({ max_invoice_value: 20000, sub_limit_per_invoice_rm: 10000 })
      )
    ).toThrow(/Maximum financing amount cannot exceed the sub-limit per invoice/);
  });
});

describe("assertMaturityForApplication", () => {
  const reference = startOfDay(new Date("2026-03-01T00:00:00"));

  it("is a no-op when months are unset or maturity is missing", () => {
    expect(() =>
      assertMaturityForApplication(invoiceWorkflow({}), { maturity_date: "2026-04-01" }, reference)
    ).not.toThrow();
    expect(() =>
      assertMaturityForApplication(
        invoiceWorkflow({ min_months_application_to_maturity: 3 }),
        { value: 10_000 },
        reference
      )
    ).not.toThrow();
  });

  it("rejects a maturity earlier than the configured months from today", () => {
    try {
      assertMaturityForApplication(
        invoiceWorkflow({ min_months_application_to_maturity: 3 }),
        { maturity_date: "2026-04-01" },
        reference
      );
      throw new Error("expected maturity validation error");
    } catch (err) {
      expect(err).toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invoice maturity must be at least 3 month(s) from today.",
      });
    }
  });

  it("accepts a maturity on the minimum date", () => {
    const maturity = addMonths(reference, 3);
    const ymd = `${maturity.getFullYear()}-${String(maturity.getMonth() + 1).padStart(2, "0")}-${String(maturity.getDate()).padStart(2, "0")}`;
    expect(() =>
      assertMaturityForApplication(
        invoiceWorkflow({ min_months_application_to_maturity: 3 }),
        { maturity_date: ymd },
        reference
      )
    ).not.toThrow();
  });
});

describe("assertMaturityForSendInvoiceOffer", () => {
  const reference = startOfDay(new Date("2026-03-01T00:00:00"));

  it("is a no-op when review-to-maturity months are unset", () => {
    expect(() =>
      assertMaturityForSendInvoiceOffer(invoiceWorkflow({}), { maturity_date: "2026-04-01" }, reference)
    ).not.toThrow();
  });

  it("rejects a missing maturity date when months are configured", () => {
    try {
      assertMaturityForSendInvoiceOffer(
        invoiceWorkflow({ min_months_review_to_maturity: 2 }),
        { value: 10_000 },
        reference
      );
    } catch (err) {
      expect(err).toMatchObject({
        statusCode: 400,
        code: "INVALID_STATE",
        message: "Invoice maturity date is missing",
      });
    }
  });

  it("rejects a maturity too soon to send an offer", () => {
    try {
      assertMaturityForSendInvoiceOffer(
        invoiceWorkflow({ min_months_review_to_maturity: 4 }),
        { maturity_date: "2026-05-01" },
        reference
      );
    } catch (err) {
      expect(err).toMatchObject({
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invoice maturity must be at least 4 month(s) from today to send an offer.",
      });
    }
  });
});
