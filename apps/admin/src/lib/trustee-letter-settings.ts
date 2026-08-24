import type { TrusteeLetterConfig } from "@cashsouk/types";

const TRUSTEE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidTrusteeEmail(value: string): boolean {
  return TRUSTEE_EMAIL_PATTERN.test(value.trim());
}

export function normalizeTrusteeCcEmails(
  emails: string[] | undefined,
  excludeEmail?: string
): string[] {
  if (!emails) return [];
  const exclude = excludeEmail?.trim().toLowerCase();
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of emails) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (exclude && key === exclude) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function splitTrusteeCcDraft(value: string): string[] {
  return value
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export type TrusteeLetterEmailValidation = {
  trusteeEmailError: string | null;
  trusteeCcError: string | null;
  canSave: boolean;
};

export function validateTrusteeLetterEmailSettings(input: {
  autoSendTrusteeEmail: boolean;
  trusteeEmail?: string;
  trusteeCcEmails?: string[];
  ccDraft?: string;
}): TrusteeLetterEmailValidation {
  const trusteeEmail = input.trusteeEmail?.trim() ?? "";
  let trusteeEmailError: string | null = null;
  if (input.autoSendTrusteeEmail && trusteeEmail.length === 0) {
    trusteeEmailError = "Trustee email is required when automatic email is enabled.";
  } else if (trusteeEmail.length > 0 && !isValidTrusteeEmail(trusteeEmail)) {
    trusteeEmailError = "Enter a valid trustee email.";
  }

  const draftParts = splitTrusteeCcDraft(input.ccDraft ?? "");
  const ccEmails = [...(input.trusteeCcEmails ?? []), ...draftParts];
  const invalidCc = ccEmails.find((email) => !isValidTrusteeEmail(email));
  const trusteeCcError = invalidCc ? "Each CC address must be a valid email." : null;

  return {
    trusteeEmailError,
    trusteeCcError,
    canSave: trusteeEmailError == null && trusteeCcError == null,
  };
}

export function buildTrusteeLetterConfigPayload(
  config: TrusteeLetterConfig,
  ccDraft?: string
): TrusteeLetterConfig {
  const trusteeEmail = config.trusteeEmail?.trim() || undefined;
  const trusteeCcEmails = normalizeTrusteeCcEmails(
    [...(config.trusteeCcEmails ?? []), ...splitTrusteeCcDraft(ccDraft ?? "")],
    trusteeEmail
  );
  return {
    ...config,
    autoSendTrusteeEmail: config.autoSendTrusteeEmail === true,
    trusteeEmail,
    trusteeCcEmails: trusteeCcEmails.length > 0 ? trusteeCcEmails : undefined,
  };
}
