const { CSP_FRAME_ANCESTORS, getSecurityHeaders } = require("../security-headers.cjs") as {
  CSP_FRAME_ANCESTORS: string;
  getSecurityHeaders: (nodeEnv?: string) => Array<{ key: string; value: string }>;
};

describe("security headers helper", () => {
  it("sets framing, nosniff, and referrer policy without HSTS in development", () => {
    expect(CSP_FRAME_ANCESTORS).toBe("frame-ancestors 'self'");
    expect(getSecurityHeaders("development")).toEqual([
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ]);
  });

  it("adds one-year HSTS with includeSubDomains only in production", () => {
    expect(getSecurityHeaders("production")).toEqual([
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      },
    ]);
  });
});
