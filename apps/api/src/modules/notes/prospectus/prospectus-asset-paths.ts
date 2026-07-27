/**
 * SECTION: Resolve Prospectus SVG assets for HTML/PDF embedding
 * WHY: Production API image does not include apps/investor/public; ship copies under apps/api/assets
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

export type ProspectusAssetFileName =
  | "logo.svg"
  | "prospectus-shariah-badge.svg"
  | "prospectus-risk-shield.svg";

/**
 * Candidate absolute paths, preferred first:
 * 1) apps/api/assets/prospectus (API package — production Docker)
 * 2) apps/investor/public (local monorepo checkout)
 */
export function resolveProspectusAssetAbsolutePath(
  fileName: ProspectusAssetFileName
): string | null {
  const candidates = [
    // From dist/modules/notes/prospectus or src/modules/notes/prospectus → apps/api
    join(__dirname, "../../../../assets/prospectus", fileName),
    // From the same module depth to monorepo investor public
    join(__dirname, "../../../../../investor/public", fileName),
    // process.cwd() when API is started from apps/api or repo root
    join(process.cwd(), "assets/prospectus", fileName),
    join(process.cwd(), "apps/api/assets/prospectus", fileName),
    join(process.cwd(), "apps/investor/public", fileName),
  ];

  for (const absolute of candidates) {
    if (existsSync(absolute)) return absolute;
  }
  return null;
}
