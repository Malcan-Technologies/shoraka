import { webhookOccurredAt } from "./webhook-occurred-at";

describe("webhookOccurredAt", () => {
  const fallback = new Date("2026-09-10T00:00:00.000Z");

  it("uses the webhook event instant", () => {
    expect(webhookOccurredAt("2026-09-08T16:30:00.000Z", fallback)).toEqual(
      new Date("2026-09-08T16:30:00.000Z")
    );
  });

  it.each([undefined, "", "invalid"])("falls back for an unusable timestamp", (timestamp) => {
    expect(webhookOccurredAt(timestamp, fallback)).toBe(fallback);
  });
});
