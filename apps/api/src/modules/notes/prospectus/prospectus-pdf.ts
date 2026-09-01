/**
 * SECTION: Generate and store Prospectus PDF from frozen approved HTML
 * WHY: Investor delivery is PDF via private S3; HTML remains the freeze source
 */

import { createHash } from "crypto";
import {
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, S3_BUCKET, S3_REGION } from "../../../lib/s3/client";
import { logger } from "../../../lib/logger";
import { AppError } from "../../../lib/http/error-handler";
import { combineProspectusPagesHtml } from "./combine-prospectus-pages-html";
import { renderProspectusHtmlToPdfBuffer } from "./render-prospectus-html-to-pdf";

export const PROSPECTUS_PDF_CONTENT_TYPE = "application/pdf";
export const PROSPECTUS_PDF_STATUS_READY = "READY";
export const PROSPECTUS_PDF_STATUS_FAILED = "FAILED";
export const PROSPECTUS_PDF_VIEW_URL_EXPIRY_SECONDS = 10 * 60;

export type ProspectusFrozenHtmlBundle = {
  page1: string;
  page2: string;
  page3: string;
  page4?: string;
  page5?: string;
};

/** Legacy publications freeze 3 pages; new publications freeze 5 (MARC appendix). */
export const PROSPECTUS_ALLOWED_PAGE_COUNTS = [3, 5] as const;

export function expectedProspectusPageCount(html: ProspectusFrozenHtmlBundle): number {
  return 3 + (html.page4 ? 1 : 0) + (html.page5 ? 1 : 0);
}

function assertAllowedProspectusPageCount(
  found: number,
  expected: number,
  kind: "HTML" | "PDF"
): void {
  if (expected !== 3 && expected !== 5) {
    throw new AppError(
      500,
      "PROSPECTUS_PDF_PAGE_COUNT",
      `Prospectus must freeze 3 pages (legacy) or 5 pages (current); HTML bundle implies ${expected}`
    );
  }
  if (found !== expected) {
    throw new AppError(
      500,
      "PROSPECTUS_PDF_PAGE_COUNT",
      `Prospectus ${kind} must contain exactly ${expected} pages (found ${found})`
    );
  }
}

export type ProspectusPdfArtifact = {
  storageBucket: string;
  storageKey: string;
  contentType: typeof PROSPECTUS_PDF_CONTENT_TYPE;
  sizeBytes: number;
  sha256: string;
  generatedAt: Date;
  generationStatus: typeof PROSPECTUS_PDF_STATUS_READY;
  snapshotHash: string;
  pageCount: number;
};

function prospectusEnvironmentSegment(): string {
  const raw =
    process.env.APP_ENV?.trim() ||
    process.env.NODE_ENV?.trim() ||
    "development";
  return raw.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

export function buildProspectusPdfObjectKey(input: {
  noteId: string;
  publicationId: string;
  snapshotHash: string;
}): string {
  const env = prospectusEnvironmentSegment();
  const hash = input.snapshotHash.replace(/[^a-fA-F0-9]/g, "").slice(0, 64) || "snapshot";
  return `prospectuses/${env}/${input.noteId}/${input.publicationId}/${hash}.pdf`;
}

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Count A4 `.page` sections in combined HTML.
 * Only `<section>` elements whose class list includes the exact token `page`
 * (not `page-header`, `page-two-issuer-grid`, etc.).
 */
export function countProspectusHtmlPages(documentHtml: string): number {
  const sectionClassRe = /<section\b[^>]*\bclass="([^"]*)"/gi;
  let count = 0;
  let match: RegExpExecArray | null;
  while ((match = sectionClassRe.exec(documentHtml)) !== null) {
    const tokens = match[1]?.split(/\s+/).filter(Boolean) ?? [];
    if (tokens.includes("page")) count += 1;
  }
  return count;
}

/**
 * Best-effort PDF page count from PDF object stream markers.
 * Used as a regression guard — HTML page count remains the authoritative layout check.
 */
export function countPdfPagesFromBuffer(pdf: Buffer): number {
  const text = pdf.toString("latin1");
  const matches = text.match(/\/Type\s*\/Page\b/g);
  return matches?.length ?? 0;
}

async function headObjectMetadata(key: string): Promise<{
  exists: boolean;
  contentLength?: number;
  checksumSha256?: string | null;
}> {
  const client = getS3Client();
  try {
    const res = await client.send(
      new HeadObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      })
    );
    return {
      exists: true,
      contentLength: res.ContentLength,
      checksumSha256: res.Metadata?.sha256 ?? null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "NotFound") {
      return { exists: false };
    }
    // Some S3 backends use 404 NotFound differently
    if (
      typeof error === "object" &&
      error &&
      "$metadata" in error &&
      (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode === 404
    ) {
      return { exists: false };
    }
    throw error;
  }
}

