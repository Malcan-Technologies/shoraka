/**
 * APPLICATION_RESUBMITTED bare PATCH path (no amendment metadata) must still surface a useful,
 * accurate description on shared application-log readers (admin timeline + issuer widgets),
 * without inventing amendment counts/remarks/resubmit_changes, and without changing the rich
 * amendments/service.ts resubmit metadata when it is present.
 */
const mockFindById = jest.fn();
const mockApplicationLogFindMany = jest.fn();

jest.mock("./repository", () => ({
  ApplicationRepository: jest.fn().mockImplementation(() => ({
    findById: (...args: unknown[]) => mockFindById(...args),
  })),
}));

jest.mock("../products/repository", () => ({
  ProductRepository: jest.fn().mockImplementation(() => ({})),
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

jest.mock("../../lib/user-display-name", () => ({
  loadUserDisplayNameMap: jest.fn().mockResolvedValue(new Map()),
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {
    applicationLog: {
      findMany: (...args: unknown[]) => mockApplicationLogFindMany(...args),
    },
  },
}));

import { ApplicationService } from "./service";

describe("ApplicationService.getApplicationLogs — APPLICATION_RESUBMITTED bare path", () => {
  const service = new ApplicationService();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindById.mockResolvedValue({ id: "app-1" });
  });

  it("falls back to a simple accurate description when no resubmit_changes metadata exists", async () => {
    mockApplicationLogFindMany.mockResolvedValue([
      {
        id: "log-1",
        application_id: "app-1",
        user_id: "user-1",
        event_type: "APPLICATION_RESUBMITTED",
        metadata: null,
        created_at: new Date("2026-08-01T00:00:00.000Z"),
      },
    ]);

    const [entry] = await service.getApplicationLogs("app-1", "admin-1", { asAdmin: true });

    expect(entry.activity).toBe("Application resubmitted for review");
  });

  it("does not invent amendment count, remarks, or resubmit_changes fields", async () => {
    mockApplicationLogFindMany.mockResolvedValue([
      {
        id: "log-1",
        application_id: "app-1",
        user_id: "user-1",
        event_type: "APPLICATION_RESUBMITTED",
        metadata: null,
        created_at: new Date("2026-08-01T00:00:00.000Z"),
      },
    ]);

    const [entry] = await service.getApplicationLogs("app-1", "admin-1", { asAdmin: true });

    expect(entry.metadata).not.toHaveProperty("resubmit_changes");
    expect(entry.activity).not.toMatch(/amendment|change/i);
  });

  it("preserves the rich activity_summary from the amendments resubmit flow unchanged", async () => {
    mockApplicationLogFindMany.mockResolvedValue([
      {
        id: "log-2",
        application_id: "app-1",
        user_id: "user-1",
        event_type: "APPLICATION_RESUBMITTED",
        metadata: {
          resubmit_changes: { activity_summary: "Changes: Supporting documents, Financials" },
        },
        created_at: new Date("2026-08-02T00:00:00.000Z"),
      },
    ]);

    const [entry] = await service.getApplicationLogs("app-1", "admin-1", { asAdmin: true });

    expect(entry.activity).toBe("Changes: Supporting documents, Financials");
  });

  it("leaves non-resubmit events untouched (no activity field injected)", async () => {
    mockApplicationLogFindMany.mockResolvedValue([
      {
        id: "log-3",
        application_id: "app-1",
        user_id: "user-1",
        event_type: "APPLICATION_SUBMITTED",
        metadata: null,
        created_at: new Date("2026-08-03T00:00:00.000Z"),
      },
    ]);

    const [entry] = await service.getApplicationLogs("app-1", "admin-1", { asAdmin: true });

    expect(entry).not.toHaveProperty("activity");
  });
});
