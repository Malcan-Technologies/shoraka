/**
 * Map the Prisma signing envelope graph to the shared API DTO.
 */
import type {
  SigningEnvelope,
  SigningDocument,
  SigningRecipient,
  SigningAssignment,
} from "@prisma/client";
import type {
  SigningEnvelopeDto,
  SigningDocumentDto,
  SigningRecipientDto,
  SigningAssignmentDto,
  SigningKycStatus,
} from "@cashsouk/types";
import { resolveSigningKycStatusMap } from "../ekyc/service";
import { legalExternalAcceptanceService } from "../legal-documents/external-acceptance-service";

export type SigningEnvelopeWithGraph = SigningEnvelope & {
  documents: SigningDocument[];
  recipients: SigningRecipient[];
  assignments: SigningAssignment[];
};

function readSupportingDocStepKey(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>).supporting_doc_step_key;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mapDocument(doc: SigningDocument): SigningDocumentDto {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description ?? null,
    source: doc.source,
    order: doc.order,
    required: doc.required,
    status: doc.status,
    has_signed_pdf: Boolean(doc.signed_s3_key?.trim()),
    supporting_doc_step_key: readSupportingDocStepKey(doc.metadata),
  };
}

function readEmailDeliveryStatus(metadata: unknown): "sent" | "failed" | null {
  if (!metadata || typeof metadata !== "object") return null;
  const delivery = (metadata as Record<string, unknown>).email_delivery;
  if (!delivery || typeof delivery !== "object") return null;
  const status = (delivery as Record<string, unknown>).status;
  return status === "sent" || status === "failed" ? status : null;
}

function mapRecipient(
  recipient: SigningRecipient,
  kycStatus: SigningKycStatus = "PENDING",
  warningAcceptedAt: string | null = null
): SigningRecipientDto {
  return {
    id: recipient.id,
    role_key: recipient.role_key,
    role_label: recipient.role_label,
    name: recipient.name,
    email: recipient.email,
    routing_order: recipient.routing_order,
    status: recipient.status,
    kyc_status: kycStatus,
    completed_at: recipient.completed_at ? recipient.completed_at.toISOString() : null,
    email_delivery_status: readEmailDeliveryStatus(recipient.metadata),
    warning_accepted_at: recipient.role_key === "guarantor" ? warningAcceptedAt : null,
  };
}

function mapAssignment(assignment: SigningAssignment): SigningAssignmentDto {
  return {
    id: assignment.id,
    document_id: assignment.document_id,
    recipient_id: assignment.recipient_id,
    required: assignment.required,
    action: assignment.action,
    status: assignment.status,
    signed_at: assignment.signed_at ? assignment.signed_at.toISOString() : null,
  };
}

export function mapSigningEnvelopeToDto(envelope: SigningEnvelopeWithGraph): SigningEnvelopeDto {
  return {
    id: envelope.id,
    application_id: envelope.application_id,
    contract_id: envelope.contract_id ?? null,
    invoice_id: envelope.invoice_id ?? null,
    title: envelope.title,
    status: envelope.status,
    expires_at: envelope.expires_at ? envelope.expires_at.toISOString() : null,
    sent_at: envelope.sent_at ? envelope.sent_at.toISOString() : null,
    completed_at: envelope.completed_at ? envelope.completed_at.toISOString() : null,
    documents: [...envelope.documents].sort((a, b) => a.order - b.order).map(mapDocument),
    recipients: [...envelope.recipients]
      .sort((a, b) => a.routing_order - b.routing_order)
      .map((recipient) => mapRecipient(recipient)),
    assignments: envelope.assignments.map(mapAssignment),
  };
}

export async function mapSigningEnvelopeToDtoWithEkyc(
  envelope: SigningEnvelopeWithGraph
): Promise<SigningEnvelopeDto> {
  const [kycMap, warningAcceptedAt] = await Promise.all([
    resolveSigningKycStatusMap(envelope.recipients),
    legalExternalAcceptanceService.acceptedAtBySigningRecipientIds(
      envelope.recipients.filter((r) => r.role_key === "guarantor").map((r) => r.id)
    ),
  ]);
  return {
    id: envelope.id,
    application_id: envelope.application_id,
    contract_id: envelope.contract_id ?? null,
    invoice_id: envelope.invoice_id ?? null,
    title: envelope.title,
    status: envelope.status,
    expires_at: envelope.expires_at ? envelope.expires_at.toISOString() : null,
    sent_at: envelope.sent_at ? envelope.sent_at.toISOString() : null,
    completed_at: envelope.completed_at ? envelope.completed_at.toISOString() : null,
    documents: [...envelope.documents].sort((a, b) => a.order - b.order).map(mapDocument),
    recipients: [...envelope.recipients]
      .sort((a, b) => a.routing_order - b.routing_order)
      .map((recipient) =>
        mapRecipient(
          recipient,
          kycMap.get(recipient.id) ?? "PENDING",
          warningAcceptedAt.get(recipient.id) ?? null
        )
      ),
    assignments: envelope.assignments.map(mapAssignment),
  };
}
