import {
  getIssuerAuthorizedParty,
  normalizeSigningEmail,
  type AuthorizedPartiesSnapshot,
} from "@cashsouk/types";
import type { LayoutDetectedSigner } from "./signature-field-geometry";

export function layoutSignersFromNamedRecipients(
  recipients: Array<{ name: string; email: string }>,
  snapshot: AuthorizedPartiesSnapshot | null | undefined
): LayoutDetectedSigner[] {
  const issuer = getIssuerAuthorizedParty(snapshot);
  const sealEmails = new Set(
    (issuer?.representatives ?? [])
      .filter((representative) => representative.applies_company_seal === true)
      .map((representative) => normalizeSigningEmail(representative.email))
  );
  return recipients.map((recipient) => ({
    name: recipient.name,
    appliesCompanySeal: sealEmails.has(normalizeSigningEmail(recipient.email)),
  }));
}
