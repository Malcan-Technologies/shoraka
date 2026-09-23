import { PRODUCT_LIMIT_VIOLATION_CODE } from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { assertProductRulesForSubmit } from "./product-rules-on-submit";

const workflow = [
  {
    id: "invoice_details",
    config: {
      max_invoice_value: 5_000,
      min_financing_ratio_percent: 60,
      max_financing_ratio_percent: 80,
    },
  },
];

const overMax = {
  status: "DRAFT",
  contract_id: null,
  details: { value: 10_000, applied_financing: 7_000, financing_ratio_percent: 70 },
};

function expectMaxFinancingViolation(run: () => void) {
  try {
    run();
    throw new Error("expected PRODUCT_LIMIT_VIOLATION");
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(PRODUCT_LIMIT_VIOLATION_CODE);
    expect((error as AppError).details).toMatchObject({ rule: "FINANCING_ABOVE_MAX" });
  }
}

describe("assertProductRulesForSubmit facility detection", () => {
  it("applies max financing whether or not the invoice sits on a facility", () => {
    expectMaxFinancingViolation(() =>
      assertProductRulesForSubmit(workflow, {
        invoices: [overMax],
        applicationContractId: "contract-1",
        structureType: "existing_contract",
      })
    );
    expectMaxFinancingViolation(() =>
      assertProductRulesForSubmit(workflow, {
        invoices: [{ ...overMax, contract_id: "contract-1" }],
        applicationContractId: null,
        structureType: "new_contract",
        contract: { status: "APPROVED" },
      })
    );
    expectMaxFinancingViolation(() =>
      assertProductRulesForSubmit(workflow, {
        invoices: [{ ...overMax, contract_id: "contract-1" }],
        applicationContractId: "contract-1",
        structureType: "invoice_only",
      })
    );
  });

  it("re-checks contract dates only when the facility section is open", () => {
    const contractWorkflow = [{ id: "contract_details", config: { min_contract_months: 12 } }];
    const shortContract = {
      status: "SUBMITTED",
      contract_details: { start_date: "2026-01-01", end_date: "2026-03-01" },
    };
    expect(() =>
      assertProductRulesForSubmit(contractWorkflow, {
        contract: shortContract,
        structureType: "new_contract",
      })
    ).toThrow(AppError);
    expect(() =>
      assertProductRulesForSubmit(contractWorkflow, {
        contract: shortContract,
        structureType: "new_contract",
        checkContract: false,
      })
    ).not.toThrow();
  });

  it("skips locked invoices regardless of facility linkage", () => {
    expect(() =>
      assertProductRulesForSubmit(workflow, {
        invoices: [{ ...overMax, status: "OFFER_SENT" }],
        applicationContractId: "contract-1",
        structureType: "existing_contract",
      })
    ).not.toThrow();
  });
});
