/**
 * Offer-acceptance phase helpers for the Review Offer modal stepper.
 * Extends the legacy signing stepper with Step 1 acknowledgements + upload.
 * Each acknowledgement document is its own stepper step (`acknowledge:<key>`).
 */

import type { SigningOfferStep } from "@/components/signing/signing-progress-stepper";
import {
  canDirectAcceptInvoice,
  getOfferAcceptanceFromOfferDetails,
  needsSigningEnvelope,
  offerAcceptanceAllowsSigning,
  offerAcceptanceIsAwaitingAdmin,
  offerAcceptanceIsStep1Editable,
  resolveOfferAcknowledgementsFromWorkflow,
  resolveAcceptanceDocumentsFromWorkflow,
  workflowHasAcceptanceDocuments,
  workflowUsesOfferAcceptanceFlow,
  type OfferAcceptanceStatus,
  type OfferAcknowledgementDocument,
  type SigningPackageOfferKind,
} from "@cashsouk/types";

const ACK_STEP_PREFIX = "acknowledge:";

export type SigningOfferStepId =
  | `acknowledge:${string}`
  | "documents"
  | "awaiting_review"
  | "signers"
  | "signing"
  | "complete";

export function acknowledgementStepId(documentKey: string): SigningOfferStepId {
  return `${ACK_STEP_PREFIX}${documentKey}`;
}

export function parseAcknowledgementStepKey(stepId: string): string | null {
  if (!stepId.startsWith(ACK_STEP_PREFIX)) return null;
  const key = stepId.slice(ACK_STEP_PREFIX.length);
  return key.length > 0 ? key : null;
}

export function isAcknowledgementStepId(stepId: string): stepId is `acknowledge:${string}` {
  return parseAcknowledgementStepKey(stepId) != null;
}

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

export type AcknowledgementStepShellInput = {
  key: string;
  name: string;
  required?: boolean;
};

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

export function getOfferAcknowledgements(workflow: unknown): OfferAcknowledgementDocument[] {
  return resolveOfferAcknowledgementsFromWorkflow(workflow);
}

export function resolveOfferAcceptanceStatus(offerDetails: unknown): OfferAcceptanceStatus | null {
  return getOfferAcceptanceFromOfferDetails(offerDetails)?.status ?? null;
}

export type SigningOfferStepShellInput = {
  usesAcceptanceFlow: boolean;
  hasPostDocs: boolean;
  acknowledgements: AcknowledgementStepShellInput[];
  acceptanceStatus: OfferAcceptanceStatus | null;
};

