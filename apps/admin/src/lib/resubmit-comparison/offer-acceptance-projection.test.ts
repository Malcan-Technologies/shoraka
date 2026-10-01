import type { ReviewApplicationView } from "@/components/application-review/section-content";
import {
  offerAcceptanceComparisonHasChanges,
  projectOfferAcceptanceComparison,
} from "./offer-acceptance-projection";
import { comparisonRowDiffers, type ComparisonStage } from "./projection-types";

type Structure = "new_contract" | "existing_contract" | "invoice_only";

function invoice(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    status: "PENDING",
    offer_details: null as unknown,
    details: {
      number: `INV-${id}`,
      value: 10000,
      maturity_date: "2027-01-15",
      financing_ratio_percent: 80,
      financing_tenure_days: 90,
      document: {
        s3_key: `inv/${id}.pdf`,
        file_name: `${id}.pdf`,
        file_size: 2048,
        uploaded_at: "2026-01-01",
      },
      ...overrides,
    },
  };
}

function app(
  structure: Structure,
  extras: Partial<ReviewApplicationView> = {}
): ReviewApplicationView {
  return {
    id: "app-1",
    financing_structure: { structure_type: structure },
    contract: {
      id: "contract-1",
      status: "PENDING",
      paymaster_id: "pm-1",
      contract_details: {
        title: "Supply deal",
        description: "Supply of goods",
        number: "C-1",
        value: 1000,
        financing: 800,
        start_date: "2026-01-01",
        end_date: "2027-01-01",
        approved_facility: 500,
        utilized_facility: 0,
        available_facility: 500,
        document: {
          s3_key: "contract/a.pdf",
          file_name: "contract.pdf",
          file_size: 4096,
          uploaded_at: "2026-01-01",
        },
      },
      customer_details: {
        name: "Acme",
        entity_type: "Sdn Bhd",
        ssm_number: "123",
        country: "MY",
        is_related_party: false,
        is_large_private_company: true,
        paymaster_id: "pm-1",
      },
      offer_details: {
        offered_facility: 700,
        facility_fee_rate_percent: 2,
        facility_fee_upfront_collect_amount: 10,
        sent_at: "2026-02-01T00:00:00Z",
        version: 1,
      },
    },
    invoices: [invoice("i1")],
    ...extras,
  };
}

function withContract(
  base: ReviewApplicationView,
  patch: {
    contract_details?: Record<string, unknown>;
    customer_details?: Record<string, unknown>;
    offer_details?: Record<string, unknown>;
    [key: string]: unknown;
  }
): ReviewApplicationView {
  const c = base.contract!;
  const { contract_details, customer_details, offer_details, ...rest } = patch;
  return {
    ...base,
    contract: {
      ...c,
      ...rest,
      contract_details: { ...(c.contract_details as object), ...contract_details },
      customer_details: { ...(c.customer_details as object), ...customer_details },
      offer_details: { ...(c.offer_details as object), ...offer_details },
    },
  };
}

function changedRows(stages: ComparisonStage[]): string[] {
  return stages.flatMap((stage) =>
    stage.blocks.flatMap((block) =>
      block.rows.filter(comparisonRowDiffers).map((row) => `${stage.id}/${block.id}/${row.key}`)
    )
  );
}

function stageIds(stages: ComparisonStage[]): string[] {
  return stages.map((s) => s.id);
}

