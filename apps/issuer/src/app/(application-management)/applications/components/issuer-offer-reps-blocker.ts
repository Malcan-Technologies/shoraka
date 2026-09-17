import {
  ISSUER_COMPANY_SEAL_OWNER_ADMIN_REQUIRED_MESSAGE,
  ISSUER_COMPANY_SEAL_REQUIRED_MESSAGE,
  ISSUER_COMPANY_SEAL_UPLOAD_LINK_LABEL,
  ISSUER_COMPANY_SEAL_VIEW_LINK_LABEL,
  ISSUER_SEAL_APPLIER_REQUIRED_MESSAGE,
  PROFILE_COMPANY_SEAL_HREF,
} from "@cashsouk/types";

export const ISSUER_DIRECTORS_REQUIRED_MESSAGE =
  "Select at least one director to represent the issuer company.";

export const GUARANTOR_PARTIES_REQUIRED_MESSAGE =
  "Complete authorised representatives for every guarantor.";

export const ISSUER_COMPANY_SEAL_STATUS_LOADING_MESSAGE = "Checking company seal…";

export const ISSUER_COMPANY_SEAL_STATUS_ERROR_MESSAGE =
  "Could not load company seal status. Refresh and try again.";

export type IssuerCompanySealUiStatus = "idle" | "loading" | "missing" | "uploaded" | "error";

export type IssuerOfferRepsBlocker = {
  message: string;
  pending?: boolean;
  href?: string;
  linkLabel?: string;
};

export function issuerOfferRepsBlocker(input: {
  directorsReady: boolean;
  guarantorsReady: boolean;
  requiresIssuerSeal: boolean;
  hasSealApplier: boolean;
  sealStatus: IssuerCompanySealUiStatus;
  canManageSeal: boolean;
}): IssuerOfferRepsBlocker | null {
  if (!input.directorsReady) {
    return { message: ISSUER_DIRECTORS_REQUIRED_MESSAGE };
  }
  if (!input.guarantorsReady) {
    return { message: GUARANTOR_PARTIES_REQUIRED_MESSAGE };
  }
  if (!input.requiresIssuerSeal) return null;
  if (!input.hasSealApplier) {
    return { message: ISSUER_SEAL_APPLIER_REQUIRED_MESSAGE };
  }
  if (input.sealStatus === "loading" || input.sealStatus === "idle") {
    return { message: ISSUER_COMPANY_SEAL_STATUS_LOADING_MESSAGE, pending: true };
  }
  if (input.sealStatus === "error") {
    return { message: ISSUER_COMPANY_SEAL_STATUS_ERROR_MESSAGE };
  }
  if (input.sealStatus === "missing") {
    return input.canManageSeal
      ? {
          message: ISSUER_COMPANY_SEAL_REQUIRED_MESSAGE,
          href: PROFILE_COMPANY_SEAL_HREF,
          linkLabel: ISSUER_COMPANY_SEAL_UPLOAD_LINK_LABEL,
        }
      : {
          message: ISSUER_COMPANY_SEAL_OWNER_ADMIN_REQUIRED_MESSAGE,
          href: PROFILE_COMPANY_SEAL_HREF,
          linkLabel: ISSUER_COMPANY_SEAL_VIEW_LINK_LABEL,
        };
  }
  return null;
}
