import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function filenameFromContentDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = header.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

export async function downloadGeneratedDocument(input: {
  applicationId: string;
  typeKey: string;
  getAccessToken: () => Promise<string | null>;
  format?: "pdf" | "docx";
}): Promise<boolean> {
  const token = await input.getAccessToken();
  if (!token) {
    toast.error("Authentication required");
    return false;
  }

  const format = input.format ?? "pdf";
  const url = `${API_URL}/v1/applications/${input.applicationId}/generated-documents/${encodeURIComponent(
    input.typeKey
  )}?format=${format}`;

  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => null);
      const message =
        (body && typeof body === "object" && "error" in body
          ? (body as { error?: { message?: string } }).error?.message
          : null) ?? "Could not download template";
      toast.error(message);
      return false;
    }

    const blob = await resp.blob();
    const filename = filenameFromContentDisposition(
      resp.headers.get("Content-Disposition"),
      `${input.typeKey}.${format}`
    );
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    return true;
  } catch {
    toast.error("Could not download template");
    return false;
  }
}
