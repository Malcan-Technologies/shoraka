/**
 * Step 2 — Prepare WiseAI SDK session
 *
 * Uses the `url` and `token` from step 1 directly — no /sdk/token call.
 *
 * Run from apps/api:
 *   npx tsx _sandbox/ekyc-flow/02-initiate-session.ts
 */

// ============ CONFIG — fill in before running ============
const CONFIG = {
  /** WiseAI console URL — the `url` field from step 1 getToken. */
  wiseConsoleUrl: "https://wiseconsole-demo.wiseai.tech",

  /** Session token — the `token` field from step 1 getToken. Passed directly to the SDK. */
  sessionToken: "a503208a-8e34-428d-871a-7b795a062002",

  /** Document type for capture: "mykad" or "passport". */
  docType: "mykad",
};

function buildSdkSession() {
  const wiseConsoleUrl = CONFIG.wiseConsoleUrl.trim();
  const sessionToken = CONFIG.sessionToken.trim();
  const docType = CONFIG.docType.trim() || "mykad";

  if (!wiseConsoleUrl) {
    throw new Error("Set CONFIG.wiseConsoleUrl to the `url` from step 1.");
  }
  if (!sessionToken) {
    throw new Error("Set CONFIG.sessionToken to the `token` from step 1.");
  }

  const endpoint = wiseConsoleUrl.replace(/\/$/, "");
  const hostedUrl = `${endpoint}/?token=${encodeURIComponent(sessionToken)}`;

  return {
    endpoint,
    sessionToken,
    docType,
    hostedUrl,
    sdkInit: {
      token: sessionToken,
      endpoint,
      docType,
    },
  };
}

function main() {
  const session = buildSdkSession();

  console.log("WiseAI SDK session (use these values as-is):");
  console.log(JSON.stringify(session.sdkInit, null, 2));

  console.log("\nWAILib.SDK constructor args:");
  console.log(`  token:    ${session.sessionToken}`);
  console.log(`  endpoint: ${session.endpoint}`);
  console.log(`  docType:  ${session.docType}`);

  console.log("\nHosted test URL:");
  console.log(session.hostedUrl);

  console.log("\n--- Next step ---");
  console.log("1. Open the hosted URL or pass token + endpoint to WAILib.SDK");
  console.log("2. Complete capture and copy encryptedData into step 3 CONFIG.ekycResult");
  console.log("3. Use the same sessionToken in step 3 CONFIG.ekycToken");
}

main();
