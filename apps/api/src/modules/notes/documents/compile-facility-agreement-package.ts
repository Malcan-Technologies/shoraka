import { createHash } from "crypto";
import type { PrismaClient } from "@prisma/client";
import { AppError } from "../../../lib/http/error-handler";
import {
  composeFacilityAgreementPackage,
  FACILITY_AGREEMENT_PACKAGE_ASSEMBLER_VERSION,
  FaPackageAnchorError,
} from "./facility-agreement-package";
import type { ShorakaCertificateOrderInput } from "./certificate-order";

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export type FacilityAgreementPackageCertificate = {
  id: string;
  buffer: Buffer;
  sha256: string;
};

export async function loadShorakaCertificatePdfs(
  rows: readonly ShorakaCertificateOrderInput[],
  loadPdf: (key: string) => Promise<Buffer>
): Promise<FacilityAgreementPackageCertificate[]> {
  const certificates: FacilityAgreementPackageCertificate[] = [];
  for (const row of rows) {
    const key = row.certificate_s3_key?.trim();
    if (!key) continue;
    const buffer = await loadPdf(key);
    certificates.push({
      id: row.id,
      buffer,
      sha256: row.certificate_file_sha256?.trim() || sha256Hex(buffer),
    });
  }
  return certificates;
}

export type AssembleAndRecordFacilityAgreementPackageInput = {
  db: Pick<PrismaClient, "facilityAgreementPackageEvidence">;
  signedFaPdf: Buffer;
  signedFaSha256: string;
  letterOfOfferPdf: Buffer;
  loTemplateSha256: string;
  loOutputSha256: string;
  certificates: readonly FacilityAgreementPackageCertificate[];
  title: string;
  evidence: {
    noteId: string | null;
    applicationId: string;
    contractId: string | null;
    invoiceId: string | null;
    createdByUserId: string;
  };
};

/**
 * Splice live LO + certificates into the signed FA and record component hashes.
 * Does not mutate the signed FA object in storage.
 */
export async function assembleAndRecordFacilityAgreementPackage(
  input: AssembleAndRecordFacilityAgreementPackageInput
): Promise<{ buffer: Buffer }> {
  let composed;
  try {
    composed = await composeFacilityAgreementPackage({
      signedFaPdf: input.signedFaPdf,
      letterOfOfferPdf: input.letterOfOfferPdf,
      certificatePdfs: input.certificates.map((certificate) => certificate.buffer),
      title: input.title,
    });
  } catch (error) {
    if (error instanceof FaPackageAnchorError) {
      throw new AppError(409, error.code, error.message);
    }
    throw error;
  }

  await input.db.facilityAgreementPackageEvidence.create({
    data: {
      note_id: input.evidence.noteId,
      application_id: input.evidence.applicationId,
      contract_id: input.evidence.contractId,
      invoice_id: input.evidence.invoiceId,
      assembler_version: FACILITY_AGREEMENT_PACKAGE_ASSEMBLER_VERSION,
      signed_fa_sha256: input.signedFaSha256,
      lo_template_sha256: input.loTemplateSha256,
      lo_output_sha256: input.loOutputSha256,
      certificate_ids: input.certificates.map((certificate) => certificate.id),
      certificate_hashes: input.certificates.map((certificate) => certificate.sha256),
      output_sha256: sha256Hex(composed.bytes),
      created_by_user_id: input.evidence.createdByUserId,
    },
  });

  return { buffer: composed.bytes };
}
