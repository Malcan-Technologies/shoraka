"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  LEGAL_DOCUMENT_TYPE_LABELS,
  type PublicLegalDocumentResponse,
} from "@cashsouk/types";
import { Button } from "@cashsouk/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function LegalDocumentDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";
  const [document, setDocument] = React.useState<PublicLegalDocumentResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const res = await fetch(`${API_URL}/v1/public/legal-documents/${slug}`);
        const json = await res.json();
        if (res.status === 404 || json?.error?.code === "NOT_FOUND") {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!json.success) {
          throw new Error(json.error?.message || "Failed to load document");
        }
        if (!cancelled) setDocument(json.data.document);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load document");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const openPdf = async (mode: "view" | "download") => {
    if (!document) return;
    const path =
      mode === "view"
        ? `${API_URL}/v1/public/legal-documents/versions/${document.legalDocumentVersionId}/view`
        : `${API_URL}/v1/public/legal-documents/versions/${document.legalDocumentVersionId}/download`;
    const res = await fetch(path);
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || "PDF unavailable");
    }
    const url = mode === "view" ? json.data.viewUrl : json.data.downloadUrl;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (notFound) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight">Document not found</h1>
        <p className="mt-3 text-[17px] leading-7 text-muted-foreground">
          This legal document is not publicly available.
        </p>
        <Button asChild className="mt-8" variant="outline">
          <Link href="/legal">Back to legal documents</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        {" / "}
        <Link href="/legal" className="hover:text-foreground">
          Legal documents
        </Link>
        {" / "}
        {document?.title || slug}
      </p>

      {loading ? <p className="mt-10 text-muted-foreground">Loading…</p> : null}
      {error ? <p className="mt-10 text-destructive">{error}</p> : null}

      {document ? (
        <div className="mt-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {document.title || LEGAL_DOCUMENT_TYPE_LABELS[document.type]}
            </h1>
            {document.description ? (
              <p className="mt-3 text-[17px] leading-7 text-muted-foreground">
                {document.description}
              </p>
            ) : null}
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Audience</dt>
              <dd className="font-medium text-foreground">{document.audience}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Version</dt>
              <dd className="font-medium text-foreground">v{document.version}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Published</dt>
              <dd className="font-medium text-foreground">
                {document.published_at
                  ? new Date(document.published_at).toLocaleString("en-MY")
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">File</dt>
              <dd className="font-medium text-foreground">{document.file_name}</dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => {
                void openPdf("view").catch((err: unknown) => {
                  window.alert(err instanceof Error ? err.message : "Unable to open PDF");
                });
              }}
            >
              View PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void openPdf("download").catch((err: unknown) => {
                  window.alert(err instanceof Error ? err.message : "Unable to download PDF");
                });
              }}
            >
              Download PDF
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