describe("projectOfferAcceptanceComparison stage order", () => {
  it("new_contract: Facility review → Send offer, invoices block below", () => {
    const p = projectOfferAcceptanceComparison(app("new_contract"), app("new_contract"));
    expect(stageIds(p.contract_details)).toEqual(["facility_review", "send_offer"]);
    expect(p.contract_details[0]!.title).toBe("Facility review");
    expect(p.contract_details[0]!.blocks.map((b) => b.title)).toEqual([
      "Contract Details",
      "Customer Details",
      "Evidence",
    ]);
    expect(p.contract_details[1]!.blocks.map((b) => b.title)).toEqual(["Offer to Issuer"]);
    expect(p.contract_details[1]!.blocks[0]!.rows.map((r) => r.label)).toEqual([
      "Requested Facility",
      "Offered Facility",
      "Facility fee rate",
      "Collect upfront now",
    ]);
    expect(stageIds(p.invoice_details)).toEqual(["invoices"]);
    expect(p.invoice_details[0]!.title).toBe("Invoice");
  });

  it("existing_contract: Facility reference, then Invoice review → Send offer", () => {
    const p = projectOfferAcceptanceComparison(app("existing_contract"), app("existing_contract"));
    expect(stageIds(p.contract_details)).toEqual(["facility_reference"]);
    expect(p.contract_details[0]!.title).toBe("Facility");
    const customer = p.contract_details[0]!.blocks.find((b) => b.id === "customer_details")!;
    expect(customer.rows.map((r) => r.key)).not.toContain("is_large_private_company");
    expect(stageIds(p.invoice_details)).toEqual(["invoice_review", "send_offer"]);
    expect(p.invoice_details[1]!.blocks[0]!.rows.map((r) => r.label)).toEqual([
      "Offered financing amount",
    ]);
  });

  it("invoice_only: Customer review with live CustomerReviewFields rows", () => {
    const p = projectOfferAcceptanceComparison(app("invoice_only"), app("invoice_only"));
    expect(stageIds(p.contract_details)).toEqual(["customer_review"]);
    expect(p.contract_details[0]!.blocks.map((b) => b.title)).toEqual(["Customer Details"]);
    expect(p.contract_details[0]!.blocks[0]!.rows.map((r) => r.label)).toEqual([
      "Customer Name",
      "Customer Entity Type",
      "Customer SSM Number",
      "Customer Country",
      "Is Customer Related to Issuer?",
    ]);
    expect(stageIds(p.invoice_details)).toEqual(["invoice_review", "send_offer"]);
  });

  it("invoice rows follow InvoiceStackedFields labels and formatting", () => {
    const p = projectOfferAcceptanceComparison(app("invoice_only"), app("invoice_only"));
    const block = p.invoice_details[0]!.blocks[0]!;
    expect(block.title).toBe("Invoice details");
    expect(p.blockAsides[block.id]).toBe("INV-i1");
    const offerBlock = p.invoice_details[1]!.blocks[0]!;
    expect(offerBlock.title).toBe("Offer to issuer");
    expect(p.blockAsides[offerBlock.id]).toBe("INV-i1");
    expect(block.rows.map((r) => r.label)).toEqual([
      "Invoice number",
      "Maturity date",
      "Financing tenure",
      "Invoice value",
      "Financing ratio",
      "Financing amount",
      "Company category",
      "Campaign Sector",
      "Sustainability Category of the Campaign",
      "Document",
    ]);
    const byKey = new Map(block.rows.map((r) => [r.key, r]));
    expect(byKey.get("maturity_date")).toMatchObject({ after: "15 Jan 2027" });
    expect(byKey.get("value")).toMatchObject({ after: "RM 10,000.00" });
    expect(byKey.get("financing_ratio")).toMatchObject({ after: "80%" });
    // No offer yet: falls back to requested (value × ratio), like invoiceFinancingAmountDisplay.
    expect(byKey.get("financing_amount")).toMatchObject({ after: "RM 8,000.00" });
  });

  it("orders invoices by the after list, removed-only invoices last", () => {
    const before = app("invoice_only", { invoices: [invoice("old"), invoice("b")] });
    const after = app("invoice_only", { invoices: [invoice("b"), invoice("a")] });
    const p = projectOfferAcceptanceComparison(before, after);
    expect(p.invoice_details[0]!.blocks.map((b) => b.id)).toEqual([
      "invoice_details:b",
      "invoice_details:a",
      "invoice_details:old",
    ]);
  });

  it("asides number invoices whose labels collide (unnumbered fallback) by emitted position", () => {
    const invoices = [invoice("x", { number: "" }), invoice("i1"), invoice("y", { number: "" })];
    const p = projectOfferAcceptanceComparison(
      app("invoice_only", { invoices }),
      app("invoice_only", { invoices })
    );
    expect(p.blockAsides).toEqual({
      "invoice_details:x": "Invoice 1",
      "invoice_offer:x": "Invoice 1",
      "invoice_details:i1": "INV-i1",
      "invoice_offer:i1": "INV-i1",
      "invoice_details:y": "Invoice 3",
      "invoice_offer:y": "Invoice 3",
    });
  });

  it("new_contract asides cover only the emitted invoice detail blocks", () => {
    const p = projectOfferAcceptanceComparison(app("new_contract"), app("new_contract"));
    const emittedIds = p.invoice_details.flatMap((s) => s.blocks.map((b) => b.id));
    expect(emittedIds).toEqual(["invoice_details:i1"]);
    expect(p.blockAsides).toEqual({ "invoice_details:i1": "INV-i1" });
  });
});

