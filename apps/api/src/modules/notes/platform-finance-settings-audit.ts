/**
 * Snapshot + redaction for platform finance settings change history.
 * Stored on security_logs as previousValues / nextValues — no secrets.
 */

const REDACTED = "[REDACTED]";

const SENSITIVE_KEY_PATTERN =
  /password|secret|token|credential|private.?key|api.?key|accountNumber|trusteeEmail|trusteeCcEmails/i;

function toNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof (value as { toNumber?: () => number }).toNumber === "function") {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
}

export function snapshotPlatformFinanceSettings(
  row: {
    key: string;
    grace_period_days: number;
    arrears_threshold_days: number;
    tawidh_rate_cap_percent: unknown;
    gharamah_rate_cap_percent: unknown;
    platform_fee_rate_cap_percent: unknown;
    default_tawidh_rate_percent: unknown;
    default_gharamah_rate_percent: unknown;
    withdrawal_letter_template: string;
    arrears_letter_template: string;
    default_letter_template: string;
    issuer_onboarding_fee_amount: unknown;
    application_processing_fee_amount: unknown;
    investor_min_deposit_amount: unknown;
    investor_max_deposit_amount: unknown;
    facility_fee_gateway_txn_max_amount: unknown;
    excess_late_charge_gateway_txn_max_amount: unknown;
    offer_deadline_reminder_hour: number;
    trustee_letter_config: unknown;
    platform_accounts_config: unknown;
    ledger_bucket_accounts_config: unknown;
  } | null
): Record<string, unknown> {
  if (!row) return {};
  return {
    key: row.key,
    gracePeriodDays: row.grace_period_days,
    arrearsThresholdDays: row.arrears_threshold_days,
    tawidhRateCapPercent: toNumber(row.tawidh_rate_cap_percent),
    gharamahRateCapPercent: toNumber(row.gharamah_rate_cap_percent),
    platformFeeRateCapPercent: toNumber(row.platform_fee_rate_cap_percent),
    defaultTawidhRatePercent: toNumber(row.default_tawidh_rate_percent),
    defaultGharamahRatePercent: toNumber(row.default_gharamah_rate_percent),
    withdrawalLetterTemplate: row.withdrawal_letter_template,
    arrearsLetterTemplate: row.arrears_letter_template,
    defaultLetterTemplate: row.default_letter_template,
    issuerOnboardingFeeAmount: toNumber(row.issuer_onboarding_fee_amount),
    applicationProcessingFeeAmount: toNumber(row.application_processing_fee_amount),
    investorMinDepositAmount: toNumber(row.investor_min_deposit_amount),
    investorMaxDepositAmount: toNumber(row.investor_max_deposit_amount),
    facilityFeeGatewayTxnMaxAmount: toNumber(row.facility_fee_gateway_txn_max_amount),
    excessLateChargeGatewayTxnMaxAmount: toNumber(row.excess_late_charge_gateway_txn_max_amount),
    offerDeadlineReminderHour: row.offer_deadline_reminder_hour,
    trusteeLetterConfig: row.trustee_letter_config,
    platformAccountsConfig: row.platform_accounts_config,
    ledgerBucketAccountsConfig: row.ledger_bucket_accounts_config,
  };
}

export function redactSensitiveFinanceSettings(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSensitiveFinanceSettings(entry));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? REDACTED
        : redactSensitiveFinanceSettings(nested);
    }
    return out;
  }
  return value;
}
