import { createHash } from "crypto";
import {
  NoteInvestmentCertificateAudience,
  NoteInvestmentCertificateStatus,
  type PrismaClient,
} from "@prisma/client";
import {
  NOTE_DOCUMENT_FIXED_IDS,
  parseShorakaCertificateDocumentId,
  type NoteDocumentCatalog,
} from "@cashsouk/types";
import { AppError } from "../../../lib/http/error-handler";
import { prisma as defaultPrisma } from "../../../lib/prisma";
import { getS3ObjectBuffer } from "../../../lib/s3/client";
import {
  generatedDocumentsService,
  workflowDeclaresGeneratedDocumentType,
} from "../../generated-documents/service";
import { PROSPECTUS_PDF_STATUS_READY, prospectusPdfFileName } from "../prospectus/prospectus-pdf";
import { certificatePdfFileName } from "../investment-note-certificate/storage";
import {
  DOA_SIGNING_DOCUMENT_KEY,
  FA_SIGNING_DOCUMENT_KEY,
  JSG_SIGNING_DOCUMENT_KEY,
  pickLatestMatchingCompletedEnvelope,
  pickSignedDocumentByTemplateRef,
  signedDocumentIsAvailable,
  type NoteSigningDocumentLike,
  type NoteSigningEnvelopeLike,
} from "./envelope";
import { sortShorakaCertificates, type ShorakaCertificateOrderInput } from "./certificate-order";
import { buildNoteDocumentCatalog, type NoteDocumentCatalogSnapshot } from "./catalog";
import {
  composeFacilityAgreementPackage,
  FACILITY_AGREEMENT_PACKAGE_ASSEMBLER_VERSION,
  FaPackageAnchorError,
} from "./facility-agreement-package";
import {
  facilityAgreementPackageFilename,
  safeNoteDocumentFilename,
  shorakaCertificateFilename,
} from "./filenames";

export type NoteDocumentContent = {
  buffer: Buffer;
  filename: string;
  contentType: "application/pdf";
};

type NoteDocumentsActor = { userId: string };

function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function productIdFromFinancingType(financingType: unknown): string | null {
  if (!financingType || typeof financingType !== "object" || Array.isArray(financingType)) {
    return null;
  }
  const productId = (financingType as { product_id?: unknown }).product_id;
  return typeof productId === "string" && productId.trim() ? productId.trim() : null;
}

function offerHasSentAt(offerDetails: unknown): boolean {
  if (!offerDetails || typeof offerDetails !== "object" || Array.isArray(offerDetails)) {
    return false;
  }
  const sentAt = (offerDetails as { sent_at?: unknown }).sent_at;
  return typeof sentAt === "string" && sentAt.trim().length > 0;
}

