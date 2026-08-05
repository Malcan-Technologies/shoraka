/**
 * TEMPORARY GATEWAY PAYMENT SHOWCASE
 * Remove after UI review — see REMOVAL.md in this folder.
 */

import type {
  CurlecGatewayAccount,
  GatewayPaymentDetailDto,
  GatewayPaymentEventDto,
  GatewayPaymentEventType,
  GatewayPaymentPurpose,
  GatewayPaymentReceiptSummaryDto,
  GatewayPaymentStatus,
} from "@cashsouk/types";

export const SHOWCASE_QUERY_PARAM = "gatewayPaymentShowcase";

export type ShowcasePermissionMode = "manage" | "view-only" | "real";

export type ShowcaseScenarioId =
  | "created-awaiting"
  | "completed-deposit"
  | "completed-onboarding-fee"
  | "completed-processing-fee"
  | "failed-payment"
  | "amount-mismatch-detected"
  | "amount-mismatch-auto-refund"
  | "refund-pending-no-id"
  | "amount-mismatch-refunded"
  | "amount-mismatch-held-retry"
  | "admin-retry-hidden-while-pending"
  | "historical-refunded-allows-new"
  | "currency-mismatch-deposit"
  | "currency-mismatch-onboarding"
  | "currency-mismatch-processing"
  | "wallet-external-refund-created"
  | "wallet-funds-partial"
  | "wallet-funds-not-protected"
  | "wallet-reversal-completed"
  | "wallet-late-refund-created-while-held"
  | "wallet-duplicate-safe-reversal"
  | "onboarding-fee-refund-initiated"
  | "onboarding-fee-repayment-required"
  | "onboarding-fee-refund-failed-restored"
  | "processing-fee-refund-initiated"
  | "processing-fee-refunded"
  | "processing-fee-refund-failed-restored"
  | "name-check-pending"
  | "receipt-unavailable"
  | "receipt-generated"
  | "receipt-pending"
  | "receipt-failed"
  | "receipt-none-amount-mismatch"
  | "receipt-none-currency-mismatch"
  | "receipt-none-refunded"
  | "all-activity-events";

export type ShowcaseScenario = {
  id: ShowcaseScenarioId;
  label: string;
  group: string;
  purpose: GatewayPaymentPurpose;
  status: GatewayPaymentStatus;
  gatewayAccount: CurlecGatewayAccount;
  notes: string[];
  payment: GatewayPaymentDetailDto;
};

const NOW = "2026-08-04T10:00:00.000Z";
const EARLIER = "2026-08-04T09:00:00.000Z";
const LATER = "2026-08-04T10:30:00.000Z";

function event(
  type: GatewayPaymentEventType,
  overrides: Partial<GatewayPaymentEventDto> & { id: string }
): GatewayPaymentEventDto {
  return {
    type,
    actorUserId: null,
    fromStatus: null,
    toStatus: null,
    reason: null,
    createdAt: NOW,
    ...overrides,
  };
}

function receipt(
  overrides: Partial<GatewayPaymentReceiptSummaryDto>
): GatewayPaymentReceiptSummaryDto {
  return {
    id: "rcpt_showcase",
    receiptNumber: "RCP-SHOW-001",
    purposeLabel: "Investor Deposit",
    status: "GENERATED",
    hasPdf: true,
    paymentDate: NOW,
    relatedReference: "org_showcase",
    relatedReferenceLabel: "Organisation",
    amount: 100,
    currency: "MYR",
    payerName: "Ahmad Showcase",
    payerCompanyName: null,
    curlecPaymentId: "pay_showcase",
    curlecOrderId: "order_showcase",
    ...overrides,
  };
}

function basePayment(
  overrides: Partial<GatewayPaymentDetailDto> &
    Pick<GatewayPaymentDetailDto, "purpose" | "status" | "gatewayAccount">
): GatewayPaymentDetailDto {
  return {
    id: "gp_showcase",
    organizationType:
      overrides.purpose === "INVESTOR_DEPOSIT" ? "INVESTOR" : "ISSUER",
    amount: 100,
    currency: "MYR",
    payerName: "Ahmad Showcase",
    nameCheckResult: null,
    investorOrganizationId: "org_showcase",
    investorOrganizationName:
      overrides.purpose === "INVESTOR_DEPOSIT"
        ? "Ahmad Showcase"
        : "Showcase Issuer Sdn Bhd",
    curlecOrderId: "order_showcase_001",
    curlecPaymentId: "pay_showcase_001",
    settlementId: null,
    createdAt: EARLIER,
    updatedAt: NOW,
    method: "fpx",
    bankCode: "MB2U",
    expectedPayerName: "Ahmad Showcase",
    nameCheckAt: null,
    nameCheckedByUserId: null,
    refundReference: null,
    refundInitiatedBy: null,
    refundedAt: null,
    refundNotes: null,
    openOverrideProposedBy: null,
    openOverrideReason: null,
    metadata: null,
    events: [],
    receipt: null,
    ...overrides,
  };
}

