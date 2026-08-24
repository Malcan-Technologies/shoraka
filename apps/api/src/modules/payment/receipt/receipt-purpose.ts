import { GatewayPaymentPurpose } from "@prisma/client";

export type ReceiptRelatedEntityType =
  | "ISSUER_ORGANIZATION"
  | "APPLICATION"
  | "INVESTOR_ORGANIZATION"
  | "CONTRACT"
  | "NOTE";

const PURPOSE_LABELS: Record<GatewayPaymentPurpose, string> = {
  [GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE]: "Issuer Registration Fee",
  [GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE]: "Application Processing Fee",
  [GatewayPaymentPurpose.INVESTOR_DEPOSIT]: "Investor Deposit",
  [GatewayPaymentPurpose.FACILITY_FEE]: "Facility Fee",
  [GatewayPaymentPurpose.EXCESS_LATE_CHARGES]: "Late Payment Charges",
};

export function getReceiptPurposeLabel(purpose: GatewayPaymentPurpose): string {
  return PURPOSE_LABELS[purpose];
}

export function getReceiptRelatedEntityType(
  purpose: GatewayPaymentPurpose
): ReceiptRelatedEntityType {
  switch (purpose) {
    case GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE:
      return "ISSUER_ORGANIZATION";
    case GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE:
      return "APPLICATION";
    case GatewayPaymentPurpose.FACILITY_FEE:
      return "CONTRACT";
    case GatewayPaymentPurpose.EXCESS_LATE_CHARGES:
      return "NOTE";
    case GatewayPaymentPurpose.INVESTOR_DEPOSIT:
      return "INVESTOR_ORGANIZATION";
    default: {
      const _exhaustive: never = purpose;
      return _exhaustive;
    }
  }
}

/** Visible PDF/admin label for optional related-reference (never Curlec dep_/fee_/pf_ receipts). */
export function getReceiptRelatedReferenceLabel(
  purpose: GatewayPaymentPurpose
): string | null {
  switch (purpose) {
    case GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE:
      return "Issuer Reference";
    case GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE:
      return "Application Reference";
    case GatewayPaymentPurpose.FACILITY_FEE:
      return "Facility Reference";
    case GatewayPaymentPurpose.EXCESS_LATE_CHARGES:
      return "Note Reference";
    case GatewayPaymentPurpose.INVESTOR_DEPOSIT:
      // Investor deposits use Curlec Order ID / Payment ID only.
      return null;
    default: {
      const _exhaustive: never = purpose;
      return _exhaustive;
    }
  }
}
