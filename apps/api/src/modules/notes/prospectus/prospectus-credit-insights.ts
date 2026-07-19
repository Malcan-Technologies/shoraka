/**
 * SECTION: Build Page 2 Credit Insights view-model
 * WHY: Officer-selected typed options only; never infer from CTOS/SoukScore/AML/KYC
 */

import {
  PROSPECTUS_CREDIT_INSIGHTS_AUDIT,
  PROSPECTUS_CREDIT_INSIGHTS_SECTION_HEADING,
  PROSPECTUS_DATA_NOT_AVAILABLE,
  type ProspectusCreditInsights,
  type ProspectusCreditInsightsInput,
} from "./prospectus-credit-insights.types";
import {
  resolveCreditInsightLabel,
  type ProspectusCreditInsightFieldKey,
} from "./prospectus-placeholder-publication-content";

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

  const selections = input.creditInsightSelections;
  const omittedFields: ProspectusCreditInsightFieldKey[] = [];

  const resolve = (
    field: ProspectusCreditInsightFieldKey
  ): string => {
    if (selections == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
    const key = selections[field];
    if (key == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
    if (key === "do_not_display") {
      omittedFields.push(field);
      return "";
    }
    return resolveCreditInsightLabel(key) ?? PROSPECTUS_DATA_NOT_AVAILABLE;
  };

  return {
    sectionHeading: PROSPECTUS_CREDIT_INSIGHTS_SECTION_HEADING,
    creditScore: resolve("creditScore"),
    paymentBehaviour: resolve("paymentBehaviour"),
    creditUtilisation: resolve("creditUtilisation"),
    litigationCheck: resolve("litigationCheck"),
    ccrisStatus: resolve("ccrisStatus"),
    creditScoreExplanation: PROSPECTUS_DATA_NOT_AVAILABLE,
    omittedFields,
    audit: PROSPECTUS_CREDIT_INSIGHTS_AUDIT,
  };
}
