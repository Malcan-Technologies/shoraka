/**
 * Per-document signing completion: idempotent assignment SIGNED + application activity.
 */
import {
  formatSigningDocumentSignedDescription,
  isAutomaticSigningRecipient,
} from "@cashsouk/types";
import type { AuditRequestContext } from "../../lib/audit";
import { logApplicationActivity } from "../applications/logs/service";
import { ActivityPortal, ApplicationLogEventType } from "../applications/logs/types";
import type { SigningEnvelopeWithGraph } from "./mapper";
import type { SigningRepository } from "./repository";
import { signingProviderReferenceMetadata } from "./provider-reference-metadata";

export type SigningDocumentSignedParties = {
  envelope: SigningEnvelopeWithGraph;
  assignment: SigningEnvelopeWithGraph["assignments"][number];
  recipient: SigningEnvelopeWithGraph["recipients"][number];
  document: SigningEnvelopeWithGraph["documents"][number];
};

function optionalTrim(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function buildSigningDocumentSignedMetadata(
  input: SigningDocumentSignedParties
): Record<string, unknown> {
  const signerName = optionalTrim(input.recipient.name);
  const documentName = optionalTrim(input.document.name);
  const roleKey = optionalTrim(input.recipient.role_key);
  const roleLabel = optionalTrim(input.recipient.role_label);
  const automatic = isAutomaticSigningRecipient(input.recipient);
  const metadata: Record<string, unknown> = {
    envelope_id: input.envelope.id,
    assignment_id: input.assignment.id,
    document_id: input.document.id,
    recipient_id: input.recipient.id,
    execution_mode: automatic ? "AUTOMATIC" : "MANUAL",
    ...(documentName ? { document_name: documentName } : {}),
    ...(signerName ? { signer_name: signerName } : {}),
    ...(roleKey ? { role_key: roleKey } : {}),
    ...(roleLabel ? { role_label: roleLabel } : {}),
    ...(input.envelope.contract_id ? { contract_id: input.envelope.contract_id } : {}),
    ...(input.envelope.invoice_id ? { invoice_id: input.envelope.invoice_id } : {}),
    ...(optionalTrim(input.envelope.title) ? { envelope_title: optionalTrim(input.envelope.title) } : {}),
    ...signingProviderReferenceMetadata(input.envelope),
  };
  if (!automatic && signerName) {
    metadata.actorName = signerName;
  }
  return metadata;
}

export async function logSigningDocumentSignedActivity(input: {
  parties: SigningDocumentSignedParties;
  context?: AuditRequestContext | null;
}): Promise<void> {
  const metadata = buildSigningDocumentSignedMetadata(input.parties);
  const automatic = isAutomaticSigningRecipient(input.parties.recipient);
  await logApplicationActivity({
    userId: null,
    applicationId: input.parties.envelope.application_id,
    entityId: input.parties.envelope.id,
    portal: automatic ? null : ActivityPortal.ISSUER,
    eventType: ApplicationLogEventType.SIGNING_DOCUMENT_SIGNED,
    remark: formatSigningDocumentSignedDescription(metadata),
    metadata,
    context: input.context,
  });
}

export async function markAssignmentSignedAndLog(input: {
  repo: Pick<SigningRepository, "markAssignmentSigned">;
  parties: SigningDocumentSignedParties;
  context?: AuditRequestContext | null;
}): Promise<boolean> {
  const newlySigned = await input.repo.markAssignmentSigned(input.parties.assignment.id);
  if (newlySigned === false) return false;
  await logSigningDocumentSignedActivity({
    parties: input.parties,
    context: input.context,
  });
  return true;
}
