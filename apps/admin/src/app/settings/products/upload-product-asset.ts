import { uploadFileToS3 } from "../../../hooks/use-site-documents";

/** Result from requesting a presigned upload URL (API returns uploadUrl and s3Key). */
export interface PresignedUploadResult {
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}

/**
 * Request a presigned URL, upload the file to S3, and return the s3Key.
 * Path: products/{productId}/{date}-{version}-{cuid}.{ext} (same pattern as site-documents).
 */
export async function uploadToS3WithPresignedUrl(
  file: File,
  requestUrl: (params: { fileName: string; contentType: string; fileSize?: number; productId: string; version: number }) => Promise<PresignedUploadResult>,
  kind: "image" | "document template",
  productId: string,
  version: number
): Promise<{ s3Key: string }> {
  try {
    const { uploadUrl, s3Key } = await requestUrl({
      fileName: file.name,
      contentType: file.type,
      fileSize: file.size,
      productId,
      version,
    });
    await uploadFileToS3(uploadUrl, file);
    return { s3Key };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`${kind === "image" ? "Image" : "Document template"} upload failed: ${message}`);
  }
}
