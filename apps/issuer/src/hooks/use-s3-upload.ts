import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useRequestApplicationDocumentUploadUrl } from "./use-application-documents";

/**
 * Reusable hook for uploading files to S3
 * Returns s3_key and file_name in the format used throughout the application
 */
export function useS3Upload(applicationId: string | null) {
  const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
  const requestUploadUrl = useRequestApplicationDocumentUploadUrl();

  /**
   * Upload a single file to S3
   * Returns { s3_key, file_name } on success
   */
  const uploadFile = useCallback(
    async (file: File, fileKey: string): Promise<{ s3_key: string; file_name: string } | null> => {
      if (!applicationId) {
        toast.error("Application not found. Please refresh the page.");
        return null;
      }

      // Set uploading state
      setUploadingFiles((prev) => new Set(prev).add(fileKey));

      try {
        // Get content type from file
        const contentType = file.type || "application/octet-stream";

        // Request presigned upload URL from API
        const uploadUrlData = await requestUploadUrl.mutateAsync({
          applicationId,
          input: {
            fileName: file.name,
            contentType,
            fileSize: file.size,
          },
        });

        // Upload file to S3 using presigned URL
        const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": contentType,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file to S3");
        }

        // Return the data in the standard format
        return {
          s3_key: uploadUrlData.s3Key,
          file_name: file.name,
        };
      } catch (error) {
        console.error(`Upload error for ${fileKey}:`, error);
        toast.error("Failed to upload file", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
        return null;
      } finally {
        // Remove uploading state
        setUploadingFiles((prev) => {
          const newSet = new Set(prev);
          newSet.delete(fileKey);
          return newSet;
        });
      }
    },
    [applicationId, requestUploadUrl]
  );

  /**
   * Upload multiple files to S3
   * Returns a map of fileKey -> { s3_key, file_name }
   */
  const uploadFiles = useCallback(
    async (
      files: Map<string, File>
    ): Promise<Map<string, { s3_key: string; file_name: string }>> => {
      const results = new Map<string, { s3_key: string; file_name: string }>();

      const uploadPromises = Array.from(files.entries()).map(async ([fileKey, file]) => {
        const result = await uploadFile(file, fileKey);
        if (result) {
          results.set(fileKey, result);
        }
        return { fileKey, success: !!result };
      });

      const uploadResults = await Promise.all(uploadPromises);
      const failed = uploadResults.filter((r) => !r.success);

      if (failed.length > 0) {
        toast.error(`${failed.length} file(s) failed to upload`);
      } else if (results.size > 0) {
        toast.success("All files uploaded successfully");
      }

      return results;
    },
    [uploadFile]
  );

  return {
    uploadFile,
    uploadFiles,
    uploadingFiles,
    isUploading: (fileKey: string) => uploadingFiles.has(fileKey),
  };
}
