const mockCreateSecurityLogRow = jest.fn();

jest.mock("../../lib/prisma", () => ({
  prisma: {
    platformFinanceSetting: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock("../../lib/audit", () => {
  const actual = jest.requireActual("../../lib/audit") as Record<string, unknown>;
  return {
    ...actual,
    createSecurityLogRow: (...args: unknown[]) => mockCreateSecurityLogRow(...args),
  };
});

import { prisma } from "../../lib/prisma";
import { NoteService } from "./service";

const previousRow = {
  id: "pfs-1",
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
    trusteeEmail: "trustee@ops.example",
    trusteeName: "Trustee Co",
  },
  platform_accounts_config: null,
  ledger_bucket_accounts_config: null,
  document_authorisation_config: null,
  updated_by_user_id: "admin_old",
  updated_at: new Date("2026-01-01T00:00:00.000Z"),
};

const nextRow = {
  ...previousRow,
  grace_period_days: 10,
  updated_by_user_id: "admin_1",
  updated_at: new Date("2026-08-26T00:00:00.000Z"),
};

const input = {
  gracePeriodDays: 10,
  arrearsThresholdDays: 14,
  tawidhRateCapPercent: 1,
  gharamahRateCapPercent: 9,
  platformFeeRateCapPercent: 3,
  defaultTawidhRatePercent: 0,
  defaultGharamahRatePercent: 0,
  withdrawalLetterTemplate: "DEFAULT_WITHDRAWAL_LETTER",
  arrearsLetterTemplate: "DEFAULT_ARREARS_LETTER",
  defaultLetterTemplate: "DEFAULT_DEFAULT_LETTER",
  issuerOnboardingFeeAmount: 150,
  applicationProcessingFeeAmount: 50,
  investorMinDepositAmount: 100,
  investorMaxDepositAmount: 30000,
  facilityFeeGatewayTxnMaxAmount: 30000,
  excessLateChargeGatewayTxnMaxAmount: 30000,
  offerDeadlineReminderHour: 9,
  trusteeLetterConfig: previousRow.trustee_letter_config,
  platformAccountsConfig: null,
  ledgerBucketAccountsConfig: null,
};

describe("NoteService updatePlatformFinanceSettings audit", () => {
  const actor = {
    userId: "admin_1",
    role: "ADMIN",
    portal: "ADMIN",
    ipAddress: "203.0.113.9",
    userAgent: "admin-agent",
    correlationId: "corr-finance",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.platformFinanceSetting.findUnique as jest.Mock)
      .mockResolvedValueOnce(previousRow)
      .mockResolvedValue(nextRow);
    (prisma.platformFinanceSetting.upsert as jest.Mock).mockResolvedValue(nextRow);
    (prisma.platformFinanceSetting.findUniqueOrThrow as jest.Mock).mockResolvedValue(nextRow);
    mockCreateSecurityLogRow.mockResolvedValue({ id: "sec-1" });
  });

  it("keeps the settings write and records before/after values for the acting admin", async () => {
    const service = new NoteService();
    const result = await service.updatePlatformFinanceSettings(input, actor);

    expect(prisma.platformFinanceSetting.upsert).toHaveBeenCalled();
    expect(result.gracePeriodDays).toBe(10);
    expect(result.updatedByUserId).toBe("admin_1");

    expect(mockCreateSecurityLogRow).toHaveBeenCalledTimes(1);
    const payload = mockCreateSecurityLogRow.mock.calls[0][0];
    expect(payload).toMatchObject({
      userId: "admin_1",
      eventType: "PLATFORM_FINANCE_SETTINGS_UPDATED",
      portal: "ADMIN",
      ipAddress: "203.0.113.9",
      userAgent: "admin-agent",
      correlationId: "corr-finance",
      source: "API",
      targetType: "PLATFORM_FINANCE_SETTINGS",
      targetId: "DEFAULT",
    });
    expect(payload.metadata.previousValues.gracePeriodDays).toBe(7);
    expect(payload.metadata.nextValues.gracePeriodDays).toBe(10);
    expect(payload.metadata.previousValues.trusteeLetterConfig.trusteeEmail).toBe(
      "trustee@ops.example"
    );
    expect(payload.metadata.nextValues.trusteeLetterConfig.trusteeEmail).toBe(
      "trustee@ops.example"
    );
    expect(payload.metadata.previousValues.trusteeLetterConfig.trusteeName).toBe("Trustee Co");
  });

  it("persists Document Authorisation settings and includes them in the audit snapshot", async () => {
    const documentAuthorisationConfig = {
      authorisedSignatoryName: "Sarah",
      useSameCompanyStamp: false,
      certificateCompanyStamp: { s3Key: "stamps/cert.png", fileName: "cert.png", contentType: "image/png" },
      receiptCompanyStamp: { s3Key: "stamps/receipt.png", fileName: "receipt.png", contentType: "image/png" },
    };
    const saved = {
      ...nextRow,
      document_authorisation_config: documentAuthorisationConfig,
    };
    (prisma.platformFinanceSetting.upsert as jest.Mock).mockResolvedValue(saved);
    (prisma.platformFinanceSetting.findUnique as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce(previousRow)
      .mockResolvedValue(saved);
    (prisma.platformFinanceSetting.findUniqueOrThrow as jest.Mock).mockResolvedValue(saved);

    const service = new NoteService();
    const result = await service.updatePlatformFinanceSettings(
      { documentAuthorisationConfig },
      actor
    );

    expect(prisma.platformFinanceSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          document_authorisation_config: documentAuthorisationConfig,
        }),
      })
    );
    expect(result.documentAuthorisationConfig).toEqual(documentAuthorisationConfig);
    const payload = mockCreateSecurityLogRow.mock.calls[0][0];
    expect(payload.metadata.nextValues.documentAuthorisationConfig.authorisedSignatoryName).toBe(
      "Sarah"
    );
  });
});
