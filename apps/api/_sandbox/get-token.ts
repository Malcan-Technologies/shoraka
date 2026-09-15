/**
 * SigningCloud Get Token — acquire eKYC verification token.
 *
 * Based on: https://docs.signingcloud.com/s/api-integration/doc/get-token-tyDZu02F8D
 *
 * Run from apps/api:
 *   npx tsx _sandbox/get-token.ts
 */

import { getSigningCloudEkycSession } from "./ekyc-signingcloud";

const signerEmail = process.env.SC_SIGNER_EMAIL ?? "khai.kit@malcan.io";

async function main() {
  const session = await getSigningCloudEkycSession(signerEmail);
  console.log(JSON.stringify(session, null, 2));
  console.log("\nHosted test URL:");
  console.log(`${session.url.replace(/\/$/, "")}/?token=${session.token}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
