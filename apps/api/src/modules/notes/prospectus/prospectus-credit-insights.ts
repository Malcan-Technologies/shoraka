/**
 * SECTION: Build Page 2 Credit Insights view-model
 * WHY: Always Data not available — no approved classifiers; no system mixing
 */

import {
  PROSPECTUS_CREDIT_INSIGHTS_AUDIT,
  PROSPECTUS_CREDIT_INSIGHTS_SECTION_HEADING,
  PROSPECTUS_DATA_NOT_AVAILABLE,
  type ProspectusCreditInsights,
  type ProspectusCreditInsightsInput,
} from "./prospectus-credit-insights.types";

export function buildProspectusCreditInsights(
  input: ProspectusCreditInsightsInput = {}
): ProspectusCreditInsights {
  // Observational only — prove raw credit/risk/onboarding signals never become Canva values.
  void input.creditContext;
  void input.ctosScore;
  void input.ficoScore;
  void input.soukScore;
  void input.creditScoreLabel;
  void input.paymentBehaviourLabel;
  void input.creditUtilisationLabel;
  void input.litigationLabel;
  void input.ccrisStatusLabel;
  void input.issuerOnTimePaymentPercent;
  void input.ccrisPaymentData;
  void input.facilityUtilisationPercent;
  void input.litigationCount;
  void input.legalRecords;
  void input.ccrisAccountCount;
  void input.regTankStatus;
  void input.amlStatus;
  void input.kycStatus;
  void input.ssmCreditworthinessSentence;

  return {
    sectionHeading: PROSPECTUS_CREDIT_INSIGHTS_SECTION_HEADING,
    creditScore: PROSPECTUS_DATA_NOT_AVAILABLE,
    paymentBehaviour: PROSPECTUS_DATA_NOT_AVAILABLE,
    creditUtilisation: PROSPECTUS_DATA_NOT_AVAILABLE,
    litigationCheck: PROSPECTUS_DATA_NOT_AVAILABLE,
    ccrisStatus: PROSPECTUS_DATA_NOT_AVAILABLE,
    creditScoreExplanation: PROSPECTUS_DATA_NOT_AVAILABLE,
    audit: PROSPECTUS_CREDIT_INSIGHTS_AUDIT,
  };
}
