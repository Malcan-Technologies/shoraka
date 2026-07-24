/**
 * SECTION: Build shared prospectus header view-model
 * WHY: Official logo asset; tagline/Shariah DNA — no product-name inference
 */

import {
  PROSPECTUS_BRAND_NAME,
  PROSPECTUS_DATA_NOT_AVAILABLE,
  PROSPECTUS_OFFICIAL_LOGO_PREVIEW_RELATIVE_SRC,
  PROSPECTUS_OFFICIAL_LOGO_REPO_PATH,
  type ProspectusHeader,
  type ProspectusHeaderInput,
} from "./prospectus-header.types";
import { PROSPECTUS_HEADER_TAGLINE } from "./prospectus-static-copy";

export function buildProspectusHeader(input: ProspectusHeaderInput = {}): ProspectusHeader {
  void input.productNameEndingInI;
  void input.tawarruqOrShorakaContext;
  void input.legacyCanvaTagline;

  return {
    brandName: PROSPECTUS_BRAND_NAME,
    logo: {
      kind: "official_asset",
      alt: PROSPECTUS_BRAND_NAME,
      previewSrc: PROSPECTUS_OFFICIAL_LOGO_PREVIEW_RELATIVE_SRC,
      repoPath: PROSPECTUS_OFFICIAL_LOGO_REPO_PATH,
    },
    tagline: PROSPECTUS_HEADER_TAGLINE,
    shariahStatusBadge: PROSPECTUS_DATA_NOT_AVAILABLE,
    audit: {
      brand: {
        logoSource: PROSPECTUS_OFFICIAL_LOGO_REPO_PATH,
        taglineSource: "repository_static_copy",
        taglineApproved: true,
      },
      shariahBadge: {
        status: "unresolved",
        noteLevelEvidenceAvailable: false,
        generatedClaimAllowed: false,
        productNameInferenceAllowed: false,
      },
    },
  };
}
