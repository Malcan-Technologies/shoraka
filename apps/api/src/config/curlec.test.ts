import {
  getConfiguredCurlecGatewayAccounts,
  getCurlecConfig,
  getCurlecGatewayAccountConfigStatus,
  resetCurlecConfigCache,
} from "./curlec";

describe("getCurlecConfig(account)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CURLEC_KEY_ID;
    delete process.env.CURLEC_KEY_SECRET;
    delete process.env.CURLEC_WEBHOOK_SECRET;
    delete process.env.CURLEC_OPERATING_KEY_ID;
    delete process.env.CURLEC_OPERATING_KEY_SECRET;
    delete process.env.CURLEC_OPERATING_WEBHOOK_SECRET;
    delete process.env.CURLEC_INVESTOR_POOL_KEY_ID;
    delete process.env.CURLEC_INVESTOR_POOL_KEY_SECRET;
    delete process.env.CURLEC_INVESTOR_POOL_WEBHOOK_SECRET;
    resetCurlecConfigCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetCurlecConfigCache();
  });

  it("resolves OPERATING from CURLEC_OPERATING_* variables only", () => {
    process.env.CURLEC_OPERATING_KEY_ID = "rzp_operating_key";
    process.env.CURLEC_OPERATING_KEY_SECRET = "operating_secret";
    process.env.CURLEC_OPERATING_WEBHOOK_SECRET = "operating_webhook";
    process.env.CURLEC_API_BASE_URL = "https://api.razorpay.com";

    const config = getCurlecConfig("OPERATING");

    expect(config.gatewayAccount).toBe("OPERATING");
    expect(config.keyId).toBe("rzp_operating_key");
    expect(config.keySecret).toBe("operating_secret");
    expect(config.webhookSecret).toBe("operating_webhook");
    expect(config.apiBaseUrl).toBe("https://api.razorpay.com");
  });

  it("resolves INVESTOR_POOL from CURLEC_INVESTOR_POOL_* variables only", () => {
    process.env.CURLEC_INVESTOR_POOL_KEY_ID = "rzp_pool_key";
    process.env.CURLEC_INVESTOR_POOL_KEY_SECRET = "pool_secret";
    process.env.CURLEC_INVESTOR_POOL_WEBHOOK_SECRET = "pool_webhook";

    const config = getCurlecConfig("INVESTOR_POOL");

    expect(config.gatewayAccount).toBe("INVESTOR_POOL");
    expect(config.keyId).toBe("rzp_pool_key");
    expect(config.keySecret).toBe("pool_secret");
    expect(config.webhookSecret).toBe("pool_webhook");
  });

  it("ignores unsupported legacy CURLEC_* variables for OPERATING", () => {
    process.env.CURLEC_KEY_ID = "rzp_legacy_key";
    process.env.CURLEC_KEY_SECRET = "legacy_secret";
    process.env.CURLEC_WEBHOOK_SECRET = "legacy_webhook";

    expect(() => getCurlecConfig("OPERATING")).toThrow(
      /CURLEC_OPERATING_KEY_ID, CURLEC_OPERATING_KEY_SECRET, CURLEC_OPERATING_WEBHOOK_SECRET/
    );
  });

  it("fails clearly when INVESTOR_POOL credentials are missing", () => {
    expect(() => getCurlecConfig("INVESTOR_POOL")).toThrow(
      /CURLEC_INVESTOR_POOL_KEY_ID, CURLEC_INVESTOR_POOL_KEY_SECRET, CURLEC_INVESTOR_POOL_WEBHOOK_SECRET/
    );
  });

  it("does not silently fall back from OPERATING to legacy CURLEC_* vars", () => {
    process.env.CURLEC_KEY_ID = "rzp_legacy_key";
    process.env.CURLEC_KEY_SECRET = "legacy_secret";
    process.env.CURLEC_WEBHOOK_SECRET = "legacy_webhook";
    process.env.CURLEC_OPERATING_KEY_ID = "";
    process.env.CURLEC_OPERATING_KEY_SECRET = "";
    process.env.CURLEC_OPERATING_WEBHOOK_SECRET = "";

    expect(() => getCurlecConfig("OPERATING")).toThrow(/Curlec OPERATING credentials are required/);
  });

  it("applies shared CURLEC_API_BASE_URL to all accounts", () => {
    process.env.CURLEC_API_BASE_URL = "https://api.example-curlec.test";
    process.env.CURLEC_OPERATING_KEY_ID = "rzp_operating_key";
    process.env.CURLEC_OPERATING_KEY_SECRET = "operating_secret";
    process.env.CURLEC_OPERATING_WEBHOOK_SECRET = "operating_webhook";
    process.env.CURLEC_INVESTOR_POOL_KEY_ID = "rzp_pool_key";
    process.env.CURLEC_INVESTOR_POOL_KEY_SECRET = "pool_secret";
    process.env.CURLEC_INVESTOR_POOL_WEBHOOK_SECRET = "pool_webhook";

    const operating = getCurlecConfig("OPERATING");
    const investorPool = getCurlecConfig("INVESTOR_POOL");

    expect(operating.apiBaseUrl).toBe("https://api.example-curlec.test");
    expect(investorPool.apiBaseUrl).toBe("https://api.example-curlec.test");
  });

  it("returns configured gateway accounts only", () => {
    process.env.CURLEC_INVESTOR_POOL_KEY_ID = "rzp_pool_key";
    process.env.CURLEC_INVESTOR_POOL_KEY_SECRET = "pool_secret";
    process.env.CURLEC_INVESTOR_POOL_WEBHOOK_SECRET = "pool_webhook";

    expect(getConfiguredCurlecGatewayAccounts()).toEqual(["INVESTOR_POOL"]);
  });

  it("configured account list contains only OPERATING and INVESTOR_POOL when both set", () => {
    process.env.CURLEC_OPERATING_KEY_ID = "rzp_operating_key";
    process.env.CURLEC_OPERATING_KEY_SECRET = "operating_secret";
    process.env.CURLEC_OPERATING_WEBHOOK_SECRET = "operating_webhook";
    process.env.CURLEC_INVESTOR_POOL_KEY_ID = "rzp_pool_key";
    process.env.CURLEC_INVESTOR_POOL_KEY_SECRET = "pool_secret";
    process.env.CURLEC_INVESTOR_POOL_WEBHOOK_SECRET = "pool_webhook";

    expect(getConfiguredCurlecGatewayAccounts()).toEqual(["OPERATING", "INVESTOR_POOL"]);
  });

  it("flags partial credentials for account status checks", () => {
    process.env.CURLEC_OPERATING_KEY_ID = "rzp_operating_key";

    const status = getCurlecGatewayAccountConfigStatus("OPERATING");
    expect(status.configured).toBe(false);
    expect(status.isPartial).toBe(true);
    expect(status.missingEnvNames).toEqual([
      "CURLEC_OPERATING_KEY_SECRET",
      "CURLEC_OPERATING_WEBHOOK_SECRET",
    ]);
  });

  it("flags fully unconfigured account without partial status", () => {
    const status = getCurlecGatewayAccountConfigStatus("INVESTOR_POOL");
    expect(status.configured).toBe(false);
    expect(status.isPartial).toBe(false);
    expect(status.missingEnvNames).toEqual([
      "CURLEC_INVESTOR_POOL_KEY_ID",
      "CURLEC_INVESTOR_POOL_KEY_SECRET",
      "CURLEC_INVESTOR_POOL_WEBHOOK_SECRET",
    ]);
  });

  it("rejects unknown gateway account values", () => {
    expect(() => getCurlecConfig("LEGACY_DEFAULT" as "OPERATING")).toThrow(
      /Unsupported Curlec gateway account/
    );
  });
});
