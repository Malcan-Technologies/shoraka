/**
 * SECTION: Sample Page 3 Stage 4 coverage/efficiency inputs
 * WHY: Deterministic CTOS direct ROE field + official XSL inputs; no mock OCF/DSCR/days
 */

import { financialSourceFromYearBlocks } from "./prospectus-financial-comparison-test-helpers";
import { buildProspectusPageThreeCoverageEfficiency } from "./prospectus-page-three-coverage-efficiency";
import type {
  ProspectusPageThreeCoverageEfficiency,
  ProspectusPageThreeCoverageEfficiencyInput,
} from "./prospectus-page-three-coverage-efficiency.types";

function yearBlock(input: {
  plnpat: number;
  networth: number;
  turnover: number;
  return_on_equity: number;
  totass: number;
  totlib: number;
  gear?: number;
}) {
  return {
    plnpat: input.plnpat,
    networth: input.networth,
    bsqpuc: input.networth,
    turnover: input.turnover,
    plnpbt: Math.round(input.plnpat * 1.2),
    return_on_equity: input.return_on_equity,
    totass: input.totass,
    totlib: input.totlib,
    gear: input.gear ?? null,
    currat: 1.62,
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
    "2022": yearBlock({
      plnpat: 1_200_000,
      networth: 2_000_000,
      turnover: 13_900_000,
      return_on_equity: 60,
      totass: 8_100_000,
      totlib: 3_600_000,
    }),
    "2023": yearBlock({
      plnpat: 1_500_000,
      networth: 2_200_000,
      turnover: 16_200_000,
      return_on_equity: 68.18,
      totass: 8_100_000,
      totlib: 3_600_000,
    }),
    "2024": yearBlock({
      plnpat: 1_800_000,
      networth: 2_400_000,
      turnover: 18_600_000,
      return_on_equity: 75,
      totass: 8_100_000,
      totlib: 3_600_000,
    }),
  });

export const SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_INPUT: ProspectusPageThreeCoverageEfficiencyInput =
  {
    financialSource: SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_SOURCE,
  };

export const SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY: ProspectusPageThreeCoverageEfficiency =
  buildProspectusPageThreeCoverageEfficiency(
    SAMPLE_PROSPECTUS_PAGE_THREE_COVERAGE_EFFICIENCY_INPUT
  );