function amountMismatchMeta(expectedSen: number, actualSen: number) {
  return {
    amountMismatch: {
      mismatchType: "AMOUNT_MISMATCH",
      expectedSen,
      actualSen,
      curlecPaymentId: "pay_showcase_mismatch",
    },
    captureMismatch: {
      mismatchType: "AMOUNT_MISMATCH",
      expectedSen,
      actualSen,
      curlecPaymentId: "pay_showcase_mismatch",
    },
  };
}

function currencyMismatchMeta(expected = "MYR", actual = "SGD") {
  return {
    captureMismatch: {
      mismatchType: "CURRENCY_MISMATCH",
      expectedCurrency: expected,
      actualCurrency: actual,
      reason: "Currency mismatch",
    },
  };
}

function externalRefundMeta(overrides: Record<string, unknown> = {}) {
  return {
    externalCurlecRefund: {
      source: "CURLEC_PROVIDER",
      refundId: "rfnd_ext_showcase",
      gatewayPaymentId: "gp_showcase",
      detectedAt: NOW,
      detectedOnEvent: "refund.created",
      holdIdempotencyKeys: ["gateway-deposit:refund-hold:gp_showcase"],
      blockedAmount: 100,
      fundsProtected: true,
      intendedAmount: 100,
      ...overrides,
    },
  };
}

function walletFailureMeta(overrides: Record<string, unknown> = {}) {
  return {
    refundConfirmedWalletReversalFailed: {
      refundId: "rfnd_ext_showcase",
      intendedReversalAmount: 100,
      blockedAmount: 100,
      fundsProtected: true,
      fundsBlocked: true,
      originalWalletCreditKey: "gateway-deposit:balance:gp_showcase",
      lastAttemptAt: NOW,
      failureCategory: "INSUFFICIENT_INVESTOR_BALANCE",
      error: "Insufficient available balance (available 10.00, required 100.00)",
      ...overrides,
    },
  };
}

export const ALL_SHOWCASE_EVENT_TYPES: GatewayPaymentEventType[] = [
  "NAME_CHECK",
  "NAME_CHECK_APPROVED",
  "NAME_CHECK_REJECTED",
  "OVERRIDE_PROPOSED",
  "OVERRIDE_APPROVED",
  "OVERRIDE_REJECTED",
  "CAPTURE_MISMATCH",
  "REFUND_INITIATED",
  "REFUND_WALLET_REVERSAL_FAILED",
  "REFUNDED",
  "EXPIRED",
];

export function buildAllActivityEvents(): GatewayPaymentEventDto[] {
  const base = Date.parse("2026-08-04T08:00:00.000Z");
  const stamp = (minutes: number) => new Date(base + minutes * 60_000).toISOString();

  return [
    event("REFUNDED", {
      id: "ev_refunded",
      fromStatus: "REFUND_INITIATED",
      toStatus: "REFUNDED",
      createdAt: stamp(11),
    }),
    event("REFUND_WALLET_REVERSAL_FAILED", {
      id: "ev_wallet_fail",
      fromStatus: "REFUND_INITIATED",
      toStatus: "HELD",
      reason: "Wallet debit failed after refund",
      createdAt: stamp(10),
    }),
    event("REFUND_INITIATED", {
      id: "ev_refund_init",
      fromStatus: "COMPLETED",
      toStatus: "REFUND_INITIATED",
      reason: "External Curlec refund detected on completed payment",
      createdAt: stamp(9),
    }),
    event("CAPTURE_MISMATCH", {
      id: "ev_currency",
      fromStatus: "PAID",
      toStatus: "HELD",
      reason: "Currency mismatch",
      createdAt: stamp(8),
    }),
    event("CAPTURE_MISMATCH", {
      id: "ev_amount",
      fromStatus: "PAID",
      toStatus: "HELD",
      reason: "AMOUNT_MISMATCH",
      createdAt: stamp(7),
    }),
    event("NAME_CHECK_REJECTED", {
      id: "ev_nc_reject",
      fromStatus: "NAME_CHECK_PENDING",
      toStatus: "REFUND_INITIATED",
      createdAt: stamp(6),
    }),
    event("NAME_CHECK_APPROVED", {
      id: "ev_nc_approve",
      fromStatus: "NAME_CHECK_PENDING",
      toStatus: "COMPLETED",
      createdAt: stamp(5),
    }),
    event("NAME_CHECK", {
      id: "ev_nc",
      fromStatus: "PAID",
      toStatus: "NAME_CHECK_PENDING",
      reason: "NAME_UNAVAILABLE",
      createdAt: stamp(4),
    }),
    event("OVERRIDE_REJECTED", {
      id: "ev_ov_rej",
      createdAt: stamp(3),
    }),
    event("OVERRIDE_APPROVED", {
      id: "ev_ov_appr",
      createdAt: stamp(2),
    }),
    event("OVERRIDE_PROPOSED", {
      id: "ev_ov_prop",
      createdAt: stamp(1),
    }),
    event("EXPIRED", {
      id: "ev_expired",
      fromStatus: "CREATED",
      toStatus: "EXPIRED",
      createdAt: stamp(0),
    }),
  ];
}

