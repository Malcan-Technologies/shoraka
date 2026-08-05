/**
 * View / download signed envelope documents via resource-scoped API
 * (no client-supplied S3 keys).
 */

import * as React from "react";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useAdminSignedSigningDocument(applicationId: string | undefined) {
  const { getAccessToken } = useAuthToken();
  const [pending, setPending] = React.useState(false);

  const handleViewSignedDocument = React.useCallback(
    async (documentId: string) => {
      if (!applicationId) {
        toast.error("Application is required to open the signed document");
        return;
      }
      try {
        setPending(true);
        const client = createApiClient(API_URL, getAccessToken);
        const blob = await client.getAdminSignedSigningDocumentBlob(
          applicationId,
          documentId,
          "inline"
        );
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to open signed document");
      } finally {
        setPending(false);
      }
    },
    [applicationId, getAccessToken]
  );

  const handleDownloadSignedDocument = React.useCallback(
    async (documentId: string, fileName?: string) => {
      if (!applicationId) {
        toast.error("Application is required to download the signed document");
        return;
      }
      try {
        setPending(true);
        const client = createApiClient(API_URL, getAccessToken);
        const blob = await client.getAdminSignedSigningDocumentBlob(
          applicationId,
          documentId,
          "attachment"
        );
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = fileName?.trim() || "signed-document.pdf";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to download signed document");
      } finally {
        setPending(false);
      }
    },
    [applicationId, getAccessToken]
  );

  return {
    signedDocumentPending: pending,
    handleViewSignedDocument,
    handleDownloadSignedDocument,
  };
}
