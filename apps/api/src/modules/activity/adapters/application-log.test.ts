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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("builds user-facing presentation copy", () => {
    expect(adapter.buildPresentation("APPLICATION_CREATED")).toEqual({
      title: "Application Started",
      description: "You created a financing application and can continue it before submitting.",
    });
    expect(adapter.buildPresentation("APPLICATION_PROCESSING_FEE_PAID")).toEqual({
      title: "Application Processing Fee Paid",
      description: "The application processing fee was paid successfully.",
    });
    expect(adapter.buildPresentation("FACILITY_FEE_PAID")).toEqual({
      title: "Facility fee paid",
      description: "A facility fee payment was received.",
    });
    expect(adapter.buildPresentation("APPLICATION_SUBMITTED")).toEqual({
      title: "Application Submitted",
      description: "Your financing application was submitted and is now under review.",
    });
    expect(adapter.buildPresentation("APPLICATION_REJECTED", { remark: "Invalid docs" })).toEqual({
      title: "Application Rejected",
      description: "Your financing application was rejected and will not continue.",
    });
    expect(adapter.buildPresentation("AMENDMENTS_SUBMITTED")).toEqual({
      title: "Amendment Request Sent",
      description: "CashSouk sent an amendment request for this application.",
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

  it("builds presentation for offer acceptance and signing package events", () => {
    expect(adapter.buildPresentation("CONTRACT_OFFER_ACCEPTANCE_SUBMITTED")).toEqual({
      title: "You Submitted Your Facility Offer Acceptance",
      description: "You submitted offer acceptance documents for CashSouk review.",
    });
    expect(adapter.buildPresentation("CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED")).toEqual({
      title: "You Resubmitted Your Facility Offer Acceptance",
      description: "You resubmitted offer acceptance documents after CashSouk requested changes.",
    });
    expect(adapter.buildPresentation("SIGNING_PACKAGE_SENT")).toEqual({
      title: "Signing package sent",
      description: "The signing package was sent to all required signers.",
    });
    expect(adapter.buildPresentation("SIGNING_PACKAGE_COMPLETED")).toEqual({
      title: "Signing package completed",
      description: "All required signers completed the signing package.",
    });
    expect(adapter.buildPresentation("SIGNING_PACKAGE_DECLINED")).toEqual({
      title: "Signing package declined",
      description: "A required signer declined the signing package.",
    });
    expect(adapter.buildPresentation("SIGNING_PACKAGE_EXPIRED")).toEqual({
      title: "Signing package expired",
      description: "The signing package expired before all required signatures were collected.",
    });
    expect(adapter.buildPresentation("CONTRACT_OFFER_ACCEPTED")).toEqual({
      title: "Facility Offer Accepted",
      description: "The facility offer was accepted.",
    });
  });

  it("includes curated issuer-facing offer acceptance and signing events", () => {
    const eventTypes = adapter.getEventTypes();
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        "CONTRACT_OFFER_ACCEPTANCE_SUBMITTED",
        "CONTRACT_OFFER_ACCEPTANCE_RESUBMITTED",
        "INVOICE_OFFER_ACCEPTANCE_SUBMITTED",
        "INVOICE_OFFER_ACCEPTANCE_RESUBMITTED",
        "APPLICATION_PROCESSING_FEE_PAID",
        "FACILITY_FEE_PAID",
        "SIGNING_PACKAGE_SENT",
        "CONTRACT_OFFER_ACCEPTED",
        "INVOICE_OFFER_ACCEPTED",
      ])
    );
    expect(eventTypes).not.toEqual(
      expect.arrayContaining([
        "CONTRACT_ACCEPTANCE_APPROVED_FOR_SIGNING",
        "SIGNING_PACKAGE_CREATED",
        "SIGNING_PACKAGE_COMPLETED",
        "SIGNING_PACKAGE_VOIDED",
        "SIGNING_PACKAGE_DECLINED",
        "SIGNING_PACKAGE_EXPIRED",
      ])
    );
    expect(eventTypes).not.toEqual(
      expect.arrayContaining([
        "PAYMASTER_CREATED",
        "PAYMASTER_LINKED_TO_ISSUER",
        "PAYMASTER_VERIFIED",
      ])
    );
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
      "You received an invoice offer for invoice INV-001. Review and respond."
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
      "You received an invoice offer for invoice INV-001. Review and respond."
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

  it("describes AMENDMENTS_SUBMITTED as CashSouk sending an amendment request", () => {
    const now = new Date();
    const record: any = {
      id: "log-amd",
      user_id: "user123",
      application_id: "app_123",
      event_type: "AMENDMENTS_SUBMITTED",
      metadata: { count: 2 },
      created_at: now,
    };

    const unified = adapter.transform(record);

    expect(unified.title).toBe("Amendment Request Sent");
    expect(unified.description).toBe("CashSouk sent an amendment request for application #APP_123.");
    expect(unified.description).not.toMatch(/you submitted amendments/i);
    expect(unified.description).not.toMatch(/issuer submitted/i);
    expect(unified.title).not.toMatch(/amendments submitted/i);
    expect(unified.event_type).toBe("AMENDMENTS_SUBMITTED");
  });

  it("keeps APPLICATION_RESUBMITTED as the issuer submitting updated application content", () => {
    const now = new Date();
    const record: any = {
      id: "log-resub",
      user_id: "user123",
      application_id: "app_123",
      event_type: "APPLICATION_RESUBMITTED",
      metadata: {},
      created_at: now,
    };

    const unified = adapter.transform(record);

    expect(unified.event_type).toBe("APPLICATION_RESUBMITTED");
    expect(unified.title).toBe("Application Resubmitted");
    expect(unified.description).toBe(
      "You resubmitted application #APP_123 after making the requested updates."
    );
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
      "You received a facility offer for application #RAPP_123. Review and respond."
    );
    expect(unified.references).toEqual({
      applicationId: "issuerapp_123",
      applicationReference: "#RAPP_123",
      contractId: "contract_456",
      contractNumber: "CT-2026-001",
    });
  });

  it("returns no application activity for investor-scoped requests", async () => {
    prisma.applicationLog.findMany.mockResolvedValue([]);

    const records = await adapter.query("user123", {
      organizationId: "investor-org-1",
      portalType: "investor",
    });

    expect(prisma.application.findMany).not.toHaveBeenCalled();
    expect(prisma.applicationLog.findMany).toHaveBeenCalledWith(
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
    prisma.applicationLog.findMany.mockResolvedValue([]);

    await adapter.query("user123", {
      organizationId: "issuer-org-1",
      portalType: "issuer",
    });

    expect(prisma.application.findMany).toHaveBeenCalledWith({
      where: { issuer_organization_id: "issuer-org-1" },
      select: { id: true },
    });
    expect(prisma.applicationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          application_id: { in: ["app_1", "app_2"] },
        }),
      })
    );
  });

  it("returns zero application counts for investor-scoped requests", async () => {
    prisma.applicationLog.count.mockResolvedValue(0);

    const count = await adapter.count("user123", {
      organizationId: "investor-org-1",
      portalType: "investor",
    });

    expect(prisma.application.findMany).not.toHaveBeenCalled();
    expect(prisma.applicationLog.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        application_id: { in: ["__none__"] },
      }),
    });
    expect(count).toBe(0);
  });

  it("searches application and invoice references", async () => {
    prisma.applicationLog.findMany.mockResolvedValue([]);

    await adapter.query("user123", { search: "INV-001" });

    expect(prisma.applicationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { application_id: { contains: "INV-001", mode: "insensitive" } },
            {
              metadata: {
                path: ["invoice_number"],
                string_contains: "INV-001",
              },
            },
            {
              metadata: {
                path: ["application_reference"],
                string_contains: "INV-001",
              },
            },
          ]),
        }),
      })
    );
  });

  it("only exposes high-signal application events", () => {
    expect(adapter.getEventTypes()).toContain("APPLICATION_APPROVED");
    expect(adapter.getEventTypes()).toContain("APPLICATION_PROCESSING_FEE_PAID");
    expect(adapter.getEventTypes()).toContain("AMENDMENTS_SUBMITTED");
    expect(adapter.getEventTypes()).toContain("SIGNING_PACKAGE_COMPLETED");
    expect(adapter.getEventTypes()).toContain("SIGNING_PACKAGE_DECLINED");
    expect(adapter.getEventTypes()).toContain("SIGNING_PACKAGE_EXPIRED");
    expect(adapter.getEventTypes()).not.toContain("SIGNING_PACKAGE_CREATED");
    expect(adapter.getEventTypes()).not.toContain("SIGNING_PACKAGE_VOIDED");
    expect(adapter.getEventTypes()).not.toContain("SECTION_REVIEWED_APPROVED");
    expect(adapter.getEventTypes()).not.toContain("ITEM_REVIEWED_REJECTED");
  });
});

