import { AppError } from "../../lib/http/error-handler";
import { validateWorkflowFinancialConfig } from "./validate-financial-config";

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
