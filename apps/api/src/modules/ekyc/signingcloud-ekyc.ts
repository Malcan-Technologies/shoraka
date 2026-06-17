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
  type SigningCloudEnvConfig,
} from "../signingcloud/signingcloud-api";
import {
  parseSigningCloudErrorText,
  signingCloudEkycPublicErrorCode,
  signingCloudEkycUserMessage,
} from "./signingcloud-user-messages";

/** SigningCloud roletype for document signers (see addusers API). */
const SIGNINGCLOUD_DOCUMENT_SIGNER_ROLE = "-1";

export interface SigningCloudEkycSession {
  url: string;
  token: string;
}

export interface SubmitSigningCloudEkycResultInput {
  email: string;
  ekycResult: string;
  name: string;
  icNumber: string;
  token: string;
}

export interface SigningCloudEkycSubmitResult {
  userVerificationSuccess: boolean;
  ekycData: unknown;
  message?: string;
  raw: unknown;
}

export function parseSigningCloudSubmitResultBody(body: unknown): SigningCloudEkycSubmitResult {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  return {
    userVerificationSuccess: record.userVerificationSuccess === true,
    ekycData: record.ekycData ?? null,
    message: typeof record.message === "string" ? record.message : undefined,
    raw: body,
  };
}

function requireSigningCloudConfig(): SigningCloudEnvConfig {
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

function deriveSignerDisplayName(email: string): string {
  const localPart = email.split("@")[0]?.trim() ?? "";
  const normalized = localPart.replace(/[._+-]/g, " ").trim().toUpperCase();
  return (normalized || email.trim()).slice(0, 64);
}

/** True when queryusers returns a document signer for the given email. */
export function signingCloudQueryUsersHasSigner(decrypted: unknown, email: string): boolean {
  if (!decrypted || typeof decrypted !== "object") {
    return false;
  }

  const users = (decrypted as Record<string, unknown>).users;
  if (!users || typeof users !== "object" || Array.isArray(users)) {
    return false;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const userMap = users as Record<string, unknown>;

  for (const [key, value] of Object.entries(userMap)) {
    if (key.trim().toLowerCase() === normalizedEmail) {
      return true;
    }

    if (value && typeof value === "object") {
      const userEmail = (value as Record<string, unknown>).email;
      if (typeof userEmail === "string" && userEmail.trim().toLowerCase() === normalizedEmail) {
        return true;
      }
    }
  }

  return false;
}

async function postSigningCloudAccountRequest(
  config: SigningCloudEnvConfig,
  accessToken: string,
  path: string,
  rawPayload: Record<string, unknown>
): Promise<{
  result: number;
  message?: string;
  decrypted: unknown;
  raw: Record<string, unknown>;
}> {
  const { data, mac } = encryptPayload(JSON.stringify(rawPayload), config.apiSecret);
  const formBody = new URLSearchParams({
    accesstoken: accessToken,
    data,
    mac,
  });

  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody.toString(),
  });

  const body = (await response.json()) as SigningCloudEncryptedResponse & Record<string, unknown>;

  if (
    body.result === 0 &&
    typeof body.data === "string" &&
    typeof body.mac === "string"
  ) {
    assertSigningCloudSuccess(body);
    return {
      result: body.result,
      message: body.message,
      decrypted: decryptSigningCloudResponse(body, config.apiSecret),
      raw: body,
    };
  }

  return {
    result: typeof body.result === "number" ? body.result : -1,
    message: typeof body.message === "string" ? body.message : undefined,
    decrypted: body,
    raw: body,
  };
}

async function querySigningCloudDocumentSignerExists(
  email: string,
  accessToken: string,
  config: SigningCloudEnvConfig
): Promise<boolean> {
  const response = await postSigningCloudAccountRequest(
    config,
    accessToken,
    "/signserver/v1/account/queryusers",
    {
      q: JSON.stringify({
        email,
        roletype: SIGNINGCLOUD_DOCUMENT_SIGNER_ROLE,
      }),
    }
  );

  if (response.result !== 0) {
    const vendor = { result: response.result, message: response.message };
    throw new AppError(
      502,
      signingCloudEkycPublicErrorCode("SIGNINGCLOUD_QUERY_USER_FAILED", vendor),
      signingCloudEkycUserMessage("SIGNINGCLOUD_QUERY_USER_FAILED", vendor),
      vendor
    );
  }

  return signingCloudQueryUsersHasSigner(response.decrypted, email);
}

/** Register the signer on SigningCloud before eKYC getToken (idempotent). */
async function ensureSigningCloudDocumentSigner(
  email: string,
  accessToken: string,
  config: SigningCloudEnvConfig
): Promise<void> {
  const signerExists = await querySigningCloudDocumentSignerExists(email, accessToken, config);
  if (signerExists) {
    return;
  }

  const response = await postSigningCloudAccountRequest(
    config,
    accessToken,
    "/signserver/v1/account/addusers",
    {
      users: [
        {
          email,
          name: deriveSignerDisplayName(email),
          roletype: SIGNINGCLOUD_DOCUMENT_SIGNER_ROLE,
        },
      ],
    }
  );

  if (response.result === 0) {
    return;
  }

  const vendor = { result: response.result, message: response.message };
  throw new AppError(
    502,
    signingCloudEkycPublicErrorCode("SIGNINGCLOUD_ADD_USER_FAILED", vendor),
    signingCloudEkycUserMessage("SIGNINGCLOUD_ADD_USER_FAILED", vendor),
    vendor
  );
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

  await ensureSigningCloudDocumentSigner(email, accessToken, config);

  const plainPayload = { email };
  const { data, mac } = encryptPayload(JSON.stringify(plainPayload), config.apiSecret);

  const query = new URLSearchParams({
    accesstoken: accessToken,
    data,
    mac,
  });

  const response = await fetch(
    `${config.baseUrl}/signserver/v1/user/ekyc/getToken?${query.toString()}`,
    { method: "GET" }
  );
  const body = (await response.json()) as
    | (SigningCloudEncryptedResponse & { url?: string; token?: string })
    | {
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
): Promise<SigningCloudEkycSubmitResult> {
  const config = requireSigningCloudConfig();
  const accessToken = await getSigningCloudAccessToken(config);
  const rawPayload = {
    ekycResult: input.ekycResult,
    email: input.email,
    name: input.name,
    icNumber: input.icNumber,
    country: "MYS",
    ekycDocType: "mykad",
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
    const decrypted = decryptSigningCloudResponse(encryptedBody, config.apiSecret);
    return parseSigningCloudSubmitResultBody(decrypted);
  }

  return parseSigningCloudSubmitResultBody(body);
}
