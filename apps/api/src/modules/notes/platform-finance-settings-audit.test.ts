import {
  redactSensitiveFinanceSettings,
  snapshotPlatformFinanceSettings,
} from "./platform-finance-settings-audit";

const sampleRow = {
  key: "DEFAULT",
  grace_period_days: 7,
  arrears_threshold_days: 14,
  tawidh_rate_cap_percent: 1,
  gharamah_rate_cap_percent: 9,
  platform_fee_rate_cap_percent: 3,
  default_tawidh_rate_percent: 0,
  default_gharamah_rate_percent: 0,
  withdrawal_letter_template: "DEFAULT_WITHDRAWAL_LETTER",
  arrears_letter_template: "DEFAULT_ARREARS_LETTER",
  default_letter_template: "DEFAULT_DEFAULT_LETTER",
  issuer_onboarding_fee_amount: 150,
  application_processing_fee_amount: 50,
  investor_min_deposit_amount: 100,
  investor_max_deposit_amount: 30000,
  facility_fee_gateway_txn_max_amount: 30000,
  excess_late_charge_gateway_txn_max_amount: 30000,
  offer_deadline_reminder_hour: 9,
  trustee_letter_config: {
    trusteeName: "Trustee Co",
    trusteeEmail: "trustee@ops.example",
    trusteeCcEmails: ["cc@ops.example"],
    autoSendTrusteeEmail: true,
    smtpPassword: "super-secret-smtp",
  },
  platform_accounts_config: {
    platformOperating: { accountName: "Ops", accountNumber: "1234567890" },
  },
  ledger_bucket_accounts_config: {
    INVESTOR_POOL: { accountName: "Pool", accountNumber: "999", apiKey: "sk-live-not-for-logs" },
  },
};

describe("platform finance settings audit snapshot", () => {
  it("maps a missing row to an empty previous snapshot", () => {
    expect(snapshotPlatformFinanceSettings(null)).toEqual({});
  });

  it("keeps operational finance and trustee config, including emails and account numbers", () => {
    const snapshot = snapshotPlatformFinanceSettings(sampleRow);
    const redacted = redactSensitiveFinanceSettings(snapshot) as Record<string, unknown>;
    const trustee = redacted.trusteeLetterConfig as Record<string, unknown>;
    const operating = (redacted.platformAccountsConfig as Record<string, unknown>)
      .platformOperating as Record<string, unknown>;
    const pool = (redacted.ledgerBucketAccountsConfig as Record<string, unknown>)
      .INVESTOR_POOL as Record<string, unknown>;

    expect(redacted.gracePeriodDays).toBe(7);
    expect(redacted.offerDeadlineReminderHour).toBe(9);
    expect(trustee.trusteeName).toBe("Trustee Co");
    expect(trustee.trusteeEmail).toBe("trustee@ops.example");
    expect(trustee.trusteeCcEmails).toEqual(["cc@ops.example"]);
    expect(operating.accountNumber).toBe("1234567890");
    expect(pool.accountNumber).toBe("999");
  });

  it("redacts only authentication secrets if they appear in nested config", () => {
    const snapshot = snapshotPlatformFinanceSettings(sampleRow);
    const redacted = redactSensitiveFinanceSettings(snapshot) as Record<string, unknown>;
    const trustee = redacted.trusteeLetterConfig as Record<string, unknown>;
    const pool = (redacted.ledgerBucketAccountsConfig as Record<string, unknown>)
      .INVESTOR_POOL as Record<string, unknown>;

    expect(trustee.smtpPassword).toBe("[REDACTED]");
    expect(pool.apiKey).toBe("[REDACTED]");
    expect(JSON.stringify(redacted)).not.toContain("super-secret-smtp");
    expect(JSON.stringify(redacted)).not.toContain("sk-live-not-for-logs");
  });
});
