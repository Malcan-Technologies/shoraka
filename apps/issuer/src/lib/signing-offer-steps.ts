/**
 * Offer-acceptance phase helpers for the Review Offer modal stepper.
 * Step 1 is upload-only via product acceptance_documents.
 */

import type { SigningOfferStep } from "@/components/signing/signing-progress-stepper";
import {
  canDirectAcceptInvoice,
  getOfferAcceptanceFromOfferDetails,
  getOfferAcceptanceStatusPresentation,
  needsSigningEnvelope,
  offerAcceptanceAllowsSigning,
  offerAcceptanceIsAwaitingAdmin,
  offerAcceptanceIsStep1Editable,
  resolveAcceptanceDocumentsFromWorkflow,
  workflowHasAcceptanceDocuments,
  workflowUsesOfferAcceptanceFlow,
  type OfferAcceptanceStatus,
  type SigningPackageOfferKind,
} from "@cashsouk/types";

export type SigningOfferStepId =
  | "documents"
  | "awaiting_review"
  | "rejected"
  | "declined"
  | "signers"
  | "signing"
  | "complete";

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
      })),
    },
  };
}

/** True when frozen workflow has ≥1 acceptance document. */
export function hasAcceptanceDocuments(workflow: unknown): boolean {
  return workflowHasAcceptanceDocuments(workflow);
}

export function resolveOfferAcceptanceStatus(offerDetails: unknown): OfferAcceptanceStatus | null {
  return getOfferAcceptanceFromOfferDetails(offerDetails)?.status ?? null;
}

export type SigningOfferStepShellInput = {
  usesAcceptanceFlow: boolean;
  hasPostDocs: boolean;
  acceptanceStatus: OfferAcceptanceStatus | null;
};

function stepShells(input: SigningOfferStepShellInput): StepShell[] {
  const shells: StepShell[] = [];

  if (input.usesAcceptanceFlow) {
    if (offerAcceptanceIsStep1Editable(input.acceptanceStatus)) {
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

    if (input.acceptanceStatus === "REJECTED") {
      const presentation = getOfferAcceptanceStatusPresentation("REJECTED");
      shells.push({
        id: "rejected",
        label: presentation.label,
        description: presentation.hint,
      });
      return shells;
    }
    if (input.acceptanceStatus === "DECLINED") {
      const presentation = getOfferAcceptanceStatusPresentation("DECLINED");
      shells.push({
        id: "declined",
        label: presentation.label,
        description: presentation.hint,
      });
      return shells;
    }

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

export type SigningOfferStepCursorInput = SigningOfferStepShellInput & {
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
      if (input.hasPostDocs) return "documents";
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
    if (input.acceptanceStatus === "REJECTED") return "rejected";
    if (input.acceptanceStatus === "DECLINED") return "declined";
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
    if (shell.id === "awaiting_review" || shell.id === "rejected" || shell.id === "declined") {
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

export { workflowUsesOfferAcceptanceFlow };
