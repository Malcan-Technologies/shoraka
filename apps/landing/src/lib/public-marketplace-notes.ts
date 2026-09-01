import { cache } from "react";
import { createApiClient } from "@cashsouk/config/src/api-client";
import type { NoteListItem } from "@cashsouk/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const PUBLIC_MARKETPLACE_PAGE_SIZE = 100;

async function loadAllPublicMarketplaceNotes(): Promise<NoteListItem[]> {
  const apiClient = createApiClient(API_URL);
  const first = await apiClient.getPublicMarketplaceNotes({
    page: 1,
    pageSize: PUBLIC_MARKETPLACE_PAGE_SIZE,
  });
  if (!first.success) return [];

  const notes = [...first.data.notes];
  const totalPages = Math.max(1, first.data.pagination.totalPages);
  if (totalPages <= 1) return notes;

  const remaining = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      apiClient.getPublicMarketplaceNotes({
        page: index + 2,
        pageSize: PUBLIC_MARKETPLACE_PAGE_SIZE,
      })
    )
  );

  for (const page of remaining) {
    if (page.success) notes.push(...page.data.notes);
  }
  return notes;
}

/** Request-deduped public catalog. Safe to call from multiple server components. */
export const getPublicMarketplaceNotes = cache(async (): Promise<NoteListItem[]> => {
  try {
    return await loadAllPublicMarketplaceNotes();
  } catch {
    return [];
  }
});

export async function getPublicMarketplaceNotesSlice(limit: number): Promise<NoteListItem[]> {
  const notes = await getPublicMarketplaceNotes();
  if (!Number.isFinite(limit) || limit <= 0) return [];
  return notes.slice(0, Math.floor(limit));
}
