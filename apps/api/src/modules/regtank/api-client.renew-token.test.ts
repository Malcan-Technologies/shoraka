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

describe("RegTankAPIClient.renewIndividualOnboardingToken", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAccessToken.mockResolvedValue("token-123");
    (global as unknown as { fetch: typeof fetch }).fetch = mockFetch;
  });

  it("POSTs /v3/onboarding/v2/indv/renew-token with requestId and email", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          requestId: "LD00001",
          token: "renewed-token",
          expiredIn: 86400,
          timestamp: "2023-07-31 09:45:29+0000",
        }),
    });

    const client = new RegTankAPIClient();
    const result = await client.renewIndividualOnboardingToken({
      requestId: "LD00001",
      email: "ali@example.com",
    });

    expect(result).toMatchObject({
      requestId: "LD00001",
      token: "renewed-token",
      expiredIn: 86400,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://regtank.example.com/v3/onboarding/v2/indv/renew-token");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      requestId: "LD00001",
      email: "ali@example.com",
    });
  });

  it("surfaces RegTank HTTP errors", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          errorCode: "ERROR_REQUEST_NOT_FOUND",
          message: "Request not found",
        }),
    });

    const client = new RegTankAPIClient();
    await expect(
      client.renewIndividualOnboardingToken({
        requestId: "LD011236",
        email: "ali@example.com",
      })
    ).rejects.toBeInstanceOf(AppError);
  });
});
