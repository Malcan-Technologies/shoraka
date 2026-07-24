/**
 * Unit tests for durable OFFER_EXPIRED transition (mocked Prisma).
 */

jest.mock("../prisma", () => ({
  prisma: {
    user: { upsert: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    contract: { findUnique: jest.fn(), update: jest.fn() },
    invoice: { findUnique: jest.fn(), update: jest.fn() },
  },
}));

jest.mock("../../modules/applications/logs/service", () => ({
  logApplicationActivity: jest.fn(),
}));

jest.mock("../../modules/notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendTyped: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("../../modules/notification/application-recipients", () => ({
  getIssuerRecipientUserIdsForApplication: jest.fn().mockResolvedValue(["issuer-1"]),
}));

jest.mock("../../modules/products/repository", () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({
    findByBaseAndVersion: jest.fn().mockResolvedValue({ workflow: [] }),
    findById: jest.fn().mockResolvedValue({ workflow: [] }),
  })),
}));

import { prisma } from "../prisma";
import { logApplicationActivity } from "../../modules/applications/logs/service";
import { runAcceptanceSigningExpiryJob } from "./acceptance-signing-expiry";

const pastIso = "2020-01-01T00:00:00.000Z";
const offerDetails = {
  offered_facility: 100000,
  version: 1,
  offer_acceptance: {
    status: "PENDING_ISSUER",
    acceptance_expires_at: pastIso,
  },
};

type TxSpies = {
  contract: { update: jest.Mock };
  applicationReview: { upsert: jest.Mock };
  application: { update: jest.Mock };
  signingEnvelope: { findMany: jest.Mock; updateMany: jest.Mock };
  invoice: { update: jest.Mock };
  applicationReviewItem: { updateMany: jest.Mock };
};

function createTxSpies(): TxSpies {
  return {
    contract: { update: jest.fn().mockResolvedValue({}) },
    applicationReview: { upsert: jest.fn().mockResolvedValue({}) },
    application: { update: jest.fn().mockResolvedValue({}) },
    signingEnvelope: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    invoice: { update: jest.fn().mockResolvedValue({}) },
    applicationReviewItem: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
}

describe("runAcceptanceSigningExpiryJob", () => {
  let tx: TxSpies;

  beforeEach(() => {
    jest.clearAllMocks();
    tx = createTxSpies();
    (prisma.user.upsert as jest.Mock).mockResolvedValue({ user_id: "SYS" });
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: "contract-1",
          offer_details: offerDetails,
          application_id: "app-1",
          product_id: "prod-1",
          product_version: 1,
          financing_structure: { structure_type: "new_contract" },
        },
      ])
      .mockResolvedValueOnce([]);
    (prisma.contract.findUnique as jest.Mock).mockResolvedValue({
      offer_details: offerDetails,
      status: "OFFER_SENT",
    });
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (client: TxSpies) => Promise<unknown>) =>
      fn(tx)
    );
  });

  it("sets OFFER_EXPIRED on entity and application, keeps offer_details, logs CONTRACT_OFFER_EXPIRED", async () => {
    const result = await runAcceptanceSigningExpiryJob();

    expect(result.contractsExpired).toEqual(["contract-1"]);
    expect(result.invoicesExpired).toEqual([]);
    expect(result.applicationsUpdated).toEqual(["app-1"]);

    expect(tx.contract.update).toHaveBeenCalledWith({
      where: { id: "contract-1" },
      data: { status: "OFFER_EXPIRED" },
    });
    expect(tx.applicationReview.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ status: "OFFER_EXPIRED" }),
      })
    );
    expect(tx.application.update).toHaveBeenCalledWith({
      where: { id: "app-1" },
      data: { status: "OFFER_EXPIRED" },
    });
    // Must not clear commercial terms
    expect(JSON.stringify(tx.contract.update.mock.calls)).not.toContain("offer_details");

    expect(logApplicationActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: "app-1",
        eventType: "CONTRACT_OFFER_EXPIRED",
        entityId: "contract-1",
      })
    );
  });

  it("expires signing envelopes when signing clock lapses", async () => {
    const signingOffer = {
      ...offerDetails,
      offer_acceptance: {
        status: "APPROVED_FOR_SIGNING",
        acceptance_expires_at: "2099-01-01T00:00:00.000Z",
        signing_expires_at: pastIso,
      },
    };
    (prisma.$queryRaw as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce([
        {
          id: "contract-2",
          offer_details: signingOffer,
          application_id: "app-2",
          product_id: "prod-1",
          product_version: 1,
          financing_structure: { structure_type: "new_contract" },
        },
      ])
      .mockResolvedValueOnce([]);
    (prisma.contract.findUnique as jest.Mock).mockResolvedValue({
      offer_details: signingOffer,
      status: "OFFER_SENT",
    });
    tx.signingEnvelope.findMany.mockResolvedValue([{ id: "env-1" }]);

    const result = await runAcceptanceSigningExpiryJob();

    expect(result.contractsExpired).toEqual(["contract-2"]);
    expect(result.envelopesExpired).toEqual(["env-1"]);
    expect(tx.signingEnvelope.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["env-1"] } },
      data: { status: "EXPIRED" },
    });
  });
});
