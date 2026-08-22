import * as fs from "fs";
import * as path from "path";

const mockApply = jest.fn(async () => ({
  result: {
    invoiceNumber: "INV-1",
    requestedAmount: 50_000,
    previousVersion: 0,
    platformFeeStored: 0,
    acceptanceExpiresAt: null,
  },
  snapshot: null,
}));

jest.mock("../../lib/refresh-contract-facility", () => ({
  applyContractCapacityChange: (...args: unknown[]) => mockApply(...args),
}));

jest.mock("./repository", () => ({
  AdminRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../regtank/repository", () => ({
  RegTankRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../regtank/api-client", () => ({
  RegTankAPIClient: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../regtank/service", () => ({
  RegTankService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../organization/repository", () => ({
  OrganizationRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../products/repository", () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
}));
jest.mock("../../lib/http/request-utils", () => ({
  extractRequestMetadata: () => ({
    ipAddress: "127.0.0.1",
    userAgent: "jest",
    deviceInfo: "test",
    deviceType: "desktop",
  }),
}));
jest.mock("../../lib/prisma", () => ({
  prisma: {
    invoice: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock("../applications/audit/writer", () => ({
  APPLICATION_AUDIT_TARGET_TYPE: {
    APPLICATION: "APPLICATION",
    CONTRACT: "CONTRACT",
    INVOICE: "INVOICE",
  },
  adminApplicationAuditContext: (userId: string) => ({ actorUserId: userId }),
  writeApplicationAuditLog: jest.fn(),
}));

import { AdminService } from "./service";
import { prisma } from "../../lib/prisma";
import { ApplicationStatus } from "@prisma/client";

describe("AdminService capacity offer paths", () => {
  const service = new AdminService();
  const repository = {
    getApplicationById: jest.fn().mockResolvedValue({ id: "app-1" }),
    resetItemReviewToPending: jest.fn(),
    resetSectionReviewToPending: jest.fn(),
    removeDraftAmendment: jest.fn(),
    updateApplicationStatus: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (service as unknown as { sendIssuerNotification: jest.Mock }).sendIssuerNotification =
      jest.fn();
    (
      service as unknown as { syncInvoiceDetailsSectionFromItems: jest.Mock }
    ).syncInvoiceDetailsSectionFromItems = jest.fn();
    (service as unknown as { logReviewActivity: jest.Mock }).logReviewActivity = jest.fn();
    (service as unknown as { clearItemDraftAmendments: jest.Mock }).clearItemDraftAmendments =
      jest.fn();
    (service as unknown as { clearItemRemarks: jest.Mock }).clearItemRemarks = jest.fn();
  });

  it("send and resend invoice offers hard-block over-limit writes under the lock", async () => {
    const application = {
      id: "app-1",
      status: ApplicationStatus.INVOICE_PENDING,
      contract_id: "contract-1",
      invoices: [
        { id: "inv-1", details: { number: "INV-1", value: 80_000, financing_ratio_percent: 70 } },
      ],
    };
    (service as unknown as { prepareForReviewAction: jest.Mock }).prepareForReviewAction = jest
      .fn()
      .mockResolvedValue({ repository, application });
    (service as unknown as { ensureUnderReview: jest.Mock }).ensureUnderReview = jest.fn();
    (service as unknown as { resolveInvoiceScopeKeyById: jest.Mock }).resolveInvoiceScopeKeyById =
      jest.fn().mockReturnValue("invoice_details:0:INV-1");
    (
      service as unknown as { ensureInvoiceOfferItemActionAllowed: jest.Mock }
    ).ensureInvoiceOfferItemActionAllowed = jest.fn();
    (
      service as unknown as { assertNoActiveSigningPackage: jest.Mock }
    ).assertNoActiveSigningPackage = jest.fn();
    (
      service as unknown as { loadApplicationProductWorkflow: jest.Mock }
    ).loadApplicationProductWorkflow = jest.fn().mockResolvedValue([]);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      status: "OFFER_EXPIRED",
      contract_id: "contract-1",
    });

    await service.sendInvoiceOffer("app-1", "inv-1", 40_000, 70, 12, 0, "A", "admin-1");

    expect(mockApply).toHaveBeenCalledWith(
      "contract-1",
      prisma,
      expect.any(Function),
      expect.objectContaining({ assertWrite: true })
    );
  });

  it("retracting an invoice offer recomputes occupancy through apply", async () => {
    const application = {
      id: "app-1",
      status: ApplicationStatus.INVOICES_SENT,
      contract_id: "contract-1",
      invoices: [{ id: "inv-1", details: { number: "INV-1" } }],
      application_review_items: [
        { item_type: "invoice", item_id: "invoice_details:0:INV-1", status: "OFFER_SENT" },
      ],
    };
    (service as unknown as { prepareForReviewAction: jest.Mock }).prepareForReviewAction = jest
      .fn()
      .mockResolvedValue({ repository, application });
    (service as unknown as { validateReviewItemExists: jest.Mock }).validateReviewItemExists =
      jest.fn();
    (service as unknown as { ensureUnderReview: jest.Mock }).ensureUnderReview = jest.fn();
    (
      service as unknown as { ensureInvoiceOfferItemActionAllowed: jest.Mock }
    ).ensureInvoiceOfferItemActionAllowed = jest.fn();
    (
      service as unknown as { assertNoActiveSigningPackage: jest.Mock }
    ).assertNoActiveSigningPackage = jest.fn();
    (
      service as unknown as { resolveInvoiceIdFromScopeKey: jest.Mock }
    ).resolveInvoiceIdFromScopeKey = jest.fn().mockReturnValue("inv-1");
    (service as unknown as { getInvoiceReference: jest.Mock }).getInvoiceReference = jest
      .fn()
      .mockReturnValue({
        invoiceId: "inv-1",
        invoiceNumber: "INV-1",
      });

    await service.resetItemReviewToPending(
      "app-1",
      "invoice",
      "invoice_details:0:INV-1",
      "admin-1"
    );

    expect(mockApply).toHaveBeenCalledWith(
      "contract-1",
      prisma,
      expect.any(Function),
      expect.objectContaining({ assertWrite: false })
    );
  });

  it("retracting a facility offer recomputes occupancy through apply", async () => {
    const application = {
      id: "app-1",
      status: ApplicationStatus.CONTRACT_SENT,
      contract_id: "contract-1",
      financing_structure: { structure_type: "new_contract" },
      invoices: [],
      application_reviews: [{ section: "contract_details", status: "OFFER_SENT" }],
    };
    (service as unknown as { prepareForReviewAction: jest.Mock }).prepareForReviewAction = jest
      .fn()
      .mockResolvedValue({ repository, application });
    (service as unknown as { ensureUnderReview: jest.Mock }).ensureUnderReview = jest.fn();
    (
      service as unknown as { assertNoActiveSigningPackage: jest.Mock }
    ).assertNoActiveSigningPackage = jest.fn();
    (
      service as unknown as { ensureContractOfferActionAllowed: jest.Mock }
    ).ensureContractOfferActionAllowed = jest.fn();
    (
      service as unknown as { assertResetReviewToPendingAllowed: jest.Mock }
    ).assertResetReviewToPendingAllowed = jest.fn();
    (service as unknown as { getContractReference: jest.Mock }).getContractReference = jest
      .fn()
      .mockReturnValue({
        contractId: "contract-1",
        contractNumber: "FAC-1",
      });

    await service.resetSectionReviewToPending("app-1", "contract_details", "admin-1");

    expect(mockApply).toHaveBeenCalledWith("contract-1", prisma, expect.any(Function));
  });

  it("caps sendInvoiceOffer against canonical requested financing, not face times ratio", () => {
    const source = fs.readFileSync(path.join(__dirname, "service.ts"), "utf8");
    expect(source).toContain("resolveRequestedInvoiceFinancing");
    expect(source).not.toContain(
      "const requestedAmount = (invoiceValue * requestedRatioPercent) / 100"
    );
  });
});
