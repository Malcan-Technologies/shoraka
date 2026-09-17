import type { ProfileFieldSources } from "@cashsouk/types";
import type { PortalType } from "@cashsouk/types";

export function isIdentityNumberEditable(params: {
  portal: PortalType;
  documentNumber: string | null;
  profileFieldSources?: ProfileFieldSources;
}): boolean {
  // This rule only applies to the Admin "Personal Investor" profile editor.
  if (params.portal !== "investor") return false;

  const missing = params.documentNumber === null || params.documentNumber === undefined || params.documentNumber.trim().length === 0;
  const source = params.profileFieldSources?.identityNumber?.source;

  // Expected behaviour:
  // - Missing identity number is always editable.
  // - Non-missing identity number is editable unless it came from RegTank.
  return missing || source !== "REGTANK";
}

