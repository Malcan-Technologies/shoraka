import { sanitizeAuditMetadata } from "./sanitize-metadata";

describe("sanitizeAuditMetadata", () => {
  it("drops raw payloads, secrets and full IC while keeping structured evidence", () => {
    expect(
      sanitizeAuditMetadata({
        requestId: "COD001",
        status: "URL_GENERATED",
        substatus: "PENDING",
        reasonCode: "AMEND",
        payload: { directors: [{ nric: "900101015432" }] },
        ic_number: "900101015432",
        governmentIdNumber: "900101-01-5432",
        access_token: "secret",
        jwt: "a.b.c",
      })
    ).toEqual({
      requestId: "COD001",
      status: "URL_GENERATED",
      substatus: "PENDING",
      reasonCode: "AMEND",
    });
  });

  it("redacts JWT-shaped strings", () => {
    expect(
      sanitizeAuditMetadata({
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.abc",
      })
    ).toEqual({ token: "[REDACTED]" });
  });
});
