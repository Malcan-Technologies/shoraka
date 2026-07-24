/**
 * Dev-only: write Page 2 About the Issuer plain HTML preview.
 *
 * Usage (from apps/api):
 *   pnpm prospectus:issuer-profile-preview
 */

import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildProspectusIssuerProfileDocument } from "../src/modules/notes/prospectus/render-prospectus-issuer-profile";

function main() {
  const outDir = path.resolve(__dirname, "../tmp/prospectus");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "prospectus-issuer-profile-preview.html");
  writeFileSync(outPath, buildProspectusIssuerProfileDocument(), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote About the Issuer preview to ${outPath}`);
}

main();
