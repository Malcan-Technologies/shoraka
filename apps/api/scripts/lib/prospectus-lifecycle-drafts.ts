/**
 * Deterministic Prospectus Review drafts for lifecycle seed scenarios.
 * Year keys follow the Note's real financial years (not display placeholders).
 */

import { PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT } from "@cashsouk/types";
import {
  emptyProspectusReviewContent,
  normalizeAboutInvoiceSelections,
  type ProspectusReviewStoredContent,
} from "../../src/modules/notes/prospectus-review/prospectus-review-content";

const PAYMASTER_NAME = "Lifecycle Seed Paymaster Sdn. Bhd.";
const CONTRACT_WORK = "civil engineering and infrastructure works";

export type LifecycleDraftMode = "empty" | "partial" | "complete";

export type LifecycleYearManual = {
  grossProfit: number;
  ebitda: number;
  ebit: number;
  cashAndBank: number;
  tradeReceivables: number;
  totalEquity: number;
  quickRatio: number;
  operatingCashFlow: number;
  freeCashFlow: number;
  debtEquity: number;
  returnOnAssets: number;
  payablesDays: number;
  assetTurnover: number;
  interestCoverage: number;
  dscr: number;
  receivablesDays: number;
  netDebtEquity: number;
};

/** Clear trend demos for three real years (oldest → newest). */
export function lifecycleTrendManualsForYears(
  years: readonly number[]
): Record<number, LifecycleYearManual> {
  const sorted = [...years].sort((a, b) => a - b);
  const templates: LifecycleYearManual[] = [
    {
      grossProfit: 2_100_000,
      ebitda: 1_600_000,
      ebit: 1_450_000,
      cashAndBank: 900_000,
      tradeReceivables: 2_800_000,
      totalEquity: 4_500_000,
      quickRatio: 1.11,
      operatingCashFlow: 1_400_000,
      freeCashFlow: 1_600_000,
      debtEquity: 0.28,
      returnOnAssets: 4.8,
      payablesDays: 52,
      assetTurnover: 1.5,
      interestCoverage: 10,
      dscr: 1.5,
      receivablesDays: 80,
      netDebtEquity: 0.4,
    },
    {
      grossProfit: 2_400_000,
      ebitda: 1_850_000,
      ebit: 1_700_000,
      cashAndBank: 1_100_000,
      tradeReceivables: 3_100_000,
      totalEquity: 5_000_000,
      quickRatio: 1.18,
      operatingCashFlow: 1_700_000,
      freeCashFlow: 1_300_000,
      debtEquity: 0.22,
      returnOnAssets: 5.3,
      payablesDays: 48,
      assetTurnover: 1.7,
      interestCoverage: 12,
      dscr: 1.505,
      receivablesDays: 70,
      netDebtEquity: 0.3,
    },
    {
      grossProfit: 2_800_000,
      ebitda: 2_100_000,
      ebit: 1_950_000,
      cashAndBank: 1_400_000,
      tradeReceivables: 3_200_000,
      totalEquity: 5_600_000,
      quickRatio: 1.26,
      operatingCashFlow: 2_100_000,
      freeCashFlow: 1_000_000,
      debtEquity: 0.16,
      returnOnAssets: 5.8,
      payablesDays: 44,
      assetTurnover: 1.9,
      interestCoverage: 14,
      dscr: 1.51,
      receivablesDays: 60,
      netDebtEquity: 0.2,
    },
  ];

  const out: Record<number, LifecycleYearManual> = {};
  sorted.forEach((year, index) => {
    const tpl = templates[Math.min(index, templates.length - 1)]!;
    out[year] = { ...tpl };
  });
  return out;
}

function buildFinancialOverrides(
  manuals: Record<number, LifecycleYearManual>
): NonNullable<ProspectusReviewStoredContent["page2"]["financialComparison"]> {
  const overrides: Record<
    string,
    {
      interestCoverage: number;
      dscr: number;
      receivablesDays: number;
      netDebtEquity: number;
    }
  > = {};
  for (const [yearKey, row] of Object.entries(manuals)) {
    const year = Number(yearKey);
    overrides[String(year)] = {
      interestCoverage: row.interestCoverage,
      dscr: row.dscr,
      receivablesDays: row.receivablesDays,
      netDebtEquity: row.netDebtEquity,
    };
    overrides[`${year}-12-31`] = { ...overrides[String(year)]! };
  }
  return { overrides };
}

function buildPage3Years(
  manuals: Record<number, LifecycleYearManual>
): NonNullable<ProspectusReviewStoredContent["page3"]["manualFinancialInputs"]> {
  const years: Record<string, Record<string, number>> = {};
  for (const [yearKey, row] of Object.entries(manuals)) {
    years[yearKey] = {
      grossProfit: row.grossProfit,
      ebitda: row.ebitda,
      ebit: row.ebit,
      cashAndBank: row.cashAndBank,
      tradeReceivables: row.tradeReceivables,
      totalEquity: row.totalEquity,
      quickRatio: row.quickRatio,
      operatingCashFlow: row.operatingCashFlow,
      freeCashFlow: row.freeCashFlow,
      debtEquity: row.debtEquity,
      returnOnAssets: row.returnOnAssets,
      payablesDays: row.payablesDays,
      assetTurnover: row.assetTurnover,
    };
  }
  return { years };
}

