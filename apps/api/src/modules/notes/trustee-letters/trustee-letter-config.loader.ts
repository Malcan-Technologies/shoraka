import type {
  LedgerBucketAccountsConfig,
  PlatformAccountsConfig,
  PlatformFinanceSetting,
  TrusteeLetterConfig,
} from "@cashsouk/types";
import {
  TRUSTEE_LETTER_MOCK_DEFAULTS,
  mergeBucketAccounts,
  mergePlatformAccounts,
} from "./trustee-letter.mock-config";

export interface ResolvedTrusteeConfig {
  letterConfig: TrusteeLetterConfig;
  platformAccounts: PlatformAccountsConfig;
  bucketAccounts: LedgerBucketAccountsConfig;
}

export function loadTrusteeLetterConfig(
  settings: Pick<
    PlatformFinanceSetting,
    "trusteeLetterConfig" | "platformAccountsConfig" | "ledgerBucketAccountsConfig"
  > | null
): ResolvedTrusteeConfig {
  return {
    letterConfig: {
      ...TRUSTEE_LETTER_MOCK_DEFAULTS,
      ...(settings?.trusteeLetterConfig ?? {}),
    },
    platformAccounts: mergePlatformAccounts(settings?.platformAccountsConfig ?? null),
    bucketAccounts: mergeBucketAccounts(settings?.ledgerBucketAccountsConfig ?? null),
  };
}
