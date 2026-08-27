const runApply = async (_id: string, _db: unknown, mutate: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    invoice: {
      updateMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    contract: {
      findUnique: jest.fn().mockResolvedValue({
        status: "APPROVED",
        contract_details: { financing: 80_000, value: 1_000_000, approved_facility: 100_000 },
      }),
      update: jest.fn(),
    },
    application: {
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn(),
    },
    signingEnvelope: { findMany: jest.fn().mockResolvedValue([]) },
    applicationReview: { upsert: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    applicationReviewItem: { upsert: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([
      {
        status: "OFFER_SENT",
        offer_details: { offered_facility: 80_000, requested_facility: 90_000 },
        contract_details: { financing: 90_000, value: 1_000_000 },
        originating_application_id: "app-1",
      },
    ]),
  };
  return { result: await mutate(tx), snapshot: null };
};
const mockApply = jest.fn(runApply);

const mockFindById = jest.fn();
const mockUpdate = jest.fn();
const mockVerifyAccess = jest.fn();

jest.mock("../../lib/refresh-contract-facility", () => ({
  applyContractCapacityChange: (...args: unknown[]) => mockApply(...args),
  lockContractRow: jest.fn(),
}));

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
  ContractRepository: jest.fn().mockImplementation(() => ({})),
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
    signingEnvelope: { findMany: jest.fn().mockResolvedValue([]) },
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
  logApplicationActivity: jest.fn(),
}));
jest.mock("./amendments/service", () => ({
  getAmendmentAllowedSections: jest.fn(),
  loadAmendmentRemarks: jest.fn(),
  acknowledgeWorkflow: jest.fn(),
  resubmitApplication: jest.fn().mockResolvedValue({ id: "app-1", status: "RESUBMITTED" }),
}));

import { ApplicationService } from "./service";
import { resubmitApplication as amendmentResubmitApplication } from "./amendments/service";
import { prisma } from "../../lib/prisma";
import { upsertLatestOrganizationFinancialStatementsFromApplication } from "./issuer-organization-financial-statements";
import { AppError } from "../../lib/http/error-handler";
import { NotificationTypeIds } from "../notification/registry";

