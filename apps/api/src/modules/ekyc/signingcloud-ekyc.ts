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
import {
  parseSigningCloudErrorText,
  signingCloudEkycPublicErrorCode,
  signingCloudEkycUserMessage,
} from "./signingcloud-user-messages";

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
    throw new AppError(
      503,
      signingCloudEkycPublicErrorCode("SIGNINGCLOUD_NOT_CONFIGURED"),
      signingCloudEkycUserMessage("SIGNINGCLOUD_NOT_CONFIGURED")
    );
  }

  return config;
}

export async function getSigningCloudEkycSession(
  email: string
): Promise<SigningCloudEkycSession> {
  const config = requireSigningCloudConfig();
  let accessToken: string;
  try {
    accessToken = await getSigningCloudAccessToken(config);
  } catch (error) {
    const technicalMessage =
      error instanceof Error ? error.message : "SigningCloud access token failed";
    const vendor = parseSigningCloudErrorText(technicalMessage);
    throw new AppError(
      502,
      signingCloudEkycPublicErrorCode("SIGNINGCLOUD_ACCESS_TOKEN_FAILED", vendor),
      signingCloudEkycUserMessage("SIGNINGCLOUD_ACCESS_TOKEN_FAILED", vendor),
      vendor
    );
  }
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
    const vendor = { result: body.result, message: body.message };
    throw new AppError(
      502,
      signingCloudEkycPublicErrorCode("SIGNINGCLOUD_EKYC_GET_TOKEN_FAILED", vendor),
      signingCloudEkycUserMessage("SIGNINGCLOUD_EKYC_GET_TOKEN_FAILED", vendor),
      vendor
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
    const vendor = {
      result: body.result,
      message: typeof body.message === "string" ? body.message : undefined,
    };
    throw new AppError(
      502,
      "SIGNINGCLOUD_EKYC_SUBMIT_FAILED",
      signingCloudEkycUserMessage("SIGNINGCLOUD_EKYC_SUBMIT_FAILED", vendor),
      vendor
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
