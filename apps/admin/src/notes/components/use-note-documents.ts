"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { createApiClient, useAuthToken } from "@cashsouk/config";
import type { NoteDocumentCatalogItem } from "@cashsouk/types";
import { notesKeys } from "../query-keys";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function noteDocumentsKey(noteId?: string) {
  return [...notesKeys.detail(noteId), "documents"] as const;
}

async function openPdfBlobInNewTab(
  loadBlob: () => Promise<{ blob: Blob; filename: string }>,
  blockedMessage: string
) {
  const tab = window.open("about:blank", "_blank");
  if (!tab) {
    throw new Error(blockedMessage);
  }
  tab.opener = null;
  try {
    const { blob } = await loadBlob();
    const objectUrl = URL.createObjectURL(blob);
    tab.location.href = objectUrl;
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    tab.close();
    throw error;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

export function useNoteDocuments(noteId?: string) {
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);

  const catalogQuery = useQuery({
    queryKey: noteDocumentsKey(noteId),
    enabled: Boolean(noteId),
    queryFn: async () => {
      if (!noteId) throw new Error("Note ID is required");
      const response = await apiClient.getAdminNoteDocuments(noteId);
      if (!response.success) throw new Error(response.error.message);
      return response.data;
    },
  });

  const viewMutation = useMutation({
    mutationFn: async (item: NoteDocumentCatalogItem) => {
      if (!noteId) throw new Error("Note ID is required");
      await openPdfBlobInNewTab(
        () => apiClient.getAdminNoteDocumentBlob(noteId, item.id, "inline"),
        "Pop-up blocked. Allow pop-ups for this site to view the PDF."
      );
    },
  });

  const downloadMutation = useMutation({
    mutationFn: async (item: NoteDocumentCatalogItem) => {
      if (!noteId) throw new Error("Note ID is required");
      const { blob, filename } = await apiClient.getAdminNoteDocumentBlob(
        noteId,
        item.id,
        "attachment"
      );
      downloadBlob(blob, item.filename || filename);
    },
  });

  return { catalogQuery, viewMutation, downloadMutation };
}
