import {
  decryptSigningCloudResponse,
  encryptPayload,
  assertSigningCloudSuccess,
  type SigningCloudEncryptedResponse,
} from "../../../src/lib/signingcloud/crypto";
import {
  getSigningCloudAccessToken,
  readSigningCloudConfigFromEnv,
  type SigningCloudEnvConfig,
} from "../../../src/modules/signingcloud/signingcloud-api";

export function requireSigningCloudConfig(): SigningCloudEnvConfig {
  const config = readSigningCloudConfigFromEnv();
  if (!config) {
    throw new Error(
      "Missing SigningCloud env. Set SC_BASE_URL, SC_API_KEY, and SC_API_SECRET in apps/api/.env"
    );
  }

  return config;
}

export async function postSigningCloudEncrypted(
  path: string,
  rawPayload: Record<string, unknown>,
  options?: { label?: string }
): Promise<unknown> {
  const config = requireSigningCloudConfig();
  const label = options?.label ?? path;
  const accessToken = await getSigningCloudAccessToken(config);

  console.log(`\n=== ${label} — request plain ===`);
  console.log(JSON.stringify(rawPayload, null, 2));

  const { data, mac } = encryptPayload(JSON.stringify(rawPayload), config.apiSecret);

  console.log(`\n=== ${label} — request encrypted ===`);
  console.log(
    JSON.stringify(
      {
        dataLength: data.length,
        macLength: mac.length,
        dataPreview: data.slice(0, 120) + (data.length > 120 ? "…" : ""),
        macPreview: mac.slice(0, 64) + (mac.length > 64 ? "…" : ""),
      },
      null,
      2
    )
  );

  const formBody = new URLSearchParams({
    accesstoken: accessToken,
    data,
    mac,
  });

  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody.toString(),
  });

  const body = (await response.json()) as
    | SigningCloudEncryptedResponse
    | Record<string, unknown>;

  console.log(`\n=== ${label} — response raw ===`);
  console.log(JSON.stringify(body, null, 2));

  if (
    "data" in body &&
    "mac" in body &&
    typeof body.data === "string" &&
    typeof body.mac === "string" &&
    "result" in body &&
    typeof body.result === "number"
  ) {
    if (body.result !== 0) {
      throw new Error(
        `SigningCloud ${label} failed: ${body.message ?? "unknown"} (result=${body.result})`
      );
    }

    assertSigningCloudSuccess(body as SigningCloudEncryptedResponse);
    const decrypted = decryptSigningCloudResponse(
      body as SigningCloudEncryptedResponse,
      config.apiSecret
    );

    console.log(`\n=== ${label} — response decrypted ===`);
    console.log(JSON.stringify(decrypted, null, 2));
    return decrypted;
  }

  if ("result" in body && typeof body.result === "number" && body.result !== 0) {
    throw new Error(
      `SigningCloud ${label} failed: ${String(body.message ?? "unknown")} (result=${body.result})`
    );
  }

  console.log(`\n=== ${label} — response (no encrypted envelope) ===`);
  return body;
}
