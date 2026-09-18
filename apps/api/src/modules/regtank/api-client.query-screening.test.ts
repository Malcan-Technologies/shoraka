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

describe("RegTankAPIClient screening query endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAccessToken.mockResolvedValue("token-123");
    (global as unknown as { fetch: typeof fetch }).fetch = mockFetch;
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: "APPROVED" }),
    });
  });

  it("queries Acuris KYC and Dow Jones DJKYC on their own endpoints", async () => {
    const client = new RegTankAPIClient();
    await client.queryKYCStatus("KYC00189");
    await client.queryKYCStatus("DJKYC08238");

    expect(mockFetch.mock.calls.map((call) => call[0])).toEqual([
      "https://regtank.example.com/v3/kyc/query?requestId=KYC00189",
      "https://regtank.example.com/v3/djkyc/query?requestId=DJKYC08238",
    ]);
  });

  it("queries Acuris KYB and Dow Jones DJKYB on their own endpoints", async () => {
    const client = new RegTankAPIClient();
    await client.queryKYBStatus("KYB2001");
    await client.queryKYBStatus("DJKYB1001");

    expect(mockFetch.mock.calls.map((call) => call[0])).toEqual([
      "https://regtank.example.com/v3/kyb/query?requestId=KYB2001",
      "https://regtank.example.com/v3/djkyb/query?requestId=DJKYB1001",
    ]);
  });
});
