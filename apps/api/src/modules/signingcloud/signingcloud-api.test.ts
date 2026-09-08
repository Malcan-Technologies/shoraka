import {
  extractSigningUrlFromManualSigningResponse,
  signingCloudAccessTokenTtlMs,
} from "./signingcloud-api";

describe("extractSigningUrlFromManualSigningResponse", () => {
  it("reads nested previewurl", () => {
    expect(
      extractSigningUrlFromManualSigningResponse({
        data: { previewurl: "https://sign.example/session" },
      })
    ).toBe("https://sign.example/session");
  });

  it("returns null when no URL is present", () => {
    expect(extractSigningUrlFromManualSigningResponse({ result: 0 })).toBeNull();
  });
});

describe("signingCloudAccessTokenTtlMs", () => {
  const prev = process.env.SC_ACCESS_TOKEN_TTL_MS;

  afterEach(() => {
    if (prev === undefined) delete process.env.SC_ACCESS_TOKEN_TTL_MS;
    else process.env.SC_ACCESS_TOKEN_TTL_MS = prev;
  });

  it("defaults to 25 minutes", () => {
    delete process.env.SC_ACCESS_TOKEN_TTL_MS;
    expect(signingCloudAccessTokenTtlMs()).toBe(25 * 60 * 1000);
  });

  it("honours a valid override", () => {
    process.env.SC_ACCESS_TOKEN_TTL_MS = "120000";
    expect(signingCloudAccessTokenTtlMs()).toBe(120000);
  });
});