async function putProspectusPdfObject(input: {
  key: string;
  body: Buffer;
  publicationId: string;
  snapshotHash: string;
  sha256: string;
}): Promise<void> {
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: input.key,
      Body: input.body,
      ContentType: PROSPECTUS_PDF_CONTENT_TYPE,
      ServerSideEncryption: "AES256",
      Metadata: {
        publicationid: input.publicationId,
        snapshothash: input.snapshotHash,
        sha256: input.sha256,
      },
    })
  );
  logger.info(
    { key: input.key, size: input.body.length, sha256: input.sha256 },
    "Uploaded Prospectus PDF to S3"
  );
}

/**
 * Generate PDF from frozen HTML, upload to private S3, return immutable metadata.
 * Does not mark the Prospectus APPROVED — caller persists metadata in the same approval transaction.
 */
export async function generateAndStoreProspectusPdf(input: {
  noteId: string;
  publicationId: string;
  snapshotHash: string;
  html: ProspectusFrozenHtmlBundle;
}): Promise<ProspectusPdfArtifact> {
  const documentHtml = combineProspectusPagesHtml(input.html);
  const expectedPageCount = expectedProspectusPageCount(input.html);
  const htmlPageCount = countProspectusHtmlPages(documentHtml);
  assertAllowedProspectusPageCount(htmlPageCount, expectedPageCount, "HTML");

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderProspectusHtmlToPdfBuffer(documentHtml);
  } catch (error) {
    logger.error({ err: error, noteId: input.noteId }, "Prospectus PDF render failed");
    throw new AppError(
      500,
      "PROSPECTUS_PDF_RENDER_FAILED",
      error instanceof Error ? error.message : "Prospectus PDF render failed"
    );
  }

  const sha256 = sha256Hex(pdfBuffer);
  const pdfPageCount = countPdfPagesFromBuffer(pdfBuffer);
  assertAllowedProspectusPageCount(pdfPageCount, expectedPageCount, "PDF");

  const storageKey = buildProspectusPdfObjectKey({
    noteId: input.noteId,
    publicationId: input.publicationId,
    snapshotHash: input.snapshotHash,
  });

  const existing = await headObjectMetadata(storageKey);
  if (existing.exists) {
    if (
      existing.checksumSha256 === sha256 ||
      existing.contentLength === pdfBuffer.length
    ) {
      logger.info(
        { key: storageKey, sha256 },
        "Reusing existing Prospectus PDF object"
      );
    } else {
      throw new AppError(
        500,
        "PROSPECTUS_PDF_KEY_CONFLICT",
        "Immutable Prospectus PDF key already exists with different content"
      );
    }
  } else {
    try {
      await putProspectusPdfObject({
        key: storageKey,
        body: pdfBuffer,
        publicationId: input.publicationId,
        snapshotHash: input.snapshotHash,
        sha256,
      });
    } catch (error) {
      logger.error({ err: error, key: storageKey }, "Prospectus PDF S3 upload failed");
      throw new AppError(
        500,
        "PROSPECTUS_PDF_UPLOAD_FAILED",
        error instanceof Error ? error.message : "Prospectus PDF upload failed"
      );
    }
  }

  return {
    storageBucket: S3_BUCKET,
    storageKey,
    contentType: PROSPECTUS_PDF_CONTENT_TYPE,
    sizeBytes: pdfBuffer.length,
    sha256,
    generatedAt: new Date(),
    generationStatus: PROSPECTUS_PDF_STATUS_READY,
    snapshotHash: input.snapshotHash,
    pageCount: pdfPageCount,
  };
}

export async function generateProspectusPdfViewUrl(input: {
  storageKey: string;
  fileName: string;
  disposition?: "inline" | "attachment";
}): Promise<{ viewUrl: string; expiresIn: number }> {
  const client = getS3Client();
  const safeName = input.fileName.replace(/"/g, "");
  const disposition = input.disposition ?? "inline";
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: input.storageKey,
    ResponseContentType: PROSPECTUS_PDF_CONTENT_TYPE,
    ResponseContentDisposition: `${disposition}; filename="${safeName}"`,
  });
  const viewUrl = await getSignedUrl(client, command, {
    expiresIn: PROSPECTUS_PDF_VIEW_URL_EXPIRY_SECONDS,
  });
  return {
    viewUrl,
    expiresIn: PROSPECTUS_PDF_VIEW_URL_EXPIRY_SECONDS,
  };
}

export function prospectusPdfFileName(noteReference: string | null | undefined): string {
  const ref = (noteReference ?? "Note").replace(/[^A-Za-z0-9._-]+/g, "-");
  return `CashSouk-Prospectus-${ref}.pdf`;
}

export { S3_REGION };
