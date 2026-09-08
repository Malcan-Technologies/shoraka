import { AppError } from "../../lib/http/error-handler";

export const CTOS_MISSING_SUBJECT_IDENTIFIER = "CTOS_MISSING_SUBJECT_IDENTIFIER";
export const CTOS_INVALID_SUBJECT_IDENTIFIER = "CTOS_INVALID_SUBJECT_IDENTIFIER";
export const CTOS_NO_MATCH = "CTOS_NO_MATCH";
export const CTOS_RATE_LIMITED = "CTOS_RATE_LIMITED";
export const CTOS_TIMEOUT = "CTOS_TIMEOUT";
export const CTOS_AUTH_ERROR = "CTOS_AUTH_ERROR";
export const CTOS_PROVIDER_ERROR = "CTOS_PROVIDER_ERROR";
export const CTOS_PARSE_ERROR = "CTOS_PARSE_ERROR";
export const CTOS_INTERNAL_ERROR = "CTOS_INTERNAL_ERROR";

export const CTOS_MISSING_SSM_MESSAGE =
  "CTOS cannot be fetched because the company registration/SSM number is not available yet.";
export const CTOS_MISSING_SSM_REGTANK_HINT =
  "Refresh the RegTank/company onboarding status first, then try CTOS again.";
export const CTOS_MISSING_IC_MESSAGE =
  "CTOS cannot be fetched because the identity document number is missing.";
export const CTOS_INVALID_SSM_MESSAGE =
  "CTOS could not use the company registration/SSM number. Please verify the company details.";
export const CTOS_NO_MATCH_MESSAGE =
  "CTOS did not return a matching company record for this registration number.";
export const CTOS_TIMEOUT_MESSAGE = "CTOS is temporarily unavailable. Please try again later.";
export const CTOS_AUTH_MESSAGE =
  "CTOS service is unavailable due to a configuration issue. Please contact support.";
export const CTOS_PROVIDER_MESSAGE = "CTOS is temporarily unavailable. Please try again later.";
export const CTOS_PARSE_MESSAGE =
  "CTOS returned an unexpected response. Please retry or contact support if the issue continues.";
export const CTOS_INTERNAL_MESSAGE = "CTOS fetch failed. Please retry or contact support if it continues.";

export function missingCompanyRegistrationError(includeRegtankHint: boolean): AppError {
  const message = includeRegtankHint
    ? `${CTOS_MISSING_SSM_MESSAGE} ${CTOS_MISSING_SSM_REGTANK_HINT}`
    : CTOS_MISSING_SSM_MESSAGE;
  return new AppError(400, CTOS_MISSING_SUBJECT_IDENTIFIER, message);
}

export function missingIndividualIdentifierError(): AppError {
  return new AppError(400, CTOS_MISSING_SUBJECT_IDENTIFIER, CTOS_MISSING_IC_MESSAGE);
}

export function classifyCtosCaughtError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const err = error as {
    message?: string;
    name?: string;
    code?: string;
    cause?: { code?: string; name?: string };
    httpStatus?: number;
  };
  const message = String(err?.message ?? error ?? "");
  const name = String(err?.name ?? "");
  const code = String(err?.code ?? err?.cause?.code ?? "");
  const causeName = String(err?.cause?.name ?? "");
  const httpStatus = typeof err?.httpStatus === "number" ? err.httpStatus : null;

  if (httpStatus === 429 || /429|too many requests/i.test(message)) {
    return new AppError(429, CTOS_RATE_LIMITED, CTOS_TIMEOUT_MESSAGE);
  }
  if (
    name === "TimeoutError" ||
    name === "AbortError" ||
    causeName === "TimeoutError" ||
    causeName === "AbortError" ||
    code === "ETIMEDOUT" ||
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    /timeout|timed out/i.test(message)
  ) {
    return new AppError(504, CTOS_TIMEOUT, CTOS_TIMEOUT_MESSAGE);
  }
  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    /authentication failed|missing access_token|unauthorized/i.test(message)
  ) {
    return new AppError(503, CTOS_AUTH_ERROR, CTOS_AUTH_MESSAGE);
  }
  if (/invalid ctos soap|no return payload|failed to parse|unexpected token/i.test(message)) {
    return new AppError(502, CTOS_PARSE_ERROR, CTOS_PARSE_MESSAGE);
  }
  if (/soap request failed|ctos soap/i.test(message) || (httpStatus != null && httpStatus >= 500)) {
    return new AppError(502, CTOS_PROVIDER_ERROR, CTOS_PROVIDER_MESSAGE);
  }
  if (/missing registration number|missing document number|subject id number is required/i.test(message)) {
    if (/document number/i.test(message)) return missingIndividualIdentifierError();
    return missingCompanyRegistrationError(false);
  }
  if (/missing name|id number is required|display name is required/i.test(message)) {
    return new AppError(400, CTOS_INVALID_SUBJECT_IDENTIFIER, CTOS_INVALID_SSM_MESSAGE);
  }

  return new AppError(500, CTOS_INTERNAL_ERROR, CTOS_INTERNAL_MESSAGE);
}
