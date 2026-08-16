import { NoteLogAdapter } from "./note-log";

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    noteAuditLog: { findMany: jest.fn() },
    note: { findMany: jest.fn() },
    noteInvestment: { findMany: jest.fn() },
    noteSettlement: { findMany: jest.fn() },
  },
}));

const { prisma } = jest.requireMock("../../../lib/prisma") as {
  prisma: {
    noteAuditLog: { findMany: jest.Mock };
    note: { findMany: jest.Mock };
    noteInvestment: { findMany: jest.Mock };
    noteSettlement: { findMany: jest.Mock };
  };
};

function createRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "event_1",
    note_id: "note_1",
    event_type: "NOTE_ACTIVATED",
    actor_type: "ADMIN",
    actor_user_id: "user_1",
    organization_id: "issuer-org-1",
    organization_kind: "ISSUER",
    target_type: "NOTE",
    target_id: "note_1",
    source: "API",
    portal: "ADMIN",
    ip_address: null,
    user_agent: null,
    correlation_id: null,
    metadata: {},
    occurred_at: new Date("2026-01-01T00:00:00Z"),
    created_at: new Date("2026-01-01T00:00:00Z"),
    noteReference: "NOTE-001",
    noteTitle: "Bridge Note",
    ...overrides,
  };
}

