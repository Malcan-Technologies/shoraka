import {
  collapseOfferAcceptanceDescriptors,
  deriveMergedSectionStatus,
  isOfferAcceptanceTabDescriptor,
  OFFER_ACCEPTANCE_TAB_ID,
  OFFER_ACCEPTANCE_TAB_LABEL,
  resolveReviewTabStatus,
} from "./unified-tab-descriptor";
import { OFFER_ACCEPTANCE_TAB_KIND, type ReviewTabDescriptor } from "../review-registry";

function tab(
  reviewSection: ReviewTabDescriptor["reviewSection"],
  extras: Partial<ReviewTabDescriptor> = {}
): ReviewTabDescriptor {
  return {
    id: reviewSection,
    kind: reviewSection,
    label: reviewSection,
    reviewSection,
    stepKey: reviewSection,
    stepId: reviewSection,
    ...extras,
  };
}

describe("deriveMergedSectionStatus", () => {
  it("uses REJECTED over every other status", () => {
    expect(
      deriveMergedSectionStatus(["APPROVED", "PENDING", "REJECTED", "AMENDMENT_REQUESTED"])
    ).toBe("REJECTED");
  });

  it("uses AMENDMENT_REQUESTED over PENDING and APPROVED", () => {
    expect(deriveMergedSectionStatus(["APPROVED", "AMENDMENT_REQUESTED", "PENDING"])).toBe(
      "AMENDMENT_REQUESTED"
    );
  });

  it("uses PENDING over APPROVED and OFFER_SENT", () => {
    expect(deriveMergedSectionStatus(["APPROVED", "OFFER_SENT", "PENDING"])).toBe("PENDING");
  });

  it("keeps OFFER_SENT when nothing worse is present", () => {
    expect(deriveMergedSectionStatus(["APPROVED", "OFFER_SENT"])).toBe("OFFER_SENT");
  });

  it("keeps OFFER_EXPIRED above OFFER_SENT and APPROVED", () => {
    expect(deriveMergedSectionStatus(["OFFER_SENT", "OFFER_EXPIRED", "APPROVED"])).toBe(
      "OFFER_EXPIRED"
    );
  });

  it("returns APPROVED when every section is approved", () => {
    expect(deriveMergedSectionStatus(["APPROVED", "APPROVED"])).toBe("APPROVED");
  });

  it("returns PENDING for an empty list or unknown statuses mixed with APPROVED", () => {
    expect(deriveMergedSectionStatus([])).toBe("PENDING");
    expect(deriveMergedSectionStatus(["APPROVED", "UNEXPECTED"])).toBe("UNEXPECTED");
  });
});

describe("collapseOfferAcceptanceDescriptors", () => {
  const financial = tab("financial", { label: "Financial" });
  const company = tab("company_details", { label: "Company" });
  const docs = tab("supporting_documents", { label: "Documents" });
  const facility = tab("contract_details", { label: "Facility" });
  const invoice = tab("invoice_details", { label: "Invoice" });
  const acceptance = tab("acceptance_documents", { label: "Acceptance" });

  it("merges facility, invoice, and acceptance at the first original position", () => {
    const collapsed = collapseOfferAcceptanceDescriptors([
      financial,
      company,
      docs,
      facility,
      acceptance,
      invoice,
    ]);
    expect(collapsed.map((d) => d.id)).toEqual([
      "financial",
      "company_details",
      "supporting_documents",
      OFFER_ACCEPTANCE_TAB_ID,
    ]);
    const unified = collapsed[3];
    expect(unified.kind).toBe(OFFER_ACCEPTANCE_TAB_KIND);
    expect(unified.label).toBe(OFFER_ACCEPTANCE_TAB_LABEL);
    expect(unified.mergedSections).toEqual([
      "contract_details",
      "acceptance_documents",
      "invoice_details",
    ]);
    expect(unified.reviewSection).toBe("contract_details");
    expect(isOfferAcceptanceTabDescriptor(unified)).toBe(true);
  });

  it("places the unified tab where Customer sat for invoice_only order", () => {
    const customer = { ...facility, label: "Customer" };
    const collapsed = collapseOfferAcceptanceDescriptors([
      financial,
      company,
      docs,
      customer,
      invoice,
      acceptance,
    ]);
    expect(collapsed.map((d) => d.label)).toEqual([
      "Financial",
      "Company",
      "Documents",
      OFFER_ACCEPTANCE_TAB_LABEL,
    ]);
    expect(collapsed[3]?.mergedSections).toEqual([
      "contract_details",
      "invoice_details",
      "acceptance_documents",
    ]);
  });

  it("merges only the sections that exist (facility + acceptance, no invoice)", () => {
    const collapsed = collapseOfferAcceptanceDescriptors([financial, facility, acceptance]);
    expect(collapsed[1]?.mergedSections).toEqual(["contract_details", "acceptance_documents"]);
  });

  it("is a no-op when none of the three sections are present", () => {
    const source = [financial, company, docs];
    expect(collapseOfferAcceptanceDescriptors(source)).toEqual(source);
  });

  it("does not double-collapse an already merged descriptor", () => {
    const once = collapseOfferAcceptanceDescriptors([financial, facility, invoice, acceptance]);
    expect(collapseOfferAcceptanceDescriptors(once)).toEqual(once);
  });
});

describe("resolveReviewTabStatus", () => {
  it("uses the single section status for ordinary tabs", () => {
    const map = new Map([
      ["financial", "APPROVED"],
      ["invoice_details", "PENDING"],
    ]);
    expect(resolveReviewTabStatus(tab("financial"), map)).toBe("APPROVED");
  });

  it("derives merged status for a unified descriptor", () => {
    const map = new Map([
      ["contract_details", "OFFER_SENT"],
      ["invoice_details", "PENDING"],
      ["acceptance_documents", "APPROVED"],
    ]);
    expect(
      resolveReviewTabStatus(
        {
          reviewSection: "contract_details",
          mergedSections: ["contract_details", "invoice_details", "acceptance_documents"],
        },
        map
      )
    ).toBe("PENDING");
  });
});
