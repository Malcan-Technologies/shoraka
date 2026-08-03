import type { NormalizedApplication } from "../status";

export type ApplicationDocumentItem = {
  id: string;
  name: string;
  s3Key: string;
  source: string;
};

function pushDoc(
  out: ApplicationDocumentItem[],
  seen: Set<string>,
  name: string,
  s3Key: string | null | undefined,
  source: string
) {
  if (!s3Key || seen.has(s3Key)) return;
  seen.add(s3Key);
  out.push({ id: s3Key, name: name || "Document", s3Key, source });
}

function walkUnknownDocs(
  value: unknown,
  out: ApplicationDocumentItem[],
  seen: Set<string>,
  source: string,
  depth = 0
) {
  if (value == null || depth > 6) return;
  if (Array.isArray(value)) {
    for (const item of value) walkUnknownDocs(item, out, seen, source, depth + 1);
    return;
  }
  if (typeof value !== "object") return;
  const row = value as Record<string, unknown>;
  const s3Key =
    (typeof row.s3_key === "string" && row.s3_key) ||
    (typeof row.s3Key === "string" && row.s3Key) ||
    null;
  if (s3Key) {
    const name = String(
      row.file_name ?? row.fileName ?? row.name ?? row.document_name ?? "Document"
    );
    pushDoc(out, seen, name, s3Key, source);
  }
  for (const child of Object.values(row)) {
    if (child && typeof child === "object") {
      walkUnknownDocs(child, out, seen, source, depth + 1);
    }
  }
}

export function collectApplicationDocuments(
  application: NormalizedApplication,
  raw?: {
    supporting_documents?: unknown;
    financial_statements?: unknown;
    contract?: { contract_details?: Record<string, unknown> | null } | null;
  } | null
): ApplicationDocumentItem[] {
  const out: ApplicationDocumentItem[] = [];
  const seen = new Set<string>();

  if (application.signedContractOfferLetterS3Key) {
    pushDoc(
      out,
      seen,
      "Signed contract offer letter",
      application.signedContractOfferLetterS3Key,
      "Signed offer"
    );
  }

  for (const inv of application.invoices) {
    pushDoc(out, seen, inv.document || `Invoice ${inv.number}`, inv.documentS3Key, "Invoice");
    if (inv.signedOfferLetterS3Key) {
      pushDoc(
        out,
        seen,
        `Signed offer — invoice ${inv.number}`,
        inv.signedOfferLetterS3Key,
        "Signed offer"
      );
    }
  }

  if (raw?.supporting_documents) {
    walkUnknownDocs(raw.supporting_documents, out, seen, "Supporting documents");
  }
  if (raw?.financial_statements) {
    walkUnknownDocs(raw.financial_statements, out, seen, "Financial statements");
  }
  if (raw?.contract?.contract_details) {
    walkUnknownDocs(raw.contract.contract_details, out, seen, "Contract");
  }

  return out;
}
