import { WithdrawalType } from "@prisma/client";
import { NoteLogAdapter } from "./note-log";

jest.mock("../../../lib/prisma", () => ({
  prisma: {
    noteEvent: { findMany: jest.fn() },
    withdrawalInstruction: { findMany: jest.fn() },
  },
}));

const { prisma } = jest.requireMock("../../../lib/prisma") as {
  prisma: {
    noteEvent: { findMany: jest.Mock };
    withdrawalInstruction: { findMany: jest.Mock };
  };
};

function createRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "event_1",
    note_id: "note_1",
    event_type: "ACTIVATE",
    actor_user_id: "user_1",
    actor_role: "ADMIN",
    portal: "ADMIN",
    ip_address: null,
    user_agent: null,
    correlation_id: null,
    metadata: {},
    created_at: new Date("2026-01-01T00:00:00Z"),
    note: {
      id: "note_1",
      issuer_organization_id: "issuer-org-1",
      note_reference: "NOTE-001",
      title: "Bridge Note",
    },
    ...overrides,
  };
}

describe("NoteLogAdapter", () => {
  const adapter = new NoteLogAdapter();

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.withdrawalInstruction.findMany.mockResolvedValue([]);
  });

  it("builds user-facing note copy", () => {
    expect(
      adapter.buildPresentation("PUBLISH", {
        noteReference: "NOTE-001",
      })
    ).toEqual({
      title: "Note Published",
      description: "Note NOTE-001 is now live and open for investment.",
    });

    expect(
      adapter.buildPresentation("SETTLEMENT_POSTED", {
        noteTitle: "Bridge Note",
      })
    ).toEqual({
      title: "Settlement Posted",
      description: "Your returns for note Bridge Note were posted.",
    });
  });

  it("keeps issuer activity limited to shared and issuer-only events", async () => {
    prisma.noteEvent.findMany.mockResolvedValue([
      createRecord({ id: "issuer_1", event_type: "CLOSE_FUNDING" }),
      createRecord({
        id: "issuer_2",
        event_type: "INVESTMENT_COMMITTED",
        metadata: { investorOrganizationId: "investor-org-1" },
      }),
      createRecord({ id: "issuer_3", event_type: "NOTE_DEFAULT_MARKED" }),
    ]);

    const records = await adapter.query("user_1", {
      organizationId: "issuer-org-1",
      portalType: "issuer",
      limit: 10,
      offset: 0,
    });

    expect(records.map((record) => record.event_type)).toEqual(["CLOSE_FUNDING", "NOTE_DEFAULT_MARKED"]);
  });

  it("only shows investment commits to the matching investor organization", async () => {
    prisma.noteEvent.findMany.mockResolvedValue([
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
      }),
      createRecord({
        id: "investor_4",
        event_type: "PAYMENT_RECEIVED",
      }),
    ]);

    const records = await adapter.query("user_1", {
      organizationId: "investor-org-1",
      portalType: "investor",
      limit: 10,
      offset: 0,
    });

    expect(records.map((record) => record.id)).toEqual(["investor_1", "investor_3"]);
  });

  it("normalizes issuer disbursement completion to note active and hides other withdrawals", async () => {
    prisma.noteEvent.findMany.mockResolvedValue([
      createRecord({
        id: "withdrawal_1",
        event_type: "WITHDRAWAL_COMPLETED",
        metadata: { withdrawalId: "wd_1" },
      }),
      createRecord({
        id: "withdrawal_2",
        event_type: "WITHDRAWAL_COMPLETED",
        metadata: { withdrawalId: "wd_2" },
      }),
    ]);
    prisma.withdrawalInstruction.findMany.mockResolvedValue([
      { id: "wd_1", withdrawal_type: WithdrawalType.ISSUER_DISBURSEMENT },
      { id: "wd_2", withdrawal_type: WithdrawalType.ISSUER_RESIDUAL_RETURN },
    ]);

    const records = await adapter.query("user_1", {
      organizationId: "issuer-org-1",
      portalType: "issuer",
      limit: 10,
      offset: 0,
    });

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe("withdrawal_1");

    const transformed = adapter.transform(records[0] as any);
    expect(transformed.title).toBe("Note Active");
    expect(transformed.description).toBe("Note NOTE-001 is now active and servicing has started.");
  });

  it("only exposes curated high-signal note events", () => {
    expect(adapter.getEventTypes()).toContain("ACTIVATE");
    expect(adapter.getEventTypes()).toContain("SETTLEMENT_POSTED");
    expect(adapter.getEventTypes()).not.toContain("PAYMENT_RECEIVED");
    expect(adapter.getEventTypes()).not.toContain("SHORAKA_ORDER_SUBMITTED");
    expect(adapter.getEventTypes()).not.toContain("SETTLEMENT_APPROVED");
  });
});
