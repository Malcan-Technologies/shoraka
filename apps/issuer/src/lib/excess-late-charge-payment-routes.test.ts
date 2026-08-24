import {
  buildExcessLateChargeNoteReturnTo,
  buildExcessLateChargeReturnLocation,
  resolveExcessLateChargeReturnTo,
  sanitizeExcessLateChargePaymentId,
} from "./excess-late-charge-payment-routes";

describe("excess late charge payment routes", () => {
  it("sanitizes payment ids and only allows financing note return paths", () => {
    expect(sanitizeExcessLateChargePaymentId("pay_abc-1")).toBe("pay_abc-1");
    expect(sanitizeExcessLateChargePaymentId("bad id")).toBeNull();
    expect(resolveExcessLateChargeReturnTo("/financing/notes/note_1")).toBe(
      "/financing/notes/note_1"
    );
    expect(resolveExcessLateChargeReturnTo("https://evil.example/x")).toBe("/financing");
    expect(buildExcessLateChargeNoteReturnTo("note_1")).toBe("/financing/notes/note_1");
    expect(buildExcessLateChargeReturnLocation("pay_1", "/financing/notes/note_1")).toBe(
      "/financing/notes/note_1?excessLateChargeReturn=pay_1"
    );
  });
});
