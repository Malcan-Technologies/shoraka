/**
 * Admin preview of merged signing-package PDFs (unsigned, wet-ink signature boxes).
 */

import * as React from "react";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useAdminSigningDocumentPreview(applicationId: string | undefined) {
  const { getAccessToken } = useAuthToken();
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);

  const openOrDownload = React.useCallback(
    async (
      documentKey: string,
      disposition: "inline" | "attachment",
      extras?: { invoiceId?: string | null }
    ) => {
      if (!applicationId) {
        toast.error("Application is required to preview this document");
        return;
      }
      try {
        setPendingKey(documentKey);
        const client = createApiClient(API_URL, getAccessToken);
        const { blob, filename } = await client.getAdminSigningDocumentPreviewBlob(
          applicationId,
          documentKey,
          {
            disposition,
            invoiceId: extras?.invoiceId ?? null,
          }
        );
        const objectUrl = URL.createObjectURL(blob);
        if (disposition === "inline") {
          window.open(objectUrl, "_blank", "noopener,noreferrer");
          window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
          return;
        }
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to preview signing document");
      } finally {
        setPendingKey(null);
      }
    },
    [applicationId, getAccessToken]
  );

  const handlePreview = React.useCallback(
    (documentKey: string, extras?: { invoiceId?: string | null }) =>
      openOrDownload(documentKey, "inline", extras),
    [openOrDownload]
  );

  const handleDownload = React.useCallback(
    (documentKey: string, extras?: { invoiceId?: string | null }) =>
      openOrDownload(documentKey, "attachment", extras),
    [openOrDownload]
  );

  return {
    previewPendingKey: pendingKey,
    handlePreview,
    handleDownload,
  };
}
