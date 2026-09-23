import type { PrismaClient } from "@prisma/client";
import {
  FACILITY_DOCUMENT_FIXED_IDS,
  isFacilityDocumentFixedId,
  type FacilityDocumentCatalog,
} from "@cashsouk/types";
import { AppError } from "../../../lib/http/error-handler";
import { prisma as defaultPrisma } from "../../../lib/prisma";
import { getS3ObjectBuffer } from "../../../lib/s3/client";
import {
  generatedDocumentsService,
  workflowDeclaresGeneratedDocumentType,
} from "../../generated-documents/service";
import {
  DOA_SIGNING_DOCUMENT_KEY,
  FA_SIGNING_DOCUMENT_KEY,
  JSG_SIGNING_DOCUMENT_KEY,
  pickLatestMatchingCompletedEnvelope,
  pickSignedDocumentByTemplateRef,
  signedDocumentIsAvailable,
  type NoteSigningDocumentLike,
  type NoteSigningEnvelopeLike,
} from "../../notes/documents/envelope";
import {
  buildFacilityDocumentCatalog,
  type FacilityDocumentCatalogSnapshot,
  type FacilityUnderlyingContract,
} from "./catalog";
import { safeFacilityDocumentFilename } from "./filenames";

export type FacilityDocumentContent = {
  buffer: Buffer;
  filename: string;
  contentType: string;
};

type FacilityDocumentsActor = { userId: string };

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

function parseUnderlyingContract(details: unknown): FacilityUnderlyingContract | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const document = (details as { document?: unknown }).document;
  if (!document || typeof document !== "object" || Array.isArray(document)) return null;
  const row = document as { s3_key?: unknown; file_name?: unknown };
  const s3Key = typeof row.s3_key === "string" ? row.s3_key.trim() : "";
  if (!s3Key) return null;
  const fileName =
    typeof row.file_name === "string" && row.file_name.trim()
      ? row.file_name.trim()
      : "contract.pdf";
  return { s3Key, fileName };
}

function contentTypeForFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

async function loadObjectFromKey(
  key: string | null | undefined,
  message: string
): Promise<Buffer> {
  const trimmed = key?.trim();
  if (!trimmed) {
    throw new AppError(404, "FACILITY_DOCUMENT_UNAVAILABLE", message);
  }
  try {
    return await getS3ObjectBuffer(trimmed);
  } catch {
    throw new AppError(404, "FACILITY_DOCUMENT_UNAVAILABLE", message);
  }
}

export class FacilityDocumentsService {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async getCatalog(facilityId: string): Promise<FacilityDocumentCatalog> {
    const snapshot = await this.loadSnapshot(facilityId);
    return buildFacilityDocumentCatalog(snapshot);
  }

  async getContent(
    facilityId: string,
    documentId: string,
    actor: FacilityDocumentsActor
  ): Promise<FacilityDocumentContent> {
    if (!isFacilityDocumentFixedId(documentId)) {
      throw new AppError(404, "FACILITY_DOCUMENT_NOT_FOUND", "Document not found on this facility.");
    }
    const snapshot = await this.loadSnapshot(facilityId);
    const catalog = buildFacilityDocumentCatalog(snapshot);
    const item = catalog.documents.find((document) => document.id === documentId);
    if (!item) {
      throw new AppError(404, "FACILITY_DOCUMENT_NOT_FOUND", "Document not found on this facility.");
    }
    if (!item.available) {
      throw new AppError(
        404,
        "FACILITY_DOCUMENT_UNAVAILABLE",
        item.unavailableHint ?? item.description
      );
    }

    if (documentId === FACILITY_DOCUMENT_FIXED_IDS.underlyingContract) {
      return this.underlyingContractFile(snapshot);
    }
    if (documentId === FACILITY_DOCUMENT_FIXED_IDS.letterOfOffer) {
      return this.generateLetterOfOffer(snapshot, actor);
    }
    if (documentId === FACILITY_DOCUMENT_FIXED_IDS.facilityAgreement) {
      return this.signedEnvelopePdf(
        snapshot.facilityAgreement,
        item.filename ?? safeFacilityDocumentFilename(snapshot.facilityReference, "FA")
      );
    }
    if (documentId === FACILITY_DOCUMENT_FIXED_IDS.jsg) {
      return this.signedEnvelopePdf(
        snapshot.jsg,
        item.filename ?? safeFacilityDocumentFilename(snapshot.facilityReference, "JSG")
      );
    }
    if (documentId === FACILITY_DOCUMENT_FIXED_IDS.deedOfAssignment) {
      return this.signedEnvelopePdf(
        snapshot.doa,
        item.filename ?? safeFacilityDocumentFilename(snapshot.facilityReference, "DOA")
      );
    }

    throw new AppError(404, "FACILITY_DOCUMENT_NOT_FOUND", "Document not found on this facility.");
  }

