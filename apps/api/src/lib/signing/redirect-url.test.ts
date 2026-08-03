import { validateSigningRedirectUrl, buildSigningReturnUrl } from "../../lib/signing/redirect-url";

describe("signing redirect URL helpers", () => {
  const prevIssuerUrl = process.env.ISSUER_URL;

  afterEach(() => {
    process.env.ISSUER_URL = prevIssuerUrl;
  });

  it("accepts redirect URLs matching ISSUER_URL origin", () => {
    process.env.ISSUER_URL = "https://issuer.example.com";
    expect(validateSigningRedirectUrl("https://issuer.example.com/signing/return?rs=abc")).toBe(
      "https://issuer.example.com/signing/return?rs=abc"
    );
  });

  it("rejects redirect URLs on other origins", () => {
    process.env.ISSUER_URL = "https://issuer.example.com";
    expect(validateSigningRedirectUrl("https://evil.example.com/callback")).toBeNull();
  });

  it("builds return URLs without access tokens", () => {
    process.env.ISSUER_URL = "https://issuer.example.com";
    expect(buildSigningReturnUrl("rs-123")).toBe(
      "https://issuer.example.com/signing/return?rs=rs-123"
    );
  });
});
