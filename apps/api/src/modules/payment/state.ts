import { GatewayPaymentStatus } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";

const ALLOWED_TRANSITIONS: Record<GatewayPaymentStatus, GatewayPaymentStatus[]> = {
  [GatewayPaymentStatus.CREATED]: [
    GatewayPaymentStatus.PAID,
    GatewayPaymentStatus.FAILED,
    GatewayPaymentStatus.EXPIRED,
  ],
  [GatewayPaymentStatus.PAID]: [
    GatewayPaymentStatus.COMPLETED,
    GatewayPaymentStatus.HELD,
    GatewayPaymentStatus.NAME_CHECK_PENDING,
  ],
  [GatewayPaymentStatus.NAME_CHECK_PENDING]: [
    GatewayPaymentStatus.COMPLETED,
    GatewayPaymentStatus.HELD,
  ],
  [GatewayPaymentStatus.HELD]: [
    GatewayPaymentStatus.COMPLETED,
    GatewayPaymentStatus.REFUND_INITIATED,
  ],
  [GatewayPaymentStatus.COMPLETED]: [GatewayPaymentStatus.REFUND_INITIATED],
  [GatewayPaymentStatus.REFUND_INITIATED]: [GatewayPaymentStatus.REFUNDED],
  [GatewayPaymentStatus.REFUNDED]: [],
  [GatewayPaymentStatus.FAILED]: [],
  [GatewayPaymentStatus.EXPIRED]: [],
};

export const TERMINAL_GATEWAY_STATUSES: ReadonlySet<GatewayPaymentStatus> = new Set([
  GatewayPaymentStatus.COMPLETED,
  GatewayPaymentStatus.HELD,
  GatewayPaymentStatus.NAME_CHECK_PENDING,
  GatewayPaymentStatus.REFUNDED,
  GatewayPaymentStatus.FAILED,
  GatewayPaymentStatus.EXPIRED,
]);

export function isTransitionAllowed(
  from: GatewayPaymentStatus,
  to: GatewayPaymentStatus
): boolean {
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

export function assertTransition(from: GatewayPaymentStatus, to: GatewayPaymentStatus): void {
  if (!isTransitionAllowed(from, to)) {
    throw new AppError(
      422,
      "INVALID_GATEWAY_TRANSITION",
      `Cannot transition gateway payment from ${from} to ${to}`
    );
  }
}
