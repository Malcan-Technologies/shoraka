import {
  compactAuditMetadata,
  diffAuditValues,
  extractPreviousNext,
  formatAuditDateTime,
  formatAuditEventLabel,
  formatAuditSourceLabel,
  formatRoleSwitchedLabel,
  isSystemActorToken,
  presentAuditActorName,
  presentMarcAssessmentAuditValues,
  productNameFromLogMetadata,
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
    expect(formatAuditEventLabel("MEMBER_ADDED")).toBe("Member Added");
    expect(formatAuditEventLabel("MEMBER_INVITED")).toBe("Member Invited");
    expect(formatAuditEventLabel("MEMBER_REMOVED")).toBe("Member Removed");
    expect(formatAuditEventLabel("MEMBER_ROLE_CHANGED")).toBe("Member Role Changed");
    expect(formatAuditEventLabel("MARC_ASSESSMENT_SAVED")).toBe("MARC Assessment Saved");
    expect(formatAuditEventLabel("MEMBER_ADDED")).not.toBe("Role Added");
    expect(formatAuditEventLabel("MEMBER_REMOVED")).not.toBe("Role Removed");
  });

  it("reads Product Name from workflow snapshot and ignores dead metadata keys", () => {
    expect(
      productNameFromLogMetadata({ workflow: [{ config: { name: "Invoice Financing" } }] })
    ).toBe("Invoice Financing");
    expect(
      productNameFromLogMetadata({
        workflow: [{ config: { type: { name: "Receivables Financing" } } }],
      })
    ).toBe("Receivables Financing");
    expect(
      productNameFromLogMetadata({ product_name: "Legacy Name", name: "Also Legacy" })
    ).toBeNull();
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

  it("labels forensic source as a channel, not a second actor type", () => {
    expect(formatAuditSourceLabel("API")).toBe("Portal");
    expect(formatAuditSourceLabel("PORTAL")).toBe("Portal");
    expect(formatAuditSourceLabel("WEBHOOK")).toBe("Webhook");
    expect(formatAuditSourceLabel("SYSTEM_JOB")).toBe("System job");
    expect(formatAuditSourceLabel("INTERNAL")).toBe("Internal process");
    expect(formatAuditSourceLabel(null)).toBe("");
    expect(formatAuditSourceLabel("")).toBe("");
    expect(formatAuditSourceLabel("ADMIN")).toBe("Admin Portal");
    expect(formatAuditSourceLabel("SYSTEM")).toBe("System");
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

  it("reads note beforeState/afterState into previous/next panels", () => {
    expect(
      extractPreviousNext({
        beforeState: { noteReference: "NT-1", status: "DRAFT" },
        afterState: { noteReference: "NT-1", status: "PUBLISHED" },
      })
    ).toEqual({
      previous: { noteReference: "NT-1", status: "DRAFT" },
      next: { noteReference: "NT-1", status: "PUBLISHED" },
    });
  });

  it("prefers previousValues over beforeState and leaves historical rows without either blank", () => {
    expect(
      extractPreviousNext({
        previousValues: { enabled: true },
        beforeState: { enabled: false },
        nextValues: { enabled: false },
      })
    ).toEqual({ previous: { enabled: true }, next: { enabled: false } });
    expect(extractPreviousNext({ remark: "none" })).toEqual({
      previous: undefined,
      next: undefined,
    });
  });

  it("formats MARC previous/next values with business labels", () => {
    expect(
      presentMarcAssessmentAuditValues({
        creditGrade: "SME-3",
        creditScore: 78.2,
        probabilityOfDefault: 1.8,
        reportFileName: "MARC_Report_Aug.pdf",
        reportDate: "2026-08-25",
      })
    ).toEqual({
      "Credit Grade": "SME-3",
      "Credit Score": "78.2",
      "Probability of Default": "1.80%",
      Report: "MARC_Report_Aug.pdf",
      "Report Date": "25 Aug 2026",
    });
    expect(presentMarcAssessmentAuditValues(null)).toBeNull();
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

  it("exports MARC Assessment Saved with the raw event ID and previous/next metadata", () => {
    const csv = buildAuditCsv([
      {
        timestamp: "2026-08-25T10:15:00.000Z",
        event: "MARC Assessment Saved",
        eventType: "MARC_ASSESSMENT_SAVED",
        actor: "Adam Lee",
        actorType: "ADMIN",
        organisation: "ABC Trading",
        source: "API",
        targetType: "ORGANIZATION",
        targetReference: "ISS-202608-DK3",
        metadata: {
          previousValues: { creditGrade: "SME-4", creditScore: 65 },
          nextValues: { creditGrade: "SME-3", creditScore: 74 },
        },
      },
    ]);
    expect(csv).toContain("MARC Assessment Saved");
    expect(csv).toContain("MARC_ASSESSMENT_SAVED");
    expect(csv).toContain("ISS-202608-DK3");
    expect(csv).toContain("Portal");
    expect(csv).not.toContain('"API"');
    expect(csv).toContain("SME-4");
    expect(csv).toContain("SME-3");
  });

  it("maps forensic source for Operations and leaves unrelated source values unchanged", () => {
    const csv = buildAuditCsv([
      { timestamp: "2026-08-25T10:15:00.000Z", event: "Login", eventType: "LOGIN", source: "API" },
      {
        timestamp: "2026-08-25T10:16:00.000Z",
        event: "Fee Paid",
        eventType: "ONBOARDING_FEE_PAID",
        source: "WEBHOOK",
      },
      {
        timestamp: "2026-08-25T10:17:00.000Z",
        event: "Offer Expired",
        eventType: "CONTRACT_OFFER_EXPIRED",
        source: "SYSTEM_JOB",
      },
      {
        timestamp: "2026-08-25T10:18:00.000Z",
        event: "Occupancy Updated",
        eventType: "FACILITY_OCCUPANCY_UPDATED",
        source: "INTERNAL",
      },
      {
        timestamp: "2026-08-25T10:19:00.000Z",
        event: "Broadcast",
        eventType: "CUSTOM",
        source: "ADMIN",
      },
      {
        timestamp: "2026-08-25T10:20:00.000Z",
        event: "System send",
        eventType: "CUSTOM",
        source: "SYSTEM",
      },
      {
        timestamp: "2026-08-25T10:21:00.000Z",
        event: "Repayment received",
        eventType: "PAYMENT_RECORDED",
        source: "PAYMASTER",
      },
      { timestamp: "2026-08-25T10:22:00.000Z", event: "Login", eventType: "LOGIN", source: null },
    ]);
    expect(csv).toContain("Portal");
    expect(csv).toContain("Webhook");
    expect(csv).toContain("System job");
    expect(csv).toContain("Internal process");
    expect(csv).toContain('"ADMIN"');
    expect(csv).toContain('"SYSTEM"');
    expect(csv).toContain('"PAYMASTER"');
    expect(csv).not.toContain('"API"');
    expect(csv).not.toContain("SYSTEM_JOB");
  });
});
