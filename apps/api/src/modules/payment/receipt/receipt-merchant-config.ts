export type ReceiptMerchantDetails = {
  legalName: string;
  registrationNumber: string | null;
  licenceNumber: string | null;
  address: string | null;
  telephone: string | null;
  email: string | null;
};

function trimOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Merchant block for payment receipts from RECEIPT_MERCHANT_* env.
 * Callers may overlay a platform display-name fallback when legal name env is unset.
 */
export function loadReceiptMerchantDetails(
  fallbackLegalName?: string | null
): ReceiptMerchantDetails {
  const legalName =
    trimOrNull(process.env.RECEIPT_MERCHANT_LEGAL_NAME) ??
    trimOrNull(fallbackLegalName ?? undefined) ??
    "CashSouk Sdn Bhd";

  return {
    legalName,
    registrationNumber: trimOrNull(process.env.RECEIPT_MERCHANT_REGISTRATION_NUMBER),
    licenceNumber: trimOrNull(process.env.RECEIPT_MERCHANT_LICENCE_NUMBER),
    address: trimOrNull(process.env.RECEIPT_MERCHANT_ADDRESS),
    telephone: trimOrNull(process.env.RECEIPT_MERCHANT_PHONE),
    email: trimOrNull(process.env.RECEIPT_MERCHANT_EMAIL),
  };
}
