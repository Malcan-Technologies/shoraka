jest.mock("../prisma", () => ({
  prisma: {
    signingEnvelope: { findMany: jest.fn(), findFirst: jest.fn() },
    signingRecipient: { findMany: jest.fn() },
  },
}));

jest.mock("../../modules/signing/service", () => ({
  signingService: {
    syncEnvelopeFromProvider: jest.fn(),
  },
}));

jest.mock("../logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { prisma } from "../prisma";
import { signingService } from "../../modules/signing/service";
import { logger } from "../logger";
import { runSigningReconcileJob } from "./signing-reconcile";
import { systemAuditContext } from "../audit";

const offerSentWhere = {
  OR: [{ contract: { status: "OFFER_SENT" } }, { invoice: { status: "OFFER_SENT" } }],
};

describe("runSigningReconcileJob", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.signingRecipient.findMany as jest.Mock).mockResolvedValue([]);
    (signingService.syncEnvelopeFromProvider as jest.Mock).mockResolvedValue(undefined);
  });

  it("selects missing-PDF and OFFER_SENT envelopes, dedupes overlap, and reports honest finalize results", async () => {
    (prisma.signingEnvelope.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: "env-pdf" }, { id: "env-both" }])
      .mockResolvedValueOnce([{ id: "env-contract" }, { id: "env-invoice" }, { id: "env-both" }]);
    (prisma.signingEnvelope.findFirst as jest.Mock).mockImplementation(
      async ({ where }: { where: { id: string } }) => {
        if (where.id === "env-contract") return null;
        return { id: where.id };
      }
    );

    const result = await runSigningReconcileJob();
    const jobContext = systemAuditContext({ correlationId: "cron:signing-reconcile" });

    expect(prisma.signingEnvelope.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        status: "COMPLETED",
        documents: {
          some: {
            provider_contract_ref: { not: null },
            signed_s3_key: null,
            status: "COMPLETED",
          },
        },
      },
      select: { id: true },
    });
    expect(prisma.signingEnvelope.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        status: "COMPLETED",
        ...offerSentWhere,
      },
      select: { id: true },
    });

    expect(signingService.syncEnvelopeFromProvider).toHaveBeenCalledTimes(4);
    expect(signingService.syncEnvelopeFromProvider).toHaveBeenNthCalledWith(1, "env-pdf", {
      context: jobContext,
    });
    expect(signingService.syncEnvelopeFromProvider).toHaveBeenNthCalledWith(2, "env-both", {
      context: jobContext,
    });
    expect(signingService.syncEnvelopeFromProvider).toHaveBeenNthCalledWith(3, "env-contract", {
      context: jobContext,
    });
    expect(signingService.syncEnvelopeFromProvider).toHaveBeenNthCalledWith(4, "env-invoice", {
      context: jobContext,
    });

    expect(prisma.signingEnvelope.findFirst).toHaveBeenCalledTimes(3);
    expect(prisma.signingEnvelope.findFirst).toHaveBeenCalledWith({
      where: { id: "env-both", ...offerSentWhere },
      select: { id: true },
    });
    expect(prisma.signingEnvelope.findFirst).toHaveBeenCalledWith({
      where: { id: "env-contract", ...offerSentWhere },
      select: { id: true },
    });
    expect(prisma.signingEnvelope.findFirst).toHaveBeenCalledWith({
      where: { id: "env-invoice", ...offerSentWhere },
      select: { id: true },
    });

    expect(result.syncedEnvelopeIds).toEqual(["env-pdf", "env-both"]);
    expect(result.finalizedEnvelopeIds).toEqual(["env-contract"]);
    expect(result.errors).toEqual([
      "finalize env-both: offer still OFFER_SENT after sync",
      "finalize env-invoice: offer still OFFER_SENT after sync",
    ]);
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        syncedEnvelopeIds: ["env-pdf", "env-both"],
        finalizedEnvelopeIds: ["env-contract"],
        errors: [
          "finalize env-both: offer still OFFER_SENT after sync",
          "finalize env-invoice: offer still OFFER_SENT after sync",
        ],
      }),
      "Signing reconcile job completed"
    );
  });
});
