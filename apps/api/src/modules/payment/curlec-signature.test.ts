import {
  computeCurlecWebhookSignature,
  verifyCurlecWebhookSignature,
} from "./curlec-signature";

describe("Curlec webhook signature", () => {
  const secret = "123456";
  const rawBody = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_test"}}}}';
  const knownSignature =
    "0855efd86332d1e6cb3c2d5f513525089056db35d47adec8499ff672f9064490";

  it("computes a deterministic HMAC-SHA256 hex digest", () => {
    expect(computeCurlecWebhookSignature(rawBody, secret)).toBe(knownSignature);
    expect(knownSignature).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifies a valid signature (known vector)", () => {
    expect(verifyCurlecWebhookSignature(rawBody, knownSignature, secret)).toBe(true);
  });

  it("rejects tampered body", () => {
    expect(verifyCurlecWebhookSignature(`${rawBody}x`, knownSignature, secret)).toBe(false);
  });

  it("rejects wrong secret", () => {
    expect(verifyCurlecWebhookSignature(rawBody, knownSignature, "other-secret")).toBe(false);
  });

  it("rejects malformed signature length without throwing", () => {
    expect(verifyCurlecWebhookSignature(rawBody, knownSignature.slice(0, 10), secret)).toBe(
      false
    );
  });

  it("rejects empty secret or signature", () => {
    expect(verifyCurlecWebhookSignature(rawBody, "", secret)).toBe(false);
    expect(verifyCurlecWebhookSignature(rawBody, knownSignature, "")).toBe(false);
  });
});
