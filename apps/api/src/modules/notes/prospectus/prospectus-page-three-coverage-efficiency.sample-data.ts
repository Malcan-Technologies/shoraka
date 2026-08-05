/**
 * SECTION: Sample Page 3 Stage 4 coverage/efficiency inputs
 * WHY: Deterministic plnpat/networth for ROE; no mock OCF/DSCR/days values
 */

import { financialSourceFromYearBlocks } from "./prospectus-financial-comparison-test-helpers";
import { buildProspectusPageThreeCoverageEfficiency } from "./prospectus-page-three-coverage-efficiency";
import type {
  ProspectusPageThreeCoverageEfficiency,
  ProspectusPageThreeCoverageEfficiencyInput,
} from "./prospectus-page-three-coverage-efficiency.types";

function yearBlock(input: { plnpat: number; networth: number; turnover: number }) {
  return {
    plnpat: input.plnpat,
    networth: input.networth,
    bsqpuc: input.networth,
    turnover: input.turnover,
    plnpbt: Math.round(input.plnpat * 1.2),
    bscatot: 4_700_000,
    curlib: 2_900_000,
    bsfatot: 1_500_000,
    othass: 1_000_000,
    bsclbank: 900_000,
    bsslltd: 500_000,
    bsclstd: 200_000,
  };
}

export const SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_SOURCE =
  financialSourceFromYearBlocks({
    "2022": yearBlock({ plnpat: 1_200_000, networth: 2_000_000, turnover: 13_900_000 }),
    "2023": yearBlock({ plnpat: 1_500_000, networth: 2_200_000, turnover: 16_200_000 }),
    "2024": yearBlock({ plnpat: 1_800_000, networth: 2_400_000, turnover: 18_600_000 }),
  });

export const SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_INPUT: ProspectusPageThreeCoverageEfficiencyInput =
  {
    financialSource: SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_SOURCE,
  };

export const SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY: ProspectusPageThreeCoverageEfficiency =
  buildProspectusPageThreeCoverageEfficiency(
    SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_INPUT
  );
