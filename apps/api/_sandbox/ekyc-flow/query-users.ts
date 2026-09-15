#!/usr/bin/env tsx
/**
 * PROTOTYPE — SigningCloud POST /signserver/v1/account/queryusers
 * Edit QUERY_PARAMS below, then: pnpm --filter api sandbox:ekyc-query-users
 */

import "dotenv/config";
import { postSigningCloudEncrypted } from "./lib/signingcloud-request";

/** Edit these before each run. */
const QUERY_PARAMS = {
  email: "khai.kit@truestack.my",
  name: undefined as string | undefined,
  /** -1 = document signer (default), 0 = creator, 1 = admin */
  roletype: undefined as string | undefined,
  ekycverified: undefined as boolean | undefined,
};

function buildQueryPayload(): Record<string, unknown> {
  const q: Record<string, unknown> = { email: QUERY_PARAMS.email };

  if (QUERY_PARAMS.name) {
    q.name = QUERY_PARAMS.name;
  }

  if (QUERY_PARAMS.roletype !== undefined) {
    q.roletype = QUERY_PARAMS.roletype;
  }

  if (QUERY_PARAMS.ekycverified !== undefined) {
    q.ekycverified = QUERY_PARAMS.ekycverified;
  }

  return { q: JSON.stringify(q) };
}

async function main(): Promise<void> {
  const rawPayload = buildQueryPayload();

  console.log("Query users for:", QUERY_PARAMS.email);

  const result = await postSigningCloudEncrypted(
    "/signserver/v1/account/queryusers",
    rawPayload,
    { label: "queryusers" }
  );

  console.log("\nDone. Inspect decrypted response above for ekycverified / user records.");
  if (result && typeof result === "object") {
    const rows = (result as Record<string, unknown>).users;
    if (Array.isArray(rows)) {
      console.log(`Matched ${rows.length} user(s).`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
