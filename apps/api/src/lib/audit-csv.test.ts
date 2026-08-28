import {
  buildAuditCsv,
  humanizeAuditEventType,
  redactAuditSecrets,
  serializeAuditMetadata,
} from "./audit-csv";

describe("redactAuditSecrets", () => {
  it("redacts secret-shaped keys and leaves business evidence", () => {
    expect(
      redactAuditSecrets({
        paymentId: "pay_1",
        amount: 50000,
        access_token: "tok_live",
        nested: { api_key: "secret", noteId: "note_1" },
      })
    ).toEqual({
      paymentId: "pay_1",
      amount: 50000,
      access_token: "[REDACTED]",
      nested: { api_key: "[REDACTED]", noteId: "note_1" },
    });
  });

  it("serializes redacted metadata for CSV", () => {
    expect(serializeAuditMetadata({ refresh_token: "abc", reason: "ok" })).toBe(
      JSON.stringify({ refresh_token: "[REDACTED]", reason: "ok" })
    );
  });
});

describe("humanizeAuditEventType", () => {
  it("keeps MARC as an acronym for MARC_ASSESSMENT_SAVED", () => {
    expect(humanizeAuditEventType("MARC_ASSESSMENT_SAVED")).toBe("MARC Assessment Saved");
    expect(
      humanizeAuditEventType("MARC_ASSESSMENT_SAVED", {
        MARC_ASSESSMENT_SAVED: "MARC Assessment Saved",
      })
    ).toBe("MARC Assessment Saved");
  });
});

describe("buildAuditCsv forensic source labels", () => {
  it("maps API to Portal and leaves notification ADMIN unchanged", () => {
    const csv = buildAuditCsv([
      {
        timestamp: "2026-08-25T10:15:00.000Z",
        event: "Login",
        eventType: "LOGIN",
        source: "API",
      },
      {
        timestamp: "2026-08-25T10:16:00.000Z",
        event: "Broadcast",
        eventType: "CUSTOM",
        source: "ADMIN",
      },
    ]);
    expect(csv).toContain("Portal");
    expect(csv).toContain("ADMIN");
    expect(csv).not.toContain('"API"');
  });
});
