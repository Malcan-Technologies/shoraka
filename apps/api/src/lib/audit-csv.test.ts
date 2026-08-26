import { redactAuditSecrets, serializeAuditMetadata } from "./audit-csv";

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