describe("ApplicationService capacity reservations", () => {
  const service = new ApplicationService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockApply.mockImplementation(runApply);
    mockVerifyAccess.mockResolvedValue(undefined);
    (service as unknown as { verifyApplicationAccess: jest.Mock }).verifyApplicationAccess =
      mockVerifyAccess;
    (service as unknown as { verifyApplicationEditable: jest.Mock }).verifyApplicationEditable =
      jest.fn();
  });

  it("submit reserves existing-facility invoices through applyContractCapacityChange", async () => {
    mockFindById.mockResolvedValue({
      id: "app-1",
      status: "DRAFT",
      contract_id: "contract-1",
      issuer_organization_id: "org-1",
      financing_type: { product_id: "prod-1" },
      invoices: [{ id: "inv-1", status: "DRAFT", contract_id: "contract-1" }],
    });

    await service.updateApplicationStatus("app-1", "SUBMITTED", "user-1");

    expect(mockApply).toHaveBeenCalledWith(
      "contract-1",
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ assertWrite: true })
    );
  });

  it("does not persist revision or financial-statement prefill when capacity rejects", async () => {
    mockFindById.mockResolvedValue({
      id: "app-1",
      status: "DRAFT",
      contract_id: "contract-1",
      issuer_organization_id: "org-1",
      financing_type: { product_id: "prod-1" },
      financing_structure: { structure_type: "existing_contract" },
      invoices: [{ id: "inv-1", status: "DRAFT", contract_id: "contract-1" }],
      contract: { id: "contract-1", status: "APPROVED", issuer_organization_id: "org-1" },
    });
    (prisma.application.findUnique as jest.Mock).mockResolvedValue({
      id: "app-1",
      review_cycle: 1,
      financing_type: { product_id: "prod-1" },
      product_version: 1,
      amendment_acknowledged_workflow_ids: [],
      financing_structure: { structure_type: "existing_contract" },
      company_details: {},
      business_details: {},
      application_guarantors: [],
      financial_statements: { questionnaire: {}, unaudited_by_year: {} },
      supporting_documents: {},
      declarations: {},
      review_and_submit: {},
      last_completed_step: 1,
      contract_id: "contract-1",
      contract: { id: "contract-1" },
      invoices: [],
      issuer_organization: { id: "org-1" },
    });
    mockApply.mockRejectedValue(
      new AppError(400, "FACILITY_CAPACITY_EXCEEDED", "Not enough left to draw")
    );

    await expect(
      service.updateApplicationStatus("app-1", "SUBMITTED", "user-1")
    ).rejects.toMatchObject({
      code: "FACILITY_CAPACITY_EXCEEDED",
    });

    expect(prisma.applicationRevision.create).not.toHaveBeenCalled();
    expect(upsertLatestOrganizationFinancialStatementsFromApplication).not.toHaveBeenCalled();
  });

  it("resubmit reservations go through the amendment apply path", async () => {
    mockFindById.mockResolvedValue({
      id: "app-1",
      status: "AMENDMENT_REQUESTED",
      contract_id: "contract-1",
      issuer_organization_id: "org-1",
    });
    (amendmentResubmitApplication as jest.Mock).mockResolvedValue({
      id: "app-1",
      status: "RESUBMITTED",
    });

    await service.resubmitApplication("app-1", "user-1");

    expect(amendmentResubmitApplication).toHaveBeenCalledWith(
      "app-1",
      "user-1",
      expect.anything(),
      undefined
    );
  });

  it("accept and reject facility offers refresh occupancy under the contract lock", async () => {
    mockFindById.mockResolvedValue({
      id: "app-1",
      status: "CONTRACT_SENT",
      contract_id: "contract-1",
      financing_structure: { structure_type: "new_contract" },
    });
    (
      service as unknown as { getProductWorkflowForApplication: jest.Mock }
    ).getProductWorkflowForApplication = jest.fn().mockResolvedValue([]);
    (service as unknown as { sendIssuerNotification: jest.Mock }).sendIssuerNotification =
      jest.fn();

    await service.respondToContractOffer("app-1", "accept", "user-1");
    expect(mockApply).toHaveBeenCalledWith(
      "contract-1",
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ assertWrite: true })
    );

    mockApply.mockClear();
    await service.respondToContractOffer("app-1", "reject", "user-1", "too expensive");
    expect(mockApply).toHaveBeenCalledWith(
      "contract-1",
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ assertWrite: true })
    );
  });

  it("stamps facility_fee_upfront_amount from the offer on accept", async () => {
    mockFindById.mockResolvedValue({
      id: "app-1",
      status: "CONTRACT_SENT",
      contract_id: "contract-1",
      financing_structure: { structure_type: "new_contract" },
    });
    (
      service as unknown as { getProductWorkflowForApplication: jest.Mock }
    ).getProductWorkflowForApplication = jest.fn().mockResolvedValue([]);

    const contractUpdate = jest.fn();
    mockApply.mockImplementationOnce(async (_id, _db, mutate) => {
      const tx = {
        invoice: {
          updateMany: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn(),
        },
        contract: {
          findUnique: jest.fn().mockResolvedValue({
            status: "APPROVED",
            contract_details: { financing: 80_000, value: 1_000_000, approved_facility: 80_000 },
          }),
          update: contractUpdate,
        },
        application: {
          update: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUnique: jest.fn(),
        },
        signingEnvelope: { findMany: jest.fn().mockResolvedValue([]) },
        applicationReview: { upsert: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
        applicationReviewItem: { upsert: jest.fn() },
        $queryRaw: jest.fn().mockResolvedValue([
          {
            status: "OFFER_SENT",
            offer_details: {
              offered_facility: 80_000,
              requested_facility: 90_000,
              facility_fee_rate_percent: 1,
              facility_fee_upfront_collect_amount: 400,
            },
            contract_details: { financing: 90_000, value: 1_000_000 },
            originating_application_id: "app-1",
          },
        ]),
      };
      return { result: await mutate(tx), snapshot: null };
    });

    const sendIssuerNotification = jest.fn();
    (service as unknown as { sendIssuerNotification: jest.Mock }).sendIssuerNotification =
      sendIssuerNotification;

    await service.respondToContractOffer("app-1", "accept", "user-1");
    expect(sendIssuerNotification).toHaveBeenCalledWith(
      "app-1",
      NotificationTypeIds.FACILITY_FEE_PAYMENT_REQUESTED,
      expect.objectContaining({
        applicationId: "app-1",
        contractId: "contract-1",
        upfrontAmount: 400,
      }),
      "facility-fee-payment:contract-1"
    );
    expect(contractUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contract_details: expect.objectContaining({
            facility_fee_upfront_amount: 400,
            facility_fee_total_amount: 800,
            facility_fee_paid_amount: 0,
          }),
        }),
      })
    );
  });

  it("accept and reject invoice offers refresh occupancy when the invoice is facility-tied", async () => {
    mockFindById.mockResolvedValue({
      id: "app-1",
      status: "INVOICES_SENT",
      contract_id: "contract-1",
      invoices: [{ id: "inv-1", details: { number: "INV-1" } }],
      financing_structure: { structure_type: "existing_contract" },
    });
    (
      service as unknown as { resolveInvoiceReviewItemKeyById: jest.Mock }
    ).resolveInvoiceReviewItemKeyById = jest.fn().mockResolvedValue("invoice_details:0:INV-1");
    (
      service as unknown as { getProductWorkflowForApplication: jest.Mock }
    ).getProductWorkflowForApplication = jest.fn().mockResolvedValue([]);
    (service as unknown as { sendIssuerNotification: jest.Mock }).sendIssuerNotification =
      jest.fn();
    mockApply.mockImplementation(async () => ({
      result: {
        now: new Date().toISOString(),
        offeredAmount: 40_000,
        requestedAmount: 50_000,
        sectionApproved: true,
        appStatus: "INVOICES_SENT",
      },
      snapshot: null,
    }));

    await service.respondToInvoiceOffer("app-1", "inv-1", "accept", "user-1");
    expect(mockApply).toHaveBeenCalledWith(
      "contract-1",
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({
        assertWrite: true,
        audit: expect.objectContaining({ reason: "INVOICE_ACCEPTED" }),
      })
    );

    mockApply.mockClear();
    await service.respondToInvoiceOffer("app-1", "inv-1", "reject", "user-1");
    expect(mockApply).toHaveBeenCalledWith(
      "contract-1",
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ assertWrite: true })
    );
  });

  it("rejects accepting a facility-linked invoice offer while upfront is outstanding", async () => {
    mockFindById.mockResolvedValue({
      id: "app-1",
      status: "INVOICES_SENT",
      contract_id: "contract-1",
      invoices: [{ id: "inv-1", contract_id: "contract-1", details: { number: "INV-1" } }],
      financing_structure: { structure_type: "existing_contract" },
    });
    (
      service as unknown as { resolveInvoiceReviewItemKeyById: jest.Mock }
    ).resolveInvoiceReviewItemKeyById = jest.fn().mockResolvedValue("invoice_details:0:INV-1");
    (
      service as unknown as { getProductWorkflowForApplication: jest.Mock }
    ).getProductWorkflowForApplication = jest.fn().mockResolvedValue([]);
    (
      service as unknown as { assertPhasedOfferDirectAcceptBlocked: jest.Mock }
    ).assertPhasedOfferDirectAcceptBlocked = jest.fn();
    mockApply.mockImplementation(async (_id, _db, mutate: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([
          {
            status: "OFFER_SENT",
            offer_details: { offered_amount: 40_000, requested_amount: 50_000 },
            contract_id: "contract-1",
          },
        ]),
        contract: {
          findUnique: jest.fn().mockResolvedValue({
            contract_details: {
              facility_fee_total_amount: 1_500,
              facility_fee_upfront_amount: 400,
              facility_fee_paid_amount: 0,
            },
          }),
        },
        invoice: { findMany: jest.fn(), update: jest.fn(), count: jest.fn() },
        application: { update: jest.fn() },
        applicationReview: { upsert: jest.fn() },
        applicationReviewItem: { upsert: jest.fn() },
      };
      return { result: await mutate(tx), snapshot: null };
    });

    await expect(
      service.respondToInvoiceOffer("app-1", "inv-1", "accept", "user-1")
    ).rejects.toMatchObject({
      code: "FACILITY_FEE_UPFRONT_REQUIRED",
      statusCode: 409,
    } satisfies Partial<AppError>);
  });

  it("requires OTP only for contract-linked direct accept", async () => {
    mockFindById.mockResolvedValue({
      id: "app-1",
      status: "INVOICES_SENT",
      contract_id: "contract-1",
      invoices: [{ id: "inv-1", contract_id: "contract-1", details: { number: "INV-1" } }],
      financing_structure: { structure_type: "existing_contract" },
    });
    (
      service as unknown as { resolveInvoiceReviewItemKeyById: jest.Mock }
    ).resolveInvoiceReviewItemKeyById = jest.fn().mockResolvedValue("invoice_details:0:INV-1");
    (
      service as unknown as { getProductWorkflowForApplication: jest.Mock }
    ).getProductWorkflowForApplication = jest.fn().mockResolvedValue([]);
    (
      service as unknown as { assertPhasedOfferDirectAcceptBlocked: jest.Mock }
    ).assertPhasedOfferDirectAcceptBlocked = jest.fn();
    (service as unknown as { sendIssuerNotification: jest.Mock }).sendIssuerNotification =
      jest.fn();
    mockApply.mockImplementation(async (_id, _db, mutate: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([
          {
            status: "OFFER_SENT",
            offer_details: { offered_amount: 40_000, requested_amount: 50_000 },
            contract_id: "contract-1",
          },
        ]),
        contract: {
          findUnique: jest.fn().mockResolvedValue({
            contract_details: {
              facility_enabled: true,
              facility_fee_total_amount: 1_500,
              facility_fee_upfront_amount: 400,
              facility_fee_paid_amount: 400,
            },
          }),
        },
        invoice: {
          findMany: jest.fn().mockResolvedValue([{ status: "WITHDRAWN" }]),
          update: jest.fn(),
          count: jest.fn().mockResolvedValue(1),
        },
        application: { update: jest.fn() },
        applicationReview: { upsert: jest.fn() },
        applicationReviewItem: { upsert: jest.fn() },
      };
      return { result: await mutate(tx), snapshot: null };
    });

    await expect(
      service.respondToInvoiceOffer("app-1", "inv-1", "accept", "user-1")
    ).rejects.toMatchObject({ code: "OTP_REQUIRED" });

    await expect(
      service.respondToInvoiceOffer("app-1", "inv-1", "reject", "user-1")
    ).resolves.toBeDefined();
  });

  it("allows accepting a facility-linked invoice offer after a facility fee waiver", async () => {
    mockFindById.mockResolvedValue({
      id: "app-1",
      status: "INVOICES_SENT",
      contract_id: "contract-1",
      invoices: [{ id: "inv-1", contract_id: "contract-1", details: { number: "INV-1" } }],
      financing_structure: { structure_type: "existing_contract" },
    });
    (
      service as unknown as { resolveInvoiceReviewItemKeyById: jest.Mock }
    ).resolveInvoiceReviewItemKeyById = jest.fn().mockResolvedValue("invoice_details:0:INV-1");
    (
      service as unknown as { getProductWorkflowForApplication: jest.Mock }
    ).getProductWorkflowForApplication = jest.fn().mockResolvedValue([]);
    (
      service as unknown as { assertPhasedOfferDirectAcceptBlocked: jest.Mock }
    ).assertPhasedOfferDirectAcceptBlocked = jest.fn();
    mockApply.mockImplementation(async (_id, _db, mutate: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        $queryRaw: jest.fn().mockResolvedValue([
          {
            status: "OFFER_SENT",
            offer_details: {
              offered_amount: 40_000,
              requested_amount: 50_000,
              fee_schedule_version: 1,
              facility_fee_collect_amount: 0,
              additional_fees: [],
            },
            contract_id: "contract-1",
          },
        ]),
        contract: {
          findUnique: jest.fn().mockResolvedValue({
            contract_details: {
              facility_enabled: true,
              facility_fee_total_amount: 1_500,
              facility_fee_upfront_amount: 400,
              facility_fee_paid_amount: 0,
              facility_fee_waived: true,
            },
          }),
        },
        invoice: {
          findMany: jest.fn().mockResolvedValue([{ status: "APPROVED" }]),
          update: jest.fn(),
          count: jest.fn().mockResolvedValue(1),
        },
        application: { update: jest.fn() },
        applicationReview: { upsert: jest.fn() },
        applicationReviewItem: { upsert: jest.fn() },
      };
      return { result: await mutate(tx), snapshot: null };
    });

    try {
      await service.respondToInvoiceOffer("app-1", "inv-1", "accept", "user-1", undefined, {
        signingCompletion: { signedOfferLetterS3Key: "s3", signedFileSha256: "abc" },
      });
    } catch (error) {
      expect((error as AppError).code).not.toBe("FACILITY_FEE_UPFRONT_REQUIRED");
    }
  });

  it("withdraw releases reserved occupancy under the contract lock", async () => {
    mockFindById.mockResolvedValue({
      id: "app-1",
      status: "SUBMITTED",
      contract_id: "contract-1",
      contract: { id: "contract-1", status: "SUBMITTED", offer_details: null },
      invoices: [{ id: "inv-1", status: "SUBMITTED", offer_details: null }],
      financing_structure: { structure_type: "existing_contract" },
    });
    (service as unknown as { sendIssuerNotification: jest.Mock }).sendIssuerNotification =
      jest.fn();
    mockApply.mockImplementation(async () => ({ result: undefined, snapshot: null }));

    await service.cancelApplication("app-1", "user-1");
    expect(mockApply).toHaveBeenCalledWith(
      "contract-1",
      expect.anything(),
      expect.any(Function),
      expect.objectContaining({ assertWrite: true })
    );
  });
});
