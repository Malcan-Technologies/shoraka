import { formatCurrency } from "@cashsouk/config";
import { resolveExcessLateChargeOutstanding } from "@cashsouk/types";

export function excessLateChargeOutstanding(owed: number, paid: number): number {
  return resolveExcessLateChargeOutstanding(owed, paid);
}

export function excessLateChargeWaitingCopy(outstanding: number): string {
  return `${formatCurrency(outstanding)} in late charges did not fit into the repayment. The issuer has been asked to pay it separately.`;
}

export function excessLateChargeCompletedCopy(owed: number): string {
  return `${formatCurrency(owed)} in separately billed late charges has been paid.`;
}
