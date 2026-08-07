import type { CurlecGatewayAccount } from "@cashsouk/types";

export const GATEWAY_ACCOUNT_OPTIONS: Array<{
  value: CurlecGatewayAccount;
  label: string;
}> = [
  { value: "OPERATING", label: "Operating" },
  { value: "INVESTOR_POOL", label: "Investor Pool" },
];

export function getGatewayAccountLabel(account: CurlecGatewayAccount): string {
  switch (account) {
    case "OPERATING":
      return "Operating";
    case "INVESTOR_POOL":
      return "Investor Pool";
    default:
      return account;
  }
}

export function getGatewayAccountDescription(account: CurlecGatewayAccount): string {
  switch (account) {
    case "OPERATING":
      return "Uses the operating Curlec merchant account.";
    case "INVESTOR_POOL":
      return "Uses the investor pool Curlec merchant account.";
    default:
      return "Curlec merchant account for this payment.";
  }
}

/** Subtle secondary badge — keeps status badges as the primary colour signal. */
export function getGatewayAccountBadgeClassName(_account?: CurlecGatewayAccount): string {
  return "border-border bg-muted/40 font-normal text-muted-foreground hover:bg-muted/40";
}
