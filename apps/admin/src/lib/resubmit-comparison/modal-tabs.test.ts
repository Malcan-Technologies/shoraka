import { resolveReviewTabStatus } from "@/components/application-review/offer-acceptance/unified-tab-descriptor";
import {
  buildResubmitTabStripSections,
  getResubmitComparisonTabDescriptors,
  resolveResubmitComparisonWorkflow,
  resubmitTabDescriptorHasChanges,
} from "./modal-tabs";

const workflow = [
  { id: "company_details" },
  { id: "business_details" },
  { id: "supporting_documents" },
  { id: "contract_details" },
  { id: "invoice_details" },
  { id: "acceptance_documents" },
];

const STANDALONE_MERGED = ["contract_details", "invoice_details", "acceptance_documents"];

describe("getResubmitComparisonTabDescriptors", () => {
  it.each(["new_contract", "existing_contract", "invoice_only"])(
    "%s: tabs end with one Offer & acceptance tab and no standalone Facility/Invoice/Acceptance tabs",
    (structure) => {
      const descriptors = getResubmitComparisonTabDescriptors(workflow, {
        financing_structure: { structure_type: structure },
        invoices: [{ id: "inv-1" }],
      });
      const ids = descriptors.map((d) => d.id);
      expect(ids[0]).toBe("financial");
      expect(ids[ids.length - 1]).toBe("offer_acceptance");
      expect(ids.filter((id) => STANDALONE_MERGED.includes(id))).toEqual([]);
      expect(descriptors.map((d) => d.label)).not.toEqual(
        expect.arrayContaining(["Facility", "Customer", "Invoice", "Acceptance"])
      );
      const merged = descriptors.find((d) => d.id === "offer_acceptance")!;
      expect(merged.label).toBe("Offer & acceptance");
      expect(merged.mergedSections).toEqual(
        expect.arrayContaining(["contract_details", "invoice_details"])
      );
    }
  );

  it("drops invoice_details from the merged tab when a facility application has no invoices", () => {
    const descriptors = getResubmitComparisonTabDescriptors(workflow, {
      financing_structure: { structure_type: "new_contract" },
      invoices: [],
    });
    const merged = descriptors.find((d) => d.id === "offer_acceptance")!;
    expect(merged.mergedSections).not.toContain("invoice_details");
  });
});

describe("resolveResubmitComparisonWorkflow", () => {
  const live = [{ id: "live" }];

  it("prefers the frozen snapshot workflow", () => {
    const frozen = [{ id: "frozen" }];
    expect(resolveResubmitComparisonWorkflow({ product: { workflow: frozen } }, live)).toBe(frozen);
  });

  it.each([
    null,
    undefined,
    {},
    { product: null },
    { product: { workflow: null } },
    { product: { workflow: [] } },
  ])("falls back to the live workflow for %p", (snapshot) => {
    expect(resolveResubmitComparisonWorkflow(snapshot, live)).toBe(live);
  });

  it("returns undefined when neither is an array", () => {
    expect(resolveResubmitComparisonWorkflow(null, undefined)).toBeUndefined();
  });
});

describe("buildResubmitTabStripSections", () => {
  const descriptors = getResubmitComparisonTabDescriptors(workflow, {
    financing_structure: { structure_type: "new_contract" },
    invoices: [{ id: "inv-1" }],
  });

  it("keeps every merged section status so the merged dot resolves like the live page", () => {
    const sections = buildResubmitTabStripSections(descriptors, [
      { section: "contract_details", status: "APPROVED" },
      { section: "invoice_details", status: "AMENDMENT_REQUESTED" },
      { section: "acceptance_documents", status: "APPROVED" },
    ]);
    const map = new Map(sections.map((s) => [s.section, s.status]));
    const merged = descriptors.find((d) => d.id === "offer_acceptance")!;
    expect(resolveReviewTabStatus(merged, map)).toBe("AMENDMENT_REQUESTED");
    expect(map.get("financial")).toBe("PENDING");
  });

  it("passes a synthetic offer_acceptance status through", () => {
    const sections = buildResubmitTabStripSections(descriptors, [
      { section: "offer_acceptance", status: "OFFER_SENT" },
    ]);
    const map = new Map(sections.map((s) => [s.section, s.status]));
    const merged = descriptors.find((d) => d.id === "offer_acceptance")!;
    expect(resolveReviewTabStatus(merged, map)).toBe("OFFER_SENT");
  });
});

describe("resubmitTabDescriptorHasChanges", () => {
  it("ORs merged sections and ignores reviewSection alone for a merged tab", () => {
    const merged = {
      reviewSection: "contract_details" as const,
      mergedSections: ["contract_details" as const, "invoice_details" as const],
    };
    expect(resubmitTabDescriptorHasChanges(merged, (s) => s === "invoice_details")).toBe(true);
    expect(resubmitTabDescriptorHasChanges(merged, () => false)).toBe(false);
    expect(
      resubmitTabDescriptorHasChanges({ reviewSection: "financial" }, (s) => s === "financial")
    ).toBe(true);
  });
});
