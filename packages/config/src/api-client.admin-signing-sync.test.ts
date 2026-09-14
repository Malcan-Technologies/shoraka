import { ApiClient } from "./api-client";

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? "application/json" : null),
    },
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}

describe("syncAdminSigningEnvelopeFromProvider", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("POSTs the admin envelope sync-from-provider path", async () => {
    const envelope = { id: "env-1", status: "COMPLETED" };
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ success: true, data: envelope, correlationId: "c1" })
    );
    global.fetch = fetchMock;
    const client = new ApiClient("http://api.test");

    const result = await client.syncAdminSigningEnvelopeFromProvider("env-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/v1/admin/signing/envelopes/env-1/sync-from-provider",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      })
    );
    expect(result).toEqual({ success: true, data: envelope, correlationId: "c1" });
  });
});
