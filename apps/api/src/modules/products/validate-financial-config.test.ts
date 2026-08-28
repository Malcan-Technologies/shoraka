import { AppError } from "../../lib/http/error-handler";
import { validateFinancialConfig, validateWorkflowFinancialConfig } from "./validate-financial-config";

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
