/**
 * SECTION: Temporary development-only prospectus publication placeholders
 * WHY: Preview/render full Pages 1–3 before pre-marketplace admin workflow exists
 *
 * NOT production truth. Prisma-backed Note mappers must NOT import this for defaults.
 * Payment Basis / Shariah Principle use shared fixed constants.
 */

import {
  PROSPECTUS_FIXED_PAYMENT_BASIS,
  PROSPECTUS_FIXED_SHARIAH_PRINCIPLE,
} from "@cashsouk/types";

export const PROSPECTUS_PUBLICATION_CONTENT_SOURCE = {
  kind: "development_placeholder" as const,
  legallyApproved: false,
  futureWorkflow: "pre_marketplace_prospectus_review",
  mustNotOverwriteApplicationOrCtos: true,
};

export type ProspectusPlaceholderSourceType =
  | "placeholder_manual"
  | "derived_suggestion"
  | "fixed_template";

export type ProspectusCreditInsightOptionKey =
  | "positive"
  | "neutral"
  | "negative"
  | "do_not_display";

export const PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE: ReadonlyArray<{
  key: ProspectusCreditInsightOptionKey;
  label: string;
}> = [
  { key: "positive", label: "Positive" },
  { key: "neutral", label: "Neutral" },
  { key: "negative", label: "Negative" },
  { key: "do_not_display", label: "Do not display" },
];

export type ProspectusCreditInsightFieldKey =
  | "creditScore"
  | "paymentBehaviour"
  | "creditUtilisation"
  | "litigationCheck"
  | "ccrisStatus";

export type ProspectusInvestorTakeawayCategoryKey =
  | "revenue_profitability"
  | "liquidity"
  | "leverage"
  | "debt_servicing_capacity"
  | "working_capital_efficiency"
  | "overall_financial_profile";

export interface ProspectusKeyInvestorHighlightPlaceholder {
  key: string;
  title: string;
  description: string;
  sourceType: ProspectusPlaceholderSourceType;
  isVisible: boolean;
}

export interface ProspectusInvoiceWorkStatementPlaceholder {
  key: string;
  text: string;
  isVisible: boolean;
  sourceType: "placeholder_manual";
}

export interface ProspectusInvestorTakeawayOption {
  key: string;
  text: string | null;
}

export interface ProspectusFinancialYearManualInputs {
  grossProfit?: number | string | null;
  ebitda?: number | string | null;
  ebit?: number | string | null;
  cashAndBank?: number | string | null;
  tradeReceivables?: number | string | null;
  totalEquity?: number | string | null;
  quickRatio?: number | string | null;
  operatingCashFlow?: number | string | null;
  freeCashFlow?: number | string | null;
  interestCoverage?: number | string | null;
  dscr?: number | string | null;
  debtEquity?: number | string | null;
  returnOnAssets?: number | string | null;
  receivablesDays?: number | string | null;
  payablesDays?: number | string | null;
  assetTurnover?: number | string | null;
}

/** Temporary builder-only manual fills for unsupported Page 3 fields. */
export interface ProspectusFinancialInputsPlaceholder {
  years: Record<string, ProspectusFinancialYearManualInputs>;
}

/**
 * Typed publication content shape for sample/preview and future workflow inputs.
 * Production Note mapping leaves this undefined.
 */
export interface ProspectusPaymasterTrackRecordPublicationInputs {
  totalInvoicesPaid?: number | null;
  totalAmountPaid?: string | number | null;
  successfulRepaymentPercent?: string | number | null;
  onTimePaymentPercent?: string | number | null;
  averagePaymentPeriodDays?: string | number | null;
}

export interface ProspectusPublicationContent {
  meta: typeof PROSPECTUS_PUBLICATION_CONTENT_SOURCE;
  keyInvestorHighlights: ProspectusKeyInvestorHighlightPlaceholder[];
  paymentBasisTemplate: {
    paymentBasis: string;
    shariahPrinciple: string;
    sourceType: "fixed_template";
    approvedProductionCopy: boolean;
  };
  paymasterTrackRecord?: ProspectusPaymasterTrackRecordPublicationInputs;
  creditInsightSelections: Partial<
    Record<ProspectusCreditInsightFieldKey, ProspectusCreditInsightOptionKey>
  >;
  invoiceWorkStatements: ProspectusInvoiceWorkStatementPlaceholder[];
  investorTakeawayOptions: Record<
    ProspectusInvestorTakeawayCategoryKey,
    ProspectusInvestorTakeawayOption[]
  >;
  investorTakeawaySelections: Partial<
    Record<ProspectusInvestorTakeawayCategoryKey, string>
  >;
  prospectusFinancialInputs?: ProspectusFinancialInputsPlaceholder;
}

