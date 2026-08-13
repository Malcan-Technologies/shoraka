import { ApplicationLogAdapter } from "./application-log";

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    applicationAuditLog: { findMany: jest.fn(), count: jest.fn() },
    application: { findMany: jest.fn() },
  },
}));

const { prisma } = jest.requireMock("../../../lib/prisma") as {
  prisma: {
    applicationAuditLog: { findMany: jest.Mock; count: jest.Mock };
    application: { findMany: jest.Mock };
  };
};

describe("ApplicationLogAdapter", () => {
  const adapter = new ApplicationLogAdapter();

  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it("builds presentation for offer acceptance events and does not advertise signing packages", () => {
    expect(adapter.buildPresentation("CONTRACT_ACCEPTANCE_SUBMITTED")).toEqual({
      title: "Contract Acceptance Submitted",
      description: "You submitted offer acceptance documents for CashSouk review.",
    });
    expect(adapter.buildPresentation("CONTRACT_ACCEPTANCE_RESUBMITTED")).toEqual({
      title: "Contract Acceptance Resubmitted",
      description: "You resubmitted offer acceptance documents after CashSouk requested changes.",
    });
    expect(adapter.buildPresentation("SIGNING_PACKAGE_SENT")).toEqual({
      title: "Application Update",
      description: "An application update was recorded for your account.",
    });
    expect(adapter.buildPresentation("CONTRACT_OFFER_ACCEPTED")).toEqual({
      title: "Contract Offer Signed",
      description: "All signers completed the contract offer signing package.",
    });
  });

  it("includes application-domain events and excludes SIGNING_PACKAGE_*", () => {
    const eventTypes = adapter.getEventTypes();
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        "CONTRACT_ACCEPTANCE_SUBMITTED",
        "CONTRACT_ACCEPTANCE_RESUBMITTED",
        "INVOICE_ACCEPTANCE_SUBMITTED",
        "INVOICE_ACCEPTANCE_RESUBMITTED",
        "CONTRACT_OFFER_ACCEPTED",
        "INVOICE_OFFER_ACCEPTED",
        "APPLICATION_AMENDMENTS_REQUESTED",
      ])
    );
    expect(eventTypes).not.toEqual(
      expect.arrayContaining([
        "SIGNING_PACKAGE_CREATED",
        "SIGNING_PACKAGE_SENT",
        "SIGNING_PACKAGE_COMPLETED",
        "SIGNING_PACKAGE_VOIDED",
        "APPLICATION_APPROVED",
      ])
    );
  });

  it("transforms record to unified activity", () => {
    const now = new Date();
    const record: any = {
      id: "log1",
      actor_user_id: "user123",
      event_type: "APPLICATION_CREATED",
      metadata: {},
      ip_address: "1.2.3.4",
      user_agent: "agent",
      occurred_at: now,
      created_at: now,
      target_type: "APPLICATION",
      target_id: "app1",
    };

    const unified = adapter.transform(record);
    expect(unified.source_table).toBe("application_audit_logs");
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
      actor_user_id: "user123",
      application_id: "app_123",
      target_id: "invoice_456",
      event_type: "INVOICE_OFFER_SENT",
      metadata: {
        invoice_id: "invoice_456",
        invoice_number: "INV-001",
      },
      occurred_at: now,
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
    prisma.applicationAuditLog.findMany.mockResolvedValue([
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

  it("returns no application activity for investor-scoped requests", async () => {
    prisma.applicationAuditLog.findMany.mockResolvedValue([]);

    const records = await adapter.query("user123", {
      organizationId: "investor-org-1",
      portalType: "investor",
    });

    expect(prisma.application.findMany).not.toHaveBeenCalled();
    expect(prisma.applicationAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          application_id: { in: ["__none__"] },
        }),
      })
    );
    expect(records).toEqual([]);
  });

  it("keeps issuer-scoped requests limited to the active issuer organization", async () => {
    prisma.application.findMany.mockResolvedValue([{ id: "app_1" }, { id: "app_2" }]);
    prisma.applicationAuditLog.findMany.mockResolvedValue([]);

    await adapter.query("user123", {
      organizationId: "issuer-org-1",
      portalType: "issuer",
    });

    expect(prisma.application.findMany).toHaveBeenCalledWith({
      where: { issuer_organization_id: "issuer-org-1" },
      select: { id: true },
    });
    expect(prisma.applicationAuditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          application_id: { in: ["app_1", "app_2"] },
        }),
      })
    );
  });

  it("returns zero application counts for investor-scoped requests", async () => {
    prisma.applicationAuditLog.count.mockResolvedValue(0);

    const count = await adapter.count("user123", {
      organizationId: "investor-org-1",
      portalType: "investor",
    });

    expect(prisma.application.findMany).not.toHaveBeenCalled();
    expect(prisma.applicationAuditLog.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        application_id: { in: ["__none__"] },
      }),
    });
    expect(count).toBe(0);
  });

  it("only exposes ApplicationAuditLog catalogue events", () => {
    expect(adapter.getEventTypes()).toContain("APPLICATION_CREATED");
    expect(adapter.getEventTypes()).toContain("APPLICATION_AMENDMENTS_REQUESTED");
    expect(adapter.getEventTypes()).toContain("APPLICATION_REOPENED_FOR_REVIEW");
    expect(adapter.getEventTypes()).toContain("CONTRACT_OFFER_REJECTED");
    expect(adapter.getEventTypes()).not.toContain("APPLICATION_APPROVED");
    expect(adapter.getEventTypes()).not.toContain("AMENDMENTS_SUBMITTED");
    expect(adapter.getEventTypes()).not.toContain("SECTION_REVIEWED_APPROVED");
    expect(adapter.getEventTypes()).not.toContain("ITEM_REVIEWED_REJECTED");
    expect(adapter.getEventTypes()).not.toContain("SIGNING_PACKAGE_CREATED");
    expect(adapter.getEventTypes()).not.toContain("SIGNING_PACKAGE_COMPLETED");
  });
});

