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

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Merchant block for payment receipts from RECEIPT_MERCHANT_* env.
 * Production requires legal name + registration number (no demo fallback).
 * Non-production may use an optional display-name fallback for local/dev.
 */
export function loadReceiptMerchantDetails(
  fallbackLegalName?: string | null
): ReceiptMerchantDetails {
  const fromEnvLegalName = trimOrNull(process.env.RECEIPT_MERCHANT_LEGAL_NAME);
  const registrationNumber = trimOrNull(
    process.env.RECEIPT_MERCHANT_REGISTRATION_NUMBER
  );

  if (isProductionRuntime()) {
    if (!fromEnvLegalName || !registrationNumber) {
      throw new Error(
        "RECEIPT_MERCHANT_CONFIG_REQUIRED: set RECEIPT_MERCHANT_LEGAL_NAME and RECEIPT_MERCHANT_REGISTRATION_NUMBER in production"
      );
    }

    return {
      legalName: fromEnvLegalName,
      registrationNumber,
      licenceNumber: trimOrNull(process.env.RECEIPT_MERCHANT_LICENCE_NUMBER),
      address: trimOrNull(process.env.RECEIPT_MERCHANT_ADDRESS),
      telephone: trimOrNull(process.env.RECEIPT_MERCHANT_PHONE),
      email: trimOrNull(process.env.RECEIPT_MERCHANT_EMAIL),
    };
  }

  const legalName =
    fromEnvLegalName ??
    trimOrNull(fallbackLegalName ?? undefined) ??
    "CashSouk Sdn Bhd";

  return {
    legalName,
    registrationNumber,
    licenceNumber: trimOrNull(process.env.RECEIPT_MERCHANT_LICENCE_NUMBER),
    address: trimOrNull(process.env.RECEIPT_MERCHANT_ADDRESS),
    telephone: trimOrNull(process.env.RECEIPT_MERCHANT_PHONE),
    email: trimOrNull(process.env.RECEIPT_MERCHANT_EMAIL),
  };
}
