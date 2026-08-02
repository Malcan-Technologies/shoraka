"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { PublicLegalDocumentResponse } from "@cashsouk/types";
import { Button } from "@cashsouk/ui";
import {
  buildPublicLegalMetadataLine,
  publicLegalDownloadPath,
  publicLegalViewPath,
  resolvePublicLegalDescription,
  resolvePublicLegalTitle,
} from "../../../../lib/legal-document-display";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function LegalDocumentDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? "";
  const [document, setDocument] = React.useState<PublicLegalDocumentResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [busyAction, setBusyAction] = React.useState<"view" | "download" | null>(null);

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

  const title = document ? resolvePublicLegalTitle(document) : "";
  const description = document ? resolvePublicLegalDescription(document.description) : null;
  const metadataLine = document
    ? buildPublicLegalMetadataLine({
        version: document.version,
        publishedAt: document.published_at,
      })
    : "";

  const openPdf = async (mode: "view" | "download") => {
    if (!document) return;
    setBusyAction(mode);
    try {
      const path =
        mode === "view"
          ? publicLegalViewPath(document.legalDocumentVersionId, API_URL)
          : publicLegalDownloadPath(document.legalDocumentVersionId, API_URL);
      const res = await fetch(path);
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "PDF unavailable");
      }
      const url = mode === "view" ? json.data.viewUrl : json.data.downloadUrl;
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setBusyAction(null);
    }
  };

  if (notFound) {
    return (
      <main className="bg-muted/30">
        <div className="mx-auto max-w-3xl px-6 py-16 md:py-20">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Document not found</h1>
          <p className="mt-3 text-[17px] leading-7 text-muted-foreground">
            This legal document is not publicly available.
          </p>
          <Button asChild className="mt-8" variant="outline">
            <Link href="/legal">Back to legal documents</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-muted/30">
      <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <nav className="text-sm text-muted-foreground" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <li>
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href="/legal" className="hover:text-foreground">
                Legal Documents
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="truncate text-foreground">{title || "Legal document"}</li>
          </ol>
        </nav>

        {loading ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-8 shadow-sm md:p-10">
            <p className="text-muted-foreground">Loading…</p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-8 rounded-2xl border border-border bg-card p-8 shadow-sm md:p-10">
            <p className="text-destructive">{error}</p>
          </div>
        ) : null}

        {document && !loading ? (
          <article className="mt-8 rounded-2xl border border-border bg-card p-8 shadow-sm md:p-10">
            <header>
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                {title}
              </h1>
              {description ? (
                <p className="mt-4 text-[17px] leading-7 text-muted-foreground">{description}</p>
              ) : null}
              <p className="mt-5 text-sm text-muted-foreground">{metadataLine}</p>
            </header>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button
                type="button"
                className="h-12 w-full rounded-xl px-8 text-[15px] font-semibold sm:w-auto"
                disabled={busyAction !== null}
                onClick={() => {
                  void openPdf("view").catch((err: unknown) => {
                    window.alert(err instanceof Error ? err.message : "Unable to open PDF");
                  });
                }}
              >
                {busyAction === "view" ? "Opening…" : "View PDF"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-xl px-8 text-[15px] font-semibold sm:w-auto"
                disabled={busyAction !== null}
                onClick={() => {
                  void openPdf("download").catch((err: unknown) => {
                    window.alert(err instanceof Error ? err.message : "Unable to download PDF");
                  });
                }}
              >
                {busyAction === "download" ? "Preparing…" : "Download PDF"}
              </Button>
            </div>
          </article>
        ) : null}
      </div>
    </main>
  );
}
