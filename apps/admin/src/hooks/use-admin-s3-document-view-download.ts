/**
 * SECTION: Admin S3 view / single-file download
 * WHY: Same behavior for application review page and resubmit comparison modal.
 * INPUT: auth from useAuthToken
 * OUTPUT: viewDocumentPending, handleViewDocument, handleDownloadDocument
 * WHERE USED: Application detail page, ResubmitComparisonModal
 */

import * as React from "react";
import { useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";

export function useAdminS3DocumentViewDownload() {
  const { getAccessToken } = useAuthToken();
  const [viewDocumentPending, setViewDocumentPending] = React.useState(false);

  const handleViewDocument = React.useCallback(
    async (s3Key: string) => {
      console.log("Admin opening S3 document in new tab, s3Key:", s3Key);
      try {
        setViewDocumentPending(true);
        const token = await getAccessToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const response = await fetch(`${apiUrl}/v1/s3/view-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ s3Key }),
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error?.message || "Failed to get view URL");
        const viewUrl = result.data?.viewUrl;
        if (viewUrl) window.open(viewUrl, "_blank", "noopener,noreferrer");
        else toast.error("Failed to open document");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to open document");
      } finally {
        setViewDocumentPending(false);
      }
    },
    [getAccessToken]
  );

  const handleDownloadDocument = React.useCallback(
    async (s3Key: string, fileName?: string) => {
      console.log("Admin downloading S3 document, s3Key:", s3Key, "fileName:", fileName);
      try {
        setViewDocumentPending(true);
        const token = await getAccessToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const response = await fetch(`${apiUrl}/v1/s3/download-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ s3Key }),
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error?.message || "Failed to get download URL");
        const downloadUrl = result.data?.downloadUrl;
        if (!downloadUrl) {
          toast.error("Failed to download document");
          return;
        }
        const fileResponse = await fetch(downloadUrl);
        if (!fileResponse.ok) {
          throw new Error("Failed to fetch file for download");
        }
        const blob = await fileResponse.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = fileName?.trim() || "document.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to download document");
      } finally {
        setViewDocumentPending(false);
      }
    },
    [getAccessToken]
  );

  return { viewDocumentPending, handleViewDocument, handleDownloadDocument };
}
