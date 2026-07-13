import type { SigningOfferStep } from "@/components/signing/signing-progress-stepper";

export type SigningOfferStepId = "documents" | "signers" | "signing" | "complete";

type StepShell = Omit<SigningOfferStep, "status">;

/** Locate supporting_documents step on a frozen product workflow array. */
export function findSupportingDocumentsStepConfig(
  workflow: unknown
): { config?: Record<string, unknown> } | undefined {
  if (!Array.isArray(workflow)) return undefined;
  return workflow.find((step) => {
    const id = String((step as { id?: unknown })?.id ?? "");
    return id === "supporting_documents" || id.startsWith("supporting_documents_");
  }) as { config?: Record<string, unknown> } | undefined;
}

/** True only when frozen supporting_documents config has ≥1 post_application row. */
export function hasPostApplicationDocuments(
  stepConfig: { config?: Record<string, unknown> } | undefined
): boolean {
  const config = stepConfig?.config;
  if (!config || typeof config !== "object") return false;
  return Object.entries(config).some(([key, value]) => {
    if (key === "enabled_categories" || !Array.isArray(value)) return false;
    return value.some((row) => {
      const timing =
        row && typeof row === "object"
          ? (row as Record<string, unknown>).upload_timing
          : undefined;
      return timing === "post_application";
    });
  });
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