describe("offerAcceptanceComparisonHasChanges — no false Diff", () => {
  const structures: Structure[] = ["new_contract", "existing_contract", "invoice_only"];

  it.each(structures)("identical snapshots (%s) do not diff", (structure) => {
    expect(
      offerAcceptanceComparisonHasChanges("contract_details", app(structure), app(structure))
    ).toBe(false);
    expect(
      offerAcceptanceComparisonHasChanges("invoice_details", app(structure), app(structure))
    ).toBe(false);
  });

  it.each(structures)("unrendered contract columns (%s) do not diff", (structure) => {
    const after = withContract(app(structure), {
      id: "contract-2",
      status: "APPROVED",
      paymaster_id: "pm-2",
      contract_details: {
        approved_facility: 9999,
        utilized_facility: 100,
        available_facility: 1,
        pending_facility: 4,
        lifetime_remaining: 3,
        document: {
          s3_key: "contract/a.pdf",
          file_name: "contract.pdf",
          file_size: 4096,
          uploaded_at: "2026-03-03",
        },
      },
      customer_details: { paymaster_id: "pm-2" },
      offer_details: {
        sent_at: "2026-03-01T00:00:00Z",
        responded_at: "2026-03-02T00:00:00Z",
        version: 2,
        sent_by_user_id: "u-2",
        responded_by_user_id: "u-3",
        offer_acceptance: { status: "ACCEPTED" },
      },
    });
    expect(offerAcceptanceComparisonHasChanges("contract_details", app(structure), after)).toBe(
      false
    );
  });

  it.each(structures)(
    "contract_id and invoice status / non-amount offer fields (%s) do not diff",
    (structure) => {
      const before = app(structure, {
        invoices: [
          {
            ...invoice("i1"),
            contract_id: "c-1",
            offer_details: { offered_amount: 5000, sent_at: "x" },
          },
        ],
      });
      const after = app(structure, {
        invoices: [
          {
            ...invoice("i1", {
              document: {
                s3_key: "inv/i1.pdf",
                file_name: "i1.pdf",
                file_size: 2048,
                uploaded_at: "2026-09-09",
              },
            }),
            contract_id: "c-2",
            status: "OFFER_SENT",
            offer_details: {
              offered_amount: 5000,
              sent_at: "y",
              version: 3,
              offered_profit_rate_percent: 12,
              offer_acceptance: { status: "PENDING" },
            },
          },
        ],
      });
      expect(offerAcceptanceComparisonHasChanges("invoice_details", before, after)).toBe(false);
    }
  );

  it("numeric string vs number for the same amount does not diff", () => {
    const before = withContract(app("new_contract"), {
      contract_details: { value: "1000", financing: "800" },
      offer_details: {
        offered_facility: "700",
        facility_fee_rate_percent: "2",
        facility_fee_upfront_collect_amount: "10",
      },
    });
    const beforeInv = app("new_contract", {
      invoices: [invoice("i1", { value: "10000", financing_ratio_percent: "80" })],
    });
    expect(
      offerAcceptanceComparisonHasChanges("contract_details", before, app("new_contract"))
    ).toBe(false);
    expect(
      offerAcceptanceComparisonHasChanges("invoice_details", beforeInv, app("new_contract"))
    ).toBe(false);
  });

  it("null contract / offer_details on both sides does not diff and still projects stages", () => {
    const empty = app("new_contract", { contract: null, invoices: [] });
    const p = projectOfferAcceptanceComparison(empty, empty);
    expect(stageIds(p.contract_details)).toEqual(["facility_review", "send_offer"]);
    expect(changedRows(p.contract_details)).toEqual([]);
    expect(p.invoice_details[0]!.blocks).toEqual([]);
  });
});

