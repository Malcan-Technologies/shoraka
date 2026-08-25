import { ApiClient } from "./api-client";

describe("trustee email API client methods", () => {
  it("exposes typed resend methods on the client", () => {
    expect(typeof ApiClient.prototype.resendWithdrawalTrusteeEmail).toBe("function");
    expect(typeof ApiClient.prototype.resendAdminNoteSettlementTrusteeEmail).toBe("function");
  });
});
