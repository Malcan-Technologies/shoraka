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
    trusteeEmail: "trustee@secret.example",
    trusteeCcEmails: ["cc@secret.example"],
    autoSendTrusteeEmail: true,
  },
  platform_accounts_config: {
    platformOperating: { accountName: "Ops", accountNumber: "1234567890" },
  },
  ledger_bucket_accounts_config: {
    INVESTOR_POOL: { accountName: "Pool", accountNumber: "999" },
  },
};

describe("platform finance settings audit snapshot", () => {
  it("maps a missing row to an empty previous snapshot", () => {
    expect(snapshotPlatformFinanceSettings(null)).toEqual({});
  });

  it("redacts trustee emails and account numbers without dropping operational fields", () => {
    const snapshot = snapshotPlatformFinanceSettings(sampleRow);
    const redacted = redactSensitiveFinanceSettings(snapshot) as Record<string, unknown>;

    expect(redacted.gracePeriodDays).toBe(7);
    expect(redacted.offerDeadlineReminderHour).toBe(9);
    expect((redacted.trusteeLetterConfig as Record<string, unknown>).trusteeName).toBe(
      "Trustee Co"
    );
    expect((redacted.trusteeLetterConfig as Record<string, unknown>).trusteeEmail).toBe(
      "[REDACTED]"
    );
    expect((redacted.trusteeLetterConfig as Record<string, unknown>).trusteeCcEmails).toBe(
      "[REDACTED]"
    );
    expect(
      (
        (redacted.platformAccountsConfig as Record<string, unknown>).platformOperating as Record<
          string,
          unknown
        >
      ).accountNumber
    ).toBe("[REDACTED]");
    expect(
      (
        (redacted.ledgerBucketAccountsConfig as Record<string, unknown>).INVESTOR_POOL as Record<
          string,
          unknown
        >
      ).accountNumber
    ).toBe("[REDACTED]");
    expect(JSON.stringify(redacted)).not.toContain("trustee@secret.example");
    expect(JSON.stringify(redacted)).not.toContain("1234567890");
  });
});
