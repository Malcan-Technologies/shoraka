import type { SigningOfferStep } from "@/components/signing/signing-progress-stepper";
import {
  canDirectAcceptInvoice,
  needsSigningEnvelope,
  resolveAcceptanceDocumentsFromWorkflow,
  workflowHasAcceptanceDocuments,
  type SigningPackageOfferKind,
} from "@cashsouk/types";

export type SigningOfferStepId = "documents" | "signers" | "signing" | "complete";

/** UI mode for ReviewOfferModal: full signing stepper vs Accept/Decline-only. */
export type ReviewOfferModalMode =
  | { ui: "signing_stepper"; packageKind: SigningPackageOfferKind }
  | { ui: "accept_decline"; canAccept: boolean; blockedMessage?: string };

/**
 * Derive modal mode from offer type + invoice contract link + contract envelope state.
 * Does not consult signingTemplate.enabled — packages are always required when envelopes are needed.
 */
export function resolveReviewOfferModalMode(input: {
  offerType: "contract" | "invoice";
  /** Invoice's `contract_id` when `offerType` is `"invoice"`. */
  invoiceContractId?: string | null;
  hasCompletedContractEnvelope: boolean;
}): ReviewOfferModalMode {
  if (input.offerType === "contract") {
    return { ui: "signing_stepper", packageKind: "contract" };
  }

  if (
    needsSigningEnvelope({
      kind: "invoice",
      invoiceContractId: input.invoiceContractId,
    })
  ) {
    return { ui: "signing_stepper", packageKind: "invoice" };
  }

  if (
    canDirectAcceptInvoice({
      invoiceContractId: input.invoiceContractId,
      hasCompletedContractEnvelope: input.hasCompletedContractEnvelope,
    })
  ) {
    return { ui: "accept_decline", canAccept: true };
  }

  return {
    ui: "accept_decline",
    canAccept: false,
    blockedMessage:
      "Finish contract signing first before accepting this invoice offer.",
  };
}

/** True when a COMPLETED envelope exists for the given contract id. */
export function hasCompletedContractEnvelope(
  envelopes: Array<{ contract_id: string | null; status: string }>,
  contractId: string | null | undefined
): boolean {
  if (contractId == null || contractId === "") return false;
  return envelopes.some(
    (envelope) => envelope.contract_id === contractId && envelope.status === "COMPLETED"
  );
}

type StepShell = Omit<SigningOfferStep, "status">;

/** @deprecated Prefer resolveAcceptanceDocumentsFromWorkflow(workflow). */
export function findSupportingDocumentsStepConfig(
  workflow: unknown
): { config?: Record<string, unknown> } | undefined {
  if (!Array.isArray(workflow)) return undefined;
  return workflow.find((step) => {
    const id = String((step as { id?: unknown })?.id ?? "");
    return id === "supporting_documents" || id.startsWith("supporting_documents_");
  }) as { config?: Record<string, unknown> } | undefined;
}

/** Synthetic supporting-documents-style config for the Review Offer upload UI. */
export function buildAcceptanceDocumentsStepConfig(
  workflow: unknown
): { config: Record<string, unknown> } {
  const rows = resolveAcceptanceDocumentsFromWorkflow(workflow);
  return {
    config: {
      acceptance_documents: rows.map((row) => ({
        name: row.name,
        required: row.required,
        allow_multiple: row.allow_multiple,
        allowed_types: row.allowed_types,
        ...(row.template ? { template: row.template } : {}),
        ...(row.legacy ? { _legacy: row.legacy } : {}),
      })),
    },
  };
}

/** True when frozen workflow has ≥1 acceptance document (new config or legacy post_application). */
export function hasPostApplicationDocuments(workflow: unknown): boolean {
  return workflowHasAcceptanceDocuments(workflow);
}

function stepShells(hasPostDocs: boolean): StepShell[] {
  const shells: StepShell[] = [];
  if (hasPostDocs) {
    shells.push({
      id: "documents",
      label: "Upload documents",
      description: "Upload required documents before signing",
    });
  }
  shells.push(
    {
      id: "signers",
      label: "Configure signers",
      description: "Assign who will sign each document",
    },
    {
      id: "signing",
      label: "Document signing",
      description: "Track signing progress across all documents",
    },
    {
      id: "complete",
      label: "Complete",
      description: "All documents signed and offer accepted",
    }
  );
  return shells;
}

export function getCurrentSigningOfferStepId(input: {
  hasPostDocs: boolean;
  postDocsReady: boolean;
  signersLocked: boolean;
  allDocsSigned: boolean;
  envelopeCompleted: boolean;
}): SigningOfferStepId {
  if (input.signersLocked) {
    if (!input.allDocsSigned) return "signing";
    if (input.envelopeCompleted) return "complete";
    return "signing";
  }
  if (input.hasPostDocs && !input.postDocsReady) return "documents";
  return "signers";
}

export function getSigningOfferSteps(input: {
  hasPostDocs: boolean;
  postDocsReady: boolean;
  signersLocked: boolean;
  allDocsSigned: boolean;
  envelopeCompleted: boolean;
}): SigningOfferStep[] {
  const currentId = getCurrentSigningOfferStepId(input);
  const shells = stepShells(input.hasPostDocs);
  const currentIdx = shells.findIndex((s) => s.id === currentId);

  return shells.map((shell, idx) => {
    let status: SigningOfferStep["status"];
    if (idx < currentIdx) {
      status = "completed";
    } else if (idx === currentIdx) {
      status = "current";
    } else {
      status = "pending";
    }
    if (shell.id === "complete" && input.envelopeCompleted) {
      status = "completed";
    }
    return { ...shell, status };
  });
}

/** Index of stepId in shell order; -1 when absent (e.g. documents with hasPostDocs false). */
export function getSigningOfferStepIndex(
  stepId: string,
  hasPostDocs: boolean
): number {
  return stepShells(hasPostDocs).findIndex((s) => s.id === stepId);
}

/** Negative if a before b, 0 if equal, positive if a after b (shell order). */
export function compareSigningOfferStepOrder(
  a: string,
  b: string,
  hasPostDocs: boolean
): number {
  return getSigningOfferStepIndex(a, hasPostDocs) - getSigningOfferStepIndex(b, hasPostDocs);
}

/**
 * True when stepId is at or before the domain cursor in shell order.
 * Unknown / absent ids (e.g. documents when !hasPostDocs) are unreachable.
 */
export function isSigningOfferStepReachable(
  stepId: string,
  currentDomainStepId: SigningOfferStepId,
  hasPostDocs: boolean
): boolean {
  const stepIdx = getSigningOfferStepIndex(stepId, hasPostDocs);
  const currentIdx = getSigningOfferStepIndex(currentDomainStepId, hasPostDocs);
  if (stepIdx < 0 || currentIdx < 0) return false;
  return stepIdx <= currentIdx;
}
