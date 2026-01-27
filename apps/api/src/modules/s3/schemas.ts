import { z } from "zod";

/**
 * Schema for requesting a presigned download URL
 */
export const requestDownloadUrlSchema = z.object({
  s3Key: z.string().min(1),
});

/**
 * Schema for requesting a presigned view URL
 */
export const requestViewUrlSchema = z.object({
  s3Key: z.string().min(1),
});

export type RequestDownloadUrlInput = z.infer<typeof requestDownloadUrlSchema>;
export type RequestViewUrlInput = z.infer<typeof requestViewUrlSchema>;