export function buildLifecycleProspectusDraft(input: {
  mode: LifecycleDraftMode;
  realYears: readonly number[];
  riskRating?: string;
  profitRatePercent?: number;
}): ProspectusReviewStoredContent {
  const paymasterSnapshot = {
    name: PAYMASTER_NAME,
    entity_type: "Private Limited Company (Sdn Bhd)",
  };
  const contractSnapshot = {
    contract_details: { description: CONTRACT_WORK },
  };

  let draft = emptyProspectusReviewContent(
    {
      paymasterSnapshot,
      riskRating: input.riskRating ?? "B",
      profitRatePercent: input.profitRatePercent ?? 12,
      listingOpensAt: "2026-05-15T00:00:00.000Z",
      maturityDate: "2026-12-15T00:00:00.000Z",
    },
    {
      paymasterSnapshot,
      contractSnapshot,
      deedOfAssignment: null,
    }
  );

  if (input.mode === "empty") {
    return draft;
  }

  draft.page1.keyInvestorHighlights = draft.page1.keyInvestorHighlights.map((h) => {
    if (h.key === "shariah") {
      return {
        key: "shariah",
        title: PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.title,
        description: PROSPECTUS_FIXED_SHARIAH_HIGHLIGHT.description,
      };
    }
    if (input.mode === "partial" && h.key === "return") {
      return { ...h, title: "", description: "" };
    }
    return {
      ...h,
      title: h.title || `Seed ${h.key} title`,
      description: h.description || `Seed ${h.key} description for lifecycle testing.`,
    };
  });

  draft.page2.issuerProfile = { companySize: "Medium" };
  draft.page2.invoicePaymaster = {
    deedOfAssignment: "Yes",
    paymasterRating: "PM1",
    confidenceGrading: "High",
  };

  if (input.mode === "partial") {
    draft.page2.creditInsights = {
      creditScoreOptionKey: "good",
      paymentBehaviourOptionKey: null,
      creditUtilisationOptionKey: null,
      litigationCheckOptionKey: null,
      ccrisStatusOptionKey: null,
    };
    draft.page3.investorTakeaways = {
      revenueProfitabilityOptionKey: "steady_growth",
      liquidityOptionKey: null,
      leverageOptionKey: null,
      debtServicingCapacityOptionKey: null,
      receivablesCollectionOptionKey: null,
      overallFinancialProfileOptionKey: null,
    };
    // Leave financial officer fields empty so approval stays blocked.
    draft.page2.financialComparison = { overrides: {} };
    draft.page3.manualFinancialInputs = { years: {} };
    return draft;
  }

  draft = normalizeAboutInvoiceSelections(draft, {
    paymasterSnapshot,
    contractSnapshot,
    deedOfAssignment: "Yes",
  });
  draft.page2.aboutInvoice = {
    items: (draft.page2.aboutInvoice?.items ?? []).map((item) => ({
      ...item,
      sourceType: "OFFICER_ENTERED" as const,
    })),
  };
  draft.page2.invoiceWorkStatements = (draft.page2.aboutInvoice?.items ?? []).map((item) => ({
    key: item.id,
    optionKey: null,
    isVisible: true,
  }));
  draft.page2.paymasterTrackRecord = {
    totalInvoicesPaid: 48,
    totalAmountPaid: "12500000",
    successfulRepaymentPercent: 98.5,
    onTimePaymentPercent: 94,
    averagePaymentPeriodDays: 32,
  };
  draft.page2.creditInsights = {
    creditScoreOptionKey: "good",
    paymentBehaviourOptionKey: "good",
    creditUtilisationOptionKey: "healthy",
    litigationCheckOptionKey: "clear",
    ccrisStatusOptionKey: "no_record",
  };

  const manuals = lifecycleTrendManualsForYears(input.realYears);
  draft.page2.financialComparison = buildFinancialOverrides(manuals);
  draft.page3.manualFinancialInputs = buildPage3Years(manuals);
  draft.page3.investorTakeaways = {
    revenueProfitabilityOptionKey: "steady_growth",
    liquidityOptionKey: "healthy_improving",
    leverageOptionKey: "conservative_improving",
    debtServicingCapacityOptionKey: "adequate_improving",
    receivablesCollectionOptionKey: "improving",
    overallFinancialProfileOptionKey: "strengthening",
  };
  return draft;
}

export function assertNotProductionSeed(env = process.env): void {
  const nodeEnv = (env.NODE_ENV ?? "").toLowerCase();
  const appEnv = (env.APP_ENV ?? "").toLowerCase();
  if (nodeEnv === "production" || appEnv === "production" || appEnv === "prod") {
    throw new Error(
      "seed-prospectus-lifecycle is blocked in production (NODE_ENV/APP_ENV=production)."
    );
  }
}