function asWorkflow(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function loadPdfFromKey(
  key: string | null | undefined,
  message: string
): Promise<Buffer> {
  const trimmed = key?.trim();
  if (!trimmed) {
    throw new AppError(404, "NOTE_DOCUMENT_UNAVAILABLE", message);
  }
  try {
    return await getS3ObjectBuffer(trimmed);
  } catch {
    throw new AppError(404, "NOTE_DOCUMENT_UNAVAILABLE", message);
  }
}

export class NoteDocumentsService {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async getCatalog(noteId: string): Promise<NoteDocumentCatalog> {
    const snapshot = await this.loadSnapshot(noteId);
    return buildNoteDocumentCatalog(snapshot);
  }

  async getContent(
    noteId: string,
    documentId: string,
    actor: NoteDocumentsActor
  ): Promise<NoteDocumentContent> {
    const snapshot = await this.loadSnapshot(noteId);
    const catalog = buildNoteDocumentCatalog(snapshot);
    const item = catalog.documents.find((document) => document.id === documentId);
    if (!item) {
      throw new AppError(404, "NOTE_DOCUMENT_NOT_FOUND", "Document not found on this note.");
    }
    if (!item.available) {
      throw new AppError(404, "NOTE_DOCUMENT_UNAVAILABLE", item.availabilityReason);
    }

    if (documentId === NOTE_DOCUMENT_FIXED_IDS.jsg) {
      return this.signedEnvelopePdf(
        snapshot.jsg,
        item.filename ?? safeNoteDocumentFilename(snapshot.noteReference, "JSG")
      );
    }
    if (documentId === NOTE_DOCUMENT_FIXED_IDS.deedOfAssignment) {
      return this.signedEnvelopePdf(
        snapshot.doa,
        item.filename ?? safeNoteDocumentFilename(snapshot.noteReference, "DOA")
      );
    }
    if (documentId === NOTE_DOCUMENT_FIXED_IDS.letterOfOffer) {
      return this.generateLetterOfOffer(snapshot, actor);
    }
    if (documentId === NOTE_DOCUMENT_FIXED_IDS.facilityAgreementPackage) {
      return this.composePackage(snapshot, actor);
    }
    if (documentId === NOTE_DOCUMENT_FIXED_IDS.prospectus) {
      return this.prospectusPdf(snapshot);
    }
    if (documentId === NOTE_DOCUMENT_FIXED_IDS.investmentNoteCertificate) {
      return this.investmentNoteCertificatePdf(snapshot);
    }

    const tradeOrderId = parseShorakaCertificateDocumentId(documentId);
    if (tradeOrderId) {
      return this.shorakaCertificatePdf(snapshot, tradeOrderId);
    }

    throw new AppError(404, "NOTE_DOCUMENT_NOT_FOUND", "Document not found on this note.");
  }

  private async loadSnapshot(noteId: string): Promise<NoteDocumentCatalogSnapshot> {
    const note = await this.db.note.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        note_reference: true,
        source_application_id: true,
        source_contract_id: true,
        source_invoice_id: true,
        prospectus_review: { select: { approved_publication_id: true } },
      },
    });
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");

    const [
      envelopes,
      application,
      publication,
      investmentRows,
      shorakaRows,
      latestPackage,
    ] = await Promise.all([
      this.db.signingEnvelope.findMany({
        where: { application_id: note.source_application_id, status: "COMPLETED" },
        select: {
          id: true,
          status: true,
          application_id: true,
          contract_id: true,
          invoice_id: true,
          completed_at: true,
          documents: {
            select: {
              id: true,
              name: true,
              template_ref: true,
              signed_s3_key: true,
              signed_file_sha256: true,
              status: true,
            },
          },
        },
      }),
      this.db.application.findUnique({
        where: { id: note.source_application_id },
        select: {
          financing_type: true,
          product_version: true,
          contract: { select: { id: true, offer_details: true } },
        },
      }),
      note.prospectus_review?.approved_publication_id
        ? this.db.noteProspectusPublication.findUnique({
            where: { id: note.prospectus_review.approved_publication_id },
            select: {
              pdf_generation_status: true,
              pdf_storage_key: true,
            },
          })
        : Promise.resolve(null),
      this.db.noteInvestmentCertificate.findMany({
        where: {
          note_id: note.id,
          audience: NoteInvestmentCertificateAudience.ADMIN,
        },
        select: {
          status: true,
          is_current: true,
          pdf_s3_key: true,
          certificate_number: true,
          generated_at: true,
        },
        orderBy: { generated_at: "desc" },
      }),
      this.db.shorakaTradeOrder.findMany({
        where: { note_id: note.id },
        select: {
          id: true,
          created_at: true,
          certificate_s3_key: true,
          certificate_file_sha256: true,
          withdrawalInstruction: {
            select: { withdrawal_type: true, created_at: true },
          },
        },
      }),
      this.db.facilityAgreementPackageEvidence.findFirst({
        where: { note_id: note.id },
        orderBy: { created_at: "desc" },
        select: { created_at: true },
      }),
    ]);

    const envelope = pickLatestMatchingCompletedEnvelope(
      envelopes as NoteSigningEnvelopeLike[],
      {
        applicationId: note.source_application_id,
        contractId: note.source_contract_id,
        invoiceId: note.source_invoice_id,
      }
    );
    const letterOfOffer = await this.letterOfOfferGates(application);
    const currentIssued = investmentRows.find(
      (row) =>
        row.is_current &&
        row.status === NoteInvestmentCertificateStatus.READY &&
        Boolean(row.pdf_s3_key?.trim())
    );
    const shoraka = sortShorakaCertificates(shorakaRows as ShorakaCertificateOrderInput[]);

    return {
      noteId: note.id,
      noteReference: note.note_reference,
      envelope,
      jsg: pickSignedDocumentByTemplateRef(envelope, JSG_SIGNING_DOCUMENT_KEY),
      facilityAgreement: pickSignedDocumentByTemplateRef(envelope, FA_SIGNING_DOCUMENT_KEY),
      doa: pickSignedDocumentByTemplateRef(envelope, DOA_SIGNING_DOCUMENT_KEY),
      letterOfOffer,
      prospectus: {
        approved: Boolean(note.prospectus_review?.approved_publication_id),
        pdfReady:
          publication?.pdf_generation_status === PROSPECTUS_PDF_STATUS_READY &&
          Boolean(publication.pdf_storage_key?.trim()),
      },
      investmentCertificate: {
        issuedReady: Boolean(currentIssued),
        pending: investmentRows.some(
          (row) => row.is_current && row.status === NoteInvestmentCertificateStatus.PENDING
        ),
        failed: investmentRows.some(
          (row) => row.is_current && row.status === NoteInvestmentCertificateStatus.FAILED
        ),
        filename: currentIssued
          ? certificatePdfFileName({
              certificateNumber: currentIssued.certificate_number,
              audience: "ADMIN",
            })
          : null,
      },
      shoraka,
      faPackageGeneratedAt: latestPackage?.created_at.toISOString() ?? null,
    };
  }

  private async letterOfOfferGates(
    application: {
      financing_type: unknown;
      product_version: number;
      contract: { id: string; offer_details: unknown } | null;
    } | null
  ): Promise<NoteDocumentCatalogSnapshot["letterOfOffer"]> {
    if (!application?.contract) {
      return { hasContract: false, offerSent: false, declaredOnProduct: false };
    }
    const offerSent = offerHasSentAt(application.contract.offer_details);
    const productId = productIdFromFinancingType(application.financing_type);
    if (!productId) {
      return { hasContract: true, offerSent, declaredOnProduct: false };
    }
    const current = await this.db.product.findUnique({
      where: { id: productId },
      select: { id: true, base_id: true, version: true, workflow: true, status: true },
    });
    if (!current || current.status === "DELETED") {
      return { hasContract: true, offerSent, declaredOnProduct: false };
    }
    const workflowRow =
      current.version === application.product_version
        ? current
        : await this.db.product.findFirst({
            where: {
              base_id: current.base_id ?? current.id,
              version: application.product_version,
              status: { not: "DELETED" },
            },
            select: { workflow: true },
          });
    const declaredOnProduct = workflowDeclaresGeneratedDocumentType(
      asWorkflow(workflowRow?.workflow),
      "arf_contract_facility_lo"
    );
    return { hasContract: true, offerSent, declaredOnProduct };
  }

  private async signedEnvelopePdf(
    document: NoteSigningDocumentLike | null,
    filename: string
  ): Promise<NoteDocumentContent> {
    if (!signedDocumentIsAvailable(document) || !document) {
      throw new AppError(
        404,
        "NOTE_DOCUMENT_UNAVAILABLE",
        "Signed document is not available yet."
      );
    }
    const buffer = await loadPdfFromKey(
      document.signed_s3_key,
      "Signed document is not available yet."
    );
    return { buffer, filename, contentType: "application/pdf" };
  }

  private async generateLetterOfOffer(
    snapshot: NoteDocumentCatalogSnapshot,
    actor: NoteDocumentsActor
  ): Promise<NoteDocumentContent & { templateSha256: string; outputSha256: string }> {
    const note = await this.requireNote(snapshot.noteId);
    const generated = await generatedDocumentsService.generateDocument({
      applicationId: note.source_application_id,
      typeKey: "arf_contract_facility_lo",
      format: "pdf",
      userId: actor.userId,
      asAdmin: true,
    });
    return {
      buffer: generated.buffer,
      filename: safeNoteDocumentFilename(snapshot.noteReference, "LO"),
      contentType: "application/pdf",
      templateSha256: generated.templateSha256,
      outputSha256: generated.outputSha256,
    };
  }

  private async composePackage(
    snapshot: NoteDocumentCatalogSnapshot,
    actor: NoteDocumentsActor
  ): Promise<NoteDocumentContent> {
    const note = await this.requireNote(snapshot.noteId);
    const signedFa = snapshot.facilityAgreement;
    if (!signedDocumentIsAvailable(signedFa) || !signedFa) {
      throw new AppError(
        404,
        "NOTE_DOCUMENT_UNAVAILABLE",
        "Available after the Facility Agreement is signed."
      );
    }

    const signedFaPdf = await loadPdfFromKey(
      signedFa.signed_s3_key,
      "The signed Facility Agreement is not available."
    );
    const letter = await this.generateLetterOfOffer(snapshot, actor);
    const certificates: Array<{ id: string; buffer: Buffer; sha256: string }> = [];
    for (const row of snapshot.shoraka) {
      const key = row.certificate_s3_key?.trim();
      if (!key) continue;
      const buffer = await loadPdfFromKey(key, "A Shoraka certificate could not be loaded.");
      certificates.push({
        id: row.id,
        buffer,
        sha256: row.certificate_file_sha256?.trim() || sha256Hex(buffer),
      });
    }

    let composed;
    try {
      composed = await composeFacilityAgreementPackage({
        signedFaPdf,
        letterOfOfferPdf: letter.buffer,
        certificatePdfs: certificates.map((certificate) => certificate.buffer),
        title: `Facility Agreement Package ${snapshot.noteReference} (compiled copy)`,
      });
    } catch (error) {
      if (error instanceof FaPackageAnchorError) {
        throw new AppError(409, error.code, error.message);
      }
      throw error;
    }

    await this.db.facilityAgreementPackageEvidence.create({
      data: {
        note_id: snapshot.noteId,
        application_id: note.source_application_id,
        contract_id: note.source_contract_id,
        invoice_id: note.source_invoice_id,
        assembler_version: FACILITY_AGREEMENT_PACKAGE_ASSEMBLER_VERSION,
        signed_fa_sha256: signedFa.signed_file_sha256?.trim() || sha256Hex(signedFaPdf),
        lo_template_sha256: letter.templateSha256,
        lo_output_sha256: letter.outputSha256,
        certificate_ids: certificates.map((certificate) => certificate.id),
        certificate_hashes: certificates.map((certificate) => certificate.sha256),
        output_sha256: sha256Hex(composed.bytes),
        created_by_user_id: actor.userId,
      },
    });

    return {
      buffer: composed.bytes,
      filename: facilityAgreementPackageFilename(snapshot.noteReference),
      contentType: "application/pdf",
    };
  }

  private async prospectusPdf(
    snapshot: NoteDocumentCatalogSnapshot
  ): Promise<NoteDocumentContent> {
    const note = await this.requireNote(snapshot.noteId);
    const publicationId = (
      await this.db.note.findUnique({
        where: { id: snapshot.noteId },
        select: { prospectus_review: { select: { approved_publication_id: true } } },
      })
    )?.prospectus_review?.approved_publication_id;
    if (!publicationId) {
      throw new AppError(404, "NOTE_DOCUMENT_UNAVAILABLE", "Available after the Prospectus is approved.");
    }
    const publication = await this.db.noteProspectusPublication.findUnique({
      where: { id: publicationId },
      select: { pdf_storage_key: true, pdf_generation_status: true },
    });
    if (
      publication?.pdf_generation_status !== PROSPECTUS_PDF_STATUS_READY ||
      !publication.pdf_storage_key
    ) {
      throw new AppError(
        404,
        "NOTE_DOCUMENT_UNAVAILABLE",
        "The approved Prospectus PDF is still being generated."
      );
    }
    const buffer = await loadPdfFromKey(
      publication.pdf_storage_key,
      "Prospectus PDF is not available."
    );
    return {
      buffer,
      filename: prospectusPdfFileName(note.note_reference),
      contentType: "application/pdf",
    };
  }

  private async investmentNoteCertificatePdf(
    snapshot: NoteDocumentCatalogSnapshot
  ): Promise<NoteDocumentContent> {
    const row = await this.db.noteInvestmentCertificate.findFirst({
      where: {
        note_id: snapshot.noteId,
        audience: NoteInvestmentCertificateAudience.ADMIN,
        is_current: true,
        status: NoteInvestmentCertificateStatus.READY,
      },
      select: { pdf_s3_key: true, certificate_number: true },
    });
    const buffer = await loadPdfFromKey(
      row?.pdf_s3_key,
      "Available after the Islamic Investment Note Certificate is issued."
    );
    return {
      buffer,
      filename:
        snapshot.investmentCertificate.filename ??
        certificatePdfFileName({
          certificateNumber: row?.certificate_number ?? snapshot.noteReference,
          audience: "ADMIN",
        }),
      contentType: "application/pdf",
    };
  }

  private async shorakaCertificatePdf(
    snapshot: NoteDocumentCatalogSnapshot,
    tradeOrderId: string
  ): Promise<NoteDocumentContent> {
    const row = snapshot.shoraka.find((entry) => entry.id === tradeOrderId);
    const buffer = await loadPdfFromKey(
      row?.certificate_s3_key,
      "The Shoraka / Tawarruq certificate has not been uploaded yet."
    );
    return {
      buffer,
      filename: shorakaCertificateFilename(snapshot.noteReference, tradeOrderId),
      contentType: "application/pdf",
    };
  }

  private async requireNote(noteId: string) {
    const note = await this.db.note.findUnique({
      where: { id: noteId },
      select: {
        id: true,
        note_reference: true,
        source_application_id: true,
        source_contract_id: true,
        source_invoice_id: true,
      },
    });
    if (!note) throw new AppError(404, "NOTE_NOT_FOUND", "Note not found");
    return note;
  }
}

export const noteDocumentsService = new NoteDocumentsService();
