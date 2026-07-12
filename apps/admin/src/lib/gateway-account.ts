import type { CurlecGatewayAccount } from "@cashsouk/types";

export const GATEWAY_ACCOUNT_OPTIONS: Array<{
  value: CurlecGatewayAccount;
  label: string;
}> = [
  { value: "LEGACY_DEFAULT", label: "Legacy" },
  { value: "OPERATING", label: "Operating" },
  { value: "INVESTOR_POOL", label: "Investor Pool" },
];

export function getGatewayAccountLabel(account: CurlecGatewayAccount): string {
  switch (account) {
    case "LEGACY_DEFAULT":
      return "Legacy";
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
    case "LEGACY_DEFAULT":
      return "Uses legacy Curlec merchant credentials.";
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
      return "bg-blue-100 text-blue-800 hover:bg-blue-100";
    case "INVESTOR_POOL":
      return "bg-emerald-100 text-emerald-800 hover:bg-emerald-100";
    case "LEGACY_DEFAULT":
    default:
      return "bg-slate-100 text-slate-700 hover:bg-slate-100";
  }
}
