"use client";

import * as React from "react";
import Link from "next/link";
import {
  LEGAL_DOCUMENT_PUBLIC_GROUPS,
  LEGAL_DOCUMENT_TYPE_LABELS,
  legalDocumentTypeToSlug,
  type LegalDocumentType,
  type PublicLegalDocumentResponse,
} from "@cashsouk/types";
import { Button } from "@cashsouk/ui";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const SECTIONS: { key: keyof typeof LEGAL_DOCUMENT_PUBLIC_GROUPS; title: string }[] = [
  { key: "general", title: "General" },
  { key: "issuer", title: "Issuer" },
  { key: "investor", title: "Investor" },
];

export default function LegalIndexPage() {
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
        if (!cancelled) setDocuments(json.data.documents ?? []);
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

  const byType = React.useMemo(() => {
    const map = new Map<LegalDocumentType, PublicLegalDocumentResponse>();
    for (const doc of documents) {
      map.set(doc.type, doc);
    }
    return map;
  }, [documents]);

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
        Published legal documents are available to read before or after you sign in. Onboarding
        acceptance still happens inside each portal after login.
      </p>

      {loading ? <p className="mt-10 text-muted-foreground">Loading…</p> : null}
      {error ? <p className="mt-10 text-destructive">{error}</p> : null}

      {!loading && !error
        ? SECTIONS.map((section) => {
            const types = LEGAL_DOCUMENT_PUBLIC_GROUPS[section.key];
            const items = types
              .map((type) => byType.get(type))
              .filter((doc): doc is PublicLegalDocumentResponse => Boolean(doc));

            if (items.length === 0) return null;

            return (
              <section key={section.key} className="mt-12">
                <h2 className="text-xl font-semibold text-foreground">{section.title}</h2>
                <ul className="mt-4 space-y-3">
                  {items.map((doc) => (
                    <li
                      key={doc.legalDocumentVersionId}
                      className="flex flex-col gap-3 border-b border-border py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-foreground">
                          {doc.title || LEGAL_DOCUMENT_TYPE_LABELS[doc.type]}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Version {doc.version}
                          {doc.published_at
                            ? ` · Published ${new Date(doc.published_at).toLocaleDateString("en-MY")}`
                            : ""}
                        </p>
                      </div>
                      <Button asChild variant="outline">
                        <Link href={`/legal/${doc.slug || legalDocumentTypeToSlug(doc.type)}`}>
                          View details
                        </Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        : null}

      {!loading && !error && documents.length === 0 ? (
        <p className="mt-10 text-muted-foreground">No published public legal documents are available yet.</p>
      ) : null}
    </main>
  );
}
