/**
 * APPLICATION_SUBMITTED_CONFIRMATION notification: fires once a new (non-resubmit)
 * application submission successfully persists, to the issuer org owner/admins.
 */
const mockFindById = jest.fn();
const mockUpdate = jest.fn();
const mockVerifyAccess = jest.fn();
const mockGetIssuerRecipientUserIdsForApplication = jest.fn();
const mockSendTyped = jest.fn().mockResolvedValue({ id: "notif-1" });

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
  NotificationService: jest.fn().mockImplementation(() => ({
    sendTyped: (...args: unknown[]) => mockSendTyped(...args),
    logTypedSystemBatch: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock("../notification/application-recipients", () => ({
  getIssuerRecipientUserIdsForApplication: (...args: unknown[]) =>
    mockGetIssuerRecipientUserIdsForApplication(...args),
}));
jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        invoice: { updateMany: jest.fn() },
        applicationRevision: { create: jest.fn() },
        application: {
          update: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({ display_reference: "APP-1" }),
        },
        applicationLog: { create: jest.fn().mockResolvedValue({ id: "log-1" }) },
      })
    ),
    invoice: { updateMany: jest.fn() },
    applicationRevision: { create: jest.fn() },
    application: { findUnique: jest.fn().mockResolvedValue(null) },
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
jest.mock("../paymaster/service", () => ({
  linkPaymasterForApplicationSubmission: jest.fn().mockResolvedValue(undefined),
}));

import { ApplicationService } from "./service";

describe("ApplicationService.updateApplicationStatus — APPLICATION_SUBMITTED_CONFIRMATION", () => {
  const service = new ApplicationService();

  const draftApplication = {
    id: "app-1",
    status: "DRAFT",
    issuer_organization_id: "org_1",
    financing_type: {},
    financing_structure: {},
    invoices: [],
    contract: null,
    contract_id: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAccess.mockResolvedValue(undefined);
    (service as unknown as { verifyApplicationAccess: jest.Mock }).verifyApplicationAccess =
      mockVerifyAccess;
    (service as unknown as { verifyApplicationEditable: (app: unknown) => void }).verifyApplicationEditable =
      () => undefined;
    mockFindById.mockResolvedValue(draftApplication);
    mockGetIssuerRecipientUserIdsForApplication.mockResolvedValue(["owner-1", "admin-1"]);
  });

  it("sends a confirmation notification to every issuer org owner/admin on successful submit", async () => {
    await service.updateApplicationStatus("app-1", "SUBMITTED", "user-1");

    expect(mockGetIssuerRecipientUserIdsForApplication).toHaveBeenCalledWith("app-1");
    expect(mockSendTyped).toHaveBeenCalledTimes(2);
    expect(mockSendTyped).toHaveBeenCalledWith(
      "owner-1",
      "application_submitted_confirmation",
      expect.objectContaining({ applicationId: "app-1" }),
      expect.stringContaining("app:app-1:notif:application_submitted_confirmation:user:owner-1")
    );
    expect(mockSendTyped).toHaveBeenCalledWith(
      "admin-1",
      "application_submitted_confirmation",
      expect.objectContaining({ applicationId: "app-1" }),
      expect.any(String)
    );
    // Session toast on the submitter's browser is a different channel from this persistent
    // org-admin inbox notification — matching application_resubmitted_confirmation, which
    // also coexists with a client toast. Do not also fire the resubmitted type here.
    expect(mockSendTyped).not.toHaveBeenCalledWith(
      expect.any(String),
      "application_resubmitted_confirmation",
      expect.anything(),
      expect.anything()
    );
  });

  it("writes APPLICATION_SUBMITTED on the same transaction client as the status update", async () => {
    const { prisma } = require("../../lib/prisma") as { prisma: { $transaction: jest.Mock } };
    let tx: { applicationLog: { create: jest.Mock }; application: { update: jest.Mock } };
    prisma.$transaction.mockImplementationOnce(async (fn: (client: unknown) => Promise<unknown>) => {
      tx = {
        invoice: { updateMany: jest.fn() },
        applicationRevision: { create: jest.fn() },
        application: {
          update: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({ display_reference: "APP-1" }),
        },
        applicationLog: { create: jest.fn().mockResolvedValue({ id: "log-1" }) },
      };
      return fn(tx);
    });

    await service.updateApplicationStatus("app-1", "SUBMITTED", "user-1");

    expect(tx!.application.update).toHaveBeenCalled();
    expect(tx!.applicationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: "APPLICATION_SUBMITTED",
          user_id: "user-1",
          application_id: "app-1",
        }),
      })
    );
  });

  it("rolls back submit when the in-transaction timeline insert fails", async () => {
    const { prisma } = require("../../lib/prisma") as { prisma: { $transaction: jest.Mock } };
    prisma.$transaction.mockImplementationOnce(async (fn: (client: unknown) => Promise<unknown>) => {
      const tx = {
        invoice: { updateMany: jest.fn() },
        applicationRevision: { create: jest.fn() },
        application: {
          update: jest.fn(),
          findUnique: jest.fn().mockResolvedValue({ display_reference: "APP-1" }),
        },
        applicationLog: { create: jest.fn().mockRejectedValue(new Error("timeline insert failed")) },
      };
      return fn(tx);
    });

    await expect(service.updateApplicationStatus("app-1", "SUBMITTED", "user-1")).rejects.toThrow(
      "timeline insert failed"
    );
    expect(mockSendTyped).not.toHaveBeenCalled();
  });

  it("does not send the confirmation when the submit transaction fails", async () => {
    const { prisma } = require("../../lib/prisma") as {
      prisma: { $transaction: jest.Mock };
    };
    prisma.$transaction.mockRejectedValueOnce(new Error("db fail"));

    await expect(service.updateApplicationStatus("app-1", "SUBMITTED", "user-1")).rejects.toThrow(
      "db fail"
    );
    expect(mockSendTyped).not.toHaveBeenCalled();
  });

  it("does not block the submit response when the notification send fails", async () => {
    mockSendTyped.mockRejectedValueOnce(new Error("notification service down"));

    const result = await service.updateApplicationStatus("app-1", "SUBMITTED", "user-1");

    expect(result).toBeTruthy();
  });

  it("does not fire the submitted confirmation for a RESUBMITTED transition", async () => {
    const amendmentApp = { ...draftApplication, status: "AMENDMENT_REQUESTED" };
    mockFindById.mockResolvedValue(amendmentApp);
    (service as unknown as { resubmitApplication: jest.Mock }).resubmitApplication = jest
      .fn()
      .mockResolvedValue({ id: "app-1", review_cycle: 2 });

    await service.updateApplicationStatus("app-1", "RESUBMITTED", "user-1");

    expect(mockSendTyped).not.toHaveBeenCalledWith(
      expect.any(String),
      "application_submitted_confirmation",
      expect.anything(),
      expect.anything()
    );
  });
});
