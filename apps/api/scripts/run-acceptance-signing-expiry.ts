#!/usr/bin/env tsx
/**
 * Manually run the acceptance/signing phase deadline job once (reminders + durable OFFER_EXPIRED).
 * Usage: pnpm run-acceptance-signing-expiry
 */

import "dotenv/config";
import { runAcceptanceSigningExpiryJob } from "../src/lib/jobs/acceptance-signing-expiry";

async function main() {
  const result = await runAcceptanceSigningExpiryJob();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
