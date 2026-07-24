/**
 * SECTION: Build Page 2 Credit Insights view-model
 * WHY: Officer-selected typed options only; never infer from CTOS/SoukScore/AML/KYC
 * All five rows are always investor-facing when selected; missing Draft → DNA.
 */

import {
  findCreditInsightCatalogueOption,
  resolveCreditInsightRenderedText,
  type ProspectusCreditInsightCatalogueField,
} from "../prospectus-review/prospectus-option-catalogues";
import {
  PROSPECTUS_CREDIT_INSIGHTS_AUDIT,
  PROSPECTUS_CREDIT_INSIGHTS_DESCRIPTION,
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

  const selections = input.creditInsightSelections;

  const resolve = (field: ProspectusCreditInsightCatalogueField): string => {
    if (selections == null) return PROSPECTUS_DATA_NOT_AVAILABLE;
    const raw = selections[field];
    if (raw == null || String(raw).trim() === "") return PROSPECTUS_DATA_NOT_AVAILABLE;
    const key = String(raw).trim();
    const hit = findCreditInsightCatalogueOption(field, key);
    if (!hit) return PROSPECTUS_DATA_NOT_AVAILABLE;
    return resolveCreditInsightRenderedText(field, key) ?? PROSPECTUS_DATA_NOT_AVAILABLE;
  };

  return {
    sectionHeading: PROSPECTUS_CREDIT_INSIGHTS_SECTION_HEADING,
    creditScore: resolve("creditScore"),
    paymentBehaviour: resolve("paymentBehaviour"),
    creditUtilisation: resolve("creditUtilisation"),
    litigationCheck: resolve("litigationCheck"),
    ccrisStatus: resolve("ccrisStatus"),
    description: PROSPECTUS_CREDIT_INSIGHTS_DESCRIPTION,
    audit: PROSPECTUS_CREDIT_INSIGHTS_AUDIT,
  };
}
