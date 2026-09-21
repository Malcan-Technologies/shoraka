/**
 * Shared response security headers for Next.js portals.
 * HSTS is production-only so local `next dev` never pins HTTPS.
 */
function getSecurityHeaders(nodeEnv = process.env.NODE_ENV) {
  const headers = [
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ];

  if (nodeEnv === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    });
  }

  return headers;
}

exports.CSP_FRAME_ANCESTORS = "frame-ancestors 'self'";
exports.getSecurityHeaders = getSecurityHeaders;
