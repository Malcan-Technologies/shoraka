import { shouldRejectEntityStatus, rejectOfferDetailsJson } from "./lifecycle-close";

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
