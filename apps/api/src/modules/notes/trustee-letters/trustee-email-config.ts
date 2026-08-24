import { z } from "zod";
import type { TrusteeLetterConfig } from "@cashsouk/types";
import { AppError } from "../../../lib/http/error-handler";

export const trusteeEmailAddressSchema = z.string().trim().email();

export const optionalTrusteeEmailSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  return value.trim() === "" ? undefined : value;
}, trusteeEmailAddressSchema.optional());

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

export const trusteeCcEmailsSchema = z.preprocess((value) => {
  if (value == null) return undefined;
  if (!Array.isArray(value)) return value;
  return normalizeTrusteeCcEmails(value.map((item) => (typeof item === "string" ? item : String(item))));
}, z.array(trusteeEmailAddressSchema).optional());

export function isTrusteeAutoSendEnabled(config: TrusteeLetterConfig | null | undefined): boolean {
  return config?.autoSendTrusteeEmail === true;
}

export function assertTrusteeAutoSendRecipients(config: TrusteeLetterConfig | null | undefined): {
  to: string;
  cc: string[];
} {
  const parsed = trusteeEmailAddressSchema.safeParse(config?.trusteeEmail);
  if (!parsed.success) {
    throw new AppError(
      409,
      "TRUSTEE_EMAIL_NOT_CONFIGURED",
      "A valid trustee email must be configured before auto-sending the instruction."
    );
  }

  const cc: string[] = [];
  for (const raw of normalizeTrusteeCcEmails(config?.trusteeCcEmails, parsed.data)) {
    const parsedCc = trusteeEmailAddressSchema.safeParse(raw);
    if (!parsedCc.success) {
      throw new AppError(
        409,
        "TRUSTEE_CC_EMAIL_INVALID",
        "Each trustee CC email must be a valid address before auto-sending the instruction."
      );
    }
    cc.push(parsedCc.data);
  }

  return { to: parsed.data, cc };
}
