import rateLimit from "express-rate-limit";

/** Default API-wide limiter — applies to all routes after webhooks. */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100000,
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

/** Tighter bucket for issuer invoice-offer OTP requests. Keyed by user + invoice, never email. */
export const otpRequestRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const userId = req.user?.user_id;
    const invoiceId = typeof req.params.invoiceId === "string" ? req.params.invoiceId : "";
    if (userId) return `offer-accept-otp:${userId}:${invoiceId}`;
    return `offer-accept-otp:ip:${req.ip ?? "unknown"}:${invoiceId}`;
  },
  message: {
    success: false,
    error: { code: "RATE_LIMITED", message: "Too many verification code requests. Please try again later." },
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
