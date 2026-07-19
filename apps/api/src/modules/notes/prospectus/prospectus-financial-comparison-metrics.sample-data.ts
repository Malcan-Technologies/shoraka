/**
 * SECTION: Sample Page 2 Stage 4B metrics from Stage 4A source
 * WHY: Realistic turnover/PAT/BS fields; unsupported rows remain DNA
 */

import { buildProspectusFinancialComparisonSource } from "./prospectus-financial-comparison-source";
import { buildProspectusFinancialComparisonMetrics } from "./prospectus-financial-comparison-metrics";
import type { ProspectusFinancialComparisonMetrics } from "./prospectus-financial-comparison-metrics.types";

export const SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS_SOURCE =
  buildProspectusFinancialComparisonSource({
    financialStatements: {
      questionnaire: { financial_year_end: "2027-12-31" },
      unaudited_by_year: {
        "2022": {
          pldd: "2022-12-31",
          turnover: 13_900_000,
          plnpat: 1_200_000,
          plnpbt: 1_500_000,
          bsqpuc: 16_216_216,
          bscatot: 4_700_000,
          curlib: 2_900_000,
          bsslltd: 1_000_000,
          bsclstd: 500_000,
        },
        "2023": {
          pldd: "2023-12-31",
          turnover: 16_200_000,
          plnpat: 1_500_000,
          plnpbt: 1_800_000,
          bsqpuc: 18_000_000,
          bscatot: 5_100_000,
          curlib: 3_000_000,
          bsslltd: 1_200_000,
          bsclstd: 600_000,
        },
        "2024": {
          pldd: "2024-12-31",
          turnover: 18_600_000,
          plnpat: 1_800_000,
          plnpbt: 2_100_000,
          bsqpuc: 20_000_000,
          bscatot: 5_700_000,
          curlib: 3_200_000,
          bsslltd: 1_400_000,
          bsclstd: 700_000,
        },
      },
    },
    ctosFinancials: {
      financials: [{ financial_year: 2024, turnover: 99_999_999 }],
    },
  });

export const SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS: ProspectusFinancialComparisonMetrics =
  buildProspectusFinancialComparisonMetrics({
    source: SAMPLE_PROSPECTUS_FINANCIAL_COMPARISON_METRICS_SOURCE,
    ctosFinancials: { financials: [{ financial_year: 2024, turnover: 99_999_999 }] },
  });