function scenario(
  partial: Omit<ShowcaseScenario, "payment"> & { payment: GatewayPaymentDetailDto }
): ShowcaseScenario {
  return partial;
}

export const SHOWCASE_SCENARIOS: ShowcaseScenario[] = [
  scenario({
    id: "created-awaiting",
    label: "1. Created / awaiting payment",
    group: "Normal",
    purpose: "INVESTOR_DEPOSIT",
    status: "CREATED",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["No receipt", "No admin refund actions"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "CREATED",
      gatewayAccount: "INVESTOR_POOL",
      curlecPaymentId: null,
      method: null,
      bankCode: null,
      payerName: null,
    }),
  }),
  scenario({
    id: "completed-deposit",
    label: "2. Completed investor deposit",
    group: "Normal",
    purpose: "INVESTOR_DEPOSIT",
    status: "COMPLETED",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["Initiate refund visible", "Receipt ready"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "COMPLETED",
      gatewayAccount: "INVESTOR_POOL",
      receipt: receipt({ purposeLabel: "Investor Deposit" }),
      events: [
        event("NAME_CHECK_APPROVED", {
          id: "ev1",
          fromStatus: "NAME_CHECK_PENDING",
          toStatus: "COMPLETED",
          createdAt: NOW,
        }),
      ],
    }),
  }),
  scenario({
    id: "completed-onboarding-fee",
    label: "3. Completed onboarding fee",
    group: "Normal",
    purpose: "ISSUER_ONBOARDING_FEE",
    status: "COMPLETED",
    gatewayAccount: "OPERATING",
    notes: ["No initiate-refund (deposit-only action)"],
    payment: basePayment({
      purpose: "ISSUER_ONBOARDING_FEE",
      status: "COMPLETED",
      gatewayAccount: "OPERATING",
      amount: 150,
      receipt: receipt({
        purposeLabel: "Issuer Registration Fee",
        amount: 150,
        payerCompanyName: "Showcase Issuer Sdn Bhd",
      }),
    }),
  }),
  scenario({
    id: "completed-processing-fee",
    label: "4. Completed processing fee",
    group: "Normal",
    purpose: "APPLICATION_PROCESSING_FEE",
    status: "COMPLETED",
    gatewayAccount: "OPERATING",
    notes: ["Receipt ready"],
    payment: basePayment({
      purpose: "APPLICATION_PROCESSING_FEE",
      status: "COMPLETED",
      gatewayAccount: "OPERATING",
      amount: 50,
      receipt: receipt({
        purposeLabel: "Application Processing Fee",
        amount: 50,
        payerCompanyName: "Showcase Issuer Sdn Bhd",
      }),
    }),
  }),
  scenario({
    id: "failed-payment",
    label: "5. Failed payment",
    group: "Normal",
    purpose: "INVESTOR_DEPOSIT",
    status: "FAILED",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["No receipt"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "FAILED",
      gatewayAccount: "INVESTOR_POOL",
      events: [
        event("EXPIRED", {
          id: "ev_fail",
          fromStatus: "CREATED",
          toStatus: "FAILED",
          reason: "Checkout failed",
        }),
      ],
    }),
  }),
  scenario({
    id: "amount-mismatch-detected",
    label: "6. Same-currency amount mismatch (HELD)",
    group: "Amount mismatch",
    purpose: "INVESTOR_DEPOSIT",
    status: "HELD",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["Retry refund visible", "autoRefundFailed may be absent"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "HELD",
      gatewayAccount: "INVESTOR_POOL",
      amount: 150,
      metadata: {
        ...amountMismatchMeta(15000, 99999),
      },
      events: [
        event("CAPTURE_MISMATCH", {
          id: "ev_mm",
          fromStatus: "PAID",
          toStatus: "HELD",
          reason: "AMOUNT_MISMATCH",
        }),
      ],
      refundNotes: "Amount mismatch — automatic refund pending ops retry",
    }),
  }),
  scenario({
    id: "amount-mismatch-auto-refund",
    label: "7–9. Auto refund pending (with refund ID)",
    group: "Amount mismatch",
    purpose: "ISSUER_ONBOARDING_FEE",
    status: "REFUND_INITIATED",
    gatewayAccount: "OPERATING",
    notes: ["Mismatch pending card", "Retry refund hidden while pending"],
    payment: basePayment({
      purpose: "ISSUER_ONBOARDING_FEE",
      status: "REFUND_INITIATED",
      gatewayAccount: "OPERATING",
      amount: 150,
      refundReference: "rfnd_auto_showcase",
      metadata: {
        ...amountMismatchMeta(15000, 99999),
        refundAttempt: {
          amountSen: 99999,
          currency: "MYR",
          reason: "AMOUNT_MISMATCH",
          auto: true,
          curlecRefundId: "rfnd_auto_showcase",
          requestedAt: EARLIER,
          source: "automatic",
        },
      },
      events: [
        event("REFUND_INITIATED", {
          id: "ev_ri",
          fromStatus: "HELD",
          toStatus: "REFUND_INITIATED",
          reason: "AMOUNT_MISMATCH",
          createdAt: EARLIER,
        }),
        event("CAPTURE_MISMATCH", {
          id: "ev_cm",
          fromStatus: "PAID",
          toStatus: "HELD",
          reason: "AMOUNT_MISMATCH",
          createdAt: "2026-08-04T08:50:00.000Z",
        }),
      ],
    }),
  }),
  scenario({
    id: "refund-pending-no-id",
    label: "8. Refund pending without refund ID",
    group: "Amount mismatch",
    purpose: "APPLICATION_PROCESSING_FEE",
    status: "REFUND_INITIATED",
    gatewayAccount: "OPERATING",
    notes: ["Curlec refund ID shows —"],
    payment: basePayment({
      purpose: "APPLICATION_PROCESSING_FEE",
      status: "REFUND_INITIATED",
      gatewayAccount: "OPERATING",
      amount: 50,
      refundReference: null,
      metadata: {
        ...amountMismatchMeta(5000, 7500),
        refundAttempt: { requestedAt: EARLIER, auto: true },
      },
      events: [
        event("REFUND_INITIATED", {
          id: "ev_ri2",
          fromStatus: "HELD",
          toStatus: "REFUND_INITIATED",
          createdAt: EARLIER,
        }),
      ],
    }),
  }),
  scenario({
    id: "amount-mismatch-refunded",
    label: "10. Amount mismatch refunded",
    group: "Amount mismatch",
    purpose: "ISSUER_ONBOARDING_FEE",
    status: "REFUNDED",
    gatewayAccount: "OPERATING",
    notes: ["Historical refunded; new payment allowed in product flow"],
    payment: basePayment({
      purpose: "ISSUER_ONBOARDING_FEE",
      status: "REFUNDED",
      gatewayAccount: "OPERATING",
      amount: 150,
      refundReference: "rfnd_done_showcase",
      refundedAt: LATER,
      metadata: amountMismatchMeta(15000, 99999),
      events: [
        event("REFUNDED", {
          id: "ev_rf",
          fromStatus: "REFUND_INITIATED",
          toStatus: "REFUNDED",
          createdAt: LATER,
        }),
      ],
    }),
  }),
  scenario({
    id: "amount-mismatch-held-retry",
    label: "11–13. Refund failed / Needs attention + Retry",
    group: "Amount mismatch",
    purpose: "INVESTOR_DEPOSIT",
    status: "HELD",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["Retry refund visible", "autoRefundFailed present"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "HELD",
      gatewayAccount: "INVESTOR_POOL",
      amount: 100,
      metadata: {
        ...amountMismatchMeta(10000, 15000),
        autoRefundFailed: {
          at: NOW,
          error: "Curlec refund API timed out",
          reason: "AMOUNT_MISMATCH",
        },
      },
      refundNotes: "Automatic refund request failed — safe to retry if Curlec has no refund",
      events: [
        event("CAPTURE_MISMATCH", {
          id: "ev_mm2",
          fromStatus: "PAID",
          toStatus: "HELD",
          reason: "AMOUNT_MISMATCH",
        }),
      ],
    }),
  }),
  scenario({
    id: "admin-retry-hidden-while-pending",
    label: "14. Admin retry hidden while pending",
    group: "Amount mismatch",
    purpose: "INVESTOR_DEPOSIT",
    status: "REFUND_INITIATED",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["Retry refund hidden (status is pending, not HELD)"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "REFUND_INITIATED",
      gatewayAccount: "INVESTOR_POOL",
      refundReference: "rfnd_pending_showcase",
      metadata: {
        ...amountMismatchMeta(10000, 15000),
        refundAttempt: { requestedAt: EARLIER, curlecRefundId: "rfnd_pending_showcase" },
      },
      events: [
        event("REFUND_INITIATED", {
          id: "ev_pend",
          fromStatus: "HELD",
          toStatus: "REFUND_INITIATED",
          createdAt: EARLIER,
        }),
      ],
    }),
  }),
  scenario({
    id: "historical-refunded-allows-new",
    label: "15. Historical refunded (new payment allowed)",
    group: "Amount mismatch",
    purpose: "ISSUER_ONBOARDING_FEE",
    status: "REFUNDED",
    gatewayAccount: "OPERATING",
    notes: ["Detail is historical; issuer portal allows Pay fee again"],
    payment: basePayment({
      purpose: "ISSUER_ONBOARDING_FEE",
      status: "REFUNDED",
      gatewayAccount: "OPERATING",
      amount: 150,
      refundReference: "rfnd_hist",
      refundedAt: LATER,
      metadata: {
        ...amountMismatchMeta(15000, 99999),
        repaymentAllowed: true,
      },
    }),
  }),
  scenario({
    id: "currency-mismatch-deposit",
    label: "16–21. Currency mismatch deposit (no Retry refund)",
    group: "Currency mismatch",
    purpose: "INVESTOR_DEPOSIT",
    status: "HELD",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["Currency card", "Retry refund hidden"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "HELD",
      gatewayAccount: "INVESTOR_POOL",
      metadata: currencyMismatchMeta("MYR", "USD"),
      events: [
        event("CAPTURE_MISMATCH", {
          id: "ev_cur",
          fromStatus: "PAID",
          toStatus: "HELD",
          reason: "Currency mismatch",
        }),
      ],
    }),
  }),
  scenario({
    id: "currency-mismatch-onboarding",
    label: "17. Onboarding fee currency mismatch",
    group: "Currency mismatch",
    purpose: "ISSUER_ONBOARDING_FEE",
    status: "HELD",
    gatewayAccount: "OPERATING",
    notes: ["No Retry refund"],
    payment: basePayment({
      purpose: "ISSUER_ONBOARDING_FEE",
      status: "HELD",
      gatewayAccount: "OPERATING",
      amount: 150,
      metadata: currencyMismatchMeta("MYR", "SGD"),
      events: [
        event("CAPTURE_MISMATCH", {
          id: "ev_cur2",
          fromStatus: "PAID",
          toStatus: "HELD",
          reason: "Currency mismatch",
        }),
      ],
    }),
  }),
  scenario({
    id: "currency-mismatch-processing",
    label: "18. Processing fee currency mismatch",
    group: "Currency mismatch",
    purpose: "APPLICATION_PROCESSING_FEE",
    status: "HELD",
    gatewayAccount: "OPERATING",
    notes: ["No Retry refund"],
    payment: basePayment({
      purpose: "APPLICATION_PROCESSING_FEE",
      status: "HELD",
      gatewayAccount: "OPERATING",
      amount: 50,
      metadata: currencyMismatchMeta("MYR", "SGD"),
    }),
  }),
  scenario({
    id: "wallet-external-refund-created",
    label: "22–24. External refund + wallet fully blocked",
    group: "Wallet reversal",
    purpose: "INVESTOR_DEPOSIT",
    status: "REFUND_INITIATED",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["externalCurlecRefund", "fundsProtected true"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "REFUND_INITIATED",
      gatewayAccount: "INVESTOR_POOL",
      refundReference: "rfnd_ext_showcase",
      metadata: {
        ...externalRefundMeta({ blockedAmount: 100, fundsProtected: true }),
      },
      events: [
        event("REFUND_INITIATED", {
          id: "ev_ext",
          fromStatus: "COMPLETED",
          toStatus: "REFUND_INITIATED",
          reason: "External Curlec refund detected on completed payment",
        }),
      ],
    }),
  }),
  scenario({
    id: "wallet-funds-partial",
    label: "25. Wallet funds partially protected",
    group: "Wallet reversal",
    purpose: "INVESTOR_DEPOSIT",
    status: "HELD",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["Retry wallet reversal"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "HELD",
      gatewayAccount: "INVESTOR_POOL",
      refundReference: "rfnd_ext_showcase",
      metadata: {
        ...externalRefundMeta({ blockedAmount: 40, fundsProtected: false }),
        ...walletFailureMeta({ blockedAmount: 40, fundsProtected: false }),
      },
      events: [
        event("REFUND_WALLET_REVERSAL_FAILED", {
          id: "ev_wf",
          fromStatus: "REFUND_INITIATED",
          toStatus: "HELD",
        }),
      ],
    }),
  }),
  scenario({
    id: "wallet-funds-not-protected",
    label: "26–29. Wallet not protected + retry button",
    group: "Wallet reversal",
    purpose: "INVESTOR_DEPOSIT",
    status: "HELD",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["Destructive Needs attention card", "Retry wallet reversal"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "HELD",
      gatewayAccount: "INVESTOR_POOL",
      refundReference: "rfnd_ext_showcase",
      metadata: {
        ...externalRefundMeta({ blockedAmount: 0, fundsProtected: false }),
        ...walletFailureMeta({
          blockedAmount: 0,
          fundsProtected: false,
          fundsBlocked: false,
        }),
      },
      events: [
        event("REFUND_WALLET_REVERSAL_FAILED", {
          id: "ev_wf2",
          fromStatus: "REFUND_INITIATED",
          toStatus: "HELD",
        }),
      ],
    }),
  }),
  scenario({
    id: "wallet-reversal-completed",
    label: "30. Wallet reversal completed / Refunded",
    group: "Wallet reversal",
    purpose: "INVESTOR_DEPOSIT",
    status: "REFUNDED",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["No wallet failure marker"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "REFUNDED",
      gatewayAccount: "INVESTOR_POOL",
      refundReference: "rfnd_ext_showcase",
      refundedAt: LATER,
      metadata: {
        ...externalRefundMeta(),
        walletReversalCompleted: {
          idempotencyKey: "gateway-deposit:refund:gp_showcase",
          at: LATER,
        },
      },
      events: [
        event("REFUNDED", {
          id: "ev_done",
          fromStatus: "HELD",
          toStatus: "REFUNDED",
          createdAt: LATER,
        }),
      ],
    }),
  }),
  scenario({
    id: "wallet-late-refund-created-while-held",
    label: "31. Late refund.created while wallet failure Held",
    group: "Wallet reversal",
    purpose: "INVESTOR_DEPOSIT",
    status: "HELD",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["Wallet failure remains authoritative for UI"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "HELD",
      gatewayAccount: "INVESTOR_POOL",
      refundReference: "rfnd_ext_showcase",
      metadata: {
        ...externalRefundMeta({ detectedOnEvent: "refund.created" }),
        ...walletFailureMeta({ fundsProtected: true, blockedAmount: 100 }),
      },
    }),
  }),
  scenario({
    id: "wallet-duplicate-safe-reversal",
    label: "32. Duplicate-safe existing reversal reference",
    group: "Wallet reversal",
    purpose: "INVESTOR_DEPOSIT",
    status: "REFUNDED",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["Existing gateway-deposit:refund idempotency key"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "REFUNDED",
      gatewayAccount: "INVESTOR_POOL",
      refundReference: "rfnd_ext_showcase",
      refundedAt: LATER,
      metadata: {
        ...externalRefundMeta(),
        walletReversalCompleted: {
          idempotencyKey: "gateway-deposit:refund:gp_showcase",
          duplicateSafe: true,
          at: LATER,
        },
      },
    }),
  }),
  scenario({
    id: "onboarding-fee-refund-initiated",
    label: "33–35. Onboarding fee external refund initiated",
    group: "Onboarding fee",
    purpose: "ISSUER_ONBOARDING_FEE",
    status: "REFUND_INITIATED",
    gatewayAccount: "OPERATING",
    notes: ["onboarding_fee_paid_at cleared in product", "Repayment required"],
    payment: basePayment({
      purpose: "ISSUER_ONBOARDING_FEE",
      status: "REFUND_INITIATED",
      gatewayAccount: "OPERATING",
      amount: 150,
      refundReference: "rfnd_fee_ext",
      metadata: {
        ...externalRefundMeta({
          previousOnboardingFeePaidAt: EARLIER,
          purposeNote: "onboarding_fee_paid_at cleared",
        }),
      },
      events: [
        event("REFUND_INITIATED", {
          id: "ev_fee",
          fromStatus: "COMPLETED",
          toStatus: "REFUND_INITIATED",
          reason: "External Curlec refund detected on completed payment",
        }),
      ],
    }),
  }),
  scenario({
    id: "onboarding-fee-repayment-required",
    label: "36–37 / 39. Onboarding fee refunded — repay",
    group: "Onboarding fee",
    purpose: "ISSUER_ONBOARDING_FEE",
    status: "REFUNDED",
    gatewayAccount: "OPERATING",
    notes: ["requiresRepayment / Pay fee again in issuer portal"],
    payment: basePayment({
      purpose: "ISSUER_ONBOARDING_FEE",
      status: "REFUNDED",
      gatewayAccount: "OPERATING",
      amount: 150,
      refundReference: "rfnd_fee_done",
      refundedAt: LATER,
      metadata: {
        ...externalRefundMeta(),
        requiresRepayment: true,
      },
      events: [
        event("REFUNDED", {
          id: "ev_fee_rf",
          fromStatus: "REFUND_INITIATED",
          toStatus: "REFUNDED",
          createdAt: LATER,
        }),
      ],
    }),
  }),
  scenario({
    id: "onboarding-fee-refund-failed-restored",
    label: "38. Onboarding fee refund failed — access restored",
    group: "Onboarding fee",
    purpose: "ISSUER_ONBOARDING_FEE",
    status: "COMPLETED",
    gatewayAccount: "OPERATING",
    notes: ["Paid access restored", "receipt available"],
    payment: basePayment({
      purpose: "ISSUER_ONBOARDING_FEE",
      status: "COMPLETED",
      gatewayAccount: "OPERATING",
      amount: 150,
      metadata: {
        externalCurlecRefundFailed: {
          source: "CURLEC_PROVIDER",
          refundId: "rfnd_fee_fail",
          error: "provider cancelled",
          at: NOW,
        },
      },
      receipt: receipt({ purposeLabel: "Issuer Registration Fee", amount: 150 }),
    }),
  }),
  scenario({
    id: "processing-fee-refund-initiated",
    label: "40–41. Processing fee external refund initiated",
    group: "Processing fee",
    purpose: "APPLICATION_PROCESSING_FEE",
    status: "REFUND_INITIATED",
    gatewayAccount: "OPERATING",
    notes: ["Submission blocked until COMPLETED fee exists"],
    payment: basePayment({
      purpose: "APPLICATION_PROCESSING_FEE",
      status: "REFUND_INITIATED",
      gatewayAccount: "OPERATING",
      amount: 50,
      refundReference: "rfnd_proc_ext",
      metadata: externalRefundMeta({ refundId: "rfnd_proc_ext" }),
    }),
  }),
  scenario({
    id: "processing-fee-refunded",
    label: "42–44. Processing fee refunded — repayment required",
    group: "Processing fee",
    purpose: "APPLICATION_PROCESSING_FEE",
    status: "REFUNDED",
    gatewayAccount: "OPERATING",
    notes: ["PROCESSING_FEE_REQUIRED on submit"],
    payment: basePayment({
      purpose: "APPLICATION_PROCESSING_FEE",
      status: "REFUNDED",
      gatewayAccount: "OPERATING",
      amount: 50,
      refundReference: "rfnd_proc_done",
      refundedAt: LATER,
      metadata: { requiresRepayment: true },
    }),
  }),
  scenario({
    id: "processing-fee-refund-failed-restored",
    label: "45. Processing fee refund failed — completed restored",
    group: "Processing fee",
    purpose: "APPLICATION_PROCESSING_FEE",
    status: "COMPLETED",
    gatewayAccount: "OPERATING",
    notes: ["Completed state restored"],
    payment: basePayment({
      purpose: "APPLICATION_PROCESSING_FEE",
      status: "COMPLETED",
      gatewayAccount: "OPERATING",
      amount: 50,
      metadata: {
        externalCurlecRefundFailed: {
          source: "CURLEC_PROVIDER",
          refundId: "rfnd_proc_fail",
          at: NOW,
        },
      },
      receipt: receipt({ purposeLabel: "Application Processing Fee", amount: 50 }),
    }),
  }),
  scenario({
    id: "name-check-pending",
    label: "Name check pending",
    group: "Normal",
    purpose: "INVESTOR_DEPOSIT",
    status: "NAME_CHECK_PENDING",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["Approve / Reject name check"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "NAME_CHECK_PENDING",
      gatewayAccount: "INVESTOR_POOL",
      nameCheckResult: "NAME_UNAVAILABLE",
      payerName: null,
      expectedPayerName: "Ahmad Showcase",
      events: [
        event("NAME_CHECK", {
          id: "ev_nc",
          fromStatus: "PAID",
          toStatus: "NAME_CHECK_PENDING",
          reason: "NAME_UNAVAILABLE",
        }),
      ],
    }),
  }),
  scenario({
    id: "receipt-unavailable",
    label: "46. Receipt unavailable before completion",
    group: "Receipt",
    purpose: "INVESTOR_DEPOSIT",
    status: "CREATED",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["No receipt card content"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "CREATED",
      gatewayAccount: "INVESTOR_POOL",
      receipt: null,
      curlecPaymentId: null,
    }),
  }),
  scenario({
    id: "receipt-generated",
    label: "47. Receipt available after completed",
    group: "Receipt",
    purpose: "INVESTOR_DEPOSIT",
    status: "COMPLETED",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["View / Download PDF"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "COMPLETED",
      gatewayAccount: "INVESTOR_POOL",
      receipt: receipt({ status: "GENERATED", hasPdf: true }),
    }),
  }),
  scenario({
    id: "receipt-pending",
    label: "51a. Receipt generation pending",
    group: "Receipt",
    purpose: "INVESTOR_DEPOSIT",
    status: "COMPLETED",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["Retry when manage permission"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "COMPLETED",
      gatewayAccount: "INVESTOR_POOL",
      receipt: receipt({ status: "PENDING", hasPdf: false, receiptNumber: "RCP-PENDING" }),
    }),
  }),
  scenario({
    id: "receipt-failed",
    label: "51b. Receipt generation failed",
    group: "Receipt",
    purpose: "INVESTOR_DEPOSIT",
    status: "COMPLETED",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["Retry button"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "COMPLETED",
      gatewayAccount: "INVESTOR_POOL",
      receipt: receipt({ status: "FAILED", hasPdf: false, receiptNumber: "RCP-FAILED" }),
    }),
  }),
  scenario({
    id: "receipt-none-amount-mismatch",
    label: "48. No receipt for amount mismatch",
    group: "Receipt",
    purpose: "ISSUER_ONBOARDING_FEE",
    status: "HELD",
    gatewayAccount: "OPERATING",
    notes: ["receipt null"],
    payment: basePayment({
      purpose: "ISSUER_ONBOARDING_FEE",
      status: "HELD",
      gatewayAccount: "OPERATING",
      amount: 150,
      metadata: amountMismatchMeta(15000, 99999),
      receipt: null,
    }),
  }),
  scenario({
    id: "receipt-none-currency-mismatch",
    label: "49. No receipt for currency mismatch",
    group: "Receipt",
    purpose: "INVESTOR_DEPOSIT",
    status: "HELD",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["receipt null"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "HELD",
      gatewayAccount: "INVESTOR_POOL",
      metadata: currencyMismatchMeta(),
      receipt: null,
    }),
  }),
  scenario({
    id: "receipt-none-refunded",
    label: "50. No receipt / refunded receipt state",
    group: "Receipt",
    purpose: "INVESTOR_DEPOSIT",
    status: "REFUNDED",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["Receipt may be REFUNDED if previously generated"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "REFUNDED",
      gatewayAccount: "INVESTOR_POOL",
      refundReference: "rfnd_rcpt",
      refundedAt: LATER,
      receipt: receipt({ status: "REFUNDED", hasPdf: true }),
    }),
  }),
  scenario({
    id: "all-activity-events",
    label: "All activity event types",
    group: "Activity log",
    purpose: "INVESTOR_DEPOSIT",
    status: "REFUNDED",
    gatewayAccount: "INVESTOR_POOL",
    notes: ["Every GatewayPaymentEventType the UI formats"],
    payment: basePayment({
      purpose: "INVESTOR_DEPOSIT",
      status: "REFUNDED",
      gatewayAccount: "INVESTOR_POOL",
      refundReference: "rfnd_timeline",
      refundedAt: LATER,
      events: buildAllActivityEvents(),
    }),
  }),
];

export function getShowcaseScenario(id: ShowcaseScenarioId): ShowcaseScenario {
  const found = SHOWCASE_SCENARIOS.find((item) => item.id === id);
  if (!found) return SHOWCASE_SCENARIOS[0]!;
  return found;
}

export function isGatewayPaymentShowcaseEnabled(
  searchParams: { get(name: string): string | null } | null | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV
): boolean {
  if (nodeEnv === "production") return false;
  return searchParams?.get(SHOWCASE_QUERY_PARAM) === "1";
}

export const PREVIEW_ONLY_TOAST =
  "Preview only — no financial action was performed.";
