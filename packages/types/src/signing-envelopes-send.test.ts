import {
  hasEnvelopeBlockingNewSend,
  signingEnvelopeBlocksNewSend,
  type SigningEnvelopeStatus,
} from "./signing-envelopes";

describe("signingEnvelopeBlocksNewSend", () => {
  it.each(["DRAFT", "SENT", "IN_PROGRESS", "COMPLETED"] as SigningEnvelopeStatus[])(
    "blocks a new send while status is %s",
    (status) => {
      expect(signingEnvelopeBlocksNewSend(status)).toBe(true);
    }
  );

  it.each(["VOIDED", "EXPIRED", "DECLINED"] as SigningEnvelopeStatus[])(
    "allows a new send after %s",
    (status) => {
      expect(signingEnvelopeBlocksNewSend(status)).toBe(false);
    }
  );
});

describe("hasEnvelopeBlockingNewSend", () => {
  it("is false when every envelope is voided", () => {
    expect(hasEnvelopeBlockingNewSend([{ status: "VOIDED" }, { status: "VOIDED" }])).toBe(false);
  });

  it("is true when any live or completed package exists", () => {
    expect(hasEnvelopeBlockingNewSend([{ status: "VOIDED" }, { status: "SENT" }])).toBe(true);
  });
});
