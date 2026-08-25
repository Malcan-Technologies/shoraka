/**
 * CONTRACT_SIGNING_DEADLINE_EXTENDED / INVOICE_SIGNING_DEADLINE_EXTENDED notifications:
 * fire once the signing deadline extension successfully persists, to the issuer org
 * owner/admins, carrying the new deadline (and invoice number where applicable).
 */
import { withOfferAcceptance } from "@cashsouk/types";

jest.mock("@cashsouk/types", () => ({
  ...jest.requireActual("@cashsouk/types"),
  workflowUsesOfferAcceptanceFlow: jest.fn().mockReturnValue(true),
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
jest.mock("../applications/logs/service", () => ({
  logApplicationActivity: jest.fn(),
}));
jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

import { AdminService } from "./service";
import { prisma } from "../../lib/prisma";

const PAST_DEADLINE = "2020-01-01T00:00:00.000Z";

function offerDetailsApprovedForSigning() {
  return withOfferAcceptance(
    {},
    { status: "APPROVED_FOR_SIGNING", signing_expires_at: PAST_DEADLINE }
  );
}

describe("AdminService — signing deadline extended notifications", () => {
  const service = new AdminService();

  beforeEach(() => {
    jest.clearAllMocks();
    (service as unknown as { sendIssuerNotification: jest.Mock }).sendIssuerNotification = jest
      .fn()
      .mockResolvedValue(undefined);
    (
      service as unknown as { loadApplicationProductWorkflow: jest.Mock }
    ).loadApplicationProductWorkflow = jest.fn().mockResolvedValue([]);
    (service as unknown as { getContractDetail: jest.Mock }).getContractDetail = jest
      .fn()
      .mockResolvedValue({ id: "contract-1" });
    (service as unknown as { ensureContractOfferActionAllowed: jest.Mock }).ensureContractOfferActionAllowed =
      jest.fn();
  });

  describe("extendContractSigningDeadline", () => {
    beforeEach(() => {
      (service as unknown as { prepareForReviewAction: jest.Mock }).prepareForReviewAction = jest
        .fn()
        .mockResolvedValue({
          repository: { getApplicationById: jest.fn().mockResolvedValue({ id: "app-1" }) },
          application: { id: "app-1", contract_id: "contract-1" },
        });
    });

    it("sends the deadline-extended notification with the new deadline after a successful extend", async () => {
      const tx = {
        contract: {
          findUnique: jest.fn().mockResolvedValue({
            id: "contract-1",
            status: "OFFER_SENT",
            offer_details: offerDetailsApprovedForSigning(),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        applicationReview: { upsert: jest.fn() },
        application: { update: jest.fn() },
      };
      (prisma.$transaction as jest.Mock).mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
        fn(tx)
      );

      await service.extendContractSigningDeadline("app-1", "admin-1");

      const notify = (service as unknown as { sendIssuerNotification: jest.Mock }).sendIssuerNotification;
      expect(notify).toHaveBeenCalledTimes(1);
      const [applicationId, typeId, payload] = notify.mock.calls[0];
      expect(applicationId).toBe("app-1");
      expect(typeId).toBe("contract_signing_deadline_extended");
      expect(payload).toMatchObject({ applicationId: "app-1" });
      expect(typeof payload.deadline).toBe("string");
      expect(payload.deadline).not.toBe(PAST_DEADLINE);
    });

    it("does not send when the extend transaction fails", async () => {
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error("db fail"));

      await expect(service.extendContractSigningDeadline("app-1", "admin-1")).rejects.toThrow(
        "db fail"
      );
      expect(
        (service as unknown as { sendIssuerNotification: jest.Mock }).sendIssuerNotification
      ).not.toHaveBeenCalled();
    });

    it("does not throw or block the response when the notification send fails", async () => {
      const tx = {
        contract: {
          findUnique: jest.fn().mockResolvedValue({
            id: "contract-1",
            status: "OFFER_SENT",
            offer_details: offerDetailsApprovedForSigning(),
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        applicationReview: { upsert: jest.fn() },
        application: { update: jest.fn() },
      };
      (prisma.$transaction as jest.Mock).mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
        fn(tx)
      );
      (service as unknown as { sendIssuerNotification: jest.Mock }).sendIssuerNotification = jest
        .fn()
        .mockRejectedValue(new Error("down"));

      await expect(service.extendContractSigningDeadline("app-1", "admin-1")).resolves.toBeTruthy();
    });
  });

  describe("extendInvoiceSigningDeadline", () => {
    beforeEach(() => {
      (service as unknown as { prepareForReviewAction: jest.Mock }).prepareForReviewAction = jest
        .fn()
        .mockResolvedValue({
          repository: { getApplicationById: jest.fn().mockResolvedValue({ id: "app-1" }) },
          application: {
            id: "app-1",
            invoices: [{ id: "inv-1", details: { number: "INV-42" } }],
          },
        });
    });

    it("sends the deadline-extended notification with the invoice number after a successful extend", async () => {
      const tx = {
        invoice: {
          findUnique: jest.fn().mockResolvedValue({
            id: "inv-1",
            status: "OFFER_SENT",
            offer_details: offerDetailsApprovedForSigning(),
            contract_id: null,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        applicationReviewItem: { updateMany: jest.fn() },
        application: { update: jest.fn() },
      };
      (prisma.$transaction as jest.Mock).mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
        fn(tx)
      );

      await service.extendInvoiceSigningDeadline("app-1", "inv-1", "admin-1");

      const notify = (service as unknown as { sendIssuerNotification: jest.Mock }).sendIssuerNotification;
      expect(notify).toHaveBeenCalledTimes(1);
      const [applicationId, typeId, payload] = notify.mock.calls[0];
      expect(applicationId).toBe("app-1");
      expect(typeId).toBe("invoice_signing_deadline_extended");
      expect(payload).toMatchObject({ applicationId: "app-1", invoiceNumber: "INV-42" });
    });
  });
});
