"use client";

import * as React from "react";
import Link from "next/link";
import {
  LEGAL_DOCUMENT_TYPE_LABELS,
  type OnboardingLegalDocumentType,
  type PublicLegalDocumentResponse,
} from "@cashsouk/types";
import { Button } from "@cashsouk/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function LegalDocumentsPage() {
  const [documents, setDocuments] = React.useState<PublicLegalDocumentResponse[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`${API_URL}/v1/public/legal-documents`);
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error?.message || "Failed to load documents");
        }
        if (!cancelled) {
          setDocuments(json.data.documents ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load documents");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const openDownload = async (id: string) => {
    const res = await fetch(`${API_URL}/v1/public/legal-documents/${id}/download`);
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error?.message || "Download unavailable");
    }
    window.open(json.data.downloadUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        {" / "}
        Legal documents
      </p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">Legal documents</h1>
      <p className="mt-3 text-[17px] leading-7 text-muted-foreground">
        Published platform legal documents. Onboarding acceptance still happens inside each portal
        after you sign in.
      </p>

      {loading ? <p className="mt-10 text-muted-foreground">Loading…</p> : null}
      {error ? <p className="mt-10 text-destructive">{error}</p> : null}

      {!loading && !error && documents.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No published legal documents are available yet.</p>
      ) : null}

      <ul className="mt-10 space-y-4">
        {documents.map((doc) => (
          <li
            key={doc.id}
            className="flex flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium text-foreground">
                {doc.title ||
                  LEGAL_DOCUMENT_TYPE_LABELS[doc.type as OnboardingLegalDocumentType] ||
                  doc.type}
              </p>
              <p className="text-sm text-muted-foreground">Version {doc.version}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void openDownload(doc.id).catch((err: unknown) => {
                  window.alert(err instanceof Error ? err.message : "Download failed");
                });
              }}
            >
              View PDF
            </Button>
          </li>
        ))}
      </ul>
    </main>
  );
}
