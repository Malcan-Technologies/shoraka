import { GatewayPaymentStatus } from "@prisma/client";
import { assertTransition, isTransitionAllowed, TERMINAL_GATEWAY_STATUSES } from "./state";

describe("gateway payment state transitions", () => {
  it("allows CREATED → PAID", () => {
    expect(isTransitionAllowed(GatewayPaymentStatus.CREATED, GatewayPaymentStatus.PAID)).toBe(true);
  });

  it("allows PAID → COMPLETED | HELD | REFUND_INITIATED", () => {
    expect(isTransitionAllowed(GatewayPaymentStatus.PAID, GatewayPaymentStatus.COMPLETED)).toBe(true);
    expect(isTransitionAllowed(GatewayPaymentStatus.PAID, GatewayPaymentStatus.HELD)).toBe(true);
    expect(isTransitionAllowed(GatewayPaymentStatus.PAID, GatewayPaymentStatus.REFUND_INITIATED)).toBe(
      true
    );
  });

  it("rejects CREATED → COMPLETED (must pass through PAID)", () => {
    expect(isTransitionAllowed(GatewayPaymentStatus.CREATED, GatewayPaymentStatus.COMPLETED)).toBe(
      false
    );
    expect(() =>
      assertTransition(GatewayPaymentStatus.CREATED, GatewayPaymentStatus.COMPLETED)
    ).toThrow(/Cannot transition gateway payment/);
  });

  it("rejects COMPLETED → PAID", () => {
    expect(isTransitionAllowed(GatewayPaymentStatus.COMPLETED, GatewayPaymentStatus.PAID)).toBe(
      false
    );
  });

  it("allows HELD → REFUND_INITIATED for retry refund", () => {
    expect(isTransitionAllowed(GatewayPaymentStatus.HELD, GatewayPaymentStatus.REFUND_INITIATED)).toBe(
      true
    );
  });

  it("allows REFUND_INITIATED → REFUNDED | HELD", () => {
    expect(
      isTransitionAllowed(GatewayPaymentStatus.REFUND_INITIATED, GatewayPaymentStatus.REFUNDED)
    ).toBe(true);
    expect(isTransitionAllowed(GatewayPaymentStatus.REFUND_INITIATED, GatewayPaymentStatus.HELD)).toBe(
      true
    );
  });

  it("marks post-payment outcomes as terminal for webhook replay", () => {
    expect(TERMINAL_GATEWAY_STATUSES.has(GatewayPaymentStatus.COMPLETED)).toBe(true);
    expect(TERMINAL_GATEWAY_STATUSES.has(GatewayPaymentStatus.HELD)).toBe(true);
    expect(TERMINAL_GATEWAY_STATUSES.has(GatewayPaymentStatus.REFUNDED)).toBe(true);
    expect(TERMINAL_GATEWAY_STATUSES.has(GatewayPaymentStatus.PAID)).toBe(false);
  });
});
