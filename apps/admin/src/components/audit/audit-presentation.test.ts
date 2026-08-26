import {
  compactAuditMetadata,
  diffAuditValues,
  formatAuditDateTime,
  formatAuditEventLabel,
  isSystemActorToken,
  presentAuditActorName,
  redactAuditSecrets,
} from "./audit-presentation";
import { buildAuditCsv } from "./audit-csv";

describe("audit presentation", () => {
  it("formats timestamps as d MMM yyyy, h:mm a", () => {
    expect(formatAuditDateTime(new Date(2026, 7, 26, 20, 45))).toBe("26 Aug 2026, 8:45 PM");
  });

  it("humanizes event enums", () => {
    expect(formatAuditEventLabel("APPLICATION_RESUBMITTED")).toBe("Application Resubmitted");
    expect(formatAuditEventLabel("NOTE_ARREARS")).toBe("Note Arrears");
    expect(formatAuditEventLabel("PROFILE_UPDATED", { PROFILE_UPDATED: "User Profile Updated" })).toBe(
      "User Profile Updated"
    );
  });

  it("does not treat SYS as a human name", () => {
    expect(isSystemActorToken("SYS")).toBe(true);
    expect(presentAuditActorName("SYS")).toBe("System");
    expect(presentAuditActorName("Ada Admin")).toBe("Ada Admin");
  });

  it("redacts secrets and keeps business evidence", () => {
    const redacted = redactAuditSecrets({
      password: "secret",
      apiKey: "abc",
      bankAccountNumber: "123456",
      trusteeEmail: "trustee@example.com",
      correlation_id: "corr-1",
    }) as Record<string, unknown>;
    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.apiKey).toBe("[REDACTED]");
    expect(redacted.bankAccountNumber).toBe("123456");
    expect(redacted.trusteeEmail).toBe("trustee@example.com");
    expect(redacted.correlation_id).toBe("corr-1");
  });

  it("diffs only changed fields", () => {
    const rows = diffAuditValues(
      { rate: 1, name: "A", nested: { keep: 1, change: "old" } },
      { rate: 2, name: "A", nested: { keep: 1, change: "new" } }
    );
    expect(rows.map((row) => row.field).sort()).toEqual(["nested.change", "rate"]);
  });

  it("serializes metadata without secrets", () => {
    expect(compactAuditMetadata({ token: "x", noteId: "n-1" })).toContain("n-1");
    expect(compactAuditMetadata({ access_token: "x" })).toContain("[REDACTED]");
  });
});

describe("buildAuditCsv", () => {
  it("writes core headers and quoted cells", () => {
    const csv = buildAuditCsv([
      {
        timestamp: "2026-05-12T14:15:42.000Z",
        event: "Overdue Late Charge Checked",
        eventType: "OVERDUE_LATE_CHARGE_CHECKED",
        actor: "Ada Admin",
        actorType: "ADMIN",
        actorEmail: "ada@example.com",
        source: "ADMIN",
        reason: 'Said "not overdue"',
        metadata: { overdue: false },
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Timestamp");
    expect(lines[0]).toContain("Event Type");
    expect(lines[0]).toContain("Correlation ID");
    expect(lines[1]).toContain("Overdue Late Charge Checked");
    expect(lines[1]).toContain('""not overdue""');
  });
});
