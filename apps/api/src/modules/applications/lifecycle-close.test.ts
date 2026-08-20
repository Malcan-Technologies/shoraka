import { shouldRejectEntityStatus, rejectOfferDetailsJson, getVoidableEnvelopeIds } from "./lifecycle-close";

describe("shouldRejectEntityStatus", () => {
  it("skips already-terminal entities", () => {
    for (const status of ["APPROVED", "REJECTED", "WITHDRAWN"]) {
      expect(shouldRejectEntityStatus(status)).toBe(false);
    }
  });

  it("rejects non-final entities", () => {
    for (const status of ["SUBMITTED", "OFFER_SENT", "DRAFT", "OFFER_EXPIRED"]) {
      expect(shouldRejectEntityStatus(status)).toBe(true);
    }
  });
});

describe("rejectOfferDetailsJson", () => {
  it("sets offer_acceptance to REJECTED when in flight", () => {
    const result = rejectOfferDetailsJson({
      offer_acceptance: {
        status: "PENDING_ISSUER",
        submitted_at: null,
      },
    }) as Record<string, unknown>;
    expect((result.offer_acceptance as { status: string }).status).toBe("REJECTED");
  });

  it("returns undefined when no offer acceptance", () => {
    expect(rejectOfferDetailsJson({})).toBeUndefined();
  });

  it("returns undefined when already terminal", () => {
    expect(
      rejectOfferDetailsJson({
        offer_acceptance: { status: "COMPLETED", submitted_at: "2026-01-01" },
      })
    ).toBeUndefined();
  });
});

describe("getVoidableEnvelopeIds", () => {
  it("returns only DRAFT, SENT, and IN_PROGRESS envelopes", () => {
    expect(
      getVoidableEnvelopeIds([
        { id: "draft", status: "DRAFT" },
        { id: "sent", status: "SENT" },
        { id: "progress", status: "IN_PROGRESS" },
        { id: "completed", status: "COMPLETED" },
        { id: "voided", status: "VOIDED" },
        { id: "declined", status: "DECLINED" },
      ])
    ).toEqual(["draft", "sent", "progress"]);
  });

  it("ignores missing statuses", () => {
    expect(getVoidableEnvelopeIds([{ id: "empty", status: null }])).toEqual([]);
  });
});