  private async loadSnapshot(facilityId: string): Promise<FacilityDocumentCatalogSnapshot> {
    const contract = await this.db.contract.findUnique({
      where: { id: facilityId },
      select: {
        id: true,
        display_reference: true,
        originating_application_id: true,
        contract_details: true,
        offer_details: true,
      },
    });
    if (!contract) {
      throw new AppError(404, "NOT_FOUND", "Facility not found");
    }

    const [envelopes, application] = await Promise.all([
      this.db.signingEnvelope.findMany({
        where: { contract_id: contract.id, invoice_id: null, status: "COMPLETED" },
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
      contract.originating_application_id
        ? this.db.application.findUnique({
            where: { id: contract.originating_application_id },
            select: { financing_type: true, product_version: true },
          })
        : Promise.resolve(null),
    ]);

    const envelope = pickLatestMatchingCompletedEnvelope(
      envelopes as NoteSigningEnvelopeLike[],
      {
        contractId: contract.id,
        invoiceId: null,
      }
    );

    return {
      facilityId: contract.id,
      facilityReference: contract.display_reference?.trim() || contract.id,
      underlyingContract: parseUnderlyingContract(contract.contract_details),
      envelope,
      jsg: pickSignedDocumentByTemplateRef(envelope, JSG_SIGNING_DOCUMENT_KEY),
      facilityAgreement: pickSignedDocumentByTemplateRef(envelope, FA_SIGNING_DOCUMENT_KEY),
      doa: pickSignedDocumentByTemplateRef(envelope, DOA_SIGNING_DOCUMENT_KEY),
      letterOfOffer: await this.letterOfOfferGates(contract, application),
    };
  }

  private async letterOfOfferGates(
    contract: { id: string; offer_details: unknown },
    application: { financing_type: unknown; product_version: number } | null
  ): Promise<FacilityDocumentCatalogSnapshot["letterOfOffer"]> {
    const offerSent = offerHasSentAt(contract.offer_details);
    if (!application) {
      return { hasContract: true, offerSent, declaredOnProduct: false };
    }
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
  ): Promise<FacilityDocumentContent> {
    if (!signedDocumentIsAvailable(document) || !document) {
      throw new AppError(
        404,
        "FACILITY_DOCUMENT_UNAVAILABLE",
        "Signed document is not available yet."
      );
    }
    const buffer = await loadObjectFromKey(
      document.signed_s3_key,
      "Signed document is not available yet."
    );
    return { buffer, filename, contentType: "application/pdf" };
  }

  private async underlyingContractFile(
    snapshot: FacilityDocumentCatalogSnapshot
  ): Promise<FacilityDocumentContent> {
    const upload = snapshot.underlyingContract;
    const buffer = await loadObjectFromKey(
      upload?.s3Key,
      "Waiting for the commercial contract to be uploaded."
    );
    const filename = upload?.fileName ?? "contract.pdf";
    return { buffer, filename, contentType: contentTypeForFilename(filename) };
  }

  private async generateLetterOfOffer(
    snapshot: FacilityDocumentCatalogSnapshot,
    actor: FacilityDocumentsActor
  ): Promise<FacilityDocumentContent> {
    const contract = await this.db.contract.findUnique({
      where: { id: snapshot.facilityId },
      select: { originating_application_id: true },
    });
    if (!contract?.originating_application_id) {
      throw new AppError(
        404,
        "FACILITY_DOCUMENT_UNAVAILABLE",
        "Waiting for the offer to be sent."
      );
    }
    const generated = await generatedDocumentsService.generateDocument({
      applicationId: contract.originating_application_id,
      typeKey: "arf_contract_facility_lo",
      format: "pdf",
      userId: actor.userId,
      asAdmin: true,
      invoiceId: null,
      contractId: snapshot.facilityId,
    });
    return {
      buffer: generated.buffer,
      filename: safeFacilityDocumentFilename(snapshot.facilityReference, "LO"),
      contentType: "application/pdf",
    };
  }
}

export const facilityDocumentsService = new FacilityDocumentsService();
