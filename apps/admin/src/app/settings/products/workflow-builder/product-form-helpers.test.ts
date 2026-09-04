import * as fs from "fs";
import * as path from "path";
import {
  buildPayloadFromSteps,
  getRequiredStepErrors,
  normalizeWorkflow,
} from "./product-form-helpers";

jest.mock("@cashsouk/ui", () => ({
  parseMoney: (value: string | number | null | undefined) => {
    if (value === "" || value === null || value === undefined) return 0;
    const num = typeof value === "string" ? Number(value.replace(/,/g, "")) : value;
    return Number.isNaN(num) ? 0 : num;
  },
}));

jest.mock("@cashsouk/ui/declaration-rich-text", () => ({
  isDeclarationHtmlEmpty: () => false,
}));

function invoiceProductSteps(invoiceConfig: Record<string, unknown>) {
  return [
    { id: "financing_structure", config: {} },
    { id: "contract_details", config: { min_contract_months: 12 } },
    { id: "invoice_details", config: invoiceConfig },
    { id: "declarations", config: { declarations: [{ text: "I agree" }] } },
  ];
}

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
    expect(helpers).toContain("sub_limit_per_invoice_rm");
    expect(configUi).toContain("Sub-limit per invoice (RM)");
  });

  it("includes invoice face-value keys and the new validation messages", () => {
    expect(helpers).toContain("min_invoice_face_value");
    expect(helpers).toContain("max_invoice_face_value");
    expect(helpers).toContain("minimum invoice value cannot be negative");
    expect(helpers).toContain("maximum invoice value cannot be negative");
    expect(helpers).toContain("minimum invoice value cannot exceed maximum invoice value");
    expect(helpers).toContain("minimum financing amount cannot exceed maximum financing amount");
    expect(helpers).toContain("maximum financing amount cannot exceed the sub-limit per invoice");
    expect(helpers).not.toContain("minimum cannot exceed maximum");
    expect(configUi).toContain("Minimum invoice value (RM)");
    expect(configUi).toContain("Maximum invoice value (RM)");
  });
});

describe("invoice face-value payload and validation", () => {
  it("parses face-value keys in buildPayloadFromSteps and normalizeWorkflow", () => {
    const payload = buildPayloadFromSteps(
      invoiceProductSteps({
        min_invoice_face_value: "1,000.00",
        max_invoice_face_value: "250,000",
        min_invoice_value: "800",
        max_invoice_value: "200,000",
      })
    );
    const invoice = payload.find((s) => s.id === "invoice_details")?.config;
    expect(invoice?.min_invoice_face_value).toBe(1000);
    expect(invoice?.max_invoice_face_value).toBe(250000);

    const normalized = normalizeWorkflow(
      invoiceProductSteps({
        min_invoice_face_value: "2,500",
        max_invoice_face_value: "",
      })
    );
    const normalizedInvoice = normalized.find((s) => s.id === "invoice_details")?.config;
    expect(normalizedInvoice?.min_invoice_face_value).toBe(2500);
    expect(normalizedInvoice?.max_invoice_face_value).toBeNull();
  });

  it("rejects negative and inverted invoice face-value limits", () => {
    expect(
      getRequiredStepErrors(invoiceProductSteps({ min_invoice_face_value: -1 })).some((e) =>
        e.includes("minimum invoice value cannot be negative")
      )
    ).toBe(true);
    expect(
      getRequiredStepErrors(invoiceProductSteps({ max_invoice_face_value: -5 })).some((e) =>
        e.includes("maximum invoice value cannot be negative")
      )
    ).toBe(true);
    expect(
      getRequiredStepErrors(
        invoiceProductSteps({ min_invoice_face_value: 10000, max_invoice_face_value: 1000 })
      ).some((e) => e.includes("minimum invoice value cannot exceed maximum invoice value"))
    ).toBe(true);
  });

  it("rejects financing min above max and financing max above sub-limit", () => {
    expect(
      getRequiredStepErrors(
        invoiceProductSteps({ min_invoice_value: 5000, max_invoice_value: 1000 })
      ).some((e) => e.includes("minimum financing amount cannot exceed maximum financing amount"))
    ).toBe(true);
    expect(
      getRequiredStepErrors(
        invoiceProductSteps({
          max_invoice_value: 20000,
          sub_limit_per_invoice_rm: 10000,
        })
      ).some((e) => e.includes("maximum financing amount cannot exceed the sub-limit per invoice"))
    ).toBe(true);
  });
});
