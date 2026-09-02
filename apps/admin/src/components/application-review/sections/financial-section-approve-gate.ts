import {
  computeHasPendingDirectorShareholder,
  isCompleteIssuerMarcAssessment,
  MARC_ASSESSMENT_REQUIRED_MESSAGE,
  type ApplicationPersonRow,
  type MarcAssessmentSnapshot,
} from "@cashsouk/types";
import { ADMIN_DIRECTOR_SHAREHOLDER_PENDING_LABEL } from "@/lib/admin-director-shareholder-review-message";

export function financialSectionApproveDisabledReason(input: {
  people?: ApplicationPersonRow[];
  marcAssessment?: MarcAssessmentSnapshot | null;
}): string | undefined {
  if (!isCompleteIssuerMarcAssessment(input.marcAssessment ?? null)) {
    return MARC_ASSESSMENT_REQUIRED_MESSAGE;
  }
  if (computeHasPendingDirectorShareholder(input.people)) {
    return ADMIN_DIRECTOR_SHAREHOLDER_PENDING_LABEL;
  }
  return undefined;
}
