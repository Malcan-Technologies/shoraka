/**
 * Prisma access for the signing envelope graph (envelope + documents + recipients + assignments).
 * The envelope is created atomically so the document x recipient matrix is always consistent.
 */
import { prisma } from "../../lib/prisma";
import type { EnvelopePlan } from "@cashsouk/types";
import type { SigningEnvelopeWithGraph } from "./mapper";

const TERMINAL_ENVELOPE_STATUSES = ["DECLINED", "VOIDED", "EXPIRED"] as const;

const GRAPH_INCLUDE = {
  documents: true,
  recipients: true,
  assignments: true,
} as const;

export type SigningApplicationContext = NonNullable<
  Awaited<ReturnType<SigningRepository["findApplicationContext"]>>
>;

export interface CreateEnvelopeInput {
  application_id: string;
  contract_id?: string | null;
  invoice_id?: string | null;
  product_version?: number | null;
  title: string;
  created_by_user_id?: string | null;
  expires_at?: Date | null;
  plan: EnvelopePlan;
}

export class SigningRepository {
  async findApplicationContext(applicationId: string) {
    return prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        issuer_organization: true,
        contract: true,
        invoices: { orderBy: { created_at: "asc" } },
        application_guarantors: { orderBy: { position: "asc" } },
      },
    });
  }

  async findActiveEnvelopeForApplication(
    applicationId: string
  ): Promise<SigningEnvelopeWithGraph | null> {
    return prisma.signingEnvelope.findFirst({
      where: {
        application_id: applicationId,
        status: { notIn: [...TERMINAL_ENVELOPE_STATUSES] },
      },
      include: GRAPH_INCLUDE,
      orderBy: { created_at: "desc" },
    });
  }

  /** Persist an envelope and its full graph from a plan in one transaction. */
  async createFromPlan(input: CreateEnvelopeInput): Promise<SigningEnvelopeWithGraph> {
    const { plan } = input;
    return prisma.$transaction(async (tx) => {
      const envelope = await tx.signingEnvelope.create({
        data: {
          application_id: input.application_id,
          contract_id: input.contract_id ?? null,
          invoice_id: input.invoice_id ?? null,
          product_version: input.product_version ?? null,
          title: input.title,
          routing_mode: plan.routing_mode,
          created_by_user_id: input.created_by_user_id ?? null,
          expires_at: input.expires_at ?? null,
          status: "DRAFT",
        },
      });

      // Create documents and recipients, keeping plan-ref -> db-id maps for assignments.
      const documentIdByRef = new Map<string, string>();
      for (const doc of plan.documents) {
        const created = await tx.signingDocument.create({
          data: {
            envelope_id: envelope.id,
            name: doc.name,
            description: doc.description ?? null,
            source: doc.source,
            order: doc.order,
            required: doc.required,
            template_ref: doc.key,
            unsigned_s3_key: doc.template?.s3_key ?? null,
            status: "DRAFT",
          },
        });
        documentIdByRef.set(doc.ref, created.id);
      }

      const recipientIdByRef = new Map<string, string>();
      for (const r of plan.recipients) {
        const created = await tx.signingRecipient.create({
          data: {
            envelope_id: envelope.id,
            role_key: r.role_key,
            role_label: r.role_label,
            party_type: r.party_type,
            user_id: r.user_id,
            application_guarantor_id: r.application_guarantor_id,
            name: r.name,
            email: r.email,
            ic_number: r.ic_number,
            routing_order: r.routing_order,
            status: "PENDING",
            kyc_status: r.kyc_required ? "PENDING" : "NOT_REQUIRED",
          },
        });
        recipientIdByRef.set(r.ref, created.id);
      }

      if (plan.assignments.length > 0) {
        await tx.signingAssignment.createMany({
          data: plan.assignments.map((a) => ({
            envelope_id: envelope.id,
            document_id: documentIdByRef.get(a.document_ref)!,
            recipient_id: recipientIdByRef.get(a.recipient_ref)!,
            required: a.required,
            action: a.action,
            status: "PENDING" as const,
          })),
        });
      }

      return tx.signingEnvelope.findUniqueOrThrow({
        where: { id: envelope.id },
        include: GRAPH_INCLUDE,
      });
    });
  }

  async findById(id: string): Promise<SigningEnvelopeWithGraph | null> {
    return prisma.signingEnvelope.findUnique({
      where: { id },
      include: GRAPH_INCLUDE,
    });
  }

  async findByApplicationId(applicationId: string): Promise<SigningEnvelopeWithGraph[]> {
    return prisma.signingEnvelope.findMany({
      where: { application_id: applicationId },
      include: GRAPH_INCLUDE,
      orderBy: { created_at: "desc" },
    });
  }

  /** Webhook lookup: find the envelope owning a document by its provider contract ref. */
  async findByDocumentProviderRef(providerRef: string): Promise<SigningEnvelopeWithGraph | null> {
    const doc = await prisma.signingDocument.findUnique({
      where: { provider_contract_ref: providerRef },
      select: { envelope_id: true },
    });
    if (!doc) return null;
    return this.findById(doc.envelope_id);
  }

  async findRecipientById(recipientId: string) {
    return prisma.signingRecipient.findUnique({ where: { id: recipientId } });
  }

  /** External no-auth lookup: resolve a recipient (and its envelope) by access token. */
  async findEnvelopeByRecipientAccessToken(
    accessToken: string
  ): Promise<{ recipientId: string; envelope: SigningEnvelopeWithGraph } | null> {
    const recipient = await prisma.signingRecipient.findUnique({
      where: { access_token: accessToken },
      select: { id: true, envelope_id: true },
    });
    if (!recipient) return null;
    const envelope = await this.findById(recipient.envelope_id);
    if (!envelope) return null;
    return { recipientId: recipient.id, envelope };
  }

  /** Persist a provider contract ref + set the document/its assignments to SENT. */
  async markDocumentSent(documentId: string, providerContractRef: string): Promise<void> {
    await prisma.$transaction([
      prisma.signingDocument.update({
        where: { id: documentId },
        data: { provider_contract_ref: providerContractRef, status: "PENDING" },
      }),
      prisma.signingAssignment.updateMany({
        where: { document_id: documentId, status: "PENDING" },
        data: { status: "SENT" },
      }),
    ]);
  }

  async setRecipientAccessToken(
    recipientId: string,
    accessToken: string,
    expiresAt: Date | null
  ): Promise<void> {
    await prisma.signingRecipient.update({
      where: { id: recipientId },
      data: { access_token: accessToken, access_token_expires_at: expiresAt },
    });
  }

  async markEnvelopeSent(envelopeId: string): Promise<void> {
    await prisma.$transaction([
      prisma.signingEnvelope.update({
        where: { id: envelopeId },
        data: { status: "SENT", sent_at: new Date() },
      }),
      prisma.signingRecipient.updateMany({
        where: { envelope_id: envelopeId, status: "PENDING" },
        data: { status: "SENT", sent_at: new Date() },
      }),
    ]);
  }

  /** Mark a single assignment signed (idempotent) and stamp signed_at. */
  async markAssignmentSigned(assignmentId: string): Promise<void> {
    await prisma.signingAssignment.update({
      where: { id: assignmentId },
      data: { status: "SIGNED", signed_at: new Date() },
    });
  }

  async recordSignedDocument(
    documentId: string,
    signedS3Key: string,
    sha256: string,
    status: SigningEnvelopeWithGraph["documents"][number]["status"]
  ): Promise<void> {
    await prisma.signingDocument.update({
      where: { id: documentId },
      data: { signed_s3_key: signedS3Key, signed_file_sha256: sha256, status },
    });
  }

  async updateRecipientStatus(
    recipientId: string,
    status: SigningEnvelopeWithGraph["recipients"][number]["status"],
    completed: boolean
  ): Promise<void> {
    await prisma.signingRecipient.update({
      where: { id: recipientId },
      data: { status, ...(completed ? { completed_at: new Date() } : {}) },
    });
  }

  async updateDocumentStatus(
    documentId: string,
    status: SigningEnvelopeWithGraph["documents"][number]["status"]
  ): Promise<void> {
    await prisma.signingDocument.update({ where: { id: documentId }, data: { status } });
  }

  async updateEnvelopeStatus(
    envelopeId: string,
    status: SigningEnvelopeWithGraph["status"],
    completed: boolean
  ): Promise<void> {
    await prisma.signingEnvelope.update({
      where: { id: envelopeId },
      data: { status, ...(completed ? { completed_at: new Date() } : {}) },
    });
  }

  async voidEnvelope(envelopeId: string, reason: string | null): Promise<void> {
    await prisma.$transaction([
      prisma.signingEnvelope.update({
        where: { id: envelopeId },
        data: { status: "VOIDED", voided_at: new Date(), void_reason: reason },
      }),
      prisma.signingDocument.updateMany({
        where: { envelope_id: envelopeId, status: { notIn: ["COMPLETED"] } },
        data: { status: "VOIDED" },
      }),
    ]);
  }

  async touchRecipientReminder(recipientId: string): Promise<void> {
    await prisma.signingRecipient.update({
      where: { id: recipientId },
      data: { last_reminder_at: new Date() },
    });
  }
}

export const signingRepository = new SigningRepository();
