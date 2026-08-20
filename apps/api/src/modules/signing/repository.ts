/**
 * Prisma access for the signing envelope graph (envelope + documents + recipients + assignments).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { EnvelopePlan } from "@cashsouk/types";
import type { SigningEnvelopeWithGraph } from "./mapper";
import { hashSigningAccessToken } from "./token";
import { AppError } from "../../lib/http/error-handler";

/** Statuses that block creating another envelope for the same contract/invoice. */
const ACTIVE_ENVELOPE_STATUSES = ["DRAFT", "SENT", "IN_PROGRESS"] as const;

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
  afterCreate?: (
    tx: Prisma.TransactionClient,
    envelope: SigningEnvelopeWithGraph
  ) => Promise<void>;
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

  async findActiveEnvelopeForContract(
    contractId: string
  ): Promise<SigningEnvelopeWithGraph | null> {
    return prisma.signingEnvelope.findFirst({
      where: {
        contract_id: contractId,
        status: { in: [...ACTIVE_ENVELOPE_STATUSES] },
      },
      include: GRAPH_INCLUDE,
      orderBy: { created_at: "desc" },
    });
  }

  async findActiveEnvelopeForInvoice(
    invoiceId: string
  ): Promise<SigningEnvelopeWithGraph | null> {
    return prisma.signingEnvelope.findFirst({
      where: {
        invoice_id: invoiceId,
        status: { in: [...ACTIVE_ENVELOPE_STATUSES] },
      },
      include: GRAPH_INCLUDE,
      orderBy: { created_at: "desc" },
    });
  }

  async createFromPlan(input: CreateEnvelopeInput): Promise<SigningEnvelopeWithGraph> {
    const { plan } = input;
    return prisma.$transaction(async (tx) => {
      // Serialize same-target creates: lock parent row, then re-check active envelope.
      if (input.contract_id) {
        await tx.$queryRaw`SELECT id FROM contracts WHERE id = ${input.contract_id} FOR UPDATE`;
        const active = await tx.signingEnvelope.findFirst({
          where: {
            contract_id: input.contract_id,
            status: { in: [...ACTIVE_ENVELOPE_STATUSES] },
          },
          select: { id: true },
        });
        if (active) {
          throw new AppError(
            409,
            "SIGNING_ENVELOPE_EXISTS",
            "This offer already has an active signing package."
          );
        }
      } else if (input.invoice_id) {
        await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${input.invoice_id} FOR UPDATE`;
        const active = await tx.signingEnvelope.findFirst({
          where: {
            invoice_id: input.invoice_id,
            status: { in: [...ACTIVE_ENVELOPE_STATUSES] },
          },
          select: { id: true },
        });
        if (active) {
          throw new AppError(
            409,
            "SIGNING_ENVELOPE_EXISTS",
            "This offer already has an active signing package."
          );
        }
      }

      const envelope = await tx.signingEnvelope.create({
        data: {
          application_id: input.application_id,
          contract_id: input.contract_id ?? null,
          invoice_id: input.invoice_id ?? null,
          product_version: input.product_version ?? null,
          title: input.title,
          created_by_user_id: input.created_by_user_id ?? null,
          expires_at: input.expires_at ?? null,
          status: "DRAFT",
        },
      });

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
            metadata: doc.supporting_doc_step_key
              ? { supporting_doc_step_key: doc.supporting_doc_step_key }
              : undefined,
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
            application_guarantor_id: r.application_guarantor_id,
            name: r.name,
            email: r.email,
            ic_number: r.ic_number,
            routing_order: r.routing_order,
            status: "PENDING",
            kyc_required: r.kyc_required !== false,
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

      const created = await tx.signingEnvelope.findUniqueOrThrow({
        where: { id: envelope.id },
        include: GRAPH_INCLUDE,
      });
      if (input.afterCreate) {
        await input.afterCreate(tx, created);
      }
      return created;
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

  async findEnvelopeByRecipientAccessToken(
    accessToken: string
  ): Promise<{ recipientId: string; envelope: SigningEnvelopeWithGraph } | null> {
    const tokenHash = hashSigningAccessToken(accessToken);
    const recipient = await prisma.signingRecipient.findUnique({
      where: { access_token_hash: tokenHash },
      select: { id: true, envelope_id: true },
    });
    if (!recipient) return null;
    const envelope = await this.findById(recipient.envelope_id);
    if (!envelope) return null;
    return { recipientId: recipient.id, envelope };
  }

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

  async setDocumentUnsignedS3Key(documentId: string, s3Key: string): Promise<void> {
    await prisma.signingDocument.update({
      where: { id: documentId },
      data: { unsigned_s3_key: s3Key },
    });
  }

  async setAssignmentSignset(assignmentId: string, signset: unknown): Promise<void> {
    await prisma.signingAssignment.update({
      where: { id: assignmentId },
      data: { signset: signset as object },
    });
  }

  async setRecipientAccessToken(
    recipientId: string,
    accessToken: string,
    expiresAt: Date | null
  ): Promise<void> {
    await prisma.signingRecipient.update({
      where: { id: recipientId },
      data: {
        access_token_hash: hashSigningAccessToken(accessToken),
        access_token_expires_at: expiresAt,
      },
    });
  }

  async markRecipientAccessCodeVerified(recipientId: string): Promise<void> {
    await prisma.signingRecipient.update({
      where: { id: recipientId },
      data: { access_code_verified_at: new Date() },
    });
  }

  async bindRecipientIcAndVerifyAccess(recipientId: string, icNumber: string): Promise<void> {
    await prisma.signingRecipient.update({
      where: { id: recipientId },
      data: {
        ic_number: icNumber,
        access_code_verified_at: new Date(),
      },
    });
  }

  /** Clears IC gate so the signer can re-enter IC before eKYC completes. */
  async clearRecipientAccessGate(
    recipientId: string,
    options: { clearIcNumber: boolean }
  ): Promise<void> {
    await prisma.signingRecipient.update({
      where: { id: recipientId },
      data: {
        access_code_verified_at: null,
        ...(options.clearIcNumber ? { ic_number: null } : {}),
      },
    });
  }

  async markDraftEnvelopeSent(
    envelopeId: string,
    tx: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<boolean> {
    const result = await tx.signingEnvelope.updateMany({
      where: { id: envelopeId, status: "DRAFT" },
      data: { status: "SENT", sent_at: new Date() },
    });
    if (result.count === 0) return false;
    await tx.signingRecipient.updateMany({
      where: { envelope_id: envelopeId, status: "PENDING" },
      data: { status: "SENT", sent_at: new Date() },
    });
    return true;
  }

  async markEnvelopeSent(envelopeId: string): Promise<void> {
    const marked = await this.markDraftEnvelopeSent(envelopeId);
    if (!marked) {
      throw new AppError(409, "SIGNING_ENVELOPE_NOT_DRAFT", "Only draft envelopes can be sent.");
    }
  }

  async markAssignmentSigned(assignmentId: string): Promise<void> {
    await prisma.signingAssignment.update({
      where: { id: assignmentId },
      data: { status: "SIGNED", signed_at: new Date() },
    });
  }

  async markAssignmentDeclined(assignmentId: string): Promise<void> {
    await prisma.signingAssignment.update({
      where: { id: assignmentId },
      data: { status: "DECLINED", signed_at: null },
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
    completed: boolean,
    tx: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<void> {
    await tx.signingRecipient.update({
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

  async voidEnvelopeGraph(
    envelopeId: string,
    reason: string | null,
    tx: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<void> {
    await tx.signingEnvelope.update({
      where: { id: envelopeId },
      data: { status: "VOIDED", voided_at: new Date(), void_reason: reason },
    });
    await tx.signingDocument.updateMany({
      where: { envelope_id: envelopeId, status: { notIn: ["COMPLETED"] } },
      data: { status: "VOIDED" },
    });
    await tx.signingRecipient.updateMany({
      where: {
        envelope_id: envelopeId,
        status: { notIn: ["SIGNED", "DECLINED"] },
      },
      data: { status: "DECLINED", declined_at: new Date() },
    });
    await tx.signingAssignment.updateMany({
      where: {
        envelope_id: envelopeId,
        status: { notIn: ["SIGNED", "DECLINED"] },
      },
      data: { status: "DECLINED" },
    });
  }

  async voidEnvelope(envelopeId: string, reason: string | null): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await this.voidEnvelopeGraph(envelopeId, reason, tx);
    });
  }

  async updateEnvelopeStatusIfCurrent(
    envelopeId: string,
    expectedStatus: SigningEnvelopeWithGraph["status"],
    nextStatus: SigningEnvelopeWithGraph["status"],
    completed: boolean,
    tx: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<boolean> {
    const result = await tx.signingEnvelope.updateMany({
      where: { id: envelopeId, status: expectedStatus },
      data: {
        status: nextStatus,
        ...(completed ? { completed_at: new Date() } : {}),
      },
    });
    return result.count > 0;
  }

  async completeEnvelopeIfActive(
    envelopeId: string,
    tx: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<boolean> {
    const result = await tx.signingEnvelope.updateMany({
      where: {
        id: envelopeId,
        status: { in: [...ACTIVE_ENVELOPE_STATUSES] },
      },
      data: { status: "COMPLETED", completed_at: new Date() },
    });
    return result.count > 0;
  }

  async findRecipientByReturnSessionId(returnSessionId: string): Promise<{
    recipientId: string;
    envelope: SigningEnvelopeWithGraph;
  } | null> {
    const recipient = await prisma.signingRecipient.findFirst({
      where: {
        metadata: {
          path: ["last_signing_session", "returnSessionId"],
          equals: returnSessionId,
        },
      },
      include: {
        envelope: { include: GRAPH_INCLUDE },
      },
    });
    if (!recipient) return null;
    return {
      recipientId: recipient.id,
      envelope: recipient.envelope as SigningEnvelopeWithGraph,
    };
  }

  async setRecipientEmailDeliveryStatus(
    recipientId: string,
    status: "sent" | "failed",
    errorMessage?: string | null
  ): Promise<void> {
    const existing = await prisma.signingRecipient.findUnique({
      where: { id: recipientId },
      select: { metadata: true },
    });
    const base =
      existing?.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
        ? { ...(existing.metadata as Record<string, unknown>) }
        : {};
    await prisma.signingRecipient.update({
      where: { id: recipientId },
      data: {
        metadata: {
          ...base,
          email_delivery: {
            status,
            at: new Date().toISOString(),
            ...(errorMessage ? { error: errorMessage.slice(0, 500) } : {}),
          },
        },
      },
    });
  }

  async touchRecipientReminder(
    recipientId: string,
    tx: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<void> {
    await tx.signingRecipient.update({
      where: { id: recipientId },
      data: { last_reminder_at: new Date() },
    });
  }
}

export const signingRepository = new SigningRepository();
