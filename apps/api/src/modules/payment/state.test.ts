import { GatewayPaymentStatus } from "@prisma/client";
import { assertTransition, isTransitionAllowed, TERMINAL_GATEWAY_STATUSES } from "./state";

describe("gateway payment state transitions", () => {
  it("allows CREATED → PAID", () => {
    expect(isTransitionAllowed(GatewayPaymentStatus.CREATED, GatewayPaymentStatus.PAID)).toBe(true);
  });

  it("allows PAID → COMPLETED | HELD | NAME_CHECK_PENDING", () => {
    expect(isTransitionAllowed(GatewayPaymentStatus.PAID, GatewayPaymentStatus.COMPLETED)).toBe(true);
    expect(isTransitionAllowed(GatewayPaymentStatus.PAID, GatewayPaymentStatus.HELD)).toBe(true);
    expect(
      isTransitionAllowed(GatewayPaymentStatus.PAID, GatewayPaymentStatus.NAME_CHECK_PENDING)
    ).toBe(true);
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

  it("marks post-payment outcomes as terminal for webhook replay", () => {
    expect(TERMINAL_GATEWAY_STATUSES.has(GatewayPaymentStatus.COMPLETED)).toBe(true);
    expect(TERMINAL_GATEWAY_STATUSES.has(GatewayPaymentStatus.HELD)).toBe(true);
    expect(TERMINAL_GATEWAY_STATUSES.has(GatewayPaymentStatus.NAME_CHECK_PENDING)).toBe(true);
    expect(TERMINAL_GATEWAY_STATUSES.has(GatewayPaymentStatus.PAID)).toBe(false);
  });
});
