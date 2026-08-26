import { ApiClient } from "./api-client";

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null),
    },
    json: () => Promise.resolve(data),
  } as Response;
}

describe("invoice offer accept OTP API client", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("GETs signatories from the accept-otp path", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: { source: "FACILITY_ENVELOPE", signatories: [] },
        correlationId: "c1",
      })
    );
    global.fetch = fetchMock;
    const client = new ApiClient("http://api.test");

    await client.getInvoiceAcceptSignatories("clapp00000000000000000001", "clinv00000000000000000001");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/v1/applications/clapp00000000000000000001/offers/invoices/clinv00000000000000000001/accept-otp/signatories",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("POSTs signatory_email when requesting an OTP", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        success: true,
        data: {
          challenge_id: "cmchallenge000000000000001",
          expires_at: "2026-08-24T00:10:00.000Z",
          last_sent_at: "2026-08-24T00:00:00.000Z",
          resend_available_at: "2026-08-24T00:01:00.000Z",
          remaining_sends: 4,
          remaining_attempts: 3,
        },
        correlationId: "c1",
      })
    );
    global.fetch = fetchMock;
    const client = new ApiClient("http://api.test");

    await client.requestInvoiceAcceptOtp("clapp00000000000000000001", "clinv00000000000000000001", {
      signatory_email: "ali@co.my",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/v1/applications/clapp00000000000000000001/offers/invoices/clinv00000000000000000001/accept-otp/request",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ signatory_email: "ali@co.my" }),
      })
    );
  });

  it("POSTs challenge_id and otp_code on accept", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, data: { id: "app-1" }, correlationId: "c1" })
    );
    global.fetch = fetchMock;
    const client = new ApiClient("http://api.test");

    await client.acceptInvoiceOffer("clapp00000000000000000001", "clinv00000000000000000001", {
      challenge_id: "cmchallenge000000000000001",
      otp_code: "123456",
      consent_ids: ["transaction_details", "digital_authorisation", "full_authorisation"],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/v1/applications/clapp00000000000000000001/offers/invoices/clinv00000000000000000001/accept",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          challenge_id: "cmchallenge000000000000001",
          otp_code: "123456",
          consent_ids: ["transaction_details", "digital_authorisation", "full_authorisation"],
        }),
      })
    );
  });

  it("GETs the summary PDF blob and uses Content-Disposition", async () => {
    const blob = new Blob(["%PDF"], { type: "application/pdf" });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-disposition"
            ? 'attachment; filename="application-summary-APP-1.pdf"'
            : null,
      },
      blob: () => Promise.resolve(blob),
    } as Response);
    global.fetch = fetchMock;
    const client = new ApiClient("http://api.test");

    const result = await client.getApplicationSummaryPdfBlob("clapp00000000000000000001");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/v1/applications/clapp00000000000000000001/summary-pdf",
      expect.objectContaining({ method: "GET" })
    );
    expect(result.filename).toBe("application-summary-APP-1.pdf");
    expect(result.blob).toBe(blob);
  });
});
