const mockFindById = jest.fn();
const mockUpdate = jest.fn();
const mockVerifyAccess = jest.fn();
const mockFindContractById = jest.fn();

jest.mock("./repository", () => ({
  ApplicationRepository: jest.fn().mockImplementation(() => ({
    findById: (...args: unknown[]) => mockFindById(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  })),
}));
jest.mock("../products/repository", () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({ findById: jest.fn() })),
}));
jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../contracts/repository", () => ({
  ContractRepository: jest.fn().mockImplementation(() => ({
    findById: (...args: unknown[]) => mockFindContractById(...args),
  })),
}));
jest.mock("../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    invoice: { updateMany: jest.fn() },
    applicationRevision: { create: jest.fn() },
    application: { findUnique: jest.fn() },
    product: { findUnique: jest.fn() },
  },
}));
jest.mock("../legal-documents/acceptance-service", () => ({
  legalDocumentAcceptanceService: { assertNoPendingReacceptance: jest.fn() },
}));
jest.mock("../payment/processing-fee-service", () => ({
  assertApplicationProcessingFeePaid: jest.fn(),
}));
jest.mock("./supporting-docs-workflow", () => ({
  assertRequiredSupportingDocumentsPresent: jest.fn(),
}));
jest.mock("./issuer-organization-financial-statements", () => ({
  upsertLatestOrganizationFinancialStatementsFromApplication: jest.fn(),
}));
jest.mock("./director-shareholder-onboarding-guard", () => ({
  assertIssuerOrgDirectorShareholderOnboardingReady: jest.fn(),
}));
jest.mock("./logs/service", () => ({
  logApplicationActivity: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../paymaster/service", () => ({
  linkPaymasterForApplicationSubmission: jest.fn().mockResolvedValue(undefined),
}));

import { ApplicationService } from "./service";
import { AppError } from "../../lib/http/error-handler";

describe("ApplicationService split origination submit", () => {
  const service = new ApplicationService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAccess.mockResolvedValue(undefined);
    (service as unknown as { verifyApplicationAccess: jest.Mock }).verifyApplicationAccess =
      mockVerifyAccess;
    (service as unknown as { verifyApplicationEditable: (app: unknown) => void }).verifyApplicationEditable =
      () => undefined;
  });

  it("rejects submit of a new facility-only application that already has invoices", async () => {
    mockFindById.mockResolvedValue({
      id: "app-1",
      status: "DRAFT",
      issuer_organization_id: "org_1",
      financing_type: { split_origination: true },
      financing_structure: { structure_type: "new_contract" },
      invoices: [{ id: "inv-1" }],
      contract: { id: "con-1", status: "DRAFT", issuer_organization_id: "org_1" },
    });

    await expect(service.updateApplicationStatus("app-1", "SUBMITTED", "user-1")).rejects.toMatchObject({
      code: "FACILITY_ONLY_NO_INVOICE",
      statusCode: 400,
    } satisfies Partial<AppError>);
  });

  it("does not apply the facility-only invoice guard to grandfathered combined apps", async () => {
    mockFindById.mockResolvedValue({
      id: "app-legacy",
      status: "DRAFT",
      issuer_organization_id: "org_1",
      financing_type: { product_id: "prod_1" },
      financing_structure: { structure_type: "new_contract" },
      last_completed_step: 8,
      invoices: [{ id: "inv-1", status: "DRAFT" }],
      contract: { id: "con-1", status: "DRAFT", issuer_organization_id: "org_1" },
      contract_id: "con-1",
    });

    try {
      await service.updateApplicationStatus("app-legacy", "SUBMITTED", "user-1");
    } catch (error) {
      expect((error as AppError).code).not.toBe("FACILITY_ONLY_NO_INVOICE");
    }
  });

  it("rejects existing-facility submit without an approved owned facility", async () => {
    mockFindById.mockResolvedValue({
      id: "app-draw",
      status: "DRAFT",
      issuer_organization_id: "org_1",
      financing_type: { split_origination: true },
      financing_structure: { structure_type: "existing_contract" },
      invoices: [{ id: "inv-1" }],
      contract: { id: "con-1", status: "SUBMITTED", issuer_organization_id: "org_1" },
    });

    await expect(service.updateApplicationStatus("app-draw", "SUBMITTED", "user-1")).rejects.toMatchObject({
      code: "INVALID_CONTRACT_STATUS",
    });
  });

  it("rejects starting an existing-facility application while upfront is outstanding", async () => {
    mockFindById.mockResolvedValue({
      id: "app-start",
      status: "DRAFT",
      issuer_organization_id: "org_1",
      last_completed_step: 1,
      financing_type: { split_origination: true },
      financing_structure: { structure_type: "new_contract" },
    });
    mockFindContractById.mockResolvedValue({
      id: "con-1",
      status: "APPROVED",
      issuer_organization_id: "org_1",
      contract_details: {
        facility_fee_total_amount: 1_500,
        facility_fee_upfront_amount: 400,
        facility_fee_paid_amount: 0,
      },
    });
    (service as unknown as { verifyApplicationStepEditable: jest.Mock }).verifyApplicationStepEditable =
      jest.fn();
    (service as unknown as { resetFinancingStructureBranchData: jest.Mock }).resetFinancingStructureBranchData =
      jest.fn();

    await expect(
      service.updateStep(
        "app-start",
        {
          stepNumber: 2,
          stepId: "financing_structure",
          data: { structure_type: "existing_contract", existing_contract_id: "con-1" },
        },
        "user-1"
      )
    ).rejects.toMatchObject({
      code: "FACILITY_FEE_UPFRONT_REQUIRED",
      statusCode: 409,
    } satisfies Partial<AppError>);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejects existing-facility submit while upfront is outstanding", async () => {
    mockFindById.mockResolvedValue({
      id: "app-draw",
      status: "DRAFT",
      issuer_organization_id: "org_1",
      financing_type: { split_origination: true },
      financing_structure: { structure_type: "existing_contract" },
      invoices: [{ id: "inv-1" }],
      contract: {
        id: "con-1",
        status: "APPROVED",
        issuer_organization_id: "org_1",
        contract_details: {
          facility_fee_total_amount: 1_500,
          facility_fee_upfront_amount: 400,
          facility_fee_paid_amount: 50,
        },
      },
    });

    await expect(service.updateApplicationStatus("app-draw", "SUBMITTED", "user-1")).rejects.toMatchObject({
      code: "FACILITY_FEE_UPFRONT_REQUIRED",
      statusCode: 409,
    } satisfies Partial<AppError>);
  });

  it("allows existing-facility submit after a facility fee waiver", async () => {
    mockFindById.mockResolvedValue({
      id: "app-draw",
      status: "DRAFT",
      issuer_organization_id: "org_1",
      financing_type: { split_origination: true },
      financing_structure: { structure_type: "existing_contract" },
      last_completed_step: 8,
      invoices: [{ id: "inv-1" }],
      contract: {
        id: "con-1",
        status: "APPROVED",
        issuer_organization_id: "org_1",
        contract_details: {
          facility_fee_total_amount: 1_500,
          facility_fee_upfront_amount: 400,
          facility_fee_paid_amount: 0,
          facility_fee_waived: true,
        },
      },
    });

    try {
      await service.updateApplicationStatus("app-draw", "SUBMITTED", "user-1");
    } catch (error) {
      expect((error as AppError).code).not.toBe("FACILITY_FEE_UPFRONT_REQUIRED");
    }
  });
});
