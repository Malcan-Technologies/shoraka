/**
 * SECTION: Shared prospectus header (Page 2 Stage 8; reusable across pages)
 * WHY: Official brand mark only; tagline/Shariah badge DNA until approved
 */

import { PROSPECTUS_DATA_NOT_AVAILABLE } from "./prospectus-note-identity.types";

export { PROSPECTUS_DATA_NOT_AVAILABLE };

export const PROSPECTUS_BRAND_NAME = "CashSouk";

/**
 * Official CashSouk logo used by investor/issuer/landing/admin portals
 * and packages/ui Logo (src="/logo.svg").
 */
export const PROSPECTUS_OFFICIAL_LOGO_REPO_PATH = "apps/investor/public/logo.svg";

/**
 * Relative img src from apps/api/tmp/prospectus/*.html preview files.
 * Not shown as visible text — attribute only.
 */
export const PROSPECTUS_OFFICIAL_LOGO_PREVIEW_RELATIVE_SRC =
  "../../../investor/public/logo.svg";

export type ProspectusHeaderLogo =
  | {
      kind: "official_asset";
      alt: string;
      /** Preview/relative src for standalone HTML only — not Canva-facing text. */
      previewSrc: string;
      repoPath: string;
    }
  | {
      kind: "text_fallback";
      alt: string;
      text: string;
    };

export interface ProspectusHeaderAudit {
  brand: {
    logoSource: string;
    taglineSource: "repository_static_copy" | "unavailable";
    taglineApproved: boolean;
  };
  shariahBadge: {
    status: "unresolved";
    noteLevelEvidenceAvailable: false;
    generatedClaimAllowed: false;
    productNameInferenceAllowed: false;
  };
}

export interface ProspectusHeader {
  brandName: string;
  logo: ProspectusHeaderLogo;
  tagline: string;
  shariahStatusBadge: string;
  audit: ProspectusHeaderAudit;
}

export interface ProspectusHeaderInput {
  /** Observational only — must not create a Shariah badge. */
  productNameEndingInI?: string | null;
  tawarruqOrShorakaContext?: unknown;
  /** Observational Canva/legacy tagline — must not auto-approve. */
  legacyCanvaTagline?: string | null;
}
