import { getEffectiveReviewTabDescriptors } from "./effective-review-tab-descriptors";

const workflow = [
  { id: "company_details" },
  { id: "business_details" },
  { id: "supporting_documents" },
  { id: "contract_details" },
  { id: "invoice_details" },
];

describe("getEffectiveReviewTabDescriptors", () => {
  it("relabels Facility as Customer for invoice_only", () => {
    const descriptors = getEffectiveReviewTabDescriptors(workflow, {
      financing_structure: { structure_type: "invoice_only" },
      invoices: [{ id: "inv-1" }],
    });
    const contractTab = descriptors.find((d) => d.reviewSection === "contract_details");
    expect(contractTab?.label).toBe("Customer");
  });

  it("keeps the Facility label for new_contract", () => {
    const descriptors = getEffectiveReviewTabDescriptors(workflow, {
      financing_structure: { structure_type: "new_contract" },
      invoices: [{ id: "inv-1" }],
    });
    const contractTab = descriptors.find((d) => d.reviewSection === "contract_details");
    expect(contractTab?.label).toBe("Facility");
  });
});
