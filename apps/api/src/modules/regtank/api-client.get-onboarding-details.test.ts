import { AppError } from "../../lib/http/error-handler";

const mockGetAccessToken = jest.fn();
const mockFetch = jest.fn();

jest.mock("../../config/regtank", () => ({
  getRegTankConfig: () => ({
    apiBaseUrl: "https://regtank.example.com",
  }),
}));

jest.mock("./oauth-client", () => ({
  getRegTankOAuthClient: () => ({
    getAccessToken: (...args: unknown[]) => mockGetAccessToken(...args),
  }),
}));

jest.mock("../../lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { RegTankAPIClient } from "./api-client";

describe("RegTankAPIClient.getOnboardingDetails endpoint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAccessToken.mockResolvedValue("token-123");
    (global as unknown as { fetch: typeof fetch }).fetch = mockFetch;
  });

  it("uses /v3/onboarding/indv/query?requestId=LD83641-R03 (not /indv/request/{id})", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ requestId: "LD83641-R03", status: "PROCESSING" }),
    });

    const client = new RegTankAPIClient();
    const result = await client.getOnboardingDetails("LD83641-R03");

    expect(result).toMatchObject({ requestId: "LD83641-R03", status: "PROCESSING" });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://regtank.example.com/v3/onboarding/indv/query?requestId=LD83641-R03");
    expect(url).not.toContain("/v3/onboarding/indv/request/LD83641-R03");
  });

  it("404 from correct /indv/query endpoint is surfaced as REGTANK_API_ERROR", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => JSON.stringify({ message: "request not found" }),
    });

    const client = new RegTankAPIClient();
    await expect(client.getOnboardingDetails("LD83641-R03")).rejects.toMatchObject<AppError>({
      statusCode: 404,
      code: "REGTANK_API_ERROR",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://regtank.example.com/v3/onboarding/indv/query?requestId=LD83641-R03");
  });
});

