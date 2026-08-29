jest.mock("../prisma", () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

jest.mock("../../modules/applications/logs/service", () => ({
  logApplicationActivity: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { prisma } from "../prisma";
import { logApplicationActivity } from "../../modules/applications/logs/service";
import { AUDIT_SOURCE } from "../audit";
import { ApplicationLogEventType } from "../../modules/applications/logs/types";
import { runApplicationTimelineRepairJob } from "./application-timeline-repair";

describe("runApplicationTimelineRepairJob", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([]);
  });

  it("rebuilds APPLICATION_CREATED from applications.created_at without inventing an actor", async () => {
    const createdAt = new Date("2026-01-02T00:00:00.000Z");
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ id: "app-1", created_at: createdAt }])
      .mockResolvedValueOnce([]);

    const result = await runApplicationTimelineRepairJob();

    expect(logApplicationActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        applicationId: "app-1",
        eventType: ApplicationLogEventType.APPLICATION_CREATED,
        createdAt,
        source: AUDIT_SOURCE.INTERNAL,
      }),
      prisma
    );
    expect(result.created).toBe(1);
    expect(result.submitted).toBe(0);
  });

  it("rebuilds APPLICATION_SUBMITTED from applications.submitted_at without inventing a submitter", async () => {
    const submittedAt = new Date("2026-01-03T00:00:00.000Z");
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "app-2", submitted_at: submittedAt }]);

    const result = await runApplicationTimelineRepairJob();

    expect(logApplicationActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: null,
        applicationId: "app-2",
        eventType: ApplicationLogEventType.APPLICATION_SUBMITTED,
        createdAt: submittedAt,
        source: AUDIT_SOURCE.INTERNAL,
      }),
      prisma
    );
    expect(result.submitted).toBe(1);
  });
});
