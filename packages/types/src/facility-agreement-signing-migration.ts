import {
  FACILITY_AGREEMENT_SIGNING_DOCUMENT_KEY,
} from "./generated-documents";
import {
  SIGNING_PACKAGES_WORKFLOW_KEY,
  SIGNING_TEMPLATE_WORKFLOW_KEY,
} from "./signing-envelopes";

const LEGACY_OFFER_LETTER_KEY = "offer_letter";
const LEGACY_OFFER_LETTER_SOURCE = "GENERATED_OFFER_LETTER";
const DEFAULT_OFFER_LETTER_NAMES = new Set(["offer letter", "offer"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function rewriteOfferLetterDocument(raw: unknown): { value: unknown; changed: boolean } {
  const doc = asRecord(raw);
  if (!doc) return { value: raw, changed: false };
  const key = typeof doc.key === "string" ? doc.key : "";
  const source = typeof doc.source === "string" ? doc.source : "";
  if (key !== LEGACY_OFFER_LETTER_KEY || source !== LEGACY_OFFER_LETTER_SOURCE) {
    return { value: raw, changed: false };
  }
  const name = typeof doc.name === "string" ? doc.name.trim() : "";
  return {
    value: {
      ...doc,
      key: FACILITY_AGREEMENT_SIGNING_DOCUMENT_KEY,
      source: "TEMPLATE",
      name:
        !name || DEFAULT_OFFER_LETTER_NAMES.has(name.toLowerCase())
          ? "Facility Agreement"
          : name,
    },
    changed: true,
  };
}

function rewriteDocuments(raw: unknown): { value: unknown; changed: boolean } {
  if (!Array.isArray(raw)) return { value: raw, changed: false };
  let changed = false;
  const value = raw.map((item) => {
    const rewritten = rewriteOfferLetterDocument(item);
    if (rewritten.changed) changed = true;
    return rewritten.value;
  });
  return { value, changed };
}

function rewriteSigningTemplate(raw: unknown): { value: unknown; changed: boolean } {
  const template = asRecord(raw);
  if (!template) return { value: raw, changed: false };
  const documents = rewriteDocuments(template.documents);
  if (!documents.changed) return { value: raw, changed: false };
  return { value: { ...template, documents: documents.value }, changed: true };
}

function rewriteSigningPackages(raw: unknown): { value: unknown; changed: boolean } {
  const packages = asRecord(raw);
  if (!packages) return { value: raw, changed: false };
  if ("contract" in packages || "invoice" in packages) {
    const contract = rewriteSigningTemplate(packages.contract);
    const invoice = rewriteSigningTemplate(packages.invoice);
    if (!contract.changed && !invoice.changed) return { value: raw, changed: false };
    return {
      value: {
        ...packages,
        ...(contract.changed ? { contract: contract.value } : {}),
        ...(invoice.changed ? { invoice: invoice.value } : {}),
      },
      changed: true,
    };
  }
  return rewriteSigningTemplate(raw);
}

/**
 * Rewrite stored product workflow Offer Letter signing documents to Facility Agreement.
 * Does not flatten dual packages or touch signing envelopes.
 */
export function rewriteOfferLetterSigningDocumentsToFacilityAgreement(workflow: unknown): {
  workflow: unknown;
  changed: boolean;
} {
  if (!Array.isArray(workflow)) return { workflow, changed: false };

  let changed = false;
  const next = workflow.map((step) => {
    const rec = asRecord(step);
    const config = asRecord(rec?.config);
    if (!rec || !config) return step;

    let nextConfig = config;
    let stepChanged = false;

    if (config[SIGNING_PACKAGES_WORKFLOW_KEY] != null) {
      const rewritten = rewriteSigningPackages(config[SIGNING_PACKAGES_WORKFLOW_KEY]);
      if (rewritten.changed) {
        nextConfig = { ...nextConfig, [SIGNING_PACKAGES_WORKFLOW_KEY]: rewritten.value };
        stepChanged = true;
      }
    }

    if (config[SIGNING_TEMPLATE_WORKFLOW_KEY] != null) {
      const rewritten = rewriteSigningTemplate(config[SIGNING_TEMPLATE_WORKFLOW_KEY]);
      if (rewritten.changed) {
        nextConfig = { ...nextConfig, [SIGNING_TEMPLATE_WORKFLOW_KEY]: rewritten.value };
        stepChanged = true;
      }
    }

    if (!stepChanged) return step;
    changed = true;
    return { ...rec, config: nextConfig };
  });

  return { workflow: next, changed };
}
