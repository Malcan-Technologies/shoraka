import { assertSigningProductionConfig } from "./production-config";

describe("assertSigningProductionConfig", () => {
  const keys = [
    "NODE_ENV",
    "SC_BASE_URL",
    "SC_API_KEY",
    "SC_API_SECRET",
    "SC_WEBHOOK_SECRET",
    "API_PUBLIC_URL",
    "ISSUER_URL",
  ] as const;
  const prev: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) {
      prev[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      const value = prev[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("does nothing outside production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.SC_WEBHOOK_SECRET;
    expect(() => assertSigningProductionConfig()).not.toThrow();
  });

  it("requires SigningCloud, callback, and return URLs in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SC_BASE_URL;
    delete process.env.SC_API_KEY;
    delete process.env.SC_API_SECRET;
    delete process.env.SC_WEBHOOK_SECRET;
    delete process.env.API_PUBLIC_URL;
    delete process.env.ISSUER_URL;
    expect(() => assertSigningProductionConfig()).toThrow(/SC_BASE_URL/);
  });

  it("passes when all production signing settings are present", () => {
    process.env.NODE_ENV = "production";
    process.env.SC_BASE_URL = "https://sc.example";
    process.env.SC_API_KEY = "key";
    process.env.SC_API_SECRET = "secret";
    process.env.SC_WEBHOOK_SECRET = "webhook";
    process.env.API_PUBLIC_URL = "https://api.example";
    process.env.ISSUER_URL = "https://issuer.example";
    expect(() => assertSigningProductionConfig()).not.toThrow();
  });
});
