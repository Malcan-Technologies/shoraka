import { ApplicationLogAdapter } from "./application-log";

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    applicationLog: { findMany: jest.fn(), count: jest.fn() },
    application: { findMany: jest.fn() },
  },
}));

const { prisma } = jest.requireMock("../../../lib/prisma") as {
  prisma: {
    applicationLog: { findMany: jest.Mock; count: jest.Mock };
    application: { findMany: jest.Mock };
  };
};

describe("ApplicationLogAdapter", () => {
  const adapter = new ApplicationLogAdapter();

  it("builds user-facing presentation copy", () => {
    expect(adapter.buildPresentation("APPLICATION_CREATED")).toEqual({
      title: "Application Started",
      description: "You created a financing application and can continue it before submitting.",
    });
    expect(adapter.buildPresentation("APPLICATION_SUBMITTED")).toEqual({
      title: "Application Submitted",
      description: "Your financing application was submitted and is now under review.",
    });
    expect(adapter.buildPresentation("APPLICATION_REJECTED", { remark: "Invalid docs" })).toEqual({
      title: "Application Rejected",
      description: "Your financing application was rejected and will not continue.",
    });
    expect(
      adapter.buildPresentation("APPLICATION_RESUBMITTED", {
        resubmit_changes: { activity_summary: "Changes: Supporting documents" },
      })
    ).toEqual({
      title: "Application Resubmitted",
      description: "You resubmitted your application after updating the requested information.",
    });
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
    expect(unified.domain).toBe("application");
    expect(unified.activity).toBe("Application Started");
    expect(unified.title).toBe("Application Started");
    expect(unified.description).toBe("You created a financing application and can continue it before submitting.");
  });

  it("derives structured references for application and invoice events", () => {
    const now = new Date();
    const record: any = {
      id: "log2",
      user_id: "user123",
      application_id: "app_123",
      entity_id: "invoice_456",
      event_type: "INVOICE_OFFER_SENT",
      metadata: {
        invoice_id: "invoice_456",
        invoice_number: "INV-001",
      },
      created_at: now,
    };

    const unified = adapter.transform(record);

    expect(unified.description).toBe(
      "An invoice offer for invoice INV-001 is ready for your review and response."
    );
    expect(unified.references).toEqual({
      applicationId: "app_123",
      applicationReference: "#APP_123",
      invoiceId: "invoice_456",
      invoiceNumber: "INV-001",
    });
  });

  it("ignores scope keys when deriving entity references", () => {
    const now = new Date();
    const record: any = {
      id: "log3",
      user_id: "user123",
      application_id: "app_123",
      entity_id: "invoice_details:0:INV-001",
      event_type: "INVOICE_OFFER_SENT",
      metadata: {
        invoice_number: "INV-001",
      },
      created_at: now,
    };

    const unified = adapter.transform(record);

    expect(unified.description).toBe(
      "An invoice offer for invoice INV-001 is ready for your review and response."
    );
    expect(unified.references).toEqual({
      applicationId: "app_123",
      applicationReference: "#APP_123",
      invoiceNumber: "INV-001",
    });
  });

  it("weaves application references naturally into the sentence", () => {
    const now = new Date();
    const record: any = {
      id: "log4",
      user_id: "user123",
      application_id: "app_123",
      event_type: "APPLICATION_SUBMITTED",
      metadata: {},
      created_at: now,
    };

    const unified = adapter.transform(record);

    expect(unified.description).toBe("Application #APP_123 was submitted and is now under review.");
    expect(unified.references).toEqual({
      applicationId: "app_123",
      applicationReference: "#APP_123",
    });
  });

  it("backfills contract references from the application when the log metadata is missing", async () => {
    const now = new Date();
    prisma.applicationLog.findMany.mockResolvedValue([
      {
        id: "log5",
        user_id: "user123",
        application_id: "issuerapp_123",
        event_type: "CONTRACT_OFFER_SENT",
        metadata: {},
        ip_address: null,
        user_agent: null,
        device_info: null,
        created_at: now,
      },
    ]);
    prisma.application.findMany.mockResolvedValue([
      {
        id: "issuerapp_123",
        contract_id: "contract_456",
        contract: {
          contract_details: {
            number: "CT-2026-001",
          },
        },
      },
    ]);

    const [record] = await adapter.query("user123", {});
    const unified = adapter.transform(record as any);

    expect(unified.description).toBe(
      "A contract offer for contract CT-2026-001 is ready for your review and response."
    );
    expect(unified.references).toEqual({
      applicationId: "issuerapp_123",
      applicationReference: "#RAPP_123",
      contractId: "contract_456",
      contractNumber: "CT-2026-001",
    });
  });

  it("only exposes high-signal application events", () => {
    expect(adapter.getEventTypes()).toContain("APPLICATION_APPROVED");
    expect(adapter.getEventTypes()).toContain("AMENDMENTS_SUBMITTED");
    expect(adapter.getEventTypes()).not.toContain("SECTION_REVIEWED_APPROVED");
    expect(adapter.getEventTypes()).not.toContain("ITEM_REVIEWED_REJECTED");
  });
});

