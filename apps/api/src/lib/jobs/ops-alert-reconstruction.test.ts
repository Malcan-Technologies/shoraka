jest.mock("../prisma", () => ({
  prisma: {
    gatewayPayment: { findMany: jest.fn(), findUnique: jest.fn() },
    gatewayPaymentReceipt: { count: jest.fn() },
    gatewayWebhookEvent: { findMany: jest.fn() },
    signingEnvelope: { findMany: jest.fn(), count: jest.fn() },
    gatewayReconException: { findMany: jest.fn(), count: jest.fn() },
    gatewayReconRun: { findMany: jest.fn(), findUnique: jest.fn() },
    legalExternalAcceptance: { findFirst: jest.fn() },
    opsAlert: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  },
}));

jest.mock("../../modules/ops-alerts/service", () => ({
  raiseOpsAlert: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import {
  GatewayPaymentStatus,
  OpsAlertStatus,
  OpsAlertType,
} from "@prisma/client";
import { prisma } from "../prisma";
import { raiseOpsAlert } from "../../modules/ops-alerts/service";
import { runOpsAlertReconstructionJob } from "./ops-alert-reconstruction";

function emptyQueries() {
  (prisma.gatewayPayment.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.gatewayPaymentReceipt.count as jest.Mock).mockResolvedValue(0);
  (prisma.gatewayWebhookEvent.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.signingEnvelope.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.signingEnvelope.count as jest.Mock).mockResolvedValue(0);
  (prisma.gatewayReconException.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.gatewayReconException.count as jest.Mock).mockResolvedValue(0);
  (prisma.gatewayReconRun.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.legalExternalAcceptance.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.opsAlert.findUnique as jest.Mock).mockResolvedValue(null);
  (prisma.opsAlert.findMany as jest.Mock).mockResolvedValue([]);
}

describe("runOpsAlertReconstructionJob", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    emptyQueries();
  });

  it("recreates a stuck-payment alert from a durable CREATED payment when the queue row is missing", async () => {
    (prisma.gatewayPayment.findMany as jest.Mock).mockImplementation((args: { where?: { status?: string } }) => {
      if (args?.where?.status === GatewayPaymentStatus.CREATED) {
        return Promise.resolve([{ id: "pay-1", gatewayAccount: "PLATFORM", curlec_order_id: "ord-1" }]);
      }
      return Promise.resolve([]);
    });

    const result = await runOpsAlertReconstructionJob();

    expect(raiseOpsAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: OpsAlertType.STUCK_PAYMENT,
        dedupeKey: "stuck-payment:pay-1",
        entityId: "pay-1",
      })
    );
    expect(result.raised).toBe(1);
  });

  it("does not duplicate an already OPEN alert for the same dedupe key", async () => {
    (prisma.gatewayPayment.findMany as jest.Mock).mockImplementation((args: { where?: { status?: string } }) => {
      if (args?.where?.status === GatewayPaymentStatus.CREATED) {
        return Promise.resolve([{ id: "pay-1", gatewayAccount: "PLATFORM", curlec_order_id: "ord-1" }]);
      }
      return Promise.resolve([]);
    });
    (prisma.opsAlert.findUnique as jest.Mock).mockResolvedValue({ status: OpsAlertStatus.OPEN });

    const result = await runOpsAlertReconstructionJob();

    expect(raiseOpsAlert).not.toHaveBeenCalled();
    expect(result.raised).toBe(0);
  });

  it("resolves a stuck-payment alert after the payment leaves CREATED", async () => {
    (prisma.opsAlert.findMany as jest.Mock).mockResolvedValue([
      {
        id: "alert-1",
        type: OpsAlertType.STUCK_PAYMENT,
        dedupe_key: "stuck-payment:pay-1",
        entity_id: "pay-1",
      },
    ]);
    (prisma.gatewayPayment.findUnique as jest.Mock).mockResolvedValue({
      status: GatewayPaymentStatus.HELD,
    });

    const result = await runOpsAlertReconstructionJob();

    expect(prisma.opsAlert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "alert-1" },
        data: expect.objectContaining({ status: OpsAlertStatus.RESOLVED }),
      })
    );
    expect(result.resolved).toBe(1);
  });
});

describe("ops alert reconstruction residuals", () => {
  it("does not invent Curlec poll or job-failure alerts from the database", () => {
    const src = require("node:fs").readFileSync(
      require("node:path").join(__dirname, "ops-alert-reconstruction.ts"),
      "utf8"
    );
    expect(src).not.toMatch(/provider-failure:curlec-order:/);
    expect(src).not.toMatch(/job-failure:/);
  });
});
