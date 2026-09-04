import * as fs from "fs";
import * as path from "path";
import { facilityImpactCopy } from "@cashsouk/types";
import {
  CREDIT_FACILITY_HEADING,
  CONTRACT_ALLOCATION_HEADING,
  REMAINING_CREDIT_LABEL,
  REMAINING_ALLOCATION_LABEL,
  RESERVED_LABEL,
} from "@/lib/facility-capacity-display";

describe("admin dual-limit surfaces", () => {
  it("labels pending as reserved and never says it is not occupying the line", () => {
    const source = fs.readFileSync(path.join(__dirname, "contract-facility-summary.tsx"), "utf8");
    expect(source).toContain("CREDIT_FACILITY_HEADING");
    expect(source).toContain("CONTRACT_ALLOCATION_HEADING");
    expect(source).toContain("RESERVED_LABEL");
    expect(source).toContain("REMAINING_CREDIT_LABEL");
    expect(source).toContain("REMAINING_ALLOCATION_LABEL");
    expect(source).toContain("clampMeterAriaNow");
    expect(source).not.toContain("Not occupying the line");
    expect(source).not.toContain("not occupying");
    expect(CREDIT_FACILITY_HEADING).toMatch(/reusable after repayment/i);
    expect(CONTRACT_ALLOCATION_HEADING).toMatch(/used once/i);
    expect(RESERVED_LABEL).toBe("Reserved");
    expect(REMAINING_CREDIT_LABEL).toBe("Remaining credit");
    expect(REMAINING_ALLOCATION_LABEL).toBe("Remaining allocation");
  });

  it("uses canonical requested financing for invoice facility impact", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "sections/invoice-section.tsx"),
      "utf8"
    );
    expect(source).toContain("resolveRequestedInvoiceAmount");
    expect(source).not.toMatch(/value \* ratio/);
  });

  it("does not render facility impact without a real facility contractId", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "sections/invoice-section.tsx"),
      "utf8"
    );
    expect(source).toContain("{contractId ? (");
    expect(source).toContain("<FacilityImpact");
  });

  it("blocks invoice offer overrides in the offer panel", () => {
    const source = fs.readFileSync(path.join(__dirname, "../invoice-offer-panel.tsx"), "utf8");
    expect(source).not.toContain("You can still send it");
    expect(source).toContain("resolveInvoiceOfferDisable");
    expect(source).toContain("resolveRequestedInvoiceAmount");
    expect(source).toContain("invoiceOfferExceedsRequested");
    expect(source).toContain("addBackFinancing: reservedInvoice ? (issuerFinancingAmount ?? 0) : 0");
    expect(source).not.toContain("offeredAmount > issuerFinancingAmount");
    expect(source).not.toMatch(
      /issuerFinancingAmount\s*=\s*\n?\s*invoiceValue !== null && financingRatio !== null/
    );
  });

  it("keeps settlement allocation on repaid facility-backed notes", () => {
    expect(
      facilityImpactCopy({
        invoiceStatus: "APPROVED",
        noteStatus: "REPAID",
        servicingStatus: "SETTLED",
      })
    ).toEqual({
      statusWording: "Repayment freed credit. Settled invoices still use contract allocation.",
      settledLifetimeRetained: true,
      released: false,
    });
  });
});