describe("NoteLogAdapter", () => {
  const adapter = new NoteLogAdapter();

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.note.findMany.mockResolvedValue([
      {
        id: "note_1",
        note_reference: "NOTE-001",
        title: "Bridge Note",
        published_at: new Date("2026-01-01T00:00:00Z"),
        listing_status: "PUBLISHED",
      },
    ]);
    prisma.noteInvestment.findMany.mockResolvedValue([{ note_id: "note_1" }]);
    prisma.noteSettlement.findMany.mockResolvedValue([]);
  });

  it("builds user-facing note copy", () => {
    expect(
      adapter.buildPresentation("NOTE_PUBLISHED", {
        noteReference: "NOTE-001",
      })
    ).toEqual({
      title: "Note Published",
      description: "Your note is now listed and open for investment.",
    });

    expect(
      adapter.buildPresentation("SETTLEMENT_POSTED", {
        noteTitle: "Bridge Note",
      })
    ).toEqual({
      title: "Settlement Posted",
      description: "Settlement was posted.",
    });

    expect(
      adapter.buildPresentation(
        "SETTLEMENT_POSTED",
        { investorAmount: 9000, currency: "MYR" },
        "investor"
      )
    ).toEqual({
      title: "Returns Credited",
      description: "Your returns were credited to your CashSouk balance.",
    });
  });

  it("includes the newly approved issuer note lifecycle events", async () => {
    prisma.noteAuditLog.findMany.mockResolvedValue([
      createRecord({ id: "unpublished", event_type: "NOTE_UNPUBLISHED" }),
      createRecord({ id: "received", event_type: "REPAYMENT_RECEIVED" }),
      createRecord({ id: "residual", event_type: "RESIDUAL_RETURN_COMPLETED" }),
    ]);

    const records = await adapter.query("user_1", {
      organizationId: "issuer-org-1",
      portalType: "issuer",
      limit: 10,
      offset: 0,
    });

    expect(records.map((record) => record.event_type)).toEqual([
      "NOTE_UNPUBLISHED",
      "REPAYMENT_RECEIVED",
      "RESIDUAL_RETURN_COMPLETED",
    ]);
  });

  it("keeps issuer activity limited to shared and issuer-only events", async () => {
    prisma.noteAuditLog.findMany.mockResolvedValue([
      createRecord({ id: "issuer_1", event_type: "NOTE_FUNDING_CLOSED" }),
      createRecord({
        id: "issuer_2",
        event_type: "INVESTMENT_COMMITTED",
        metadata: { investorOrganizationId: "investor-org-1" },
      }),
      createRecord({ id: "issuer_3", event_type: "NOTE_MARKED_DEFAULT" }),
    ]);

    const records = await adapter.query("user_1", {
      organizationId: "issuer-org-1",
      portalType: "issuer",
      limit: 10,
      offset: 0,
    });

    expect(records.map((record) => record.event_type)).toEqual([
      "NOTE_FUNDING_CLOSED",
      "NOTE_MARKED_DEFAULT",
    ]);
  });

  it("only shows investment commits to the matching investor organization", async () => {
    prisma.noteAuditLog.findMany.mockResolvedValue([
      createRecord({
        id: "investor_1",
        event_type: "INVESTMENT_COMMITTED",
        metadata: { investorOrganizationId: "investor-org-1" },
      }),
      createRecord({
        id: "investor_2",
        event_type: "INVESTMENT_COMMITTED",
        metadata: { investorOrganizationId: "investor-org-2" },
      }),
      createRecord({
        id: "investor_3",
        event_type: "SETTLEMENT_POSTED",
        metadata: { settlementId: "set_1" },
      }),
      createRecord({
        id: "investor_4",
        event_type: "REPAYMENT_RECEIVED",
      }),
    ]);
    prisma.noteSettlement.findMany.mockResolvedValue([
      {
        id: "set_1",
        preview_snapshot: {
          allocations: [{ investmentId: "inv_1", investorOrganizationId: "investor-org-1" }],
        },
      },
    ]);

    const records = await adapter.query("user_1", {
      organizationId: "investor-org-1",
      portalType: "investor",
      limit: 10,
      offset: 0,
    });

    expect(records.map((record) => record.id)).toEqual(["investor_1", "investor_3"]);
  });

  it("does not leak funding or settlement events to an unrelated investor", async () => {
    prisma.noteInvestment.findMany.mockResolvedValue([]);
    prisma.noteAuditLog.findMany.mockResolvedValue([
      createRecord({ id: "funding", event_type: "NOTE_FUNDING_CLOSED" }),
      createRecord({
        id: "settlement",
        event_type: "SETTLEMENT_POSTED",
        metadata: { settlementId: "set_1" },
      }),
    ]);
    prisma.noteSettlement.findMany.mockResolvedValue([
      {
        id: "set_1",
        preview_snapshot: {
          allocations: [{ investmentId: "inv_1", investorOrganizationId: "other-org" }],
        },
      },
    ]);

    const records = await adapter.query("user_1", {
      organizationId: "investor-org-1",
      portalType: "investor",
      limit: 10,
      offset: 0,
    });

    expect(records).toEqual([]);
  });

  it("shows issuer terms updates only after the note is already visible", async () => {
    prisma.note.findMany.mockResolvedValue([
      {
        id: "note_1",
        note_reference: "NOTE-001",
        title: "Bridge Note",
        published_at: null,
        listing_status: "DRAFT",
      },
    ]);
    prisma.noteAuditLog.findMany.mockResolvedValue([
      createRecord({ id: "terms", event_type: "NOTE_TERMS_UPDATED" }),
      createRecord({ id: "published", event_type: "NOTE_PUBLISHED" }),
      createRecord({ id: "prospectus", event_type: "NOTE_PROSPECTUS_APPROVED" }),
    ]);

    const records = await adapter.query("user_1", {
      organizationId: "issuer-org-1",
      portalType: "issuer",
      limit: 10,
      offset: 0,
    });

    expect(records.map((record) => record.event_type)).toEqual(["NOTE_PUBLISHED"]);
  });

  it("does not treat disbursement completion as note activation", async () => {
    prisma.noteAuditLog.findMany.mockResolvedValue([
      createRecord({
        id: "withdrawal_1",
        event_type: "DISBURSEMENT_COMPLETED",
        metadata: { withdrawalId: "wd_1" },
      }),
      createRecord({
        id: "activation_1",
        event_type: "NOTE_ACTIVATED",
      }),
    ]);

    const records = await adapter.query("user_1", {
      organizationId: "issuer-org-1",
      portalType: "issuer",
      limit: 10,
      offset: 0,
    });

    expect(records.map((record) => record.event_type)).toEqual([
      "DISBURSEMENT_COMPLETED",
      "NOTE_ACTIVATED",
    ]);

    const completed = adapter.transform(records[0] as never);
    expect(completed.title).toBe("Disbursement Completed");

    const activated = adapter.transform(records[1] as never);
    expect(activated.title).toBe("Note Activated");
  });

  it("only exposes curated high-signal note events", () => {
    expect(adapter.getEventTypes()).toContain("NOTE_ACTIVATED");
    expect(adapter.getEventTypes()).toContain("SETTLEMENT_POSTED");
    expect(adapter.getEventTypes()).toContain("REPAYMENT_RECEIVED");
    expect(adapter.getEventTypes()).toContain("NOTE_UNPUBLISHED");
    expect(adapter.getEventTypes()).toContain("NOTE_TERMS_UPDATED");
    expect(adapter.getEventTypes()).not.toContain("NOTE_PROSPECTUS_APPROVED");
    expect(adapter.getEventTypes()).not.toContain("SHORAKA_ORDER_SUBMITTED");
    expect(adapter.getEventTypes()).not.toContain("SETTLEMENT_APPROVED");
    expect(adapter.getEventTypes()).not.toContain("WITHDRAWAL_COMPLETED");
  });
});