describe("offerAcceptanceComparisonHasChanges — real changes", () => {
  it("facility value change diffs contract_details only", () => {
    const after = withContract(app("new_contract"), { contract_details: { value: 2000 } });
    const p = projectOfferAcceptanceComparison(app("new_contract"), after);
    expect(changedRows(p.contract_details)).toEqual([
      "facility_review/contract_details/value",
      // Requested Facility resolves from financing first, so it is unchanged here.
    ]);
    expect(
      offerAcceptanceComparisonHasChanges("contract_details", app("new_contract"), after)
    ).toBe(true);
    expect(offerAcceptanceComparisonHasChanges("invoice_details", app("new_contract"), after)).toBe(
      false
    );
  });

  it("facility offer change diffs the Send offer stage", () => {
    const after = withContract(app("new_contract"), { offer_details: { offered_facility: 750 } });
    expect(
      changedRows(projectOfferAcceptanceComparison(app("new_contract"), after).contract_details)
    ).toEqual(["send_offer/offer_to_issuer/offered_facility"]);
  });

  it("customer change diffs Customer review for invoice_only", () => {
    const after = withContract(app("invoice_only"), { customer_details: { name: "Beta" } });
    expect(
      changedRows(projectOfferAcceptanceComparison(app("invoice_only"), after).contract_details)
    ).toEqual(["customer_review/customer_details/name"]);
  });

  it("existing_contract reference diffs only when a rendered value differs", () => {
    const after = withContract(app("existing_contract"), {
      contract_details: { end_date: "2028-01-01" },
      customer_details: { is_large_private_company: false },
    });
    expect(
      changedRows(
        projectOfferAcceptanceComparison(app("existing_contract"), after).contract_details
      )
    ).toEqual(["facility_reference/contract_details/end_date"]);
  });

  it("invoice value change diffs invoice_details", () => {
    const before = app("existing_contract");
    const after = app("existing_contract", { invoices: [invoice("i1", { value: 12000 })] });
    const rows = changedRows(projectOfferAcceptanceComparison(before, after).invoice_details);
    expect(rows).toEqual(expect.arrayContaining(["invoice_review/invoice_details:i1/value"]));
    expect(offerAcceptanceComparisonHasChanges("invoice_details", before, after)).toBe(true);
    expect(offerAcceptanceComparisonHasChanges("contract_details", before, after)).toBe(false);
  });

  it("invoice offered amount change diffs the invoice Send offer stage", () => {
    const before = app("invoice_only", {
      invoices: [{ ...invoice("i1"), offer_details: { offered_amount: 5000 } }],
    });
    const after = app("invoice_only", {
      invoices: [{ ...invoice("i1"), offer_details: { offered_amount: 6000 } }],
    });
    expect(changedRows(projectOfferAcceptanceComparison(before, after).invoice_details)).toEqual([
      "invoice_review/invoice_details:i1/financing_amount",
      "send_offer/invoice_offer:i1/offered_amount",
    ]);
  });

  it.each(["added", "removed"] as const)("invoice %s diffs invoice_details", (mode) => {
    const one = app("invoice_only", { invoices: [invoice("i1")] });
    const two = app("invoice_only", { invoices: [invoice("i1"), invoice("i2")] });
    const [before, after] = mode === "added" ? [one, two] : [two, one];
    expect(offerAcceptanceComparisonHasChanges("invoice_details", before, after)).toBe(true);
  });

  it("contract document with the same name but a new s3 key diffs", () => {
    const after = withContract(app("new_contract"), {
      contract_details: {
        document: { s3_key: "contract/b.pdf", file_name: "contract.pdf", file_size: 4096 },
      },
    });
    expect(
      changedRows(projectOfferAcceptanceComparison(app("new_contract"), after).contract_details)
    ).toEqual(["facility_review/evidence/contract_document"]);
  });

  it("invoice document replaced under the same name diffs", () => {
    const after = app("new_contract", {
      invoices: [
        invoice("i1", {
          document: { s3_key: "inv/i1-v2.pdf", file_name: "i1.pdf", file_size: 2048 },
        }),
      ],
    });
    expect(
      changedRows(projectOfferAcceptanceComparison(app("new_contract"), after).invoice_details)
    ).toEqual(["invoices/invoice_details:i1/document"]);
  });
});
