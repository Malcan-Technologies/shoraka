/**
 * SECTION: Build Risk Assessment view-model
 * WHY: Canva shows SoukScore grade + catalogue label/explanation; no separate storage
 */

import {
  marcBandForGrade,
  marcGradeColor,
  marcGradeLabel,
  marcOfficialRiskProfile,
  resolveSoukscoreRiskRatingPresentation,
} from "@cashsouk/types";
import {
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_RATING_SCALE_REFERENCE,
  PROSPECTUS_RATING_SCALE_STATUS,
  type ProspectusRiskAssessment,
  type ProspectusRiskAssessmentInput,
} from "./prospectus-risk-assessment.types";

function formatMarcAssessmentScore(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function formatMarcAssessmentPd(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value.toFixed(2)}%`;
  }
  const text = String(value).trim();
  if (!text) return null;
  return text.endsWith("%") ? text : `${text}%`;
}

export function buildProspectusRiskAssessment(
  input: ProspectusRiskAssessmentInput
): ProspectusRiskAssessment {
  const marcGrade = input.marcGrade?.trim() || "";
  const marcBand = marcBandForGrade(marcGrade);
  const officialProfile = marcOfficialRiskProfile(marcGrade);
  if (marcBand && officialProfile) {
    return {
      canva: {
        riskGrade: marcGrade,
        riskLabel: marcGradeLabel(marcGrade),
        riskExplanation: officialProfile,
        riskGradeColor: marcGradeColor(marcGrade),
        riskGradeTextColor: "#ffffff",
        ratingScaleReference: PROSPECTUS_RATING_SCALE_REFERENCE,
        marcCreditScoreDisplay: formatMarcAssessmentScore(input.marcCreditScore),
        marcProbabilityOfDefaultDisplay: formatMarcAssessmentPd(input.marcProbabilityOfDefault),
      },
      audit: {
        riskScore: PROSPECTUS_DATA_NOT_AVAILABLE,
        riskAppliesTo: "Issuer organization MARC assessment, frozen at Prospectus approve",
        assessmentSource: "Admin-entered organization MARC assessment",
        isFrozen: true,
        scaleStatus: PROSPECTUS_RATING_SCALE_STATUS,
      },
    };
  }

  const presentation = resolveSoukscoreRiskRatingPresentation(input.soukscoreRiskRating);

  return {
    canva: {
      riskGrade: presentation.grade,
      riskLabel: presentation.label,
      riskExplanation: presentation.description,
      riskGradeColor: presentation.color,
      riskGradeTextColor: presentation.textColor,
      ratingScaleReference: PROSPECTUS_RATING_SCALE_REFERENCE,
      marcCreditScoreDisplay: null,
      marcProbabilityOfDefaultDisplay: null,
    },
    audit: {
      riskScore: PROSPECTUS_DATA_NOT_AVAILABLE,
      riskAppliesTo: presentation.isAvailable
        ? "Invoice offer, frozen on Note snapshot"
        : PROSPECTUS_DATA_NOT_AVAILABLE,
      assessmentSource: presentation.isAvailable
        ? "Admin Cashsouk Risk Rating on invoice offer"
        : PROSPECTUS_DATA_NOT_AVAILABLE,
      isFrozen: presentation.isAvailable,
      scaleStatus: PROSPECTUS_RATING_SCALE_STATUS,
    },
  };
}
