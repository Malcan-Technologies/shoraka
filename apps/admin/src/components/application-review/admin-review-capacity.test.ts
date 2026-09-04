jest.mock("@cashsouk/config", () =>
  jest.requireActual("@cashsouk/config/src/offer-resolvers")
);

import * as fs from "fs";
import * as path from "path";
import { resolveRequestedFacility } from "@cashsouk/config";
import { CAPACITY_SNAPSHOT_VERSION, CAPACITY_SNAPSHOT_VERSION_KEY } from "@cashsouk/types";
import {
  resolveAdminReviewTabCapacity,
  type AdminReviewCapacityInvoice,
  type AdminReviewTabCapacityProps,
} from "./admin-review-capacity";

function expectMatchingTabCapacity(props: AdminReviewTabCapacityProps) {
  expect(props.contract.remainingCredit).toBe(props.invoice.availableFacility);
  expect(props.acceptance.remainingCredit).toBe(props.invoice.availableFacility);
  expect(props.contract.reservedFacility).toBe(props.invoice.pendingFacility);
  expect(props.contract.remainingAllocation).toBe(props.invoice.lifetimeRemaining);
  expect(props.acceptance.remainingAllocation).toBe(props.invoice.lifetimeRemaining);
}

function unmarkedApp(invoices: AdminReviewCapacityInvoice[], contractFace = 500_000) {
  return {
    id: "app-1",
    invoices,
    contract: {
      contract_details: {
        value: contractFace,
        approved_facility: 100_000,
        available_facility: 100_000,
        utilized_facility: 0,
      },
      invoices,
    },
  };
}

