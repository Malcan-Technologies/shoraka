import rateLimit from "express-rate-limit";

/** Default API-wide limiter — applies to all routes after webhooks. */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
  },
});

/** Tighter bucket for unauthenticated external signing routes (IC gate is low-entropy). */
export const externalSigningRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many signing attempts. Please try again later." },
  },
});

/** Tighter bucket for SigningCloud webhook callbacks. */
export const signingCloudWebhookRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many webhook requests." },
  },
});
