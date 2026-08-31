jest.mock("../prisma", () => ({
  prisma: {
    signingEnvelope: { findMany: jest.fn() },
  },
}));

jest.mock("../../modules/signing/service", () => ({
  signingService: {
    expireEnvelope: jest.fn(),
  },
}));

import { prisma } from "../prisma";
import { signingService } from "../../modules/signing/service";
import { runSigningEnvelopeExpiryJob } from "./signing-envelope-expiry";
import { systemAuditContext } from "../audit";

describe("runSigningEnvelopeExpiryJob", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("expires each overdue envelope with SYSTEM_JOB context", async () => {
    (prisma.signingEnvelope.findMany as jest.Mock).mockResolvedValue([{ id: "env-1" }, { id: "env-2" }]);
    (signingService.expireEnvelope as jest.Mock)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const result = await runSigningEnvelopeExpiryJob();

    expect(signingService.expireEnvelope).toHaveBeenNthCalledWith(1, "env-1", {
      context: systemAuditContext({ correlationId: "cron:signing-envelope-expiry" }),
    });
    expect(signingService.expireEnvelope).toHaveBeenNthCalledWith(2, "env-2", {
      context: systemAuditContext({ correlationId: "cron:signing-envelope-expiry" }),
    });
    expect(result.expiredEnvelopeIds).toEqual(["env-1"]);
  });
});
