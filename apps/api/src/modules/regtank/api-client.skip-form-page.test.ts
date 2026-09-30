import type { RegTankIndividualOnboardingRequest } from "./types";

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

function makeIndividualRequest(
  overrides: Partial<RegTankIndividualOnboardingRequest> = {}
): RegTankIndividualOnboardingRequest {
  return {
    email: "ali@example.com",
    surname: "Ali",
    forename: "Ahmad",
    referenceId: "ref-1",
    countryOfResidence: "MY",
    nationality: "MY",
    placeOfBirth: "MY",
    idIssuingCountry: "MY",
    gender: "UNSPECIFIED",
    governmentIdNumber: "",
    idType: "IDENTITY",
    language: "EN",
    bypassIdUpload: false,
    formId: 1015495,
    ...overrides,
  };
}

function lastRequest(): { url: string; body: Record<string, unknown> } {
  const [url, init] = mockFetch.mock.calls[mockFetch.mock.calls.length - 1] as [string, RequestInit];
  return { url, body: JSON.parse(String(init.body)) as Record<string, unknown> };
}

describe("RegTankAPIClient skipFormPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    mockGetAccessToken.mockResolvedValue("token-123");
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          requestId: "LD00001",
          verifyLink: "https://masked.link?requestId=LD00001",
          expiredIn: 86400,
          timestamp: "2023-07-31 09:45:29+0000",
        }),
    });
    (global as unknown as { fetch: typeof fetch }).fetch = mockFetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("createIndividualOnboarding (POST /v3/onboarding/indv/request)", () => {
    it("sends skipFormPage false when the caller passes false", async () => {
      await new RegTankAPIClient().createIndividualOnboarding(
        makeIndividualRequest({ skipFormPage: false })
      );

      const { url, body } = lastRequest();
      expect(url).toBe("https://regtank.example.com/v3/onboarding/indv/request");
      expect(body.skipFormPage).toBe(false);
      expect(body.formId).toBe(1015495);
    });

    it("sends skipFormPage false when the caller omits it", async () => {
      await new RegTankAPIClient().createIndividualOnboarding(makeIndividualRequest());

      expect(lastRequest().body.skipFormPage).toBe(false);
    });

    it("sends skipFormPage false even when the caller passes true", async () => {
      await new RegTankAPIClient().createIndividualOnboarding(
        makeIndividualRequest({ skipFormPage: true })
      );

      expect(lastRequest().body.skipFormPage).toBe(false);
    });
  });

  describe("restartOnboarding (POST /v3/onboarding/indv/restart)", () => {
    it("sends skipFormPage false with no options", async () => {
      await new RegTankAPIClient().restartOnboarding("LD00001");

      const { url, body } = lastRequest();
      expect(url).toBe("https://regtank.example.com/v3/onboarding/indv/restart");
      expect(body).toEqual({ requestId: "LD00001", language: "EN", skipFormPage: false });
    });

    it("sends skipFormPage false when only email is passed", async () => {
      await new RegTankAPIClient().restartOnboarding("LD00001", { email: "ali@example.com" });

      expect(lastRequest().body).toEqual({
        requestId: "LD00001",
        language: "EN",
        skipFormPage: false,
        email: "ali@example.com",
      });
    });

    it("sends skipFormPage false even when the caller passes true", async () => {
      await new RegTankAPIClient().restartOnboarding("LD00001", {
        email: "ali@example.com",
        language: "EN",
        idType: "IDENTITY",
        skipFormPage: true,
      });

      expect(lastRequest().body).toEqual({
        requestId: "LD00001",
        language: "EN",
        idType: "IDENTITY",
        skipFormPage: false,
        email: "ali@example.com",
      });
    });
  });

  describe("endpoints that do not document skipFormPage", () => {
    it("renew-token body has no skipFormPage", async () => {
      await new RegTankAPIClient().renewIndividualOnboardingToken({
        requestId: "LD00001",
        email: "ali@example.com",
      });

      const { url, body } = lastRequest();
      expect(url).toBe("https://regtank.example.com/v3/onboarding/v2/indv/renew-token");
      expect(body).not.toHaveProperty("skipFormPage");
    });

    it("corporate request body has no skipFormPage", async () => {
      await new RegTankAPIClient().createCorporateOnboarding({
        email: "owner@example.com",
        companyName: "Acme Sdn Bhd",
        formName: "Cashsouk Business Onboarding Form",
        referenceId: "org-1",
      });

      const { url, body } = lastRequest();
      expect(url).toBe("https://regtank.example.com/v3/onboarding/corp/request");
      expect(body).toEqual({
        email: "owner@example.com",
        companyName: "Acme Sdn Bhd",
        formName: "Cashsouk Business Onboarding Form",
      });
    });
  });
});
