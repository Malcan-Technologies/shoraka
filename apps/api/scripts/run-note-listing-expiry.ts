#!/usr/bin/env tsx
/**
 * Run the note listing expiry job once. Use for testing or manual execution.
 *
 * Auto-closes notes whose `note_listings.closes_at` has passed: those meeting the
 * minimum funding threshold are funded; the rest fail and release commitments.
 * Requires DATABASE_URL.
 *
 * Usage: pnpm run-note-listing-expiry
 */

import "dotenv/config";
import { runNoteListingExpiryJob } from "../src/lib/jobs/note-listing-expiry";

async function main() {
  const result = await runNoteListingExpiryJob();

  console.log("\nNote listing expiry job result:");
  console.log("  Notes auto-funded:", result.notesAutoFunded.length, result.notesAutoFunded);
  console.log("  Notes auto-failed:", result.notesAutoFailed.length, result.notesAutoFailed);
  console.log("  Errors:", result.errors.length, result.errors);
  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/prisma");
    await prisma.$disconnect();
  });
