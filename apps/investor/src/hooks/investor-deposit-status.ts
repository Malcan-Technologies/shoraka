import type { GatewayPaymentStatus } from "@cashsouk/types";

const TERMINAL_DEPOSIT_STATUSES = new Set<GatewayPaymentStatus>([
  "COMPLETED",
  "HELD",
  "NAME_CHECK_PENDING",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "REFUND_INITIATED",
]);

const WALLET_SETTLED_DEPOSIT_STATUSES = new Set<GatewayPaymentStatus>([
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "REFUND_INITIATED",
]);

export function isTerminalDepositStatus(status: GatewayPaymentStatus): boolean {
  return TERMINAL_DEPOSIT_STATUSES.has(status);
}

/** FPX returned, but cash is not in the wallet yet (name check / hold). */
export function isDepositWalletSettled(status: GatewayPaymentStatus): boolean {
  return WALLET_SETTLED_DEPOSIT_STATUSES.has(status);
}
