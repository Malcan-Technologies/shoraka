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

export function getGatewayAccountBadgeClassName(account: CurlecGatewayAccount): string {
  switch (account) {
    case "OPERATING":
      return "border-transparent bg-status-submitted-bg text-status-submitted-text hover:bg-status-submitted-bg";
    case "INVESTOR_POOL":
      return "border-transparent bg-status-success-bg text-status-success-text hover:bg-status-success-bg";
    default:
      return "border-transparent bg-status-neutral-bg text-status-neutral-text hover:bg-status-neutral-bg";
  }
}
