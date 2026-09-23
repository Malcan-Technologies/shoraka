/**
 * Resume CashSouk `/signature/auto` for wrap-smoke contracts after the issuer
 * has signed the hosted CA fields (including the FA/DoA company seal).
 *
 * Reads `apps/api/tmp/signingcloud-wrap-smoke/layout.json` from a wrap-smoke
 * upload that stamped automatic keywords (`SIGNINGCLOUD_SMOKE_AUTO_EMAIL` +
 * `SIGNINGCLOUD_SMOKE_AUTO_EMAIL_2` on that run). Existing CA-only wrap-smoke
 * contracts cannot be auto-signed — re-upload first. The company-seal stamp is
 * uploaded during wrap-smoke, not here.
 *
 * Required:
 *   SC_BASE_URL, SC_API_KEY, SC_API_SECRET
 *
 * Optional:
 *   SIGNINGCLOUD_SMOKE_POLL_MS        default 15000
 *   SIGNINGCLOUD_SMOKE_POLL_ATTEMPTS  default 20
 *
 * Writes signed PDFs next to the wrap-smoke sessions file (gitignored).
 */
import { config as loadEnv } from "dotenv";
import * as path from "path";
import { SigningCloudProvider } from "../src/modules/signing/provider/signingcloud-adapter";
import { readSigningCloudConfigFromEnv } from "../src/modules/signingcloud/signingcloud-api";
import {
  completeAfterManuals,
  readSavedAutomaticDocs,
} from "./lib/signingcloud-smoke-auto-sign";

loadEnv({ path: path.join(__dirname, "../.env.local") });
loadEnv({ path: path.join(__dirname, "../.env") });

function captureDir(): string {
  return path.join(__dirname, "../tmp/signingcloud-wrap-smoke");
}

function readSavedWrapDocs(outDir: string): ReturnType<typeof readSavedAutomaticDocs> {
  return readSavedAutomaticDocs(
    path.join(outDir, "layout.json"),
    "No saved wrap-smoke layout. Run signingcloud:generated-docs-wrap-smoke with SIGNINGCLOUD_SMOKE_AUTO_EMAIL and SIGNINGCLOUD_SMOKE_AUTO_EMAIL_2 first."
  );
}

async function main(): Promise<void> {
  if (!readSigningCloudConfigFromEnv()) {
    throw new Error("SigningCloud is not configured (SC_BASE_URL, SC_API_KEY, SC_API_SECRET)");
  }
  const outDir = captureDir();
  const saved = readSavedWrapDocs(outDir);
  await completeAfterManuals(new SigningCloudProvider(), saved, outDir, "wrap");
  console.log("Wrap-smoke auto-sign complete for FA, JSG, and DOA.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
