import { CurlecGatewayAccount, GatewayPaymentPurpose } from "@prisma/client";
import { AppError } from "../../lib/http/error-handler";

function assertUnreachablePurpose(purpose: never): never {
  throw new AppError(
    500,
    "GATEWAY_PURPOSE_UNSUPPORTED",
    `Unsupported gateway payment purpose for account routing: ${String(purpose)}`
  );
}

export function resolveGatewayAccountForPurpose(
  purpose: GatewayPaymentPurpose
): CurlecGatewayAccount {
  switch (purpose) {
    case GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE:
      return CurlecGatewayAccount.OPERATING;
    case GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE:
      return CurlecGatewayAccount.OPERATING;
    case GatewayPaymentPurpose.FACILITY_FEE:
      return CurlecGatewayAccount.OPERATING;
    case GatewayPaymentPurpose.EXCESS_LATE_CHARGES:
      return CurlecGatewayAccount.OPERATING;
    case GatewayPaymentPurpose.INVESTOR_DEPOSIT:
      return CurlecGatewayAccount.INVESTOR_POOL;
    default:
      return assertUnreachablePurpose(purpose);
  }
}

export function assertGatewayAccountMatch(
  expectedGatewayAccount: CurlecGatewayAccount,
  actualGatewayAccount: CurlecGatewayAccount,
  context: string
): void {
  if (expectedGatewayAccount === actualGatewayAccount) {
    return;
  }

  throw new AppError(
    409,
    "GATEWAY_ACCOUNT_MISMATCH",
    `Gateway account mismatch in ${context}: expected ${expectedGatewayAccount}, got ${actualGatewayAccount}`
  );
}