export const PROSPECTUS_PLACEHOLDER_PUBLICATION_CONTENT: ProspectusPublicationContent = {
  meta: PROSPECTUS_PUBLICATION_CONTENT_SOURCE,
  keyInvestorHighlights: [
    {
      key: "paymaster",
      title: "Placeholder — Paymaster highlight",
      description:
        "Development placeholder only. Future credit-officer selection or entry.",
      sourceType: "placeholder_manual",
      isVisible: true,
    },
    {
      key: "issuer_fundamentals",
      title: "Placeholder — Issuer fundamentals",
      description:
        "Development placeholder only. Future suggestion from approved SoukScore mapping.",
      sourceType: "derived_suggestion",
      isVisible: true,
    },
    {
      key: "return",
      title: "Placeholder — Return highlight",
      description:
        "Development placeholder only. Future suggestion from profit rate and investment period.",
      sourceType: "derived_suggestion",
      isVisible: true,
    },
    {
      key: "shariah",
      title: "Placeholder — Shariah highlight",
      description:
        "Development placeholder only. Future fixed approved template option.",
      sourceType: "fixed_template",
      isVisible: true,
    },
  ],
  paymentBasisTemplate: {
    paymentBasis: PROSPECTUS_FIXED_PAYMENT_BASIS,
    shariahPrinciple: PROSPECTUS_FIXED_SHARIAH_PRINCIPLE,
    sourceType: "fixed_template",
    approvedProductionCopy: true,
  },
  creditInsightSelections: {
    creditScore: "positive",
    paymentBehaviour: "neutral",
    creditUtilisation: "positive",
    litigationCheck: "do_not_display",
    ccrisStatus: "neutral",
  },
  invoiceWorkStatements: [
    {
      key: "work_under_contract",
      text: "Placeholder — work under contract statement (not approved).",
      isVisible: true,
      sourceType: "placeholder_manual",
    },
    {
      key: "certification_acceptance",
      text: "Placeholder — certification and acceptance statement (not approved).",
      isVisible: true,
      sourceType: "placeholder_manual",
    },
    {
      key: "paymaster_trust_account",
      text: "Placeholder — paymaster-to-trust-account statement (not approved).",
      isVisible: true,
      sourceType: "placeholder_manual",
    },
    {
      key: "deed_of_assignment",
      text: "Placeholder — deed of assignment statement (not approved).",
      isVisible: true,
      sourceType: "placeholder_manual",
    },
  ],
  investorTakeawayOptions: {
    revenue_profitability: [
      {
        key: "placeholder_positive",
        text: "Placeholder — revenue/profitability description (not approved).",
      },
      { key: "do_not_display", text: null },
    ],
    liquidity: [
      {
        key: "placeholder_stable",
        text: "Placeholder — liquidity description (not approved).",
      },
      { key: "do_not_display", text: null },
    ],
    leverage: [
      {
        key: "placeholder_moderate",
        text: "Placeholder — leverage description (not approved).",
      },
      { key: "do_not_display", text: null },
    ],
    debt_servicing_capacity: [
      {
        key: "placeholder_adequate",
        text: "Placeholder — debt-servicing description (not approved).",
      },
      { key: "do_not_display", text: null },
    ],
    working_capital_efficiency: [
      {
        key: "placeholder_typical",
        text: "Placeholder — working-capital description (not approved).",
      },
      { key: "do_not_display", text: null },
    ],
    overall_financial_profile: [
      {
        key: "placeholder_balanced",
        text: "Placeholder — overall profile description (not approved).",
      },
      { key: "do_not_display", text: null },
    ],
  },
  investorTakeawaySelections: {
    revenue_profitability: "placeholder_positive",
    liquidity: "placeholder_stable",
    leverage: "do_not_display",
    debt_servicing_capacity: "placeholder_adequate",
    working_capital_efficiency: "placeholder_typical",
    overall_financial_profile: "placeholder_balanced",
  },
  prospectusFinancialInputs: {
    years: {
      "2022": {
        grossProfit: 2_100_000,
        cashAndBank: 450_000,
        totalEquity: 3_200_000,
      },
      "2023": {
        grossProfit: 2_400_000,
        cashAndBank: 520_000,
        totalEquity: 3_500_000,
      },
      "2024": {
        grossProfit: 2_800_000,
        cashAndBank: 610_000,
        totalEquity: 3_900_000,
      },
    },
  },
};

export function resolveCreditInsightLabel(
  key: ProspectusCreditInsightOptionKey | undefined
): string | null {
  if (key == null) return null;
  if (key === "do_not_display") return null;
  const hit = PROSPECTUS_CREDIT_INSIGHT_OPTION_CATALOGUE.find((o) => o.key === key);
  return hit?.label ?? null;
}

export function resolveInvestorTakeawayText(
  category: ProspectusInvestorTakeawayCategoryKey,
  selectedKey: string | undefined,
  options: ProspectusPublicationContent["investorTakeawayOptions"]
): string | null {
  if (!selectedKey) return null;
  const option = options[category]?.find((o) => o.key === selectedKey);
  if (!option || option.key === "do_not_display") return null;
  return option.text;
}
