import {
  ISSUER_SEAL_APPLIER_REQUIRED_MESSAGE,
  PROFILE_PEOPLE_HREF,
} from "@cashsouk/types";
import type { IssuerDirectorSelectionIssue } from "./issuer-directors";

export const ISSUER_DIRECTORS_REQUIRED_MESSAGE =
  "Select at least one director to represent the issuer company.";

export const ISSUER_DIRECTOR_PERSON_EMAIL_REQUIRED_MESSAGE =
  "Add Person Email for the selected director on People & Access, then return here to continue.";

export const ISSUER_DIRECTOR_PERSON_EMAIL_FIELD_HINT =
  "Person Email is missing for this director.";

export const ISSUER_DIRECTOR_IC_REQUIRED_MESSAGE =
  "Add a 12-digit IC number for the selected director on People & Access, then return here to continue.";

export const PROFILE_PEOPLE_ACCESS_LINK_LABEL = "Open People & Access";

export const GUARANTOR_PARTIES_REQUIRED_MESSAGE =
  "Complete authorised representatives for every guarantor.";

export type IssuerOfferRepsBlocker = {
  message: string;
  pending?: boolean;
  href?: string;
  linkLabel?: string;
};

function directorIssueBlocker(
  issue: IssuerDirectorSelectionIssue
): IssuerOfferRepsBlocker {
  if (issue.kind === "missing_email") {
    return {
      message: ISSUER_DIRECTOR_PERSON_EMAIL_REQUIRED_MESSAGE,
      href: PROFILE_PEOPLE_HREF,
      linkLabel: PROFILE_PEOPLE_ACCESS_LINK_LABEL,
    };
  }
  if (issue.kind === "missing_ic") {
    return {
      message: ISSUER_DIRECTOR_IC_REQUIRED_MESSAGE,
      href: PROFILE_PEOPLE_HREF,
      linkLabel: PROFILE_PEOPLE_ACCESS_LINK_LABEL,
    };
  }
  return { message: ISSUER_DIRECTORS_REQUIRED_MESSAGE };
}

export function issuerOfferRepsBlocker(input: {
  directorIssue: IssuerDirectorSelectionIssue | null;
  guarantorsReady: boolean;
  requiresIssuerSeal: boolean;
  hasSealApplier: boolean;
}): IssuerOfferRepsBlocker | null {
  if (input.directorIssue) {
    return directorIssueBlocker(input.directorIssue);
  }
  if (!input.guarantorsReady) {
    return { message: GUARANTOR_PARTIES_REQUIRED_MESSAGE };
  }
  if (!input.requiresIssuerSeal) return null;
  if (!input.hasSealApplier) {
    return { message: ISSUER_SEAL_APPLIER_REQUIRED_MESSAGE };
  }
  return null;
}
