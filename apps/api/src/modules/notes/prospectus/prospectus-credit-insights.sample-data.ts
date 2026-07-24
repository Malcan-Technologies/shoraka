/**
 * SECTION: Sample Page 2 Credit Insights inputs for Stage 5 preview
 * WHY: Supply unsupported credit/risk/onboarding signals; builder must still return DNA
 */

import { buildProspectusCreditInsights } from "./prospectus-credit-insights";
import type {
  ProspectusCreditInsights,
  ProspectusCreditInsightsInput,
} from "./prospectus-credit-insights.types";

/**
 * Deliberately includes Canva-sample-like and raw credit/risk observations.
 * None become Canva-facing values.
 */
export const SAMPLE_PROSPECTUS_CREDIT_INSIGHTS_INPUT: ProspectusCreditInsightsInput = {
  creditContext: { provider: "CTOS", reportId: "sample-report" },
  ctosScore: 720,
  ficoScore: 720,
  soukScore: "AA",
  creditScoreLabel: "Good",
  paymentBehaviourLabel: "Good",
  creditUtilisationLabel: "Healthy",
  litigationLabel: "Clear",
  ccrisStatusLabel: "No record",
  issuerOnTimePaymentPercent: 94,
  ccrisPaymentData: { arrears: 0, outstanding: 0 },
  facilityUtilisationPercent: 45,
  litigationCount: 0,
  legalRecords: [],
  ccrisAccountCount: 0,
  regTankStatus: "approved",
  amlStatus: "clear",
  kycStatus: "completed",
  ssmCreditworthinessSentence:
    "Credit Score is a predictive indicator of the issuer’s credit worthiness based on data from SSM",
};

export const SAMPLE_PROSPECTUS_CREDIT_INSIGHTS: ProspectusCreditInsights =
  buildProspectusCreditInsights(SAMPLE_PROSPECTUS_CREDIT_INSIGHTS_INPUT);
