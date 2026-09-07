/** Strip `responsiblePersonPhone: ` / `address.postalCode: ` prefixes from API toasts. */
const FIELD_PATH_PREFIX = /^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*:\s+/;

const TECHNICAL_ENUM = /^Invalid enum value/i;
const TECHNICAL_LITERAL = /^Invalid literal/i;
const TECHNICAL_EMAIL = /^Invalid email/i;
const TECHNICAL_PHONE = /^Invalid phone number format$/i;

export function stripApiFieldPathPrefix(message: string): string {
  return message.replace(FIELD_PATH_PREFIX, "");
}

export function humanizeApiValidationMessage(message: string): string {
  const stripped = stripApiFieldPathPrefix(message.trim());
  if (!stripped) return "Please check the highlighted fields.";
  if (TECHNICAL_ENUM.test(stripped) || TECHNICAL_LITERAL.test(stripped)) {
    return "Select a valid option.";
  }
  if (TECHNICAL_EMAIL.test(stripped)) return "Enter a valid e-mail address.";
  if (TECHNICAL_PHONE.test(stripped)) return "Enter a valid phone number.";
  return stripped;
}

export function fieldErrorsFromApiDetails(details: unknown): Record<string, string> {
  if (!Array.isArray(details)) return {};
  const map: Record<string, string> = {};
  for (const issue of details) {
    if (!issue || typeof issue !== "object") continue;
    const record = issue as { path?: unknown; message?: unknown };
    if (!Array.isArray(record.path) || typeof record.message !== "string") continue;
    const path = record.path
      .filter((part): part is string | number => typeof part === "string" || typeof part === "number")
      .join(".");
    const message = humanizeApiValidationMessage(record.message);
    if (!path || !message || map[path]) continue;
    map[path] = message;
  }
  return map;
}

export class ProfileValidationError extends Error {
  fieldErrors: Record<string, string>;

  constructor(message: string, fieldErrors: Record<string, string> = {}) {
    super(humanizeApiValidationMessage(message));
    this.name = "ProfileValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export function profileValidationErrorFromApi(error: {
  message: string;
  details?: unknown;
}): ProfileValidationError {
  return new ProfileValidationError(error.message, fieldErrorsFromApiDetails(error.details));
}

export function isProfileValidationError(error: unknown): error is ProfileValidationError {
  return error instanceof ProfileValidationError;
}
