import { createHash } from "crypto";
import type {
  DocumentAuthorisationConfig,
  DocumentStampSource,
} from "@cashsouk/types";
import { prisma } from "../../../lib/prisma";
import { getS3ObjectBuffer } from "../../../lib/s3/client";
import { logger } from "../../../lib/logger";

export type FrozenCompanyStamp = {
  s3Key: string;
  sha256: string | null;
  contentType: string | null;
  fileName: string | null;
};

export type FrozenCertificateAuthorisation = {
  authorisedSignatoryName: string;
  companyStamp: FrozenCompanyStamp | null;
};

export type FrozenReceiptAuthorisation = {
  stampSource: DocumentStampSource;
  companyStamp: FrozenCompanyStamp | null;
};

const EMPTY_CONFIG: DocumentAuthorisationConfig = {
  authorisedSignatoryName: "",
  useSameCompanyStamp: true,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stampFieldsFrom(value: unknown): {
  s3Key: string | null;
  fileName: string | null;
  contentType: string | null;
} {
  const record = asRecord(value);
  return {
    s3Key: nonEmpty(record?.s3Key),
    fileName: nonEmpty(record?.fileName),
    contentType: nonEmpty(record?.contentType),
  };
}

function optionalStampFields(
  value: unknown
): DocumentAuthorisationConfig["certificateCompanyStamp"] {
  const fields = stampFieldsFrom(value);
  if (!fields.s3Key && !fields.fileName && !fields.contentType) return undefined;
  return {
    ...(fields.s3Key ? { s3Key: fields.s3Key } : {}),
    ...(fields.fileName ? { fileName: fields.fileName } : {}),
    ...(fields.contentType ? { contentType: fields.contentType } : {}),
  };
}

export function parseDocumentAuthorisationConfig(
  value: unknown
): DocumentAuthorisationConfig {
  const record = asRecord(value);
  if (!record) return { ...EMPTY_CONFIG };
  const useSame =
    record.useSameCompanyStamp === false
      ? false
      : record.useSameCompanyStamp === true
        ? true
        : true;
  return {
    authorisedSignatoryName: nonEmpty(record.authorisedSignatoryName) ?? "",
    useSameCompanyStamp: useSame,
    certificateCompanyStamp: optionalStampFields(record.certificateCompanyStamp),
    receiptCompanyStamp: optionalStampFields(record.receiptCompanyStamp),
  };
}

export async function loadDocumentAuthorisationConfig(): Promise<DocumentAuthorisationConfig> {
  const row = await prisma.platformFinanceSetting.findUnique({
    where: { key: "DEFAULT" },
    select: { document_authorisation_config: true },
  });
  return parseDocumentAuthorisationConfig(row?.document_authorisation_config);
}

async function freezeStamp(input: {
  s3Key: string | null;
  fileName: string | null;
  contentType: string | null;
}): Promise<FrozenCompanyStamp | null> {
  if (!input.s3Key) return null;
  try {
    const bytes = await getS3ObjectBuffer(input.s3Key);
    return {
      s3Key: input.s3Key,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      contentType: input.contentType,
      fileName: input.fileName,
    };
  } catch (error) {
    logger.warn(
      { err: error, s3Key: input.s3Key },
      "Document authorisation stamp could not be hashed at freeze time"
    );
    return {
      s3Key: input.s3Key,
      sha256: null,
      contentType: input.contentType,
      fileName: input.fileName,
    };
  }
}

export async function freezeCertificateAuthorisation(): Promise<FrozenCertificateAuthorisation> {
  const config = await loadDocumentAuthorisationConfig();
  const stamp = stampFieldsFrom(config.certificateCompanyStamp);
  return {
    authorisedSignatoryName: config.authorisedSignatoryName,
    companyStamp: await freezeStamp(stamp),
  };
}

export async function freezeReceiptAuthorisation(): Promise<FrozenReceiptAuthorisation> {
  const config = await loadDocumentAuthorisationConfig();
  const stampSource: DocumentStampSource = config.useSameCompanyStamp
    ? "SHARED_CERTIFICATE_STAMP"
    : "SEPARATE_RECEIPT_STAMP";
  const stamp =
    stampSource === "SHARED_CERTIFICATE_STAMP"
      ? stampFieldsFrom(config.certificateCompanyStamp)
      : stampFieldsFrom(config.receiptCompanyStamp);
  return {
    stampSource,
    companyStamp: await freezeStamp(stamp),
  };
}

export async function loadFrozenStampImage(
  stamp: FrozenCompanyStamp | null | undefined
): Promise<{ bytes: Buffer; contentType: string | null } | null> {
  const key = stamp?.s3Key?.trim();
  if (!key) return null;
  try {
    const bytes = await getS3ObjectBuffer(key);
    if (!bytes.length) return null;
    return { bytes, contentType: stamp?.contentType ?? null };
  } catch (error) {
    logger.warn(
      { err: error, s3Key: key },
      "Document authorisation stamp could not be loaded for rendering"
    );
    return null;
  }
}
