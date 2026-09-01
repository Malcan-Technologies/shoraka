import { createApiClient } from "@cashsouk/config/src/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const EXPIRY_SAFETY_MS = 30_000;

const viewUrlCache = new Map<string, { url: string; expiresAt: number }>();

function cachedViewUrl(noteId: string) {
  const hit = viewUrlCache.get(noteId);
  if (!hit) return null;
  if (Date.now() >= hit.expiresAt) {
    viewUrlCache.delete(noteId);
    return null;
  }
  return hit.url;
}

async function resolvePublicProspectusViewUrl(noteId: string) {
  const cached = cachedViewUrl(noteId);
  if (cached) return cached;

  const apiClient = createApiClient(API_URL);
  const res = await apiClient.getPublicMarketplaceNoteProspectus(noteId);
  if (!res.success) throw new Error(res.error.message);
  if (!res.data.pdfViewUrl) {
    throw new Error("Prospectus PDF is not available");
  }

  const ttlMs = Math.max((res.data.pdfExpiresIn ?? 0) * 1000 - EXPIRY_SAFETY_MS, 5_000);
  viewUrlCache.set(noteId, { url: res.data.pdfViewUrl, expiresAt: Date.now() + ttlMs });
  return res.data.pdfViewUrl;
}

/** Open the published prospectus PDF in a new tab. */
export async function openPublicMarketplaceProspectus(noteId: string) {
  const viewer = window.open("about:blank", "_blank");
  if (!viewer) {
    throw new Error("Pop-up blocked");
  }

  try {
    const pdfViewUrl = await resolvePublicProspectusViewUrl(noteId);
    viewer.opener = null;
    viewer.location.replace(pdfViewUrl);
  } catch (error) {
    viewer.close();
    throw error;
  }
}
