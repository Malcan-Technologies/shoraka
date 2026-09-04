import { getTabUnlockTooltip } from "./review-registry";

describe("getTabUnlockTooltip", () => {
  const available = new Set(["contract_details", "invoice_details", "acceptance_documents"]);
  const pending = new Map<string, string>([
    ["contract_details", "PENDING"],
    ["invoice_details", "APPROVED"],
  ]);

  it("asks for Customer approval on invoice_only acceptance", () => {
    const tooltip = getTabUnlockTooltip(
      "acceptance_documents",
      pending,
      available,
      {
        acceptance_documents: ["contract_details", "invoice_details"],
      },
      { contract_details: "Customer" },
      "invoice_only"
    );
    expect(tooltip).toContain("Approve Customer section first");
    expect(tooltip).not.toContain("Send offer from Facility first");
  });

  it("asks for a facility offer on new_contract acceptance", () => {
    const tooltip = getTabUnlockTooltip(
      "acceptance_documents",
      pending,
      available,
      {
        acceptance_documents: ["contract_details", "invoice_details"],
      },
      undefined,
      "new_contract"
    );
    expect(tooltip).toContain("Send offer from Facility first");
    expect(tooltip).not.toContain("Approve Customer section first");
  });
});
