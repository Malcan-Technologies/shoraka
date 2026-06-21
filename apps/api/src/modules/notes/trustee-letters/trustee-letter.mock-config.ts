import type {
  LedgerBucketAccountsConfig,
  PlatformAccountsConfig,
  TrusteeAccountDetails,
  TrusteeLetterConfig,
} from "@cashsouk/types";

export const TRUSTEE_LETTER_MOCK_DEFAULTS: TrusteeLetterConfig = {
  trusteeName: "RHB Trustees Berhad",
  trusteeAddressLine1: "Level 11 Tower 3 RHB Centre",
  trusteeAddressLine2: "Jalan Tun Razak",
  trusteeAddressLine3: "50400 Kuala Lumpur",
  attentionPerson: "Ms Lim Bee Fang",
  platformDisplayName: "CashSouk Sdn Bhd",
  defaultContactPerson: "CashSouk Finance Team",
  authorisedSignatoryLabel: "Authorised Signatories",
  defaultValueDateBehavior: "T+1",
  defaultLetterRefPrefix: "CSK",
};

export const EMPTY_ACCOUNT: TrusteeAccountDetails = {
  displayName: "",
  bankName: "",
  accountName: "",
  accountNumber: "",
  remarks: "",
};

function emptyPlatformAccounts(): PlatformAccountsConfig {
  return {
    platformOperating: { ...EMPTY_ACCOUNT },
    serviceFee: { ...EMPTY_ACCOUNT },
    platformFee: { ...EMPTY_ACCOUNT },
    facilityFee: { ...EMPTY_ACCOUNT },
  };
}

function emptyBucketAccounts(): LedgerBucketAccountsConfig {
  return {
    INVESTOR_POOL: { ...EMPTY_ACCOUNT },
    REPAYMENT_POOL: { ...EMPTY_ACCOUNT },
    OPERATING_ACCOUNT: { ...EMPTY_ACCOUNT },
    ISSUER_PAYABLE: { ...EMPTY_ACCOUNT },
    TAWIDH_ACCOUNT: { ...EMPTY_ACCOUNT },
    GHARAMAH_ACCOUNT: { ...EMPTY_ACCOUNT },
  };
}

export function mergePlatformAccounts(
  partial: Partial<PlatformAccountsConfig> | null | undefined
): PlatformAccountsConfig {
  const base = emptyPlatformAccounts();
  if (!partial) return base;
  return {
    platformOperating: { ...base.platformOperating, ...partial.platformOperating },
    serviceFee: { ...base.serviceFee, ...partial.serviceFee },
    platformFee: { ...base.platformFee, ...partial.platformFee },
    facilityFee: { ...base.facilityFee, ...partial.facilityFee },
  };
}

export function mergeBucketAccounts(
  partial: Partial<LedgerBucketAccountsConfig> | null | undefined
): LedgerBucketAccountsConfig {
  const base = emptyBucketAccounts();
  if (!partial) return base;
  return {
    INVESTOR_POOL: { ...base.INVESTOR_POOL, ...partial.INVESTOR_POOL },
    REPAYMENT_POOL: { ...base.REPAYMENT_POOL, ...partial.REPAYMENT_POOL },
    OPERATING_ACCOUNT: { ...base.OPERATING_ACCOUNT, ...partial.OPERATING_ACCOUNT },
    ISSUER_PAYABLE: { ...base.ISSUER_PAYABLE, ...partial.ISSUER_PAYABLE },
    TAWIDH_ACCOUNT: { ...base.TAWIDH_ACCOUNT, ...partial.TAWIDH_ACCOUNT },
    GHARAMAH_ACCOUNT: { ...base.GHARAMAH_ACCOUNT, ...partial.GHARAMAH_ACCOUNT },
  };
}
