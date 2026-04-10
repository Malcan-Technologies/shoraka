import { ApplicationLogAdapter } from "./application-log";

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    applicationLog: { findMany: jest.fn(), count: jest.fn() },
    application: { findMany: jest.fn() },
  },
}));

describe("ApplicationLogAdapter", () => {
  const adapter = new ApplicationLogAdapter();

  it("builds human readable descriptions", () => {
    expect(adapter.buildDescription("APPLICATION_CREATED")).toBe("Created an application");
    expect(adapter.buildDescription("APPLICATION_SUBMITTED")).toBe("Submitted the application");
    expect(adapter.buildDescription("APPLICATION_REJECTED", { remark: "Invalid docs" })).toBe(
      "Application rejected"
    );
    expect(
      adapter.buildDescription("APPLICATION_RESUBMITTED", {
        resubmit_changes: { activity_summary: "Changes: Supporting documents" },
      })
    ).toBe("Changes: Supporting documents");
    expect(adapter.buildDescription("APPLICATION_RESUBMITTED", {})).toBe("Resubmitted the application");
  });

  it("transforms record to unified activity", () => {
    const now = new Date();
    const record: any = {
      id: "log1",
      user_id: "user123",
      event_type: "APPLICATION_CREATED",
      metadata: {},
      ip_address: "1.2.3.4",
      user_agent: "agent",
      device_info: "device",
      created_at: now,
    };

    const unified = adapter.transform(record);
    expect(unified.source_table).toBe("application_logs");
    expect(unified.category).toBe("organization");
    expect(unified.activity).toBe("Created an application");
  });
});