describe("resolveAdminReviewTabCapacity", () => {
  const pendingThisApp = {
    application_id: "app-1",
    status: "SUBMITTED",
    details: { value: 80_000, applied_financing: 40_000 },
  };
  const pendingSibling = {
    application_id: "app-2",
    status: "SUBMITTED",
    details: { value: 40_000, applied_financing: 20_000 },
  };

  it("gives unmarked legacy rows the same remaining/reserved/lifetime on every tab", () => {
    const props = resolveAdminReviewTabCapacity({
      contractSectionStatus: "APPROVED",
      app: {
        id: "app-1",
        invoices: [pendingThisApp],
        contract: {
          contract_details: {
            value: 500_000,
            approved_facility: 100_000,
            available_facility: 100_000,
            utilized_facility: 0,
          },
          invoices: [pendingThisApp, pendingSibling],
        },
      },
    });

    expect(props).not.toBeNull();
    expectMatchingTabCapacity(props!);
    expect(props!.invoice.pendingFacility).toBe(60_000);
    expect(props!.invoice.availableFacility).toBe(40_000);
    expect(props!.invoice.lifetimeUsed).toBe(120_000);
    expect(props!.invoice.lifetimeRemaining).toBe(380_000);
    expect(props!.invoice.lifetimeCap).toBe(500_000);
    expect(props!.invoice.isOverLimit).toBe(false);
  });

  it.each([
    ["SUBMITTED", 80_000],
    ["AMENDMENT_REQUESTED", 80_000],
    ["OFFER_SENT", 80_000],
    ["APPROVED", 80_000],
  ] as const)("counts unmarked %s invoice face toward lifetime", (status, used) => {
    const props = resolveAdminReviewTabCapacity({
      contractSectionStatus: "APPROVED",
      app: unmarkedApp([{ status, details: { value: 80_000, applied_financing: 40_000 } }]),
    });

    expect(props).not.toBeNull();
    expectMatchingTabCapacity(props!);
    expect(props!.invoice.lifetimeUsed).toBe(used);
    expect(props!.invoice.lifetimeRemaining).toBe(420_000);
    expect(props!.contract.remainingAllocation).toBe(420_000);
    expect(props!.acceptance.remainingAllocation).toBe(420_000);
  });

  it.each(["DRAFT", "REJECTED", "WITHDRAWN", "OFFER_EXPIRED"] as const)(
    "excludes unmarked %s invoice face from lifetime",
    (status) => {
      const props = resolveAdminReviewTabCapacity({
        contractSectionStatus: "APPROVED",
        app: unmarkedApp([{ status, details: { value: 80_000, applied_financing: 40_000 } }]),
      });

      expect(props).not.toBeNull();
      expectMatchingTabCapacity(props!);
      expect(props!.invoice.lifetimeUsed).toBe(0);
      expect(props!.invoice.lifetimeRemaining).toBe(500_000);
    }
  );

  it("sums multiple unmarked invoice faces and ignores applied_financing as face", () => {
    const props = resolveAdminReviewTabCapacity({
      contractSectionStatus: "APPROVED",
      app: unmarkedApp([
        { status: "SUBMITTED", details: { value: 80_000, applied_financing: 40_000 } },
        { status: "OFFER_SENT", details: { invoice_value: 30_000, applied_financing: 15_000 } },
        { status: "APPROVED", details: { value: 25_000, applied_financing: 12_000 } },
        { status: "REJECTED", details: { value: 90_000, applied_financing: 50_000 } },
      ]),
    });

    expect(props).not.toBeNull();
    expectMatchingTabCapacity(props!);
    expect(props!.invoice.lifetimeUsed).toBe(135_000);
    expect(props!.invoice.lifetimeRemaining).toBe(365_000);
  });

  it("preserves negative remaining when unmarked faces exceed contract face", () => {
    const props = resolveAdminReviewTabCapacity({
      contractSectionStatus: "APPROVED",
      app: unmarkedApp(
        [
          { status: "SUBMITTED", details: { value: 80_000, applied_financing: 40_000 } },
          { status: "APPROVED", details: { value: 70_000, applied_financing: 30_000 } },
        ],
        100_000
      ),
    });

    expect(props).not.toBeNull();
    expectMatchingTabCapacity(props!);
    expect(props!.invoice.lifetimeCap).toBe(100_000);
    expect(props!.invoice.lifetimeUsed).toBe(150_000);
    expect(props!.invoice.lifetimeRemaining).toBe(-50_000);
    expect(props!.invoice.isOverLimit).toBe(true);
    expect(props!.contract.remainingAllocation).toBe(-50_000);
    expect(props!.acceptance.remainingAllocation).toBe(-50_000);
  });

  it("preserves marked exact zeros across contract, invoice, and acceptance props", () => {
    const props = resolveAdminReviewTabCapacity({
      contractSectionStatus: "APPROVED",
      app: {
        id: "app-1",
        invoices: [pendingThisApp],
        contract: {
          contract_details: {
            value: 500_000,
            approved_facility: 100_000,
            pending_facility: 0,
            available_facility: 0,
            utilized_facility: 100_000,
            lifetime_cap: 500_000,
            lifetime_used: 500_000,
            lifetime_remaining: 0,
            [CAPACITY_SNAPSHOT_VERSION_KEY]: CAPACITY_SNAPSHOT_VERSION,
          },
          invoices: [pendingThisApp],
        },
      },
    });

    expect(props).not.toBeNull();
    expectMatchingTabCapacity(props!);
    expect(props!.invoice.pendingFacility).toBe(0);
    expect(props!.invoice.availableFacility).toBe(0);
    expect(props!.invoice.lifetimeUsed).toBe(500_000);
    expect(props!.invoice.lifetimeRemaining).toBe(0);
  });

  it("preserves marked nonzero occupancy exactly and does not re-sum pending or faces", () => {
    const props = resolveAdminReviewTabCapacity({
      contractSectionStatus: "APPROVED",
      app: {
        id: "app-1",
        invoices: [pendingThisApp],
        contract: {
          contract_details: {
            value: 500_000,
            approved_facility: 100_000,
            pending_facility: 15_000,
            available_facility: 55_000,
            utilized_facility: 30_000,
            lifetime_cap: 500_000,
            lifetime_used: 120_000,
            lifetime_remaining: 380_000,
            [CAPACITY_SNAPSHOT_VERSION_KEY]: CAPACITY_SNAPSHOT_VERSION,
          },
          invoices: [pendingThisApp, pendingSibling],
        },
      },
    });

    expect(props).not.toBeNull();
    expectMatchingTabCapacity(props!);
    expect(props!.invoice.pendingFacility).toBe(15_000);
    expect(props!.invoice.availableFacility).toBe(55_000);
    expect(props!.invoice.lifetimeUsed).toBe(120_000);
    expect(props!.invoice.lifetimeRemaining).toBe(380_000);
  });

  it("keeps marked settled allocation even when review invoices would sum differently", () => {
    const props = resolveAdminReviewTabCapacity({
      contractSectionStatus: "APPROVED",
      app: {
        id: "app-1",
        invoices: [pendingThisApp],
        contract: {
          contract_details: {
            value: 500_000,
            approved_facility: 100_000,
            pending_facility: 0,
            available_facility: 100_000,
            utilized_facility: 0,
            lifetime_cap: 500_000,
            lifetime_used: 200_000,
            lifetime_remaining: 300_000,
            [CAPACITY_SNAPSHOT_VERSION_KEY]: CAPACITY_SNAPSHOT_VERSION,
          },
          invoices: [pendingThisApp],
        },
      },
    });

    expect(props).not.toBeNull();
    expectMatchingTabCapacity(props!);
    expect(props!.invoice.lifetimeUsed).toBe(200_000);
    expect(props!.invoice.lifetimeRemaining).toBe(300_000);
    expect(props!.contract.remainingAllocation).toBe(300_000);
    expect(props!.acceptance.remainingAllocation).toBe(300_000);
  });

  it("uses the linked approved line on existing_contract when contract review is omitted", () => {
    const props = resolveAdminReviewTabCapacity({
      app: {
        id: "app-draw",
        financing_structure: { structure_type: "existing_contract" },
        invoices: [pendingThisApp],
        contract: {
          status: "APPROVED",
          contract_details: {
            value: 500_000,
            financing: 200_000,
            approved_facility: 80_000,
            available_facility: 200_000,
            utilized_facility: 0,
          },
          invoices: [pendingThisApp],
        },
      },
    });

    expect(props).not.toBeNull();
    expectMatchingTabCapacity(props!);
    expect(props!.invoice.contractFacility).toBe(80_000);
    expect(props!.invoice.pendingFacility).toBe(40_000);
    expect(props!.invoice.availableFacility).toBe(40_000);
    expect(props!.contract.remainingCredit).toBe(40_000);
    expect(props!.invoice.isOverLimit).toBe(false);
  });

  it("treats occupancy against approved when that line is smaller than requested or face", () => {
    const overLimitInvoice = {
      application_id: "app-draw",
      status: "SUBMITTED",
      details: { value: 180_000, applied_financing: 90_000 },
    };
    const props = resolveAdminReviewTabCapacity({
      app: {
        id: "app-draw",
        financing_structure: { structure_type: "existing_contract" },
        invoices: [overLimitInvoice],
        contract: {
          status: "APPROVED",
          contract_details: {
            value: 500_000,
            financing: 200_000,
            approved_facility: 80_000,
            available_facility: 200_000,
            utilized_facility: 0,
          },
          invoices: [overLimitInvoice],
        },
      },
    });

    expect(props).not.toBeNull();
    expectMatchingTabCapacity(props!);
    expect(props!.invoice.contractFacility).toBe(80_000);
    expect(props!.invoice.pendingFacility).toBe(90_000);
    expect(props!.invoice.availableFacility).toBe(-10_000);
    expect(props!.contract.remainingCredit).toBe(-10_000);
    expect(props!.invoice.isOverLimit).toBe(true);
  });

  it("skips holder capacity for invoice_only applications", () => {
    const props = resolveAdminReviewTabCapacity({
      contractSectionStatus: "APPROVED",
      app: {
        id: "app-invoice-only",
        financing_structure: { structure_type: "invoice_only" },
        invoices: [pendingThisApp],
        contract: {
          status: "SUBMITTED",
          contract_details: {
            value: 500_000,
            approved_facility: 100_000,
            available_facility: 100_000,
            utilized_facility: 0,
          },
          invoices: [pendingThisApp],
        },
      },
    });
    expect(props).toBeNull();
  });

  it("keeps new_contract preapproval requested labels off the approved ceiling", () => {
    const preapprovalDetails = {
      value: 500_000,
      financing: 120_000,
      available_facility: 120_000,
      utilized_facility: 0,
    };
    const props = resolveAdminReviewTabCapacity({
      contractSectionStatus: "APPROVED",
      app: {
        id: "app-new",
        financing_structure: { structure_type: "new_contract" },
        invoices: [pendingThisApp],
        contract: {
          status: "SUBMITTED",
          contract_details: preapprovalDetails,
          invoices: [pendingThisApp],
        },
      },
    });

    expect(resolveRequestedFacility(preapprovalDetails)).toBe(120_000);
    expect(props).toBeNull();
  });

  it("wires section-content tabs from the shared occupancy object", () => {
    const source = fs.readFileSync(path.join(__dirname, "section-content.tsx"), "utf8");
    const resolver = fs.readFileSync(path.join(__dirname, "admin-review-capacity.ts"), "utf8");
    expect(source).toContain("resolveAdminReviewTabCapacity");
    expect(source).toContain("adminReviewTabCapacity?.acceptance");
    expect(source).toContain("adminReviewTabCapacity?.contract");
    expect(source).toContain("adminReviewTabCapacity.invoice");
    expect(source).toContain("isInvoiceOnlyFinancingStructure");
    expect(source).toContain("facilityContractId");
    expect(source).not.toContain("parseFacilityAmount");
    expect(source).not.toContain("resolveAdminReviewFacilityOccupancy");
    expect(resolver).toContain("contractStatus: input.app.contract.status");
    expect(resolver).toContain("isInvoiceOnlyFinancingStructure(input.app.financing_structure)");
    expect(resolver).not.toContain("resolveRequestedFacility");
  });

  it("skips acceptance holder-capacity fields for invoice_only", () => {
    const acceptance = fs.readFileSync(
      path.join(__dirname, "sections/acceptance-section.tsx"),
      "utf8"
    );
    expect(acceptance).toContain("isInvoiceOnlyFinancingStructure");
    expect(acceptance).toContain("showHolderCapacity");
    expect(acceptance).toContain("REMAINING_CREDIT_LABEL");
  });
});
