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
} from "@cashsouk/types";

export type SigningEnvelopeWithGraph = SigningEnvelope & {
  documents: SigningDocument[];
  recipients: SigningRecipient[];
  assignments: SigningAssignment[];
};

function mapDocument(doc: SigningDocument): SigningDocumentDto {
  return {
    id: doc.id,
    name: doc.name,
    description: doc.description ?? null,
    source: doc.source,
    order: doc.order,
    required: doc.required,
    status: doc.status,
    signed_s3_key: doc.signed_s3_key ?? null,
  };
}

function mapRecipient(recipient: SigningRecipient): SigningRecipientDto {
  return {
    id: recipient.id,
    role_key: recipient.role_key,
    role_label: recipient.role_label,
    party_type: recipient.party_type,
    name: recipient.name,
    email: recipient.email,
    routing_order: recipient.routing_order,
    status: recipient.status,
    kyc_status: recipient.kyc_status,
    completed_at: recipient.completed_at ? recipient.completed_at.toISOString() : null,
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
      .map(mapRecipient),
    assignments: envelope.assignments.map(mapAssignment),
  };
}
