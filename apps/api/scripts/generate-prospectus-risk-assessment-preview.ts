/**
 * Dev-only: write Risk Assessment plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:risk-assessment-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusRiskAssessmentDocument } from "../src/modules/notes/prospectus/render-prospectus-risk-assessment";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-risk-assessment-preview.html");
  writeFileSync(outPath, buildProspectusRiskAssessmentDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote Risk Assessment preview to ${outPath}`);
}

main();
