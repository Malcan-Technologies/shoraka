import { AppError } from "../../lib/http/error-handler";
import {
  encryptPayload,
  decryptSigningCloudResponse,
  assertSigningCloudSuccess,
  type SigningCloudEncryptedResponse,
} from "../../lib/signingcloud/crypto";
import {
  getSigningCloudAccessToken,
  readSigningCloudConfigFromEnv,
} from "../signingcloud/signingcloud-api";

export interface SigningCloudEkycSession {
  url: string;
  token: string;
}

export interface SubmitSigningCloudEkycResultInput {
  email: string;
  ekycResult: string;
  name: string;
  icNumber: string;
  country: string;
  ekycDocType: string;
  token: string;
}

function requireSigningCloudConfig() {
  const config = readSigningCloudConfigFromEnv();
  if (!config) {
    throw new AppError(503, "SIGNINGCLOUD_NOT_CONFIGURED", "SigningCloud is not configured");
  }

  return config;
}

export async function getSigningCloudEkycSession(
  email: string
): Promise<SigningCloudEkycSession> {
  const config = requireSigningCloudConfig();
  const accessToken = await getSigningCloudAccessToken(config);
  const { data, mac } = encryptPayload(JSON.stringify({ email }), config.apiSecret);
  const query = new URLSearchParams({
    accesstoken: accessToken,
    data,
    mac,
  });

  const response = await fetch(
    `${config.baseUrl}/signserver/v1/user/ekyc/getToken?${query.toString()}`,
    { method: "GET" }
  );
  const body = (await response.json()) as {
    result: number;
    message?: string;
    url?: string;
    token?: string;
  };

  if (body.result !== 0 || !body.url || !body.token) {
    throw new AppError(
      502,
      "SIGNINGCLOUD_EKYC_GET_TOKEN_FAILED",
      `SigningCloud getToken failed: ${body.message ?? JSON.stringify(body)}`
    );
  }

  return {
    url: body.url,
    token: body.token,
  };
}

export async function submitSigningCloudEkycResult(
  input: SubmitSigningCloudEkycResultInput
): Promise<unknown> {
  const config = requireSigningCloudConfig();
  const accessToken = await getSigningCloudAccessToken(config);
  const rawPayload = {
    ekycResult: input.ekycResult,
    email: input.email,
    name: input.name,
    icNumber: input.icNumber,
    country: input.country,
    ekycDocType: input.ekycDocType,
    token: input.token,
  };
  const { data, mac } = encryptPayload(JSON.stringify(rawPayload), config.apiSecret);
  const formBody = new URLSearchParams({
    accesstoken: accessToken,
    data,
    mac,
  });

  const response = await fetch(`${config.baseUrl}/signserver/v1/user/ekyc/submitResult`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formBody.toString(),
  });

  const body = (await response.json()) as
    | (SigningCloudEncryptedResponse & Record<string, unknown>)
    | Record<string, unknown>;

  if ("result" in body && typeof body.result === "number" && body.result !== 0) {
    throw new AppError(
      502,
      "SIGNINGCLOUD_EKYC_SUBMIT_FAILED",
      `SigningCloud submitResult failed: ${JSON.stringify(body)}`
    );
  }

  if (
    "data" in body &&
    "mac" in body &&
    typeof body.data === "string" &&
    typeof body.mac === "string" &&
    "result" in body &&
    typeof body.result === "number" &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    const encryptedBody = body as SigningCloudEncryptedResponse;
    assertSigningCloudSuccess(encryptedBody);
    return decryptSigningCloudResponse(encryptedBody, config.apiSecret);
  }

  return body;
}
