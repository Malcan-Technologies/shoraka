import { downloadGeneratedDocument } from "./download-generated-document";

describe("downloadGeneratedDocument", () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("surfaces API error message on failure", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { message: "Contract offer has not been sent yet." },
      }),
    }) as typeof fetch;

    const ok = await downloadGeneratedDocument({
      applicationId: "app_1",
      typeKey: "arf_contract_facility_loo",
      getAccessToken: async () => "token",
    });

    expect(ok).toBe(false);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/v1/applications/app_1/generated-documents/arf_contract_facility_loo?format=pdf"
      ),
      expect.objectContaining({ headers: { Authorization: "Bearer token" } })
    );
  });

  it("returns false when not authenticated", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    const ok = await downloadGeneratedDocument({
      applicationId: "app_1",
      typeKey: "arf_contract_facility_loo",
      getAccessToken: async () => null,
    });

    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