function stepShells(input: SigningOfferStepShellInput): StepShell[] {
  const shells: StepShell[] = [];

  if (input.usesAcceptanceFlow) {
    if (offerAcceptanceIsStep1Editable(input.acceptanceStatus)) {
      for (const doc of input.acknowledgements) {
        shells.push({
          id: acknowledgementStepId(doc.key),
          label: doc.name || "Acknowledgement",
          description: "Review and accept this document",
        });
      }
      if (input.hasPostDocs) {
        shells.push({
          id: "documents",
          label: "Upload documents",
          description: "Upload required acceptance documents",
        });
      }
      return shells;
    }

    if (offerAcceptanceIsAwaitingAdmin(input.acceptanceStatus)) {
      shells.push({
        id: "awaiting_review",
        label: "Under review",
        description: "CashSouk is reviewing your acceptance documents",
      });
      return shells;
    }

    if (offerAcceptanceAllowsSigning(input.acceptanceStatus)) {
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

    // Rejected / unknown — never fall through to legacy Configure signers.
    shells.push({
      id: "awaiting_review",
      label: "Under review",
      description: "CashSouk is reviewing your acceptance documents",
    });
    return shells;
  }

  // Legacy path: optional upload then signing in one continuous flow
  if (input.hasPostDocs) {
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

function isAckChecked(
  doc: AcknowledgementStepShellInput,
  checkedKeys: ReadonlySet<string>
): boolean {
  if (doc.required === false) return true;
  return checkedKeys.has(doc.key);
}

function firstIncompleteAcknowledgementStepId(
  acknowledgements: AcknowledgementStepShellInput[],
  checkedKeys: ReadonlySet<string>
): SigningOfferStepId | null {
  for (const doc of acknowledgements) {
    if (!isAckChecked(doc, checkedKeys)) {
      return acknowledgementStepId(doc.key);
    }
  }
  return null;
}

export type SigningOfferStepCursorInput = SigningOfferStepShellInput & {
  checkedAcknowledgementKeys: ReadonlySet<string>;
  postDocsReady: boolean;
  signersLocked: boolean;
  allDocsSigned: boolean;
  envelopeCompleted: boolean;
};

export function getCurrentSigningOfferStepId(
  input: SigningOfferStepCursorInput
): SigningOfferStepId {
  if (input.usesAcceptanceFlow) {
    if (offerAcceptanceIsStep1Editable(input.acceptanceStatus)) {
      const incompleteAck = firstIncompleteAcknowledgementStepId(
        input.acknowledgements,
        input.checkedAcknowledgementKeys
      );
      if (incompleteAck) return incompleteAck;
      if (input.hasPostDocs) return "documents";
      if (input.acknowledgements.length > 0) {
        const last = input.acknowledgements[input.acknowledgements.length - 1];
        return acknowledgementStepId(last.key);
      }
      return "documents";
    }
    if (offerAcceptanceIsAwaitingAdmin(input.acceptanceStatus)) {
      return "awaiting_review";
    }
    if (offerAcceptanceAllowsSigning(input.acceptanceStatus)) {
      if (input.signersLocked) {
        if (!input.allDocsSigned) return "signing";
        if (input.envelopeCompleted) return "complete";
        return "signing";
      }
      return "signers";
    }
    // Rejected / unknown — stay on awaiting shell; never legacy Configure signers.
    return "awaiting_review";
  }

  if (input.signersLocked) {
    if (!input.allDocsSigned) return "signing";
    if (input.envelopeCompleted) return "complete";
    return "signing";
  }
  if (input.hasPostDocs && !input.postDocsReady) return "documents";
  return "signers";
}

export function getSigningOfferSteps(input: SigningOfferStepCursorInput): SigningOfferStep[] {
  const currentId = getCurrentSigningOfferStepId(input);
  const shells = stepShells(input);
  const currentIdx = shells.findIndex((s) => s.id === currentId);

  return shells.map((shell, idx) => {
    let status: SigningOfferStep["status"];
    const ackKey = parseAcknowledgementStepKey(shell.id);
    if (ackKey) {
      const checked = input.checkedAcknowledgementKeys.has(ackKey);
      if (checked || (idx < currentIdx && currentIdx >= 0)) {
        status = "completed";
      } else if (idx === currentIdx) {
        status = "current";
      } else {
        status = "pending";
      }
    } else if (idx < currentIdx) {
      status = "completed";
    } else if (idx === currentIdx) {
      status = "current";
    } else {
      status = "pending";
    }
    if (shell.id === "complete" && input.envelopeCompleted) {
      status = "completed";
    }
    if (shell.id === "awaiting_review") {
      status = "current";
    }
    return { ...shell, status };
  });
}

/** Index of stepId in shell order; -1 when absent. */
export function getSigningOfferStepIndex(
  stepId: string,
  input: SigningOfferStepShellInput
): number {
  return stepShells(input).findIndex((s) => s.id === stepId);
}

/** Negative if a before b, 0 if equal, positive if a after b (shell order). */
export function compareSigningOfferStepOrder(
  a: string,
  b: string,
  input: SigningOfferStepShellInput
): number {
  return getSigningOfferStepIndex(a, input) - getSigningOfferStepIndex(b, input);
}

/**
 * True when stepId is at or before the domain cursor in shell order.
 * Unknown / absent ids are unreachable.
 */
export function isSigningOfferStepReachable(
  stepId: string,
  currentDomainStepId: SigningOfferStepId,
  input: SigningOfferStepShellInput
): boolean {
  const stepIdx = getSigningOfferStepIndex(stepId, input);
  const currentIdx = getSigningOfferStepIndex(currentDomainStepId, input);
  if (stepIdx < 0 || currentIdx < 0) return false;
  return stepIdx <= currentIdx;
}

/** Next step after the given acknowledgement key within Step 1 shells. */
export function getNextStepAfterAcknowledgement(
  documentKey: string,
  input: SigningOfferStepShellInput
): SigningOfferStepId | null {
  const shells = stepShells(input);
  const idx = shells.findIndex((s) => s.id === acknowledgementStepId(documentKey));
  if (idx < 0 || idx >= shells.length - 1) return null;
  return shells[idx + 1].id as SigningOfferStepId;
}

export { workflowUsesOfferAcceptanceFlow };
