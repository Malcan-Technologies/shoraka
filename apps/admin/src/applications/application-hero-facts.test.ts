import {
  applicationFinancingStructureLabel,
  applicationPaymasterName,
} from "./application-hero-facts";

describe("applicationFinancingStructureLabel", () => {
  it("maps financing structure keys to header labels", () => {
    expect(applicationFinancingStructureLabel("invoice_only")).toBe("Invoice only");
    expect(applicationFinancingStructureLabel("new_contract")).toBe("New facility");
    expect(applicationFinancingStructureLabel("existing_contract")).toBe("Existing facility");
    expect(applicationFinancingStructureLabel(undefined)).toBe("—");
  });
});

describe("applicationPaymasterName", () => {
  it("prefers customer name, then company name", () => {
    expect(
      applicationPaymasterName({
        contract: { customer_details: { customer_name: "Acme Trading" } },
        company_details: { company_name: "Fallback Sdn Bhd" },
      })
    ).toBe("Acme Trading");
    expect(
      applicationPaymasterName({
        company_details: { company_name: "Fallback Sdn Bhd" },
      })
    ).toBe("Fallback Sdn Bhd");
    expect(applicationPaymasterName({})).toBe("—");
  });
});
