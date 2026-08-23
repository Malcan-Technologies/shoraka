import { parseAdditionalFeeCharges, type AdditionalFeeCharge } from "@cashsouk/types";
import { decimalToNumber } from "./track-record-aggregates";

export type IssuerDashboardDisbursementBreakdown = {
  grossFundedAmount: string | null;
  platformFeeAmount: string | null;
  facilityFeeCharged: string | null;
  netIssuerDisbursement: string | null;
  additionalFees?: AdditionalFeeCharge[] | null;
  facilityFeeCollectionWaived?: boolean;
};

function moneyField(value: unknown): string | null {
  return value != null ? decimalToNumber(value).toFixed(2) : null;
}

/**
 * Maps issuer-disbursement withdrawal metadata onto the dashboard note breakdown.
 * Extra fee charges and collection waiver are omitted when metadata does not carry them.
 */
export function mapIssuerDisbursementBreakdown(
  metadata: Record<string, unknown> | null
): IssuerDashboardDisbursementBreakdown {
  const additionalFees = parseAdditionalFeeCharges(metadata?.additionalFees);
  const facilityFeeCollectionWaived =
    metadata?.facilityFeeCollectionWaived === true ? true : undefined;

  return {
    grossFundedAmount: moneyField(metadata?.grossFundedAmount),
    platformFeeAmount: moneyField(metadata?.platformFeeAmount),
    facilityFeeCharged: moneyField(metadata?.facilityFeeCharged),
    netIssuerDisbursement: moneyField(metadata?.netIssuerDisbursement),
    ...(additionalFees ? { additionalFees } : {}),
    ...(facilityFeeCollectionWaived ? { facilityFeeCollectionWaived } : {}),
  };
}
