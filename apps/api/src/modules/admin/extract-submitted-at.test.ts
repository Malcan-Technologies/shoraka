import { extractSubmittedAtFromWebhookPayloads } from "./extract-submitted-at";

describe("extractSubmittedAtFromWebhookPayloads", () => {
  it("returns null for PENDING_AMENDMENT", () => {
    const value = extractSubmittedAtFromWebhookPayloads({
      onboardingStatus: "PENDING_AMENDMENT",
      webhookPayloads: [
        { status: "WAIT_FOR_APPROVAL", timestamp: "2026-05-11T15:39:00.000Z" },
      ],
      completedAt: new Date("2026-05-12T00:00:00.000Z"),
    });
    expect(value).toBe(null);
  });

  it("uses latest WAIT_FOR_APPROVAL when multiple payloads exist", () => {
    const value = extractSubmittedAtFromWebhookPayloads({
      onboardingStatus: "PENDING_SSM_REVIEW",
      webhookPayloads: [
        { status: "URL_GENERATED", timestamp: "2026-05-11T15:35:00.000Z" },
        { status: "WAIT_FOR_APPROVAL", timestamp: "2026-05-11T15:39:00.000Z" },
        { status: "WAIT_FOR_APPROVAL", timestamp: "2026-05-11T17:30:00.000Z" },
      ],
      completedAt: null,
    });
    expect(value).toBe("2026-05-11T17:30:00.000Z");
  });

  it("parses JSON string payloads and ignores invalid ones", () => {
    const value = extractSubmittedAtFromWebhookPayloads({
      onboardingStatus: "PENDING_APPROVAL",
      webhookPayloads: [
        JSON.stringify({ status: "WAIT_FOR_APPROVAL", timestamp: "2026-05-11T16:00:00.000Z" }),
        "not-json",
        { status: "WAIT_FOR_APPROVAL", timestamp: "2026-05-11T16:30:00.000Z" },
      ],
      completedAt: null,
    });
    expect(value).toBe("2026-05-11T16:30:00.000Z");
  });

  it("falls back to completedAt when no WAIT_FOR_APPROVAL exists", () => {
    const value = extractSubmittedAtFromWebhookPayloads({
      onboardingStatus: "PENDING_SSM_REVIEW",
      webhookPayloads: [{ status: "URL_GENERATED", timestamp: "2026-05-11T15:35:00.000Z" }],
      completedAt: new Date("2026-05-12T08:00:00.000Z"),
    });
    expect(value).toBe("2026-05-12T08:00:00.000Z");
  });
});

