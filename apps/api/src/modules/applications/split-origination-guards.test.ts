import { AppError } from "../../lib/http/error-handler";
import {
  allowsLegacyCombinedInvoices,
  assertApplicationSubmitOrigination,
  assertExistingFacilityDrawdown,
  assertMayAttachInvoiceToApplication,
} from "./split-origination-guards";

const approvedContract = {
  id: "con_1",
  status: "APPROVED",
  issuer_organization_id: "org_1",
};

function expectAppError(run: () => unknown, code: string) {
  try {
    run();
    throw new Error(`expected ${code} to be thrown`);
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
  }
}

describe("split origination API guards", () => {
  it("rejects invoices on newly created new_contract applications", () => {
    expectAppError(
      () =>
        assertMayAttachInvoiceToApplication({
          financing_type: { split_origination: true },
          financing_structure: { structure_type: "new_contract" },
          issuer_organization_id: "org_1",
        }),
      "FACILITY_ONLY_NO_INVOICE"
    );
  });

  it("allows grandfathered combined new_contract applications to keep invoices", () => {
    const legacy = {
      financing_type: { product_id: "p1" },
      financing_structure: { structure_type: "new_contract" },
      issuer_organization_id: "org_1",
    };
    expect(allowsLegacyCombinedInvoices(legacy)).toBe(true);
    expect(() => assertMayAttachInvoiceToApplication(legacy)).not.toThrow();
    expect(() =>
      assertApplicationSubmitOrigination({
        application: legacy,
        invoices: [{ id: "inv_1" }],
        contract: { id: "con_draft", status: "DRAFT", issuer_organization_id: "org_1" },
      })
    ).not.toThrow();
  });

  it("rejects existing-facility drawdowns without an approved owned facility", () => {
    const drawdown = {
      financing_type: { split_origination: true },
      financing_structure: { structure_type: "existing_contract", existing_contract_id: "con_1" },
      issuer_organization_id: "org_1",
    };
    expectAppError(
      () => assertExistingFacilityDrawdown(drawdown, null),
      "FACILITY_DRAWDOWN_REQUIRES_APPROVED_FACILITY"
    );
    expectAppError(
      () =>
        assertExistingFacilityDrawdown(drawdown, {
          id: "con_1",
          status: "SUBMITTED",
          issuer_organization_id: "org_1",
        }),
      "INVALID_CONTRACT_STATUS"
    );
    expectAppError(
      () =>
        assertExistingFacilityDrawdown(drawdown, {
          id: "con_1",
          status: "APPROVED",
          issuer_organization_id: "org_other",
        }),
      "FORBIDDEN"
    );
  });

  it("rejects existing-facility drawdowns on a disabled facility", () => {
    expectAppError(
      () =>
        assertExistingFacilityDrawdown(
          {
            financing_type: { split_origination: true },
            financing_structure: { structure_type: "existing_contract" },
            issuer_organization_id: "org_1",
          },
          {
            ...approvedContract,
            contract_details: {
              facility_enabled: false,
              facility_disabled_reason: "Paused by ops",
            },
          }
        ),
      "FACILITY_DISABLED"
    );
  });

  it("allows existing-facility drawdowns when facility_enabled is omitted (legacy)", () => {
    expect(() =>
      assertExistingFacilityDrawdown(
        {
          financing_type: { split_origination: true },
          financing_structure: { structure_type: "existing_contract" },
          issuer_organization_id: "org_1",
        },
        { ...approvedContract, contract_details: { approved_facility: 100000 } }
      )
    ).not.toThrow();
  });

  it("rejects submit when a new facility-only application already has invoices", () => {
    expectAppError(
      () =>
        assertApplicationSubmitOrigination({
          application: {
            financing_type: { split_origination: true },
            financing_structure: { structure_type: "new_contract" },
            issuer_organization_id: "org_1",
          },
          invoices: [{ id: "inv_1" }],
          contract: { id: "con_draft", status: "DRAFT", issuer_organization_id: "org_1" },
        }),
      "FACILITY_ONLY_NO_INVOICE"
    );
  });
});
