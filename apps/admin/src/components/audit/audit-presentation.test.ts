import {
  compactAuditMetadata,
  diffAuditValues,
  formatAuditDateTime,
  formatAuditEventLabel,
  formatAuditSourceLabel,
  formatRoleSwitchedLabel,
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
    expect(formatAuditEventLabel("AMENDMENTS_SUBMITTED")).toBe("Amendment Request Sent");
    expect(formatAuditEventLabel("AMENDMENTS_SUBMITTED")).not.toBe("Amendments Submitted");
    expect(formatAuditEventLabel("NOTE_ARREARS")).toBe("Note Arrears");
    expect(formatAuditEventLabel("PROFILE_UPDATED", { PROFILE_UPDATED: "User Profile Updated" })).toBe(
      "User Profile Updated"
    );
    expect(formatAuditEventLabel("LEGAL_DOCUMENT_CREATED")).toBe("Document Created");
    expect(formatAuditEventLabel("LEGAL_VERSION_FILE_REPLACED")).toBe("Version File Replaced");
  });

  it("labels ROLE_SWITCHED from metadata without splitting the event id", () => {
    expect(formatRoleSwitchedLabel({ action: "DEACTIVATED" })).toBe("Admin Deactivated");
    expect(formatRoleSwitchedLabel({ action: "DEACTIVATED_VIA_ROLE_REMOVAL" })).toBe(
      "Admin Deactivated"
    );
    expect(formatRoleSwitchedLabel({ action: "REACTIVATED" })).toBe("Admin Reactivated");
    expect(formatRoleSwitchedLabel({ action: "ACTIVATED_VIA_ROLE_ADDITION" })).toBe(
      "Admin Reactivated"
    );
    expect(formatRoleSwitchedLabel({ previousRole: "OPS", newRole: "SUPER_ADMIN" })).toBe(
      "Admin Role Changed"
    );
    expect(formatRoleSwitchedLabel({ newRole: "INVESTOR" })).toBe("Role Switched");
  });

  it("does not treat SYS as a human name", () => {
    expect(isSystemActorToken("SYS")).toBe(true);
    expect(presentAuditActorName("SYS")).toBe("System");
    expect(presentAuditActorName("Ada Admin")).toBe("Ada Admin");
  });

  it("labels source as a channel, not a second actor type", () => {
    expect(formatAuditSourceLabel("ADMIN")).toBe("Admin Portal");
    expect(formatAuditSourceLabel("API")).toBe("API");
    expect(formatAuditSourceLabel("SYSTEM")).toBe("System");
    expect(formatAuditSourceLabel("SYSTEM_JOB")).toBe("System Job");
    expect(formatAuditSourceLabel("WEBHOOK")).toBe("Webhook");
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
